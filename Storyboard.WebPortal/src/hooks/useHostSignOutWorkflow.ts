import { useCallback } from "react";
import { webPortalAssetCache } from "../cache/webPortalAssetCache";
import type { DiagnosticsLevel } from "../components/DiagnosticsConsole";
import type { HostDiscoveredGame } from "../hostApi/HostContracts";
import type { GameRenderSceneSnapshot } from "../gameRenderer";

interface RendererScaleMetrics {
  roomWidth: number;
  roomHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}

interface RendererLastClickPoint {
  clientX: number;
  clientY: number;
  viewportX: number;
  viewportY: number;
  roomX: number;
  roomY: number;
  insideRoom: boolean;
}

const DEFAULT_SESSION_NAME = "WebPortal Session";
const DEFAULT_JOIN_POLICY = "ownerOnly";

type AddDiagnostic = (level: DiagnosticsLevel, category: string, message: string, details?: unknown) => void;

interface UseHostSignOutWorkflowOptions {
  clearPresentationCueCatalog: () => void;
  refreshCacheStats: () => void;
  setCredentialHandle: (value: string) => void;
  setPrincipalName: (value: string) => void;
  setDiscoverGames: (games: HostDiscoveredGame[]) => void;
  setSelectedGameId: (value: string) => void;
  setSelectedGameKey: (value: string) => void;
  setRequestedSessionName: (value: string) => void;
  setRequestedJoinPolicy: (value: string) => void;
  resetSessionSelections: () => void;
  clearPendingCommandState: () => void;
  clearSessionOutputLines: () => void;
  clearPhasePresentationState: () => void;
  setRendererSceneSnapshot: (value: GameRenderSceneSnapshot | null) => void;
  setRendererScaleMetrics: (value: RendererScaleMetrics | null) => void;
  setRendererLastClickPoint: (value: RendererLastClickPoint | null) => void;
  resetCommandWorkflowState: () => void;
  resetHostOperationState: () => void;
  setHostStatus: (value: string) => void;
  setSelectedRoomTransitionCueEffectKey: (effectKey: string) => void;
  tryTransitionByEvents: (candidates: string[], fallbackState: string) => void;
  addDiagnostic: AddDiagnostic;
}

interface UseHostSignOutWorkflowResult {
  signOut: () => void;
}

export function useHostSignOutWorkflow(
  options: UseHostSignOutWorkflowOptions
): UseHostSignOutWorkflowResult {
  const signOut = useCallback((): void => {
    options.clearPresentationCueCatalog();
    webPortalAssetCache.clearMemory();
    options.refreshCacheStats();
    options.setCredentialHandle("");
    options.setPrincipalName("");
    options.setDiscoverGames([]);
    options.setSelectedGameId("");
    options.setSelectedGameKey("");
    options.setRequestedSessionName(DEFAULT_SESSION_NAME);
    options.setRequestedJoinPolicy(DEFAULT_JOIN_POLICY);
    options.resetSessionSelections();
    options.clearPendingCommandState();
    options.clearSessionOutputLines();
    options.clearPhasePresentationState();
    options.setRendererSceneSnapshot(null);
    options.setRendererScaleMetrics(null);
    options.setRendererLastClickPoint(null);
    options.resetCommandWorkflowState();
    options.resetHostOperationState();
    options.setHostStatus("Signed out.");
    options.setSelectedRoomTransitionCueEffectKey("");

    options.tryTransitionByEvents(["SignOutRequested"], "SignedOut");
    options.addDiagnostic("info", "auth", "Sign out requested.");
  }, [options]);

  return {
    signOut
  };
}
