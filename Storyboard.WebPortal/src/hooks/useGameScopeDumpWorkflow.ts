import { useCallback, useEffect, useRef, useState } from "react";
import type { HostApiClient } from "../hostApi/client";
import type {
  HostGameScopeDumpCapabilities,
  HostGameScopeDumpPreset,
  HostGameScopeDumpResult
} from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

export const GAME_SCOPE_DUMP_PRESETS: Array<{ value: HostGameScopeDumpPreset; label: string }> = [
  { value: "All", label: "All" },
  { value: "RoomAndAncestors", label: "Room + ancestors" },
  { value: "RoomAndDecendents", label: "Room + descendants" },
  { value: "RoomAndRelatives", label: "Room relatives" },
  { value: "PhaseAndAncestors", label: "Phase + ancestors" },
  { value: "PhaseAll", label: "All phases" }
];

export interface GameScopeDumpWorkflow {
  capabilities: HostGameScopeDumpCapabilities | null;
  capabilityLoading: boolean;
  capabilityError: string;
  busy: boolean;
  error: string;
  lastCapture: HostGameScopeDumpResult | null;
  refreshCapabilities: () => Promise<void>;
  capture: (scope: HostGameScopeDumpPreset) => Promise<void>;
}

interface Options {
  credentialHandle: string;
  gameId: string;
  sessionId: string;
  hostApiClient: HostApiClient;
  addDiagnostic: AddDiagnostic;
}

function resultMessage(result: { message?: string; code?: string }): string {
  return result.message?.trim() || result.code?.trim() || "The Host rejected the game-scope dump request.";
}

export function useGameScopeDumpWorkflow(options: Options): GameScopeDumpWorkflow {
  const [capabilities, setCapabilities] = useState<HostGameScopeDumpCapabilities | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [capabilityError, setCapabilityError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastCapture, setLastCapture] = useState<HostGameScopeDumpResult | null>(null);
  const requestEpoch = useRef(0);

  const refreshCapabilities = useCallback(async (): Promise<void> => {
    const epoch = ++requestEpoch.current;
    if (!options.credentialHandle || !options.gameId || !options.sessionId) {
      setCapabilities(null);
      setCapabilityError("");
      setCapabilityLoading(false);
      return;
    }

    setCapabilityLoading(true);
    setCapabilityError("");
    try {
      const response = await options.hostApiClient.getGameScopeDumpCapabilities(
        options.credentialHandle,
        options.gameId,
        options.sessionId
      );
      if (epoch !== requestEpoch.current) return;
      setCapabilities(response.capabilities);
      if (!response.result.success) {
        const message = resultMessage(response.result);
        setCapabilityError(message);
        options.addDiagnostic("warn", "game-scope-dump", "Game-scope dump capability request was rejected.", {
          event: "game-scope-dump-capabilities-rejected",
          gameId: options.gameId,
          sessionId: options.sessionId,
          code: response.result.code,
          correlationId: response.result.correlationId
        });
      }
    } catch {
      if (epoch !== requestEpoch.current) return;
      setCapabilities(null);
      setCapabilityError("Could not check dump availability. Check the Host connection and retry.");
      options.addDiagnostic("error", "game-scope-dump", "Game-scope dump capability request failed in transport.", {
        event: "game-scope-dump-capabilities-transport-failed",
        gameId: options.gameId,
        sessionId: options.sessionId
      });
    } finally {
      if (epoch === requestEpoch.current) setCapabilityLoading(false);
    }
  }, [options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId]);

  useEffect(() => {
    setCapabilities(null);
    setLastCapture(null);
    setError("");
    void refreshCapabilities();
    return () => { requestEpoch.current += 1; };
  }, [refreshCapabilities]);

  const capture = useCallback(async (scope: HostGameScopeDumpPreset): Promise<void> => {
    if (!capabilities?.available || busy || !options.credentialHandle || !options.gameId || !options.sessionId) return;
    setBusy(true);
    setError("");
    setLastCapture(null);
    try {
      const response = await options.hostApiClient.requestGameScopeDump(
        options.credentialHandle,
        options.gameId,
        options.sessionId,
        scope
      );
      setLastCapture(response);
      const successfulCapture = response.result.success
        && (response.outcome === "Completed" || response.outcome === "Truncated");
      if (!successfulCapture) {
        const message = response.message?.trim()
          || response.result.message?.trim()
          || response.errorCode
          || response.result.code
          || "The Host could not capture this scope.";
        setError(message);
        options.addDiagnostic("warn", "game-scope-dump", "Game-scope dump request did not complete successfully.", {
          event: "game-scope-dump-capture-failed",
          dumpId: response.dumpId || undefined,
          gameId: response.gameId || options.gameId,
          sessionId: response.sessionId || options.sessionId,
          scope: response.scope,
          outcome: response.outcome,
          errorCode: response.errorCode,
          code: response.result.code,
          correlationId: response.result.correlationId
        });
        return;
      }

      options.addDiagnostic(response.outcome === "Completed" ? "info" : "warn", "game-scope-dump", "Game-scope dump capture finished.", {
        event: "game-scope-dump-capture-completed",
        dumpId: response.dumpId,
        gameId: response.gameId,
        sessionId: response.sessionId,
        scope: response.scope,
        outcome: response.outcome,
        itemCount: response.itemCount,
        completedUtc: response.completedUtc,
        errorCode: response.errorCode,
        correlationId: response.result.correlationId
      });
    } catch {
      setError("The dump request could not reach the Host. Check the Host connection and retry.");
      options.addDiagnostic("error", "game-scope-dump", "Game-scope dump request failed in transport.", {
        event: "game-scope-dump-capture-transport-failed",
        gameId: options.gameId,
        sessionId: options.sessionId,
        scope
      });
    } finally {
      setBusy(false);
    }
  }, [busy, capabilities?.available, options.addDiagnostic, options.credentialHandle, options.gameId, options.hostApiClient, options.sessionId]);

  return { capabilities, capabilityLoading, capabilityError, busy, error, lastCapture, refreshCapabilities, capture };
}
