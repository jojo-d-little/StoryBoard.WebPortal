import { useCallback } from "react";
import { webPortalAssetCache } from "../cache/webPortalAssetCache";

interface UseHostGameSelectionWorkflowOptions {
  selectedGameId: string;
  selectedGameKey: string;
  clearPresentationCueCatalog: () => void;
  refreshCacheStats: () => void;
  setSelectedRoomTransitionCueEffectKey: (effectKey: string) => void;
  setSelectedGameId: (value: string) => void;
  setSelectedGameKey: (value: string) => void;
}

interface UseHostGameSelectionWorkflowResult {
  setSelectedGame: (gameId: string, gameKey: string) => void;
}

function stringEqualsIgnoreCase(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

export function useHostGameSelectionWorkflow(
  options: UseHostGameSelectionWorkflowOptions
): UseHostGameSelectionWorkflowResult {
  const setSelectedGame = useCallback((gameId: string, gameKey: string): void => {
    const previousSelection = `${options.selectedGameId}|${options.selectedGameKey}`;
    const nextSelection = `${gameId}|${gameKey}`;
    if (!stringEqualsIgnoreCase(previousSelection, nextSelection)) {
      options.clearPresentationCueCatalog();
      webPortalAssetCache.clearMemory();
      options.refreshCacheStats();
      options.setSelectedRoomTransitionCueEffectKey("");
    }

    options.setSelectedGameId(gameId);
    options.setSelectedGameKey(gameKey);
  }, [options]);

  return {
    setSelectedGame
  };
}
