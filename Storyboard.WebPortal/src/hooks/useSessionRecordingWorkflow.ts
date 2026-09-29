import { useCallback, useEffect, useRef, useState } from "react";
import type { HostApiClient } from "../hostApi/client";
import type {
  HostRecordPlaybackCapabilities,
  HostRecordingStatus,
  HostRecordingDescriptor,
  HostPlaybackStatus,
  HostNextPlaybackStep,
  HostPlaybackStepOutcome
} from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

export interface SessionRecordingWorkflow {
  capabilities: HostRecordPlaybackCapabilities | null;
  status: HostRecordingStatus | null;
  playbackStatus: HostPlaybackStatus | null;
  nextPlaybackStep: HostNextPlaybackStep | null;
  lastPlaybackOutcome: HostPlaybackStepOutcome | null;
  recordings: HostRecordingDescriptor[];
  libraryScope: "All" | "Scratch" | "Saved";
  setLibraryScope: (scope: "All" | "Scratch" | "Saved") => void;
  selectedRecordingId: string;
  selectedRecording: HostRecordingDescriptor | null;
  hasMoreRecordings: boolean;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  refreshLibrary: (append?: boolean) => Promise<void>;
  selectRecording: (recordingId: string) => Promise<void>;
  loadMoreRecordings: () => Promise<void>;
  promoteSelected: (displayName: string) => Promise<void>;
  discardSelected: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  startPlayback: (mode: "Timed" | "Manual", speed: number) => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  switchPlaybackToManual: () => Promise<void>;
  refreshNextPlaybackStep: () => Promise<void>;
  advancePlayback: () => Promise<void>;
  continueRecordingFromPlayback: () => Promise<void>;
}

interface Options {
  credentialHandle: string;
  gameId: string;
  sessionId: string;
  hostApiClient: HostApiClient;
  addDiagnostic: AddDiagnostic;
}

function errorMessage(result: { message?: string; code?: string }): string {
  return result.message?.trim() || result.code || "The Host recording operation failed.";
}

