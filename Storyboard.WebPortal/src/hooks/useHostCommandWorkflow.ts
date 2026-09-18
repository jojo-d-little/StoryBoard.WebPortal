import { useRef, useState } from "react";
import { HostApiClient } from "../hostApi/client";
import type {
  HostPendingClarificationRequest,
  HostProcessCommandResult,
  HostClarificationAnswer,
  HostGameDiagnosticsLevel
} from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { ensureSignedInSessionContext } from "./hostWorkflowGuards";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

const MAX_COMMAND_CORRELATION_ID = 2_147_483_647;

const STATUS_SUBMITTING_COMMAND = "Submitting command...";
const STATUS_SUBMITTING_CLARIFICATION = "Submitting clarification answer...";

const MSG_COMMAND_REQUIRES_ACTIVE_SESSION = "Command requires an active session.";
const MSG_COMMAND_CANNOT_BE_EMPTY = "Command cannot be empty.";
const MSG_CLARIFICATION_REQUIRES_CONTEXT = "Clarification requires an active signed-in session.";
const MSG_NO_PENDING_CLARIFICATION = "There is no pending clarification to answer.";
const MSG_CLARIFICATION_CANNOT_BE_EMPTY = "Clarification answer cannot be empty.";
const MSG_CLARIFICATION_STATE_MISSING = "Clarification state is missing command correlation data.";

const MSG_DIAGNOSTICS_COMMAND = "Command diagnostics returned.";
const MSG_DIAGNOSTICS_CLARIFICATION = "Clarification diagnostics returned.";
const MSG_DUPLICATE_CORRELATION_RETRY = "Duplicate command correlation id detected; retrying with a new id.";

const STATUS_PREFIX_COMMAND_PROCESSED = "Command processed";
const STATUS_PREFIX_COMMAND_CLARIFIED = "Command clarification processed";

function createInitialCommandCorrelationId(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const seed = new Uint32Array(1);
    crypto.getRandomValues(seed);
    return Math.max(1, (seed[0] % MAX_COMMAND_CORRELATION_ID) + 1);
  }

  return Math.max(1, Math.floor(Math.random() * MAX_COMMAND_CORRELATION_ID));
}

interface UseHostCommandWorkflowOptions {
  credentialHandle: string;
  activeSessionId: string;
  hostApiClient: HostApiClient;
  beginHostOperation: (operation: "command", statusMessage: string) => boolean;
  completeHostOperation: (operation: "command") => void;
  failHostOperation: (operation: "command", statusMessage: string) => void;
  setHostStatus: (value: string) => void;
  appendClientCommandEcho: (commandText: string) => void;
  addDiagnostic: AddDiagnostic;
}

interface UseHostCommandWorkflowResult {
  pendingCommandClarification: HostPendingClarificationRequest | null;
  lastCommandResult: HostProcessCommandResult | null;
  submitCommand: (rawCommandText: string, options?: { suppressClientEcho?: boolean }) => Promise<HostProcessCommandResult | null>;
  submitClarificationAnswer: (selectedObjectScopeNodeId: string) => Promise<void>;
  clearPendingCommandState: () => void;
  resetCommandWorkflowState: () => void;
}

interface CommandExecutionRequest {
  commandCorrelationId: number;
  rawCommandText: string;
  clarificationAnswers: HostClarificationAnswer[];
  priority: HostGameDiagnosticsLevel;
}

interface CommandResponseHandlingContext {
  fallbackCommandCorrelationId: number;
  fallbackRawCommandText: string;
  statusPrefix: string;
  diagnosticsMessage: string;
}

