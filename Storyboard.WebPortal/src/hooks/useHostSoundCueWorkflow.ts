import { useEffect, useRef, useState } from "react";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { HostApiClient } from "../hostApi/client";
import type { HostCommandSoundCue, HostSessionDataEnvelope } from "../hostApi/HostContracts";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface ActiveCuePlayback {
  cue: HostCommandSoundCue;
  audio: HTMLAudioElement;
  laneAndKey: string;
  acceptedAtMs: number;
  scheduledStartAtMs: number;
  actualStartAtMs: number | null;
  startedAtMs: number;
  startTimeoutId: number | null;
  stopTimeoutId: number | null;
  repeatTimeoutId: number | null;
  repeatIterationsCompleted: number;
  canceled: boolean;
  baseVolume: number;
  fadeIntervalId: number | null;
}

interface UseHostSoundCueWorkflowOptions {
  hostApiClient: HostApiClient;
  credentialHandle: string;
  activeSessionId: string;
  selectedGameId: string;
  selectedGameKey: string;
  audioUnlockRequired: boolean;
  audioLanes: {
    sfx: {
      muted: boolean;
      volumePercent: number;
    };
    ambient: {
      muted: boolean;
      volumePercent: number;
    };
  };
  addDiagnostic: AddDiagnostic;
}

export interface HostSoundCueWorkflowStatus {
  isAudioUnlocked: boolean;
  pendingUnlockCueCount: number;
  autoplayBlockedCount: number;
}

interface UseHostSoundCueWorkflowResult {
  consumeSessionDeltaSoundCues: (sessionData: HostSessionDataEnvelope) => void;
  clearActiveSoundCues: () => void;
  requestAudioUnlock: () => void;
  soundCueStatus: HostSoundCueWorkflowStatus;
}

const DEDUPE_KEY_LIMIT = 2000;
const PENDING_UNLOCK_QUEUE_LIMIT = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNonNegativeInt(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value ?? 0));
}

function buildLaneAndKey(cue: HostCommandSoundCue): string {
  return `${cue.soundEffectLane}|${cue.soundEffectKey}`.toLowerCase();
}

function buildCueDedupeKey(watermark: string, cue: HostCommandSoundCue): string {
  const normalizedWatermark = watermark.trim() || "(none)";
  return [
    normalizedWatermark,
    cue.operation,
    String(cue.commandCorrelationId),
    String(cue.sequenceIndex),
    cue.playRequestInstanceId ?? "(none)",
    cue.soundEffectLane,
    cue.soundEffectKey
  ].join("|");
}

function resolveBaseVolume(baseVolumeDb: number | undefined): number {
  if (!Number.isFinite(baseVolumeDb)) {
    return 1;
  }

  const linear = Math.pow(10, Number(baseVolumeDb) / 20);
  return clamp(linear, 0, 1);
}

function isAutoplayBlockedError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  return err.name === "NotAllowedError";
}

function normalizeLaneVolumePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return clamp(Math.round(value), 0, 100);
}

function buildCueTraceKey(cue: HostCommandSoundCue): string {
  return `${cue.commandCorrelationId}:${cue.actionId}:${cue.sequenceIndex}:${cue.soundEffectLane}:${cue.soundEffectKey}`;
}

