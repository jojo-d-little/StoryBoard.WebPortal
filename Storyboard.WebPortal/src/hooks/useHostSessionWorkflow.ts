import { useCallback } from "react";
import { HostApiClient } from "../hostApi/client";
import type { HostSessionDescriptor } from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { ensureCredentialHandle } from "./hostWorkflowGuards";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

type SessionAttachReason = "session-start" | "session-join" | "session-reconnect";

const MSG_SIGNIN_REQUIRED_START = "Start session requires sign-in first.";
const MSG_SIGNIN_REQUIRED_LIST = "List sessions requires sign-in first.";
const MSG_SIGNIN_REQUIRED_JOIN = "Join session requires sign-in first.";
const MSG_SIGNIN_REQUIRED_LEAVE = "Leave session requires sign-in first.";
const MSG_SIGNIN_REQUIRED_RECONNECT = "Reconnect requires sign-in first.";

const MSG_SELECTED_GAME_REQUIRED = "Start session requires a selected game. Discover games first.";
const MSG_SELECTED_SESSION_REQUIRED = "Join session requires a selected session. List sessions first.";
const MSG_ACTIVE_OR_SELECTED_SESSION_REQUIRED = "Leave session requires an active or selected session.";
const MSG_RECONNECT_SESSION_REQUIRED = "Reconnect requires a session id.";

const MSG_OWNER_REQUIRED_QUIT = "Quit game is only available to the current session owner.";
const MSG_RETURNED_TO_LOBBY = "Returned to lobby.";
const MSG_QUIT_FALLBACK_NOTE = "Quit game requested. Using leave-session endpoint until host supports explicit quit.";

const STATUS_STARTING_SESSION = "Starting session...";
const STATUS_LISTING_SESSIONS = "Listing sessions...";
const STATUS_JOINING_SESSION = "Joining session...";
const STATUS_LEAVING_SESSION = "Leaving session...";
const STATUS_RECONNECTING_SESSION = "Reconnecting session...";

const ERR_PREFIX_START = "Start session error";
const ERR_PREFIX_LIST = "List sessions error";
const ERR_PREFIX_JOIN = "Join session error";
const ERR_PREFIX_LEAVE = "Leave session error";
const ERR_PREFIX_RECONNECT = "Reconnect error";

interface UseHostSessionWorkflowOptions {
  credentialHandle: string;
  selectedGameId: string;
  selectedGameKey: string;
  requestedSessionName: string;
  requestedJoinPolicy: string;
  selectedSessionId: string;
  activeSessionId: string;
  activeSessionIsOwner: boolean;
  hostApiClient: HostApiClient;
  setSessions: (sessions: HostSessionDescriptor[]) => void;
  setSelectedSessionId: (sessionId: string) => void;
  setActiveSessionId: (sessionId: string) => void;
  setActiveSessionIsOwner: (isOwner: boolean) => void;
  setSelectedGameId: (value: string | ((current: string) => string)) => void;
  setSelectedGameKey: (value: string | ((current: string) => string)) => void;
  setRendererLastClickPoint: (value: null) => void;
  setRendererSceneSnapshot: (value: null) => void;
  setRendererScaleMetrics: (value: null) => void;
  clearPendingCommandState: () => void;
  resetSessionEchoForAttach: (reason: SessionAttachReason, targetSessionId: string) => void;
  resetSessionPhasePresentationForAttach: (reason: SessionAttachReason, targetSessionId: string) => void;
  tryTransitionByEvents: (candidates: string[], fallbackState: string) => void;
  beginHostOperation: (operation: "sessionStart" | "sessionList" | "sessionJoin" | "sessionLeave" | "sessionReconnect", statusMessage: string) => boolean;
  completeHostOperation: (operation: "sessionStart" | "sessionList" | "sessionJoin" | "sessionLeave" | "sessionReconnect") => void;
  failHostOperation: (operation: "sessionStart" | "sessionList" | "sessionJoin" | "sessionLeave" | "sessionReconnect", statusMessage: string) => void;
  setHostStatus: (value: string) => void;
  addDiagnostic: AddDiagnostic;
  formatDiagnostics: (messages: string[]) => string;
}

interface UseHostSessionWorkflowResult {
  resetSessionSelections: () => void;
  startSessionFromSelectedGame: () => Promise<void>;
  startSessionForGame: (gameId: string, gameKey: string) => Promise<void>;
  listHostSessions: () => Promise<void>;
  joinSelectedSession: () => Promise<void>;
  joinSessionById: (sessionId: string) => Promise<void>;
  leaveActiveSession: () => Promise<void>;
  quitActiveSession: () => Promise<void>;
  reconnectActiveSession: () => Promise<void>;
  returnToLobby: () => void;
}

