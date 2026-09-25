import { useCallback } from "react";
import { HostApiClient } from "../hostApi/client";
import type { HostGameDescriptor, HostGameDetailsDescriptor } from "../hostApi/HostContracts";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import { ensureCredentialHandle } from "./hostWorkflowGuards";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

const STATUS_SIGNING_IN = "Signing in...";
const STATUS_RESOLVING_PRINCIPAL = "Resolving current principal...";
const STATUS_DISCOVERING_GAMES = "Discovering games...";

const MSG_PRINCIPAL_REQUIRES_SIGNIN = "Current principal requires a credential handle. Sign in first.";
const MSG_DISCOVERY_REQUIRES_SIGNIN = "Game discovery requires a credential handle. Sign in first.";

interface UseHostAuthDiscoveryWorkflowOptions {
  credentialHandle: string;
  authUsername: string;
  authPassword: string;
  principalName: string;
  hostApiClient: HostApiClient;
  setCredentialHandle: (value: string) => void;
  setPrincipalName: (value: string) => void;
  setDiscoverGames: (games: HostGameDescriptor[]) => void;
  setSelectedGameId: (value: string) => void;
  setSelectedGameKey: (value: string) => void;
  resetSessionSelections: () => void;
  tryTransitionByEvents: (candidates: string[], fallbackState: string) => void;
  beginHostOperation: (operation: "auth" | "principal" | "discovery", statusMessage: string) => boolean;
  completeHostOperation: (operation: "auth" | "principal" | "discovery") => void;
  failHostOperation: (operation: "auth" | "principal" | "discovery", statusMessage: string) => void;
  setHostStatus: (value: string) => void;
  addDiagnostic: AddDiagnostic;
  formatDiagnostics: (messages: string[]) => string;
}

interface UseHostAuthDiscoveryWorkflowResult {
  signInToHost: () => Promise<void>;
  fetchCurrentPrincipal: () => Promise<void>;
  fetchDiscoveredGames: () => Promise<void>;
  fetchGameDetails: (gameId: string, gameKey: string) => Promise<HostGameDetailsDescriptor | null>;
  fetchGamePreviewImageDataUrl: (relativeLocator: string, gameId: string, gameKey: string) => Promise<string | null>;
}

export function useHostAuthDiscoveryWorkflow(
  options: UseHostAuthDiscoveryWorkflowOptions
): UseHostAuthDiscoveryWorkflowResult {
  const signInToHost = useCallback(async (): Promise<void> => {
    if (!options.beginHostOperation("auth", STATUS_SIGNING_IN)) {
      return;
    }

    try {
      const response = await options.hostApiClient.authenticate(options.authUsername, options.authPassword);
      if (!response.result.success) {
        options.failHostOperation("auth", `Sign-in failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      options.setDiscoverGames([]);
      options.setSelectedGameId("");
      options.setSelectedGameKey("");
      options.resetSessionSelections();
      options.setCredentialHandle(response.credentialHandle);
      options.setPrincipalName(response.principalName || options.authUsername);
      options.tryTransitionByEvents(["SignInSucceeded", "AuthenticateSucceeded", "AuthenticationSucceeded"], "SignedIn");
      options.setHostStatus(`Sign-in succeeded: ${response.result.code}`);
      options.addDiagnostic("info", "auth", "Host sign-in succeeded.", {
        principal: response.principalName || options.authUsername,
        resultCode: response.result.code
      });
      options.completeHostOperation("auth");
    } catch (err) {
      options.failHostOperation("auth", `Sign-in error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [options]);

  const fetchCurrentPrincipal = useCallback(async (): Promise<void> => {
    if (!ensureCredentialHandle(
      options.credentialHandle,
      options.setHostStatus,
      MSG_PRINCIPAL_REQUIRES_SIGNIN
    )) {
      return;
    }

    if (!options.beginHostOperation("principal", STATUS_RESOLVING_PRINCIPAL)) {
      return;
    }

    try {
      const response = await options.hostApiClient.getCurrentPrincipal(options.credentialHandle);
      if (!response.result.success) {
        options.failHostOperation("principal", `Current principal failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      options.setPrincipalName(response.principalName || options.principalName);
      options.setHostStatus(`Current principal succeeded: ${response.result.code}`);
      options.addDiagnostic("info", "auth", "Current principal resolved.", {
        principal: response.principalName,
        resultCode: response.result.code
      });
      options.completeHostOperation("principal");
    } catch (err) {
      options.failHostOperation("principal", `Current principal error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [options]);

  const fetchDiscoveredGames = useCallback(async (): Promise<void> => {
    if (!ensureCredentialHandle(
      options.credentialHandle,
      options.setHostStatus,
      MSG_DISCOVERY_REQUIRES_SIGNIN
    )) {
      return;
    }

    if (!options.beginHostOperation("discovery", STATUS_DISCOVERING_GAMES)) {
      return;
    }

    try {
      const response = await options.hostApiClient.discoverGames(options.credentialHandle);
      if (!response.result.success) {
        options.failHostOperation("discovery", `Discovery failed: ${response.result.code}${options.formatDiagnostics(response.result.diagnosticsMessages)}`);
        return;
      }

      options.setDiscoverGames(response.games);
      if (response.games.length > 0) {
        options.setSelectedGameId(response.games[0].gameId);
        options.setSelectedGameKey(response.games[0].gameKey);
      }
      options.setHostStatus(`Discovery succeeded: ${response.games.length} game(s) returned.`);
      options.addDiagnostic("info", "discovery", "Game discovery completed.", {
        count: response.games.length,
        resultCode: response.result.code
      });
      options.completeHostOperation("discovery");
    } catch (err) {
      options.failHostOperation("discovery", `Discovery error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [options]);

  const fetchGameDetails = useCallback(async (gameId: string, gameKey: string): Promise<HostGameDetailsDescriptor | null> => {
    if (!options.credentialHandle) {
      return null;
    }

    try {
      const response = await options.hostApiClient.getGameDetails(options.credentialHandle, gameId, gameKey);
      if (!response.result.success || !response.game) {
        return null;
      }

      return response.game;
    } catch {
      return null;
    }
  }, [options.credentialHandle, options.hostApiClient]);

  const fetchGamePreviewImageDataUrl = useCallback(async (relativeLocator: string, gameId: string, gameKey: string): Promise<string | null> => {
    if (!options.credentialHandle || !relativeLocator) {
      return null;
    }

    try {
      return await options.hostApiClient.getAssetPreviewDataUrl(options.credentialHandle, relativeLocator, gameId, gameKey);
    } catch {
      return null;
    }
  }, [options.credentialHandle, options.hostApiClient]);

  return {
    signInToHost,
    fetchCurrentPrincipal,
    fetchDiscoveredGames,
    fetchGameDetails,
    fetchGamePreviewImageDataUrl
  };
}
