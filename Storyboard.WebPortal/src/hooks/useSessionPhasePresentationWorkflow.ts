import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  HostCommandPresentationCueText,
  HostSessionDataEnvelope
} from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import type { ResolvedTextPresentationCue } from "../gameRenderer/presentationCue/resolveMovementCueDuration";
import {
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  isPresentationCategoryEnabled,
  type PresentationIsolationSettings
} from "../gameRenderer/presentationIsolation";
import type { SessionOutputLineSource } from "./useSessionEchoWorkflow";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

export interface HudOverlayEntry {
  id: string;
  text: string;
  titleText?: string;
  bodyText?: string;
  cueEffectKey: string;
  isManualDismiss: boolean;
  scrollMode: "none" | "auto" | "manual";
  scrollSpeedPxPerSec: number;
  layoutMode: "edge-card" | "fullscreen";
  backdropMode: "dim" | "solid";
  backdropOpacity: number;
  panelOpacity: number;
  panelBorderThicknessPx: number;
  titleFontSizePx?: number;
  bodyFontSizePx?: number;
  transitionStyle: "none" | "fade";
  motionInMs: number;
  motionOutMs: number;
}

type SessionAttachReason = "session-start" | "session-join" | "session-reconnect";

interface UseSessionPhasePresentationWorkflowOptions {
  activeSessionId: string;
  presentationIsolationSettings?: PresentationIsolationSettings;
  addDiagnostic: AddDiagnostic;
  appendSessionOutputLines: (lines: string[], source: SessionOutputLineSource) => void;
  resolveTextPresentationCue: (step: HostCommandPresentationCueText) => ResolvedTextPresentationCue | null;
}

interface UseSessionPhasePresentationWorkflowResult {
  hudOverlayEntries: HudOverlayEntry[];
  consumeSessionDeltaPhasePresentation: (sessionData: HostSessionDataEnvelope) => void;
  dismissHudOverlay: () => void;
  resetPhasePresentationForSessionAttach: (reason: SessionAttachReason, targetSessionId: string) => void;
  clearPhasePresentationState: () => void;
}

const DEFAULT_HUD_OVERLAY_DURATION_MS = 2500;

interface PendingHudOverlayCue {
  text: string;
  effectKey: string;
  cue: ResolvedTextPresentationCue;
  step: HostCommandPresentationCueText;
}

function buildPhaseStepText(step: HostCommandPresentationCueText): string {
  const title = (step.titleText ?? "").trim();
  const body = (step.bodyText ?? "").trim();

  if (title && body && title !== body) {
    return `${title}\n\n${body}`;
  }

  if (title) {
    return title;
  }

  if (body) {
    return body;
  }

  return "";
}

