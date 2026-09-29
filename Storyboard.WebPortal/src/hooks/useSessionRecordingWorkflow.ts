import { useCallback, useEffect, useRef, useState } from "react";
import type { HostApiClient } from "../hostApi/client";
import type {
  HostRecordPlaybackCapabilities,
  HostRecordingStatus,
  HostRecordingDescriptor
} from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

export interface SessionRecordingWorkflow {
  capabilities: HostRecordPlaybackCapabilities | null;
  status: HostRecordingStatus | null;
  recordings: HostRecordingDescriptor[];
  libraryScope: "All" | "Scratch" | "Saved";
  setLibraryScope: (scope: "All" | "Scratch" | "Saved") => void;
  selectedRecordingId: string;
  selectedRecording: HostRecordingDescriptor | null;
  hasMoreRecordings: boolean;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  refreshLibrary: (append?: boolean) => Promise<void>;
  selectRecording: (recordingId: string) => Promise<void>;
  loadMoreRecordings: () => Promise<void>;
  promoteSelected: (displayName: string) => Promise<void>;
  discardSelected: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
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
  }, [capabilities, libraryScope, options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId]);

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
    }
  }, [busy, options.addDiagnostic, options.credentialHandle, options.hostApiClient, options.sessionId, refresh, status]);

  return {
    capabilities, status, recordings, libraryScope, setLibraryScope, selectedRecordingId,
    selectedRecording, hasMoreRecordings: recordingListContinuation !== null,
    busy, error, refresh, refreshLibrary,
    selectRecording, loadMoreRecordings, promoteSelected, discardSelected,
    start, stop
  };
}