type SessionOperationKey = "sessionStart" | "sessionList" | "sessionJoin" | "sessionLeave" | "sessionReconnect";

interface SessionOperationExecutionOptions {
  operation: SessionOperationKey;
  statusMessage: string;
  errorPrefix: string;
  execute: () => Promise<void>;
  onError?: () => void;
}

interface SessionOperationSuccessOptions {
  operation: SessionOperationKey;
  hostStatusMessage: string;
  diagnosticMessage: string;
  diagnosticDetails?: unknown;
}

export function useHostSessionWorkflow(options: UseHostSessionWorkflowOptions): UseHostSessionWorkflowResult {
  const resetEchoForSessionAttach = useCallback((reason: SessionAttachReason, targetSessionId: string): void => {
    options.clearPendingCommandState();
    options.resetSessionEchoForAttach(reason, targetSessionId);
    options.resetSessionPhasePresentationForAttach(reason, targetSessionId);
  }, [options]);

  const resetSessionSelections = useCallback((): void => {
    options.setSessions([]);
    options.setSelectedSessionId("");
    options.setActiveSessionId("");
    options.setActiveSessionIsOwner(false);
  }, [options]);

  const runSessionOperation = useCallback(async ({
    operation,
    statusMessage,
    errorPrefix,
    execute,
    onError
  }: SessionOperationExecutionOptions): Promise<void> => {
    if (!options.beginHostOperation(operation, statusMessage)) {
      return;
    }

    try {
      await execute();
    } catch (err) {
      options.failHostOperation(operation, `${errorPrefix}: ${err instanceof Error ? err.message : String(err)}`);
      onError?.();
    }
  }, [options]);

  const completeSessionOperationSuccess = useCallback(({
    operation,
    hostStatusMessage,
    diagnosticMessage,
    diagnosticDetails
  }: SessionOperationSuccessOptions): void => {
    options.setHostStatus(hostStatusMessage);
    options.addDiagnostic("info", "session", diagnosticMessage, diagnosticDetails);
    options.completeHostOperation(operation);
  }, [options]);

  const startSessionFromSelectedGame = useCallback(async (): Promise<void> => {
    if (!ensureCredentialHandle(options.credentialHandle, options.setHostStatus, MSG_SIGNIN_REQUIRED_START)) {
      return;
    }

    if (!options.selectedGameId && !options.selectedGameKey) {
      options.setHostStatus(MSG_SELECTED_GAME_REQUIRED);
      return;
    }

    await runSessionOperation({
      operation: "sessionStart",
      statusMessage: STATUS_STARTING_SESSION,
      errorPrefix: ERR_PREFIX_START,
      execute: async () => {
      const response = await options.hostApiClient.startSession(
        options.credentialHandle,
        options.selectedGameId,
        options.selectedGameKey,
        options.requestedSessionName,
        options.requestedJoinPolicy
      );

      if (!response.result.success || !response.created) {
        options.failHostOperation("sessionStart", `Start session failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      const createdSessionId = response.session?.sessionId || "";
      if (createdSessionId) {
        options.setActiveSessionId(createdSessionId);
        options.setSelectedSessionId(createdSessionId);
        options.setActiveSessionIsOwner(Boolean(response.session?.isOwner));
        resetEchoForSessionAttach("session-start", createdSessionId);
      }

      options.tryTransitionByEvents(["StartSessionSucceeded", "StartSessionSuccess", "SessionStartSucceeded"], "SessionActive");
      completeSessionOperationSuccess({
        operation: "sessionStart",
        hostStatusMessage: `Start session succeeded: ${response.result.code}`,
        diagnosticMessage: "Session start succeeded.",
        diagnosticDetails: {
          sessionId: createdSessionId,
          resultCode: response.result.code
        }
      });
      }
    });
  }, [options, runSessionOperation, completeSessionOperationSuccess]);

  const startSessionForGame = useCallback(async (gameId: string, gameKey: string): Promise<void> => {
    if (!ensureCredentialHandle(options.credentialHandle, options.setHostStatus, MSG_SIGNIN_REQUIRED_START)) {
      return;
    }

    if (!gameId && !gameKey) {
      options.setHostStatus(MSG_SELECTED_GAME_REQUIRED);
      return;
    }

    await runSessionOperation({
      operation: "sessionStart",
      statusMessage: STATUS_STARTING_SESSION,
      errorPrefix: ERR_PREFIX_START,
      execute: async () => {
      const response = await options.hostApiClient.startSession(
        options.credentialHandle,
        gameId,
        gameKey,
        options.requestedSessionName,
        options.requestedJoinPolicy
      );

      if (!response.result.success || !response.created) {
        options.failHostOperation("sessionStart", `Start session failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      options.setSelectedGameId(gameId);
      options.setSelectedGameKey(gameKey);

      const createdSessionId = response.session?.sessionId || "";
      if (createdSessionId) {
        options.setActiveSessionId(createdSessionId);
        options.setSelectedSessionId(createdSessionId);
        options.setActiveSessionIsOwner(Boolean(response.session?.isOwner));
        resetEchoForSessionAttach("session-start", createdSessionId);
      }

      options.tryTransitionByEvents(["StartSessionSucceeded", "StartSessionSuccess", "SessionStartSucceeded"], "SessionActive");
      completeSessionOperationSuccess({
        operation: "sessionStart",
        hostStatusMessage: `Start session succeeded: ${response.result.code}`,
        diagnosticMessage: "Session start succeeded.",
        diagnosticDetails: {
          sessionId: createdSessionId,
          resultCode: response.result.code
        }
      });
      }
    });
  }, [options, runSessionOperation, completeSessionOperationSuccess]);

  const listHostSessions = useCallback(async (): Promise<void> => {
    if (!ensureCredentialHandle(options.credentialHandle, options.setHostStatus, MSG_SIGNIN_REQUIRED_LIST)) {
      return;
    }

    await runSessionOperation({
      operation: "sessionList",
      statusMessage: STATUS_LISTING_SESSIONS,
      errorPrefix: ERR_PREFIX_LIST,
      execute: async () => {
      const hasActiveGameFilter = Boolean(options.activeSessionId) && (Boolean(options.selectedGameId) || Boolean(options.selectedGameKey));

      const response = await options.hostApiClient.listSessions(options.credentialHandle, {
        gameId: hasActiveGameFilter ? options.selectedGameId : "",
        gameKey: hasActiveGameFilter ? options.selectedGameKey : "",
        includeOwnOnly: false,
        includeJoinableOnly: false,
        maxItems: 25
      });

      if (!response.result.success) {
        options.failHostOperation("sessionList", `List sessions failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      options.setSessions(response.sessions);
      if (options.activeSessionId) {
        const activeSession = response.sessions.find((session) => session.sessionId === options.activeSessionId);
        if (activeSession) {
          options.setActiveSessionIsOwner(Boolean(activeSession.isOwner));
        }
      }

      if (response.sessions.length > 0) {
        const stillSelected = response.sessions.some((session) => session.sessionId === options.selectedSessionId);
        if (!stillSelected) {
          options.setSelectedSessionId(response.sessions[0].sessionId);
        }
      } else {
        options.setSelectedSessionId("");
      }

      completeSessionOperationSuccess({
        operation: "sessionList",
        hostStatusMessage: `List sessions succeeded: ${response.sessions.length} session(s) available.`,
        diagnosticMessage: "Session list loaded.",
        diagnosticDetails: {
          count: response.sessions.length,
          resultCode: response.result.code
        }
      });
      }
    });
  }, [options, runSessionOperation, completeSessionOperationSuccess]);

  const joinSessionById = useCallback(async (sessionId: string): Promise<void> => {
    if (!ensureCredentialHandle(options.credentialHandle, options.setHostStatus, MSG_SIGNIN_REQUIRED_JOIN)) {
      return;
    }

    if (!sessionId) {
      options.setHostStatus(MSG_SELECTED_SESSION_REQUIRED);
      return;
    }

    await runSessionOperation({
      operation: "sessionJoin",
      statusMessage: STATUS_JOINING_SESSION,
      errorPrefix: ERR_PREFIX_JOIN,
      execute: async () => {
      const response = await options.hostApiClient.joinSession(options.credentialHandle, sessionId);
      if (!response.result.success || !response.joined) {
        options.failHostOperation("sessionJoin", `Join session failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      const joinedSessionId = response.session?.sessionId || sessionId;
      options.setSelectedGameId((current) => response.session?.gameId || current);
      options.setSelectedGameKey((current) => response.session?.gameKey || current);
      options.setActiveSessionId(joinedSessionId);
      options.setSelectedSessionId(joinedSessionId);
      options.setActiveSessionIsOwner(Boolean(response.session?.isOwner));
      resetEchoForSessionAttach("session-join", joinedSessionId);
      options.tryTransitionByEvents(["JoinSessionSucceeded", "JoinSessionSuccess"], "SessionActive");
      completeSessionOperationSuccess({
        operation: "sessionJoin",
        hostStatusMessage: `Join session succeeded: ${response.result.code}`,
        diagnosticMessage: "Session join succeeded.",
        diagnosticDetails: {
          sessionId: joinedSessionId,
          resultCode: response.result.code
        }
      });
      }
    });
  }, [options, runSessionOperation, completeSessionOperationSuccess]);

  const joinSelectedSession = useCallback(async (): Promise<void> => {
    await joinSessionById(options.selectedSessionId);
  }, [joinSessionById, options.selectedSessionId]);

  const leaveActiveSession = useCallback(async (): Promise<void> => {
    if (!ensureCredentialHandle(options.credentialHandle, options.setHostStatus, MSG_SIGNIN_REQUIRED_LEAVE)) {
      return;
    }

    const targetSessionId = options.activeSessionId || options.selectedSessionId;
    if (!targetSessionId) {
      options.setHostStatus(MSG_ACTIVE_OR_SELECTED_SESSION_REQUIRED);
      return;
    }

    await runSessionOperation({
      operation: "sessionLeave",
      statusMessage: STATUS_LEAVING_SESSION,
      errorPrefix: ERR_PREFIX_LEAVE,
      execute: async () => {
      const response = await options.hostApiClient.leaveSession(options.credentialHandle, targetSessionId);
      if (!response.result.success || !response.left) {
        options.failHostOperation("sessionLeave", `Leave session failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      options.setActiveSessionId("");
      options.setActiveSessionIsOwner(false);
      options.setRendererLastClickPoint(null);
      options.clearPendingCommandState();
      options.tryTransitionByEvents(["LeaveSessionSucceeded", "LeaveSessionSuccess"], "SignedIn");
      completeSessionOperationSuccess({
        operation: "sessionLeave",
        hostStatusMessage: `Leave session succeeded: ${response.result.code}`,
        diagnosticMessage: "Session leave succeeded.",
        diagnosticDetails: {
          sessionId: targetSessionId,
          resultCode: response.result.code
        }
      });
      }
    });
  }, [options, runSessionOperation, completeSessionOperationSuccess]);

  const quitActiveSession = useCallback(async (): Promise<void> => {
    if (!options.activeSessionIsOwner) {
      options.setHostStatus(MSG_OWNER_REQUIRED_QUIT);
      return;
    }

    options.addDiagnostic("info", "session", MSG_QUIT_FALLBACK_NOTE);
    await leaveActiveSession();
  }, [leaveActiveSession, options]);

  const reconnectActiveSession = useCallback(async (): Promise<void> => {
    if (!ensureCredentialHandle(options.credentialHandle, options.setHostStatus, MSG_SIGNIN_REQUIRED_RECONNECT)) {
      return;
    }

    const targetSessionId = options.activeSessionId || options.selectedSessionId;
    if (!targetSessionId) {
      options.setHostStatus(MSG_RECONNECT_SESSION_REQUIRED);
      return;
    }

    await runSessionOperation({
      operation: "sessionReconnect",
      statusMessage: STATUS_RECONNECTING_SESSION,
      errorPrefix: ERR_PREFIX_RECONNECT,
      execute: async () => {
      const response = await options.hostApiClient.joinSession(options.credentialHandle, targetSessionId);
      if (!response.result.success || !response.joined) {
        options.failHostOperation("sessionReconnect", `Reconnect failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        options.tryTransitionByEvents(["ReconnectFailed"], "SessionDisconnected");
        return;
      }

      const joinedSessionId = response.session?.sessionId || targetSessionId;
      options.setActiveSessionId(joinedSessionId);
      options.setSelectedSessionId(joinedSessionId);
      options.setActiveSessionIsOwner(Boolean(response.session?.isOwner));
      resetEchoForSessionAttach("session-reconnect", joinedSessionId);
      options.tryTransitionByEvents(["ReconnectSucceeded"], "SessionActive");
      completeSessionOperationSuccess({
        operation: "sessionReconnect",
        hostStatusMessage: `Reconnect succeeded: ${response.result.code}`,
        diagnosticMessage: "Session reconnect succeeded.",
        diagnosticDetails: {
          sessionId: joinedSessionId,
          resultCode: response.result.code
        }
      });
      },
      onError: () => {
        options.tryTransitionByEvents(["ReconnectFailed"], "SessionDisconnected");
      }
    });
  }, [options, runSessionOperation, completeSessionOperationSuccess]);

  const returnToLobby = useCallback((): void => {
    options.setActiveSessionId("");
    options.setActiveSessionIsOwner(false);
    options.setRendererSceneSnapshot(null);
    options.setRendererScaleMetrics(null);
    options.setRendererLastClickPoint(null);
    options.clearPendingCommandState();
    options.tryTransitionByEvents(["ReturnToLobbyRequested"], "SignedIn");
    options.setHostStatus(MSG_RETURNED_TO_LOBBY);
    options.addDiagnostic("info", "session", "Return to lobby requested from disconnected state.");
  }, [options]);

  return {
    resetSessionSelections,
    startSessionFromSelectedGame,
    startSessionForGame,
    listHostSessions,
    joinSelectedSession,
    joinSessionById,
    leaveActiveSession,
    quitActiveSession,
    reconnectActiveSession,
    returnToLobby
  };
}