export function useHostCommandWorkflow(options: UseHostCommandWorkflowOptions): UseHostCommandWorkflowResult {
  const [pendingCommandClarification, setPendingCommandClarification] = useState<HostPendingClarificationRequest | null>(null);
  const [lastCommandResult, setLastCommandResult] = useState<HostProcessCommandResult | null>(null);
  const nextCommandCorrelationIdRef = useRef<number>(createInitialCommandCorrelationId());
  const pendingCommandCorrelationIdRef = useRef<number | null>(null);
  const pendingRawCommandTextRef = useRef<string>("");

  function clearPendingCommandState(): void {
    setPendingCommandClarification(null);
    pendingCommandCorrelationIdRef.current = null;
    pendingRawCommandTextRef.current = "";
  }

  function resetCommandWorkflowState(): void {
    clearPendingCommandState();
    setLastCommandResult(null);
  }

  function reserveCommandCorrelationId(): number {
    const next = nextCommandCorrelationIdRef.current;
    nextCommandCorrelationIdRef.current = next >= MAX_COMMAND_CORRELATION_ID ? 1 : next + 1;
    return next;
  }

  async function processCommandRequest(request: CommandExecutionRequest): Promise<HostProcessCommandResult> {
    return options.hostApiClient.processCommand(
      options.credentialHandle,
      options.activeSessionId,
      request.commandCorrelationId,
      request.rawCommandText,
      request.clarificationAnswers,
      request.priority
    );
  }

  function handleCommandResponse(
    response: HostProcessCommandResult,
    context: CommandResponseHandlingContext
  ): void {
    setLastCommandResult(response);

    if (response.clarificationRequired && response.pendingClarification) {
      setPendingCommandClarification(response.pendingClarification);
      pendingCommandCorrelationIdRef.current = response.commandCorrelationId || context.fallbackCommandCorrelationId;
      pendingRawCommandTextRef.current = response.rawCommandText || context.fallbackRawCommandText;
    } else {
      clearPendingCommandState();
    }

    if (response.diagnostics.length > 0) {
      options.addDiagnostic("info", "command", context.diagnosticsMessage, {
        resultCode: response.resultCode,
        diagnostics: response.diagnostics
      });
    }

    options.setHostStatus(`${context.statusPrefix}: ${response.resultCode}`);
    options.completeHostOperation("command");
  }

  async function submitCommand(rawCommandText: string, submitOptions?: { suppressClientEcho?: boolean }): Promise<HostProcessCommandResult | null> {
    if (!options.activeSessionId) {
      options.setHostStatus(MSG_COMMAND_REQUIRES_ACTIVE_SESSION);
      return null;
    }

    const commandText = rawCommandText.trim();
    if (!commandText) {
      options.setHostStatus(MSG_COMMAND_CANNOT_BE_EMPTY);
      return null;
    }

    if (!options.beginHostOperation("command", STATUS_SUBMITTING_COMMAND)) {
      return null;
    }

    const initialCommandCorrelationId = reserveCommandCorrelationId();
    if (!submitOptions?.suppressClientEcho) {
      options.appendClientCommandEcho(commandText);
    }

    try {
      let response = await processCommandRequest({
        commandCorrelationId: initialCommandCorrelationId,
        rawCommandText: commandText,
        clarificationAnswers: [],
        priority: "Low"
      });

      let effectiveCommandCorrelationId = initialCommandCorrelationId;

      if (response.resultCode === "DuplicateCorrelationId") {
        const retryCommandCorrelationId = reserveCommandCorrelationId();
        options.addDiagnostic("warn", "command", MSG_DUPLICATE_CORRELATION_RETRY, {
          initialCommandCorrelationId,
          retryCommandCorrelationId,
          sessionId: options.activeSessionId
        });

        response = await processCommandRequest({
          commandCorrelationId: retryCommandCorrelationId,
          rawCommandText: commandText,
          clarificationAnswers: [],
          priority: "Low"
        });
        effectiveCommandCorrelationId = retryCommandCorrelationId;
      }

      handleCommandResponse(response, {
        fallbackCommandCorrelationId: effectiveCommandCorrelationId,
        fallbackRawCommandText: commandText,
        statusPrefix: STATUS_PREFIX_COMMAND_PROCESSED,
        diagnosticsMessage: MSG_DIAGNOSTICS_COMMAND
      });

      return response;
    } catch (err) {
      options.failHostOperation("command", `Command error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async function submitClarificationAnswer(selectedObjectScopeNodeId: string): Promise<void> {
    if (!ensureSignedInSessionContext(
      options.credentialHandle,
      options.activeSessionId,
      options.setHostStatus,
      MSG_CLARIFICATION_REQUIRES_CONTEXT
    )) {
      return;
    }

    if (!pendingCommandClarification) {
      options.setHostStatus(MSG_NO_PENDING_CLARIFICATION);
      return;
    }

    if (!selectedObjectScopeNodeId.trim()) {
      options.setHostStatus(MSG_CLARIFICATION_CANNOT_BE_EMPTY);
      return;
    }

    if (!options.beginHostOperation("command", STATUS_SUBMITTING_CLARIFICATION)) {
      return;
    }

    const commandCorrelationId = pendingCommandCorrelationIdRef.current;
    const rawCommandText = pendingRawCommandTextRef.current;
    if (!commandCorrelationId || !rawCommandText) {
      options.failHostOperation("command", MSG_CLARIFICATION_STATE_MISSING);
      return;
    }

    try {
      const response = await processCommandRequest({
        commandCorrelationId,
        rawCommandText,
        clarificationAnswers: [{
          slotId: pendingCommandClarification.slotId,
          selectedObjectScopeNodeId: selectedObjectScopeNodeId.trim()
        }],
        priority: "Low"
      });

      handleCommandResponse(response, {
        fallbackCommandCorrelationId: commandCorrelationId,
        fallbackRawCommandText: rawCommandText,
        statusPrefix: STATUS_PREFIX_COMMAND_CLARIFIED,
        diagnosticsMessage: MSG_DIAGNOSTICS_CLARIFICATION
      });
    } catch (err) {
      options.failHostOperation("command", `Clarification error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    pendingCommandClarification,
    lastCommandResult,
    submitCommand,
    submitClarificationAnswer,
    clearPendingCommandState,
    resetCommandWorkflowState
  };
}
