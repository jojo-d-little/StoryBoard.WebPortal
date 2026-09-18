import { useEffect, useRef } from "react";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { HostApiClient } from "../hostApi/client";
import type { HostRuntimePresentationBaseline, HostSessionDataEnvelope } from "../hostApi/HostContracts";

interface SessionDeltaPollingSettings {
  pollIntervalMs: number;
  heartbeatEveryNPolls: number;
}

interface UseSessionDeltaPollingOptions {
  hostApiClient: HostApiClient;
  credentialHandle: string;
  sessionId: string;
  initialWatermark?: string;
  resetEpoch?: number;
  settings: SessionDeltaPollingSettings;
  enabled: boolean;
  allowInTest?: boolean;
  onSessionData?: (sessionData: HostSessionDataEnvelope) => void;
  onResyncBaseline?: (baseline: HostRuntimePresentationBaseline) => void | Promise<void>;
  addDiagnostic: (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;
}

interface PollingRuntimeState {
  inFlight: boolean;
  nextTimeoutId: number | null;
  pendingDelayResolve: (() => void) | null;
  stopped: boolean;
  generation: number;
  lastPollStartedAtMs: number;
  currentWatermark: string;
  runCount: number;
  noopCount: number;
  failureCount: number;
}

interface PollAnalysis {
  hasData: boolean;
  hasHighSignalData: boolean;
  counts: {
    roomObjectChanges: number;
    soundCues: number;
    outputLines: number;
    diagnostics: number;
    moveLegTelemetry: number;
  };
}

const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 60000;
const MIN_HEARTBEAT_POLLS = 1;
const MAX_HEARTBEAT_POLLS = 500;
let globalPollOwnerEpoch = 0;

function claimGlobalPollOwnership(): number {
  globalPollOwnerEpoch += 1;
  return globalPollOwnerEpoch;
}

function isGlobalPollOwner(ownerEpoch: number): boolean {
  return ownerEpoch > 0 && globalPollOwnerEpoch === ownerEpoch;
}

function normalizePollIntervalMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 750;
  }

  const rounded = Math.round(value);
  return Math.max(MIN_POLL_INTERVAL_MS, Math.min(MAX_POLL_INTERVAL_MS, rounded));
}

function normalizeHeartbeatEveryNPolls(value: number): number {
  if (!Number.isFinite(value)) {
    return 100;
  }

  const rounded = Math.round(value);
  return Math.max(MIN_HEARTBEAT_POLLS, Math.min(MAX_HEARTBEAT_POLLS, rounded));
}

function normalizeWatermark(value: string): string {
  return value.trim();
}

function hasWatermarkAdvanced(fromWatermark: string, toWatermark: string): boolean {
  const from = normalizeWatermark(fromWatermark);
  const to = normalizeWatermark(toWatermark);
  return to.length > 0 && to !== from;
}

function analyzeSessionData(
  sessionData: HostSessionDataEnvelope | null,
  fromWatermark: string,
  toWatermark: string
): PollAnalysis {
  if (!sessionData) {
    return {
      hasData: false,
      hasHighSignalData: false,
      counts: {
        roomObjectChanges: 0,
        soundCues: 0,
        outputLines: 0,
        diagnostics: 0,
        moveLegTelemetry: 0
      }
    };
  }

  const counts = {
    roomObjectChanges: sessionData.roomObjectChanges.length,
    soundCues: sessionData.soundCues.length,
    outputLines: sessionData.outputLines.length,
    diagnostics: sessionData.diagnostics.length,
    moveLegTelemetry: sessionData.roomObjectChanges.reduce(
      (total, change) => total + (change.moveLegTelemetry?.length ?? 0),
      0)
  };

  // Treat diagnostics-only payloads with unchanged watermark as no-op to avoid noisy logs.
  const hasSubstantivePayload = sessionData.hasRoomChange
    || sessionData.hasPhaseChange
    || counts.roomObjectChanges > 0
    || counts.soundCues > 0
    || counts.outputLines > 0
    || counts.moveLegTelemetry > 0;

  const hasData = hasSubstantivePayload || hasWatermarkAdvanced(fromWatermark, toWatermark);
  const hasHighSignalData = sessionData.hasRoomChange
    || sessionData.hasPhaseChange
    || counts.roomObjectChanges > 0
    || counts.soundCues > 0
    || counts.moveLegTelemetry > 0;

  return { hasData, hasHighSignalData, counts };
}

