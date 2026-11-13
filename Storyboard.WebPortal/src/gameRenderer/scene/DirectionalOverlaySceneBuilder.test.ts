import { describe, expect, it } from "vitest";
import type { GameRenderDirectionalOverlay } from "../contracts/sceneTypes";
import { buildDirectionalOverlayScene } from "./DirectionalOverlaySceneBuilder";

function overlay(id: string, slot: string, zOrder: number): GameRenderDirectionalOverlay {
  return {
    id,
    slot,
    asset: { assetPath: "assets/shared.png" },
    x: zOrder * 10,
    y: -zOrder,
    rotationDegrees: 0,
    scale: 1,
    zOrder
  };
}

describe("buildDirectionalOverlayScene", () => {
  it("keeps every ordered entry from the Default slot in Independent mode", () => {
    const scene = buildDirectionalOverlayScene({
      displayMode: "independent",
      overlays: [
        overlay("north", "North", 0),
        overlay("default-piece", "Default", 3),
        overlay("default-base", "Default", 1)
      ]
    });

    expect(scene.map(({ id }) => id)).toEqual(["default-base", "default-piece"]);
  });

  it("selects every entry in the first ordered slot when Default is absent", () => {
    const scene = buildDirectionalOverlayScene({
      displayMode: "independent",
      overlays: [
        overlay("west-piece", "West", 5),
        overlay("north", "North", 6),
        overlay("west-base", "West", 2)
      ]
    });

    expect(scene.map(({ id }) => id)).toEqual(["west-base", "west-piece"]);
  });

  it("keeps all ordered slot groups in Composed mode", () => {
    const scene = buildDirectionalOverlayScene({
      displayMode: "composed",
      overlays: [overlay("south", "South", 3), overlay("north", "North", 1)]
    });

    expect(scene.map(({ id }) => id)).toEqual(["north", "south"]);
  });
});