export function useSessionRecordingWorkflow(options: Options): SessionRecordingWorkflow {
  const [capabilities, setCapabilities] = useState<HostRecordPlaybackCapabilities | null>(null);
  const [status, setStatus] = useState<HostRecordingStatus | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<HostPlaybackStatus | null>(null);
  const [nextPlaybackStep, setNextPlaybackStep] = useState<HostNextPlaybackStep | null>(null);
  const [lastPlaybackOutcome, setLastPlaybackOutcome] = useState<HostPlaybackStepOutcome | null>(null);
  const [recordings, setRecordings] = useState<HostRecordingDescriptor[]>([]);
  const [libraryScope, setLibraryScope] = useState<"All" | "Scratch" | "Saved">("All");
  const [selectedRecordingId, setSelectedRecordingId] = useState("");
  const [selectedRecording, setSelectedRecording] = useState<HostRecordingDescriptor | null>(null);
  const [recordingListContinuation, setRecordingListContinuation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestEpoch = useRef(0);
  const recordingListContinuationRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!options.credentialHandle || !options.sessionId) return;
    const epoch = requestEpoch.current;
    try {
      const result = await options.hostApiClient.getRecordPlaybackStatus(options.credentialHandle, options.sessionId);
      if (epoch !== requestEpoch.current) return;
      if (result.result.success) {
        setStatus(result.recordingStatus ?? null);
        setPlaybackStatus(result.playbackStatus ?? null);
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Recording status request was rejected.", {
          event: "recording-status-failed", code: result.result.code, sessionId: options.sessionId,
          correlationId: result.result.correlationId, message
        });
      }
    } catch (cause) {
      if (epoch !== requestEpoch.current) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Recording status request failed in transport.", {
        event: "recording-status-transport-failed", sessionId: options.sessionId, message
      });
    }
  }, [options.addDiagnostic, options.credentialHandle, options.hostApiClient, options.sessionId]);

  const refreshCapabilities = useCallback(async (): Promise<void> => {
    if (!options.credentialHandle || !options.gameId) return;
    try {
      const result = await options.hostApiClient.getRecordPlaybackCapabilities(
        options.credentialHandle, options.gameId, options.sessionId
      );
      setCapabilities(result.capabilities ?? null);
      if (!result.result.success) setError(errorMessage(result.result));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId]);

  const refreshNextPlaybackStep = useCallback(async (): Promise<void> => {
    if (!options.credentialHandle || !options.sessionId || !playbackStatus || playbackStatus.mode !== "Manual" || playbackStatus.state !== "Ready") {
      setNextPlaybackStep(null); return;
    }
    if (nextPlaybackStep?.stepIndex === playbackStatus.nextStepIndex) return;
    try {
      const result = await options.hostApiClient.getNextSessionPlaybackStep(options.credentialHandle, options.sessionId, playbackStatus.playbackId);
      if (result.result.success) {
        setPlaybackStatus(result.playbackStatus ?? playbackStatus);
        setNextPlaybackStep(result.nextStep ?? null);
        setError("");
      } else { setError(errorMessage(result.result)); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [nextPlaybackStep?.stepIndex, options.credentialHandle, options.hostApiClient, options.sessionId, playbackStatus]);

  const runPlaybackAction = useCallback(async (action: (id: string, version: number) => Promise<{ result: { success: boolean; message?: string; code?: string }; playbackStatus?: HostPlaybackStatus }>): Promise<void> => {
    if (!playbackStatus || busy || !options.credentialHandle || !options.sessionId) return;
    setBusy(true); setError("");
    try {
      const result = await action(playbackStatus.playbackId, playbackStatus.version);
      if (result.result.success) { setPlaybackStatus(result.playbackStatus ?? null); setNextPlaybackStep(null); }
      else { setError(errorMessage(result.result)); await refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); await refresh(); }
    finally { setBusy(false); }
  }, [busy, options.credentialHandle, options.hostApiClient, options.sessionId, playbackStatus, refresh]);

  const startPlayback = useCallback(async (mode: "Timed" | "Manual", speed: number): Promise<void> => {
    if (!selectedRecording || !options.credentialHandle || !options.sessionId || busy) return;
    setBusy(true); setError(""); setLastPlaybackOutcome(null); setNextPlaybackStep(null);
    try {
      const result = await options.hostApiClient.startSessionPlayback(options.credentialHandle, options.sessionId, selectedRecording.recordingId, selectedRecording.stateToken, mode, speed);
      if (result.result.success) setPlaybackStatus(result.playbackStatus ?? null);
      else setError(errorMessage(result.result));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); await refresh(); }
  }, [busy, options.credentialHandle, options.hostApiClient, options.sessionId, refresh, selectedRecording]);

  const pausePlayback = useCallback(() => runPlaybackAction((id, version) => options.hostApiClient.pauseSessionPlayback(options.credentialHandle, options.sessionId, id, version)), [options.credentialHandle, options.hostApiClient, options.sessionId, runPlaybackAction]);
  const resumePlayback = useCallback(() => runPlaybackAction((id, version) => options.hostApiClient.resumeSessionPlayback(options.credentialHandle, options.sessionId, id, version)), [options.credentialHandle, options.hostApiClient, options.sessionId, runPlaybackAction]);
  const stopPlayback = useCallback(() => runPlaybackAction((id, version) => options.hostApiClient.stopSessionPlayback(options.credentialHandle, options.sessionId, id, version)), [options.credentialHandle, options.hostApiClient, options.sessionId, runPlaybackAction]);
  const setPlaybackSpeed = useCallback((speed: number) => runPlaybackAction((id, version) => options.hostApiClient.setSessionPlaybackSpeed(options.credentialHandle, options.sessionId, id, version, speed)), [options.credentialHandle, options.hostApiClient, options.sessionId, runPlaybackAction]);
  const switchPlaybackToManual = useCallback(() => runPlaybackAction((id, version) => options.hostApiClient.switchSessionPlaybackToManual(options.credentialHandle, options.sessionId, id, version)), [options.credentialHandle, options.hostApiClient, options.sessionId, runPlaybackAction]);

  const advancePlayback = useCallback(async (): Promise<void> => {
    if (!playbackStatus || !nextPlaybackStep || busy) return;
    setBusy(true); setError("");
    try {
      const result = await options.hostApiClient.advanceSessionPlayback(options.credentialHandle, options.sessionId, playbackStatus.playbackId, playbackStatus.version, nextPlaybackStep.stepToken);
      if (result.result.success) { setPlaybackStatus(result.playbackStatus ?? null); setLastPlaybackOutcome(result.stepOutcome ?? null); setNextPlaybackStep(null); }
      else { setError(errorMessage(result.result)); await refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); await refresh(); }
    finally { setBusy(false); }
  }, [busy, nextPlaybackStep, options.credentialHandle, options.hostApiClient, options.sessionId, playbackStatus, refresh]);

  const continueRecordingFromPlayback = useCallback(async (): Promise<void> => {
    const validManualBoundary = playbackStatus?.mode === "Manual" && playbackStatus.state === "Ready";
    const completedBoundary = playbackStatus?.state === "Completed";
    if (!playbackStatus || !selectedRecording || !capabilities?.canContinue || busy
      || (!validManualBoundary && !completedBoundary)
      || playbackStatus.recordingId !== selectedRecording.recordingId) return;
    setBusy(true); setError("");
    try {
      const result = await options.hostApiClient.continueRecordingFromPlayback(
        options.credentialHandle, options.sessionId, playbackStatus.playbackId,
        selectedRecording.recordingId, playbackStatus.version, selectedRecording.stateToken
      );
      if (result.result.success) {
        if (result.recordingStatus) setStatus(result.recordingStatus);
        if (result.recording) setSelectedRecording(result.recording);
        setPlaybackStatus(null);
        setNextPlaybackStep(null);
        options.addDiagnostic("info", "recording", "Recording continued from the manual playback cursor.", {
          event: "recording-continued-from-playback", playbackId: playbackStatus.playbackId,
          recordingId: selectedRecording.recordingId, correlationId: result.result.correlationId
        });
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Continue Recording From Here was rejected.", {
          event: "recording-continue-from-playback-failed", code: result.result.code,
          playbackId: playbackStatus.playbackId, recordingId: selectedRecording.recordingId,
          correlationId: result.result.correlationId, message
        });
        await refresh();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Continuation from playback failed in transport.", {
        event: "recording-continue-from-playback-transport-failed", playbackId: playbackStatus.playbackId,
        recordingId: selectedRecording.recordingId, message
      });
      await refresh();
    } finally { setBusy(false); }
  }, [busy, capabilities?.canContinue, options.addDiagnostic, options.credentialHandle, options.hostApiClient, options.sessionId, playbackStatus, refresh, selectedRecording]);

  useEffect(() => { void refreshNextPlaybackStep(); }, [refreshNextPlaybackStep]);

  const refreshLibrary = useCallback(async (append = false): Promise<void> => {
    if (!options.credentialHandle || !options.gameId || !capabilities?.canList) return;
    const continuationToken = append ? recordingListContinuationRef.current ?? undefined : undefined;
    try {
      const result = await options.hostApiClient.listSessionRecordings(
        options.credentialHandle,
        options.gameId,
        options.sessionId,
        {
          scope: libraryScope === "All" ? undefined : libraryScope,
          pageSize: Math.min(100, Math.max(1, capabilities.maxPageSize || 100)),
          continuationToken
        }
      );
      if (result.result.success) {
        setRecordings((current) => append ? [...current, ...result.recordings] : result.recordings);
        if (!append) {
          const refreshedSelection = result.recordings.find((item) => item.recordingId === selectedRecordingId);
          if (refreshedSelection) setSelectedRecording(refreshedSelection);
        }
        recordingListContinuationRef.current = result.nextContinuationToken ?? null;
        setRecordingListContinuation(result.nextContinuationToken ?? null);
        setError("");
        options.addDiagnostic("info", "recording", "Recording library refreshed.", {
          event: "recording-library-refreshed", gameId: options.gameId, scope: libraryScope,
          count: result.recordings.length, appended: append, correlationId: result.result.correlationId
        });
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Recording library request was rejected.", {
          event: "recording-library-failed", code: result.result.code, gameId: options.gameId,
          scope: libraryScope, correlationId: result.result.correlationId, message
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Recording library request failed in transport.", {
        event: "recording-library-transport-failed", gameId: options.gameId, scope: libraryScope, message
      });
    }
  }, [capabilities, libraryScope, options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId, selectedRecordingId]);

  const selectRecording = useCallback(async (recordingId: string): Promise<void> => {
    setSelectedRecordingId(recordingId);
    setSelectedRecording(recordings.find((item) => item.recordingId === recordingId) ?? null);
    setError("");
  }, [recordings]);

  const loadMoreRecordings = useCallback(async (): Promise<void> => {
    if (recordingListContinuation) await refreshLibrary(true);
  }, [recordingListContinuation, refreshLibrary]);

  const promoteSelected = useCallback(async (displayName: string): Promise<void> => {
    const name = displayName.trim();
    if (!name || !selectedRecording || selectedRecording.scope !== "Scratch" || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await options.hostApiClient.promoteSessionRecording(
        options.credentialHandle, options.gameId, options.sessionId,
        selectedRecording.recordingId, selectedRecording.stateToken, name
      );
      if (result.result.success && result.recording) {
        setSelectedRecording(result.recording);
        setSelectedRecordingId(result.recording.recordingId);
        setLibraryScope("Saved");
        options.addDiagnostic("info", "recording", "Scratch recording promoted to saved storage.", {
          event: "recording-promoted", recordingId: result.recording.recordingId,
          gameId: options.gameId, displayName: result.recording.displayName,
          correlationId: result.result.correlationId
        });
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Recording promotion was rejected.", {
          event: "recording-promote-failed", code: result.result.code,
          recordingId: selectedRecording.recordingId, gameId: options.gameId,
          correlationId: result.result.correlationId, message
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Recording promotion failed in transport.", {
        event: "recording-promote-transport-failed", recordingId: selectedRecording.recordingId,
        gameId: options.gameId, message
      });
    } finally {
      setBusy(false);
    }
  }, [busy, options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId, selectedRecording]);

  const discardSelected = useCallback(async (): Promise<void> => {
    if (!selectedRecording || selectedRecording.scope !== "Scratch" || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await options.hostApiClient.discardSessionScratchRecording(
        options.credentialHandle, options.gameId, options.sessionId,
        selectedRecording.recordingId, selectedRecording.stateToken
      );
      if (result.result.success && result.discarded) {
        options.addDiagnostic("info", "recording", "Scratch recording discarded.", {
          event: "recording-scratch-discarded", recordingId: selectedRecording.recordingId,
          gameId: options.gameId, correlationId: result.result.correlationId
        });
        setSelectedRecordingId("");
        setSelectedRecording(null);
        await refreshLibrary(false);
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Scratch recording discard was rejected.", {
          event: "recording-scratch-discard-failed", code: result.result.code,
          recordingId: selectedRecording.recordingId, gameId: options.gameId,
          correlationId: result.result.correlationId, message
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Scratch recording discard failed in transport.", {
        event: "recording-scratch-discard-transport-failed", recordingId: selectedRecording.recordingId,
        gameId: options.gameId, message
      });
    } finally {
      setBusy(false);
    }
  }, [busy, options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId, refreshLibrary, selectedRecording]);

  useEffect(() => {
    requestEpoch.current += 1;
    const epoch = requestEpoch.current;
    setCapabilities(null);
    setStatus(null);
    setPlaybackStatus(null); setNextPlaybackStep(null); setLastPlaybackOutcome(null);
    setRecordings([]);
    recordingListContinuationRef.current = null;
    setRecordingListContinuation(null);
    setSelectedRecordingId("");
    setSelectedRecording(null);
    setError("");
    if (!options.credentialHandle || !options.gameId) return;

    void options.hostApiClient.getRecordPlaybackCapabilities(
      options.credentialHandle, options.gameId, options.sessionId
    ).then((result) => {
      if (epoch !== requestEpoch.current) return;
      if (result.result.success) {
        setCapabilities(result.capabilities);
      } else {
        setCapabilities(result.capabilities);
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Recording capability request was rejected.", {
          event: "recording-capabilities-failed", code: result.result.code, gameId: options.gameId,
          sessionId: options.sessionId, correlationId: result.result.correlationId, message
        });
      }
    }).catch((cause: unknown) => {
      if (epoch !== requestEpoch.current) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Recording capability request failed in transport.", {
        event: "recording-capabilities-transport-failed", gameId: options.gameId,
        sessionId: options.sessionId, message
      });
    });

    return () => { requestEpoch.current += 1; };
  }, [options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId]);

  useEffect(() => {
    if (!options.credentialHandle || !options.sessionId) {
      setStatus(null);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [options.credentialHandle, options.sessionId, refresh]);

  useEffect(() => {
    if (!capabilities?.canList) {
      setRecordings([]);
      recordingListContinuationRef.current = null;
      setRecordingListContinuation(null);
      return;
    }
    setRecordings([]);
    recordingListContinuationRef.current = null;
    setRecordingListContinuation(null);
    void refreshLibrary(false);
  }, [capabilities?.canList, options.gameId, libraryScope, refreshLibrary]);

  const start = useCallback(async (): Promise<void> => {
    if (!options.credentialHandle || !options.sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await options.hostApiClient.startSessionRecording(options.credentialHandle, options.sessionId);
      if (result.result.success && result.recordingStatus) {
        setStatus(result.recordingStatus);
        options.addDiagnostic("info", "recording", "Recording started.", {
          event: "recording-started", recordingId: result.recordingStatus.recordingId,
          sessionId: options.sessionId, correlationId: result.result.correlationId
        });
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Start Recording was rejected.", {
          event: "recording-start-failed", code: result.result.code,
          sessionId: options.sessionId, correlationId: result.result.correlationId, message
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Start Recording failed in transport.", {
        event: "recording-start-transport-failed", sessionId: options.sessionId, message
      });
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [busy, options.addDiagnostic, options.credentialHandle, options.hostApiClient, options.sessionId, refresh]);

  const stop = useCallback(async (): Promise<void> => {
    if (!options.credentialHandle || !options.sessionId || !status || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await options.hostApiClient.stopSessionRecording(
        options.credentialHandle, options.sessionId, status.recordingId, status.stateToken
      );
      if (result.result.success && result.recordingStatus) {
        setStatus(result.recordingStatus);
        if (result.recording) setSelectedRecording(result.recording);
        options.addDiagnostic("info", "recording", "Recording stopped and finalized.", {
          event: "recording-stopped", recordingId: result.recordingStatus.recordingId,
          stepCount: result.recordingStatus.stepCount, sessionId: options.sessionId,
          correlationId: result.result.correlationId
        });
      } else {
        const message = errorMessage(result.result);
        setError(message);
        options.addDiagnostic("warn", "recording", "Stop Recording was rejected.", {
          event: "recording-stop-failed", code: result.result.code,
          recordingId: status.recordingId, sessionId: options.sessionId,
          correlationId: result.result.correlationId, message
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      options.addDiagnostic("error", "recording", "Stop Recording failed in transport.", {
        event: "recording-stop-transport-failed", recordingId: status.recordingId,
        sessionId: options.sessionId, message
      });
    } finally {
      setBusy(false);
      await refresh();
      await refreshLibrary(false);
    }
  }, [busy, options.addDiagnostic, options.credentialHandle, options.hostApiClient, options.sessionId, refresh, refreshLibrary, status]);

  return {
    capabilities, status, playbackStatus, nextPlaybackStep, lastPlaybackOutcome, recordings, libraryScope, setLibraryScope, selectedRecordingId,
    selectedRecording, hasMoreRecordings: recordingListContinuation !== null,
    busy, error, refresh, refreshCapabilities, refreshLibrary,
    selectRecording, loadMoreRecordings, promoteSelected, discardSelected,
    start, stop, startPlayback, pausePlayback, resumePlayback, stopPlayback,
    setPlaybackSpeed, switchPlaybackToManual, refreshNextPlaybackStep, advancePlayback,
    continueRecordingFromPlayback
  };
}
