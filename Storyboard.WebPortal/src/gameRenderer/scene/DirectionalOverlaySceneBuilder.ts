import type { GameRenderDisplayMode, GameRenderDirectionalOverlay } from "../contracts/sceneTypes";

export interface BuildDirectionalOverlaySceneInput {
  overlays: GameRenderDirectionalOverlay[];
  displayMode: GameRenderDisplayMode;
}

export function buildDirectionalOverlayScene(input: BuildDirectionalOverlaySceneInput): GameRenderDirectionalOverlay[] {
  const ordered = [...input.overlays].sort((a, b) => {
    if (a.zOrder !== b.zOrder) {
      return a.zOrder - b.zOrder;
    }

    return a.id.localeCompare(b.id);
  });

  if (input.displayMode !== "independent") {
    return ordered;
  }

  const selected = ordered.find((overlay) => overlay.slot.toLowerCase() === "default") ?? ordered[0];
  return selected ? ordered.filter((overlay) => overlay.slot.toLowerCase() === selected.slot.toLowerCase()) : [];
}