function normalizeMotionDurationMs(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function normalizeOptionalFiniteNonNegative(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Number(value);
  return normalized >= 0 ? normalized : undefined;
}

function normalizeBackdropOpacity(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function normalizePanelOpacity(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0.95;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function normalizePanelBorderThicknessPx(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.max(0, Number(value));
}

function normalizeScrollMode(value: "none" | "auto" | "manual" | undefined): "none" | "auto" | "manual" {
  return value ?? "none";
}

function normalizeScrollSpeedPxPerSec(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(1, Number(value));
}

function buildPhasePresentationSignature(sessionData: HostSessionDataEnvelope): string {
  const watermark = sessionData.sessionDeltaWatermark.trim();
  const stepsSource = sessionData.orderedTextPresentationSteps.length > 0
    ? sessionData.orderedTextPresentationSteps
    : (sessionData.phaseChange ? sessionData.phaseChange.orderedTextPresentationSteps ?? [] : []);
  if (stepsSource.length === 0) {
    return `${watermark}|none`;
  }

  const steps = stepsSource.map((step) => {
    return [
      step.titleText ?? "",
      step.bodyText ?? "",
      step.effectKey ?? step.presentationCueEffectKey ?? ""
    ].join("|");
  });

  return [
    watermark,
    ...steps
  ].join("::");
}

export function useSessionPhasePresentationWorkflow(
  options: UseSessionPhasePresentationWorkflowOptions
): UseSessionPhasePresentationWorkflowResult {
  const [hudOverlayEntries, setHudOverlayEntries] = useState<HudOverlayEntry[]>([]);
  const pendingOverlayQueueRef = useRef<PendingHudOverlayCue[]>([]);
  const activeManualDismissIdRef = useRef<string>("");
  const activeMotionOutMsRef = useRef<number>(0);
  const activeTransitionStyleRef = useRef<"none" | "fade">("none");
  const activeTimerRef = useRef<number | null>(null);
  const overlaySequenceRef = useRef<number>(0);
  const lastWatermarkRef = useRef<string>("");
  const lastSignatureRef = useRef<string>("");
  const isolationSettings = options.presentationIsolationSettings ?? DEFAULT_PRESENTATION_ISOLATION_SETTINGS;

  const clearActiveOverlayTimer = useCallback((): void => {
    if (activeTimerRef.current !== null) {
      window.clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }
  }, []);

  const showNextHudOverlayCue = useCallback((): void => {
    clearActiveOverlayTimer();

    const nextCue = pendingOverlayQueueRef.current.shift();
    if (!nextCue) {
      activeManualDismissIdRef.current = "";
      activeMotionOutMsRef.current = 0;
      activeTransitionStyleRef.current = "none";
      setHudOverlayEntries([]);
      return;
    }

    overlaySequenceRef.current += 1;
    const nextId = `hud-${Date.now()}-${overlaySequenceRef.current}`;

    const durationMs = nextCue.cue.durationMs === undefined
      ? DEFAULT_HUD_OVERLAY_DURATION_MS
      : Math.round(nextCue.cue.durationMs);

    const isManualDismiss = nextCue.cue.isManualDismiss || durationMs <= 0;
    activeManualDismissIdRef.current = isManualDismiss ? nextId : "";
    const transitionStyle = nextCue.cue.transitionStyle ?? "none";
    const motionOutMs = normalizeMotionDurationMs(nextCue.cue.motionOutMs);
    activeTransitionStyleRef.current = transitionStyle;
    activeMotionOutMsRef.current = motionOutMs;

    setHudOverlayEntries([
      {
        id: nextId,
        text: nextCue.text,
        titleText: (nextCue.step.titleText ?? "").trim() || undefined,
        bodyText: (nextCue.step.bodyText ?? "").trim() || undefined,
        cueEffectKey: nextCue.effectKey,
        isManualDismiss,
        scrollMode: normalizeScrollMode(nextCue.cue.scrollMode),
        scrollSpeedPxPerSec: normalizeScrollSpeedPxPerSec(nextCue.cue.scrollSpeedPxPerSec),
        layoutMode: nextCue.cue.layoutMode ?? "edge-card",
        backdropMode: nextCue.cue.backdropMode ?? "dim",
        backdropOpacity: normalizeBackdropOpacity(nextCue.cue.backdropOpacity),
        panelOpacity: normalizePanelOpacity(nextCue.cue.panelOpacity),
        panelBorderThicknessPx: normalizePanelBorderThicknessPx(nextCue.cue.panelBorderThicknessPx),
        titleFontSizePx: normalizeOptionalFiniteNonNegative(nextCue.cue.titleFontSizePx),
        bodyFontSizePx: normalizeOptionalFiniteNonNegative(nextCue.cue.bodyFontSizePx),
        transitionStyle,
        motionInMs: normalizeMotionDurationMs(nextCue.cue.motionInMs),
        motionOutMs
      }
    ]);

    if (isManualDismiss) {
      return;
    }

    activeTimerRef.current = window.setTimeout(() => {
      setHudOverlayEntries((current) => current.filter((entry) => entry.id !== nextId));
      const advanceDelayMs = activeTransitionStyleRef.current === "fade"
        ? activeMotionOutMsRef.current
        : 0;

      if (advanceDelayMs > 0) {
        activeTimerRef.current = window.setTimeout(() => {
          showNextHudOverlayCue();
        }, advanceDelayMs);
        return;
      }

      showNextHudOverlayCue();
    }, durationMs);
  }, [clearActiveOverlayTimer]);

  const clearPhasePresentationState = useCallback((): void => {
    clearActiveOverlayTimer();
    pendingOverlayQueueRef.current = [];
    activeManualDismissIdRef.current = "";
    activeMotionOutMsRef.current = 0;
    activeTransitionStyleRef.current = "none";
    setHudOverlayEntries([]);
    lastWatermarkRef.current = "";
    lastSignatureRef.current = "";
  }, [clearActiveOverlayTimer]);

  useEffect(() => {
    return () => {
      clearActiveOverlayTimer();
    };
  }, [clearActiveOverlayTimer]);

  useEffect(() => {
    if (isPresentationCategoryEnabled(isolationSettings, "text")) {
      return;
    }

    clearActiveOverlayTimer();
    pendingOverlayQueueRef.current = [];
    activeManualDismissIdRef.current = "";
    activeMotionOutMsRef.current = 0;
    activeTransitionStyleRef.current = "none";
    setHudOverlayEntries([]);
  }, [clearActiveOverlayTimer, isolationSettings]);

  const dismissHudOverlay = useCallback((): void => {
    const activeManualDismissId = activeManualDismissIdRef.current;
    if (!activeManualDismissId) {
      return;
    }

    activeManualDismissIdRef.current = "";
    setHudOverlayEntries((current) => current.filter((entry) => entry.id !== activeManualDismissId));
    const advanceDelayMs = activeTransitionStyleRef.current === "fade"
      ? activeMotionOutMsRef.current
      : 0;
    if (advanceDelayMs > 0) {
      activeTimerRef.current = window.setTimeout(() => {
        showNextHudOverlayCue();
      }, advanceDelayMs);
      return;
    }

    showNextHudOverlayCue();
  }, [showNextHudOverlayCue]);

  const consumeSessionDeltaPhasePresentation = useCallback((sessionData: HostSessionDataEnvelope): void => {
    const orderedSteps = sessionData.orderedTextPresentationSteps.length > 0
      ? sessionData.orderedTextPresentationSteps
      : (sessionData.phaseChange ? sessionData.phaseChange.orderedTextPresentationSteps ?? [] : []);

    if (orderedSteps.length === 0) {
      return;
    }

    const signature = buildPhasePresentationSignature(sessionData);
    const watermark = sessionData.sessionDeltaWatermark.trim();

    if (watermark && watermark === lastWatermarkRef.current) {
      return;
    }

    if (!watermark && signature === lastSignatureRef.current) {
      return;
    }

    const pendingOverlays: PendingHudOverlayCue[] = [];
    let suppressedTextPresentationCount = 0;

    for (const step of orderedSteps) {
      const text = buildPhaseStepText(step);
      if (!text) {
        continue;
      }

      const effectKey = (step.effectKey ?? step.presentationCueEffectKey ?? "").trim();
      if (!effectKey) {
        continue;
      }

      const resolvedCue = options.resolveTextPresentationCue(step);
      if (!resolvedCue) {
        continue;
      }

      const textPresentationEnabled = isPresentationCategoryEnabled(isolationSettings, "text");
      if (resolvedCue.target === "echo" || resolvedCue.target === "narrative-dialog") {
        if (!textPresentationEnabled) {
          suppressedTextPresentationCount += 1;
        } else {
          options.appendSessionOutputLines([text], "phase-step");
        }
        continue;
      }

      if (!textPresentationEnabled) {
        suppressedTextPresentationCount += 1;
        continue;
      }

      if (resolvedCue.target === "hud-overlay") {
        pendingOverlays.push({
          text,
          effectKey,
          cue: resolvedCue,
          step
        });
      }
    }

    if (pendingOverlays.length > 0) {
      pendingOverlayQueueRef.current.push(...pendingOverlays);
      if (hudOverlayEntries.length === 0 && activeTimerRef.current === null && !activeManualDismissIdRef.current) {
        showNextHudOverlayCue();
      }
    }

    if (watermark) {
      lastWatermarkRef.current = watermark;
    }

    lastSignatureRef.current = signature;

    options.addDiagnostic("info", "presentation-cues", "Applied ordered phase text presentation steps.", {
      stepCount: orderedSteps.length,
      hudOverlayEnqueuedCount: pendingOverlays.length,
      textPresentationSuppressedCount: suppressedTextPresentationCount,
      textPresentationEnabled: isPresentationCategoryEnabled(isolationSettings, "text"),
      watermark: watermark || "(none)",
      activeSessionId: options.activeSessionId || "(none)"
    });
  }, [hudOverlayEntries.length, options, showNextHudOverlayCue]);

  const resetPhasePresentationForSessionAttach = useCallback((reason: SessionAttachReason, targetSessionId: string): void => {
    clearPhasePresentationState();

    options.addDiagnostic("info", "presentation-cues", "Session attach reset phase presentation state.", {
      reason,
      targetSessionId,
      activeSessionId: options.activeSessionId || "(none)"
    });
  }, [clearPhasePresentationState, options]);

  return useMemo(() => {
    return {
      hudOverlayEntries,
      consumeSessionDeltaPhasePresentation,
      dismissHudOverlay,
      resetPhasePresentationForSessionAttach,
      clearPhasePresentationState
    };
  }, [
    hudOverlayEntries,
    consumeSessionDeltaPhasePresentation,
    dismissHudOverlay,
    resetPhasePresentationForSessionAttach,
    clearPhasePresentationState
  ]);
}
