import type { GameRenderSceneSnapshot } from "../contracts/sceneTypes";

export function buildEmptySceneFixture(): GameRenderSceneSnapshot {
  return {
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [],
    roomObjects: []
  };
}