export function useSessionDeltaPolling(options: UseSessionDeltaPollingOptions): void {
  const runtimeStateRef = useRef<PollingRuntimeState>({
    inFlight: false,
    nextTimeoutId: null,
    pendingDelayResolve: null,
    stopped: true,
    generation: 0,
    lastPollStartedAtMs: 0,
    currentWatermark: "",
    runCount: 0,
    noopCount: 0,
    failureCount: 0
  });
  const onSessionDataRef = useRef(options.onSessionData);
  const onResyncBaselineRef = useRef(options.onResyncBaseline);
  const addDiagnosticRef = useRef(options.addDiagnostic);

  useEffect(() => {
    onSessionDataRef.current = options.onSessionData;
  }, [options.onSessionData]);

  useEffect(() => {
    onResyncBaselineRef.current = options.onResyncBaseline;
  }, [options.onResyncBaseline]);

  useEffect(() => {
    addDiagnosticRef.current = options.addDiagnostic;
  }, [options.addDiagnostic]);

  useEffect(() => {
    const isTestRuntime = import.meta.env.MODE === "test";
    if (isTestRuntime && !options.allowInTest) {
      return;
    }

    const normalizedPollIntervalMs = normalizePollIntervalMs(options.settings.pollIntervalMs);
    const normalizedHeartbeatEveryNPolls = normalizeHeartbeatEveryNPolls(options.settings.heartbeatEveryNPolls);
    const initialWatermark = normalizeWatermark(options.initialWatermark ?? "");
    const runtimeState = runtimeStateRef.current;
    const activeGeneration = runtimeState.generation + 1;
    const ownerEpoch = claimGlobalPollOwnership();
    runtimeState.generation = activeGeneration;

    function isCurrentGeneration(): boolean {
      return !runtimeState.stopped
        && runtimeState.generation === activeGeneration
        && isGlobalPollOwner(ownerEpoch);
    }

    function clearScheduledPoll(): void {
      if (runtimeState.nextTimeoutId !== null) {
        window.clearTimeout(runtimeState.nextTimeoutId);
        runtimeState.nextTimeoutId = null;
      }

      if (runtimeState.pendingDelayResolve) {
        const resolve = runtimeState.pendingDelayResolve;
        runtimeState.pendingDelayResolve = null;
        resolve();
      }
    }

    function stopPolling(): void {
      runtimeState.stopped = true;
      clearScheduledPoll();
    }

    function waitForDelay(delayMs: number): Promise<void> {
      const normalizedDelayMs = Math.max(0, delayMs);
      if (normalizedDelayMs <= 0) {
        return Promise.resolve();
      }

      clearScheduledPoll();

      return new Promise<void>((resolve) => {
        runtimeState.pendingDelayResolve = () => {
          runtimeState.pendingDelayResolve = null;
          resolve();
        };

        runtimeState.nextTimeoutId = window.setTimeout(() => {
          runtimeState.nextTimeoutId = null;
          const pendingResolve = runtimeState.pendingDelayResolve;
          runtimeState.pendingDelayResolve = null;
          pendingResolve?.();
        }, normalizedDelayMs);
      });
    }

    async function runOnePollCycle(): Promise<void> {
      if (!isCurrentGeneration()) {
        return;
      }

      const pollStartedAtMs = Date.now();
      runtimeState.inFlight = true;
      runtimeState.lastPollStartedAtMs = pollStartedAtMs;
      runtimeState.runCount += 1;
      const fromWatermark = runtimeState.currentWatermark;

      try {
        const pollResult = await options.hostApiClient.getSessionDeltas(
          options.credentialHandle,
          options.sessionId,
          fromWatermark,
          "Medium"
        );

        if (!isCurrentGeneration()) {
          return;
        }

        if (pollResult.resultCode === "ResyncRequired") {
          const baseline = await options.hostApiClient.getSessionBaseline(options.credentialHandle, options.sessionId);

          if (!isCurrentGeneration()) {
            return;
          }

          await onResyncBaselineRef.current?.(baseline);

          if (!isCurrentGeneration()) {
            return;
          }

          const baselineWatermark = baseline.sessionDeltaWatermark?.trim() ?? "";
          runtimeState.currentWatermark = baselineWatermark;
          runtimeState.noopCount = 0;
          runtimeState.failureCount = 0;

          addDiagnosticRef.current("warn", "session-delta", "Session delta polling requested resync; baseline fetched.", {
            fromWatermark: fromWatermark || "(none)",
            baselineWatermark: baselineWatermark || "(none)",
            pollResultCode: pollResult.resultCode
          });
          return;
        }

        const toWatermark = (pollResult.sessionData?.sessionDeltaWatermark || pollResult.sessionDeltaWatermark || "").trim();
        if (toWatermark) {
          runtimeState.currentWatermark = toWatermark;
        }

        if (pollResult.sessionData) {
          onSessionDataRef.current?.(pollResult.sessionData);
        }

        const analysis = analyzeSessionData(pollResult.sessionData, fromWatermark, toWatermark);
        if (analysis.hasData) {
          runtimeState.noopCount = 0;
          runtimeState.failureCount = 0;

          const shouldLogData = analysis.hasHighSignalData
            || runtimeState.runCount === 1
            || runtimeState.runCount % normalizedHeartbeatEveryNPolls === 0;

          if (shouldLogData) {
            addDiagnosticRef.current("info", "session-delta", "Session delta poll returned data.", {
              fromWatermark: fromWatermark || "(none)",
              toWatermark: toWatermark || "(none)",
              resultCode: pollResult.resultCode,
              runCount: runtimeState.runCount,
              ...analysis.counts
            });
          }
        } else {
          runtimeState.noopCount += 1;
          runtimeState.failureCount = 0;

          if (runtimeState.noopCount % normalizedHeartbeatEveryNPolls === 0) {
            addDiagnosticRef.current("info", "session-delta", "Session delta poll heartbeat (no-op).", {
              fromWatermark: fromWatermark || "(none)",
              toWatermark: toWatermark || "(none)",
              runCount: runtimeState.runCount,
              noopCount: runtimeState.noopCount,
              heartbeatEveryNPolls: normalizedHeartbeatEveryNPolls
            });
          }
        }
      } catch (err) {
        runtimeState.failureCount += 1;
        if (runtimeState.failureCount === 1 || runtimeState.failureCount % 5 === 0) {
          addDiagnosticRef.current("warn", "session-delta", "Session delta poll failed.", {
            failureCount: runtimeState.failureCount,
            message: err instanceof Error ? err.message : String(err)
          });
        }
      } finally {
        runtimeState.inFlight = false;
      }
    }

    async function runPollingLoop(): Promise<void> {
      let nextPollDueAtMs = Date.now() + normalizedPollIntervalMs;

      while (isCurrentGeneration()) {
        const waitMs = Math.max(0, nextPollDueAtMs - Date.now());
        await waitForDelay(waitMs);

        if (!isCurrentGeneration()) {
          break;
        }

        await runOnePollCycle();
        nextPollDueAtMs = Date.now() + normalizedPollIntervalMs;
      }
    }

    if (!options.enabled || !options.credentialHandle || !options.sessionId) {
      stopPolling();
      runtimeState.lastPollStartedAtMs = 0;
      runtimeState.currentWatermark = "";
      runtimeState.runCount = 0;
      runtimeState.noopCount = 0;
      runtimeState.failureCount = 0;
      return () => {
        stopPolling();
      };
    }

    runtimeState.stopped = false;
    runtimeState.currentWatermark = initialWatermark;
    runtimeState.lastPollStartedAtMs = 0;
    runtimeState.runCount = 0;
    runtimeState.noopCount = 0;
    runtimeState.failureCount = 0;

    addDiagnosticRef.current("info", "session-delta", "Session delta polling started.", {
      sessionId: options.sessionId,
      resetEpoch: options.resetEpoch ?? 0,
      ownerEpoch,
      generation: activeGeneration,
      initialWatermark: runtimeState.currentWatermark || "(none)",
      pollIntervalMs: normalizedPollIntervalMs,
      heartbeatEveryNPolls: normalizedHeartbeatEveryNPolls
    });

    void runPollingLoop();

    return () => {
      stopPolling();
      runtimeState.lastPollStartedAtMs = 0;
      addDiagnosticRef.current("info", "session-delta", "Session delta polling stopped.", {
        sessionId: options.sessionId,
        resetEpoch: options.resetEpoch ?? 0,
        ownerEpoch,
        generation: activeGeneration,
        runCount: runtimeState.runCount
      });

      if (isGlobalPollOwner(ownerEpoch)) {
        globalPollOwnerEpoch = 0;
      }
    };
  }, [
    options.hostApiClient,
    options.credentialHandle,
    options.sessionId,
    options.initialWatermark,
    options.resetEpoch,
    options.settings.pollIntervalMs,
    options.settings.heartbeatEveryNPolls,
    options.enabled,
    options.allowInTest
  ]);
}
