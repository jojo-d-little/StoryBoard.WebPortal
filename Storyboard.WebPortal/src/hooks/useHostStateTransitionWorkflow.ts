import { useCallback } from "react";
import { tryTransition } from "../orchestration/resolver";
import type { OrchestrationContracts } from "../orchestration/types";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UseHostStateTransitionWorkflowOptions {
  contracts: OrchestrationContracts | null;
  state: string;
  states: string[];
  onStateChange: (nextState: string) => void;
  addDiagnostic: AddDiagnostic;
}

interface UseHostStateTransitionWorkflowResult {
  tryTransitionByEvents: (candidates: string[], fallbackState: string) => void;
  triggerStateEvent: (eventName: string) => void;
}

export function useHostStateTransitionWorkflow(
  options: UseHostStateTransitionWorkflowOptions
): UseHostStateTransitionWorkflowResult {
  const tryTransitionByEvents = useCallback((candidates: string[], fallbackState: string): void => {
    if (!options.contracts) {
      return;
    }

    for (const eventName of candidates) {
      const next = tryTransition(options.contracts, options.state, eventName);
      if (next) {
        options.onStateChange(next);
        return;
      }
    }

    if (options.states.includes(fallbackState)) {
      options.onStateChange(fallbackState);
    }
  }, [options]);

  const triggerStateEvent = useCallback((eventName: string): void => {
    if (!options.contracts) {
      return;
    }

    const next = tryTransition(options.contracts, options.state, eventName);
    if (!next) {
      options.addDiagnostic("warn", "state", `No transition found for event '${eventName}' from state '${options.state}'.`);
      return;
    }

    options.onStateChange(next);
    options.addDiagnostic("info", "state", `Transitioned from ${options.state} to ${next}.`, { event: eventName });
  }, [options]);

  return {
    tryTransitionByEvents,
    triggerStateEvent
  };
}
