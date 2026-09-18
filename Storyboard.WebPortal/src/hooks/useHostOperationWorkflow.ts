import { useCallback, useState } from "react";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import type { HostOperationKey, HostOperationPhase } from "./useHostWorkflow";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UseHostOperationWorkflowOptions {
  addDiagnostic: AddDiagnostic;
}

interface UseHostOperationWorkflowResult {
  hostStatus: string;
  setHostStatus: (value: string) => void;
  hostBusy: boolean;
  hostOperationKey: HostOperationKey;
  hostOperationPhase: HostOperationPhase;
  beginHostOperation: (operation: HostOperationKey, statusMessage: string) => boolean;
  completeHostOperation: (operation: HostOperationKey) => void;
  failHostOperation: (operation: HostOperationKey, statusMessage: string) => void;
  resetHostOperationState: () => void;
}

export function useHostOperationWorkflow(
  options: UseHostOperationWorkflowOptions
): UseHostOperationWorkflowResult {
  const [hostStatus, setHostStatus] = useState<string>("Host workflow idle.");
  const [hostBusy, setHostBusy] = useState<boolean>(false);
  const [hostOperationKey, setHostOperationKey] = useState<HostOperationKey>("none");
  const [hostOperationPhase, setHostOperationPhase] = useState<HostOperationPhase>("Idle");

  const beginHostOperation = useCallback((operation: HostOperationKey, statusMessage: string): boolean => {
    if (hostBusy) {
      setHostStatus("Another host operation is in progress. Please wait.");
      options.addDiagnostic("warn", "host-operation", "Attempted operation while another operation was in progress.", {
        requestedOperation: operation,
        activeOperation: hostOperationKey
      });
      return false;
    }

    setHostBusy(true);
    setHostOperationKey(operation);
    setHostOperationPhase("Running");
    setHostStatus(statusMessage);
    options.addDiagnostic("info", "host-operation", statusMessage, { operation });
    return true;
  }, [hostBusy, hostOperationKey, options]);

  const completeHostOperation = useCallback((operation: HostOperationKey): void => {
    setHostBusy(false);
    setHostOperationKey(operation);
    setHostOperationPhase("Idle");
    options.addDiagnostic("info", "host-operation", `Operation completed: ${operation}.`);
  }, [options]);

  const failHostOperation = useCallback((operation: HostOperationKey, statusMessage: string): void => {
    setHostBusy(false);
    setHostOperationKey(operation);
    setHostOperationPhase("Failed");
    setHostStatus(statusMessage);
    options.addDiagnostic("error", "host-operation", statusMessage, { operation });
  }, [options]);

  const resetHostOperationState = useCallback((): void => {
    setHostBusy(false);
    setHostOperationKey("none");
    setHostOperationPhase("Idle");
  }, []);

  return {
    hostStatus,
    setHostStatus,
    hostBusy,
    hostOperationKey,
    hostOperationPhase,
    beginHostOperation,
    completeHostOperation,
    failHostOperation,
    resetHostOperationState
  };
}