export function useHostSoundCueWorkflow(options: UseHostSoundCueWorkflowOptions): UseHostSoundCueWorkflowResult {
  const activeByInstanceIdRef = useRef<Map<string, ActiveCuePlayback>>(new Map());
  const activeByLaneAndKeyRef = useRef<Map<string, ActiveCuePlayback>>(new Map());
  const seenCueKeysRef = useRef<Set<string>>(new Set());
  const seenCueKeyQueueRef = useRef<string[]>([]);
  const pendingUnlockPlayQueueRef = useRef<HostCommandSoundCue[]>([]);
  const isAudioUnlockedRef = useRef<boolean>(!options.audioUnlockRequired);
  const autoplayBlockedCountRef = useRef<number>(0);

  const [soundCueStatus, setSoundCueStatus] = useState<HostSoundCueWorkflowStatus>(() => ({
    isAudioUnlocked: !options.audioUnlockRequired,
    pendingUnlockCueCount: 0,
    autoplayBlockedCount: 0
  }));

  function publishStatus(): void {
    setSoundCueStatus({
      isAudioUnlocked: isAudioUnlockedRef.current,
      pendingUnlockCueCount: pendingUnlockPlayQueueRef.current.length,
      autoplayBlockedCount: autoplayBlockedCountRef.current
    });
  }

  function clearPlaybackTimers(playback: ActiveCuePlayback): void {
    if (playback.startTimeoutId !== null) {
      window.clearTimeout(playback.startTimeoutId);
      playback.startTimeoutId = null;
    }

    if (playback.stopTimeoutId !== null) {
      window.clearTimeout(playback.stopTimeoutId);
      playback.stopTimeoutId = null;
    }

    if (playback.repeatTimeoutId !== null) {
      window.clearTimeout(playback.repeatTimeoutId);
      playback.repeatTimeoutId = null;
    }

    if (playback.fadeIntervalId !== null) {
      window.clearInterval(playback.fadeIntervalId);
      playback.fadeIntervalId = null;
    }
  }

  function unregisterPlayback(playback: ActiveCuePlayback): void {
    const instanceId = playback.cue.playRequestInstanceId?.trim();
    if (instanceId) {
      activeByInstanceIdRef.current.delete(instanceId);
    }

    const laneCurrent = activeByLaneAndKeyRef.current.get(playback.laneAndKey);
    if (laneCurrent === playback) {
      activeByLaneAndKeyRef.current.delete(playback.laneAndKey);
    }
  }

  function resolveLaneMultiplier(cue: HostCommandSoundCue): number {
    const laneSettings = cue.soundEffectLane === "Ambient"
      ? options.audioLanes.ambient
      : options.audioLanes.sfx;

    if (laneSettings.muted) {
      return 0;
    }

    return normalizeLaneVolumePercent(laneSettings.volumePercent) / 100;
  }

  function rampVolume(
    playback: ActiveCuePlayback,
    from: number,
    to: number,
    durationMs: number,
    onComplete: () => void
  ): void {
    const clampedFrom = clamp(from, 0, 1);
    const clampedTo = clamp(to, 0, 1);
    const fadeDurationMs = toNonNegativeInt(durationMs);
    if (fadeDurationMs <= 0 || Math.abs(clampedFrom - clampedTo) < 0.0001) {
      playback.audio.volume = clampedTo;
      onComplete();
      return;
    }

    const stepMs = 50;
    const startedAt = Date.now();
    playback.audio.volume = clampedFrom;
    playback.fadeIntervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const progress = clamp(elapsedMs / fadeDurationMs, 0, 1);
      playback.audio.volume = clampedFrom + (clampedTo - clampedFrom) * progress;
      if (progress >= 1) {
        if (playback.fadeIntervalId !== null) {
          window.clearInterval(playback.fadeIntervalId);
          playback.fadeIntervalId = null;
        }
        onComplete();
      }
    }, stepMs);
  }

  function stopPlayback(playback: ActiveCuePlayback, reason: string): void {
    if (playback.canceled) {
      return;
    }

    playback.canceled = true;
    clearPlaybackTimers(playback);

    const finalizeStop = (): void => {
      const stoppedAtMs = Date.now();
      const actualElapsedMs = playback.actualStartAtMs === null
        ? 0
        : Math.max(0, stoppedAtMs - playback.actualStartAtMs);

      try {
        playback.audio.pause();
        playback.audio.currentTime = 0;
      } catch {
        // No-op: media teardown should not fail workflow execution.
      }

      unregisterPlayback(playback);

      options.addDiagnostic("info", "session-audio", "Stopped sound cue playback.", {
        reason,
        operation: playback.cue.operation,
        soundEffectKey: playback.cue.soundEffectKey,
        lane: playback.cue.soundEffectLane,
        playRequestInstanceId: playback.cue.playRequestInstanceId ?? "(none)",
        repeatMode: playback.cue.repeatMode
      });

      options.addDiagnostic("info", "timing-sync", "Sound cue playback stopped.", {
        traceKey: buildCueTraceKey(playback.cue),
        reason,
        commandCorrelationId: playback.cue.commandCorrelationId,
        actionId: playback.cue.actionId,
        sequenceIndex: playback.cue.sequenceIndex,
        lane: playback.cue.soundEffectLane,
        soundEffectKey: playback.cue.soundEffectKey,
        acceptedAtMs: playback.acceptedAtMs,
        scheduledStartAtMs: playback.scheduledStartAtMs,
        actualStartAtMs: playback.actualStartAtMs,
        stoppedAtMs,
        actualElapsedMs,
        maxPlayDurationMs: playback.cue.maxPlayDurationMs ?? null,
        repeatMode: playback.cue.repeatMode
      });
    };

    const fadeOutMs = toNonNegativeInt(playback.cue.fadeOutMs);
    if (fadeOutMs > 0 && playback.audio.volume > 0) {
      rampVolume(playback, playback.audio.volume, 0, fadeOutMs, finalizeStop);
      return;
    }

    finalizeStop();
  }

  function clearActiveSoundCues(): void {
    const uniquePlaybacks = new Set<ActiveCuePlayback>([
      ...activeByInstanceIdRef.current.values(),
      ...activeByLaneAndKeyRef.current.values()
    ]);

    for (const playback of uniquePlaybacks) {
      stopPlayback(playback, "clear-all");
    }

    activeByInstanceIdRef.current.clear();
    activeByLaneAndKeyRef.current.clear();
  }

  function trackCueDedupKey(dedupeKey: string): void {
    if (seenCueKeysRef.current.has(dedupeKey)) {
      return;
    }

    seenCueKeysRef.current.add(dedupeKey);
    seenCueKeyQueueRef.current.push(dedupeKey);

    while (seenCueKeyQueueRef.current.length > DEDUPE_KEY_LIMIT) {
      const oldest = seenCueKeyQueueRef.current.shift();
      if (oldest) {
        seenCueKeysRef.current.delete(oldest);
      }
    }
  }

  function queueCueForUnlockReplay(cue: HostCommandSoundCue): void {
    pendingUnlockPlayQueueRef.current.push(cue);
    while (pendingUnlockPlayQueueRef.current.length > PENDING_UNLOCK_QUEUE_LIMIT) {
      pendingUnlockPlayQueueRef.current.shift();
    }
    publishStatus();
  }

  function handleAutoplayBlocked(cue: HostCommandSoundCue, reason: string): void {
    queueCueForUnlockReplay(cue);
    autoplayBlockedCountRef.current += 1;
    publishStatus();

    options.addDiagnostic("warn", "session-audio", "Sound cue blocked by browser autoplay policy; queued for unlock retry.", {
      reason,
      soundEffectKey: cue.soundEffectKey,
      lane: cue.soundEffectLane,
      playRequestInstanceId: cue.playRequestInstanceId ?? "(none)",
      pendingUnlockCueCount: pendingUnlockPlayQueueRef.current.length
    });
  }

  function scheduleRepeat(playback: ActiveCuePlayback): void {
    if (playback.canceled) {
      return;
    }

    const cue = playback.cue;
    if (cue.repeatMode === "None" || cue.repeatMode === "UntilCanceled") {
      return;
    }

    if (cue.repeatMode === "RepeatCount") {
      const repeatCount = toNonNegativeInt(cue.repeatCount);
      if (repeatCount <= 0 || playback.repeatIterationsCompleted >= repeatCount) {
        stopPlayback(playback, "repeat-count-complete");
        return;
      }
    }

    if (cue.repeatMode === "RepeatForDuration") {
      const repeatDurationMs = toNonNegativeInt(cue.repeatDurationMs);
      if (repeatDurationMs <= 0 || (Date.now() - playback.startedAtMs) >= repeatDurationMs) {
        stopPlayback(playback, "repeat-duration-complete");
        return;
      }
    }

    const repeatDelayMs = toNonNegativeInt(cue.repeatIntervalMs) + toNonNegativeInt(cue.repeatCooldownMs);
    playback.repeatTimeoutId = window.setTimeout(async () => {
      playback.repeatTimeoutId = null;
      if (playback.canceled) {
        return;
      }

      playback.repeatIterationsCompleted += 1;
      playback.audio.currentTime = 0;
      try {
        playback.audio.volume = playback.baseVolume * resolveLaneMultiplier(cue);
        await playback.audio.play();
      } catch (err) {
        if (isAutoplayBlockedError(err) && options.audioUnlockRequired && !isAudioUnlockedRef.current) {
          handleAutoplayBlocked(cue, "repeat-autoplay-blocked");
          stopPlayback(playback, "repeat-autoplay-blocked");
          return;
        }

        stopPlayback(playback, "repeat-play-failed");
        options.addDiagnostic("warn", "session-audio", "Failed to start repeated sound cue playback.", {
          message: err instanceof Error ? err.message : String(err),
          soundEffectKey: cue.soundEffectKey,
          playRequestInstanceId: cue.playRequestInstanceId ?? "(none)",
          repeatMode: cue.repeatMode
        });
      }
    }, repeatDelayMs);
  }

  async function startPlayback(playback: ActiveCuePlayback): Promise<void> {
    if (playback.canceled) {
      return;
    }

    playback.audio.onended = () => {
      scheduleRepeat(playback);
    };

    const maxPlayDurationMs = toNonNegativeInt(playback.cue.maxPlayDurationMs);
    if (maxPlayDurationMs > 0) {
      playback.stopTimeoutId = window.setTimeout(() => {
        playback.stopTimeoutId = null;
        stopPlayback(playback, "max-play-duration");
      }, maxPlayDurationMs);
    }

    try {
      playback.audio.volume = playback.baseVolume * resolveLaneMultiplier(playback.cue);
      await playback.audio.play();
      playback.actualStartAtMs = Date.now();

      options.addDiagnostic("info", "timing-sync", "Sound cue playback started.", {
        traceKey: buildCueTraceKey(playback.cue),
        commandCorrelationId: playback.cue.commandCorrelationId,
        actionId: playback.cue.actionId,
        sequenceIndex: playback.cue.sequenceIndex,
        lane: playback.cue.soundEffectLane,
        soundEffectKey: playback.cue.soundEffectKey,
        acceptedAtMs: playback.acceptedAtMs,
        scheduledStartAtMs: playback.scheduledStartAtMs,
        actualStartAtMs: playback.actualStartAtMs,
        scheduledDelayMs: Math.max(0, playback.scheduledStartAtMs - playback.acceptedAtMs),
        startDriftMs: playback.actualStartAtMs - playback.scheduledStartAtMs,
        maxPlayDurationMs: playback.cue.maxPlayDurationMs ?? null
      });

      if (!isAudioUnlockedRef.current) {
        isAudioUnlockedRef.current = true;
        publishStatus();
      }

      const fadeInMs = toNonNegativeInt(playback.cue.fadeInMs);
      if (fadeInMs > 0 && playback.baseVolume > 0) {
        rampVolume(playback, 0, playback.baseVolume * resolveLaneMultiplier(playback.cue), fadeInMs, () => {
          // Volume ramp completed.
        });
      }
    } catch (err) {
      if (isAutoplayBlockedError(err) && options.audioUnlockRequired && !isAudioUnlockedRef.current) {
        handleAutoplayBlocked(playback.cue, "initial-autoplay-blocked");
        stopPlayback(playback, "autoplay-blocked");
        return;
      }

      stopPlayback(playback, "initial-play-failed");
      options.addDiagnostic("warn", "session-audio", "Failed to start sound cue playback.", {
        message: err instanceof Error ? err.message : String(err),
        soundEffectKey: playback.cue.soundEffectKey,
        playRequestInstanceId: playback.cue.playRequestInstanceId ?? "(none)"
      });
    }
  }

  async function handlePlayCue(cue: HostCommandSoundCue): Promise<void> {
    if (!options.credentialHandle || !options.activeSessionId) {
      return;
    }

    const runtimeAssetRef = cue.runtimeAssetRef.trim();
    if (!runtimeAssetRef) {
      options.addDiagnostic("warn", "session-audio", "Skipping sound cue because runtime asset reference is empty.", {
        soundEffectKey: cue.soundEffectKey,
        playRequestInstanceId: cue.playRequestInstanceId ?? "(none)"
      });
      return;
    }

    if (typeof Audio === "undefined") {
      options.addDiagnostic("warn", "session-audio", "Skipping sound cue because Audio API is unavailable.", {
        soundEffectKey: cue.soundEffectKey,
        playRequestInstanceId: cue.playRequestInstanceId ?? "(none)"
      });
      return;
    }

    const laneAndKey = buildLaneAndKey(cue);
    const priorByLaneAndKey = activeByLaneAndKeyRef.current.get(laneAndKey);
    if (priorByLaneAndKey && cue.replayPolicy === "IgnoreIfAlreadyPlaying") {
      options.addDiagnostic("info", "session-audio", "Ignored sound cue because replay policy disallows overlapping playback.", {
        soundEffectKey: cue.soundEffectKey,
        lane: cue.soundEffectLane,
        replayPolicy: cue.replayPolicy,
        playRequestInstanceId: cue.playRequestInstanceId ?? "(none)"
      });
      return;
    }

    if (priorByLaneAndKey && cue.replayPolicy === "CancelPreviousAtNextPlay") {
      stopPlayback(priorByLaneAndKey, "replace-same-lane-and-key");
    }

    const previewDataUrl = await options.hostApiClient.getAssetPreviewDataUrl(
      options.credentialHandle,
      runtimeAssetRef,
      options.selectedGameId,
      options.selectedGameKey
    );

    if (!previewDataUrl) {
      options.addDiagnostic("warn", "session-audio", "Failed to resolve sound cue asset.", {
        soundEffectKey: cue.soundEffectKey,
        runtimeAssetRef,
        lane: cue.soundEffectLane
      });
      return;
    }

    const audio = new Audio(previewDataUrl);
    audio.preload = "auto";
    audio.loop = cue.repeatMode === "UntilCanceled";
    const baseVolume = resolveBaseVolume(cue.baseVolumeDb);
    const laneMultiplier = resolveLaneMultiplier(cue);
    audio.volume = toNonNegativeInt(cue.fadeInMs) > 0
      ? 0
      : baseVolume * laneMultiplier;

    const playback: ActiveCuePlayback = {
      cue,
      audio,
      laneAndKey,
      acceptedAtMs: Date.now(),
      scheduledStartAtMs: 0,
      actualStartAtMs: null,
      startedAtMs: Date.now(),
      startTimeoutId: null,
      stopTimeoutId: null,
      repeatTimeoutId: null,
      repeatIterationsCompleted: 0,
      canceled: false,
      baseVolume,
      fadeIntervalId: null
    };

    activeByLaneAndKeyRef.current.set(laneAndKey, playback);
    const instanceId = cue.playRequestInstanceId?.trim();
    if (instanceId) {
      activeByInstanceIdRef.current.set(instanceId, playback);
    }

    const startDelayMs = toNonNegativeInt(cue.startDelayMs);
    playback.scheduledStartAtMs = playback.acceptedAtMs + startDelayMs;

    options.addDiagnostic("info", "timing-sync", "Sound cue scheduled.", {
      traceKey: buildCueTraceKey(cue),
      commandCorrelationId: cue.commandCorrelationId,
      actionId: cue.actionId,
      sequenceIndex: cue.sequenceIndex,
      lane: cue.soundEffectLane,
      soundEffectKey: cue.soundEffectKey,
      acceptedAtMs: playback.acceptedAtMs,
      scheduledStartAtMs: playback.scheduledStartAtMs,
      scheduledDelayMs: startDelayMs,
      maxPlayDurationMs: cue.maxPlayDurationMs ?? null,
      repeatMode: cue.repeatMode,
      replayPolicy: cue.replayPolicy,
      repeatDurationMs: cue.repeatDurationMs ?? null,
      repeatCount: cue.repeatCount ?? null,
      repeatIntervalMs: cue.repeatIntervalMs ?? null,
      repeatCooldownMs: cue.repeatCooldownMs ?? null
    });

    if (startDelayMs > 0) {
      playback.startTimeoutId = window.setTimeout(() => {
        playback.startTimeoutId = null;
        void startPlayback(playback);
      }, startDelayMs);
    } else {
      void startPlayback(playback);
    }

    options.addDiagnostic("info", "session-audio", "Accepted sound cue playback request.", {
      operation: cue.operation,
      soundEffectKey: cue.soundEffectKey,
      lane: cue.soundEffectLane,
      playRequestInstanceId: cue.playRequestInstanceId ?? "(none)",
      repeatMode: cue.repeatMode,
      replayPolicy: cue.replayPolicy,
      laneMuted: laneMultiplier <= 0,
      laneVolumePercent: cue.soundEffectLane === "Ambient"
        ? normalizeLaneVolumePercent(options.audioLanes.ambient.volumePercent)
        : normalizeLaneVolumePercent(options.audioLanes.sfx.volumePercent),
      startDelayMs,
      maxPlayDurationMs: cue.maxPlayDurationMs ?? null
    });
  }

  function handleCancelCue(cue: HostCommandSoundCue): void {
    const instanceId = cue.playRequestInstanceId?.trim();
    if (instanceId) {
      const instancePlayback = activeByInstanceIdRef.current.get(instanceId);
      if (instancePlayback) {
        stopPlayback(instancePlayback, "cancel-by-instance-id");
        return;
      }
    }

    const laneAndKey = buildLaneAndKey(cue);
    const lanePlayback = activeByLaneAndKeyRef.current.get(laneAndKey);
    if (lanePlayback) {
      stopPlayback(lanePlayback, "cancel-by-lane-and-key");
      return;
    }

    options.addDiagnostic("info", "session-audio", "Cancel sound cue did not match an active playback.", {
      soundEffectKey: cue.soundEffectKey,
      lane: cue.soundEffectLane,
      playRequestInstanceId: cue.playRequestInstanceId ?? "(none)"
    });
  }

  function flushPendingUnlockQueue(): void {
    if (pendingUnlockPlayQueueRef.current.length === 0) {
      return;
    }

    const pending = [...pendingUnlockPlayQueueRef.current];
    pendingUnlockPlayQueueRef.current = [];
    publishStatus();

    for (const cue of pending) {
      void handlePlayCue(cue);
    }
  }

  function requestAudioUnlock(): void {
    if (isAudioUnlockedRef.current) {
      return;
    }

    isAudioUnlockedRef.current = true;
    publishStatus();

    options.addDiagnostic("info", "session-audio", "Audio playback unlocked after user gesture.", {
      pendingUnlockCueCount: pendingUnlockPlayQueueRef.current.length
    });

    flushPendingUnlockQueue();
  }

  function consumeSessionDeltaSoundCues(sessionData: HostSessionDataEnvelope): void {
    if (sessionData.soundCues.length === 0) {
      return;
    }

    const watermark = sessionData.sessionDeltaWatermark.trim();
    for (const cue of sessionData.soundCues) {
      const dedupeKey = buildCueDedupeKey(watermark, cue);
      if (seenCueKeysRef.current.has(dedupeKey)) {
        continue;
      }

      trackCueDedupKey(dedupeKey);

      if (cue.operation === "Cancel") {
        handleCancelCue(cue);
      } else {
        void handlePlayCue(cue);
      }
    }
  }

  useEffect(() => {
    const handleUnlockGesture = (): void => {
      requestAudioUnlock();
    };

    window.addEventListener("pointerdown", handleUnlockGesture, { passive: true });
    window.addEventListener("keydown", handleUnlockGesture);

    return () => {
      window.removeEventListener("pointerdown", handleUnlockGesture);
      window.removeEventListener("keydown", handleUnlockGesture);
      clearActiveSoundCues();
      seenCueKeysRef.current.clear();
      seenCueKeyQueueRef.current = [];
      pendingUnlockPlayQueueRef.current = [];
    };
  }, [options.audioUnlockRequired]);

  useEffect(() => {
    clearActiveSoundCues();
    seenCueKeysRef.current.clear();
    seenCueKeyQueueRef.current = [];
    pendingUnlockPlayQueueRef.current = [];
    autoplayBlockedCountRef.current = 0;
    isAudioUnlockedRef.current = !options.audioUnlockRequired;
    publishStatus();
  }, [options.activeSessionId, options.credentialHandle, options.audioUnlockRequired]);

  useEffect(() => {
    if (options.audioUnlockRequired) {
      return;
    }

    if (!isAudioUnlockedRef.current) {
      isAudioUnlockedRef.current = true;
      publishStatus();
    }

    flushPendingUnlockQueue();
  }, [options.audioUnlockRequired]);

  useEffect(() => {
    for (const playback of activeByLaneAndKeyRef.current.values()) {
      if (playback.canceled) {
        continue;
      }

      if (toNonNegativeInt(playback.cue.fadeInMs) > 0 && playback.fadeIntervalId !== null) {
        continue;
      }

      playback.audio.volume = playback.baseVolume * resolveLaneMultiplier(playback.cue);
    }
  }, [options.audioLanes]);

  return {
    consumeSessionDeltaSoundCues,
    clearActiveSoundCues,
    requestAudioUnlock,
    soundCueStatus
  };
}
