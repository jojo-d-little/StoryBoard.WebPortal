import { describe, expect, it } from "vitest";
import type { GameRenderPointLightTimelineEffect } from "../../../contracts/presentationEffects/GameRenderResolvedObjectEffect";
import type { GameRenderSceneSnapshot } from "../../../contracts/sceneTypes";
import { PointLightTimelineController } from "./PointLightTimelineController";

describe("PointLightTimelineController", () => {
  it("does not complete a shared activation on another target when one target is removed", () => {
    const controller = new PointLightTimelineController();
    const effect: GameRenderPointLightTimelineEffect = {
      effectKey: "lighting.point-light.lightning.timeline",
      activationId: "shared-activation",
      kind: "pointLightTimelineStyle",
      timelineStartAtMs: 0,
      style: { frames: [{ atMs: 0, intensity: 1 }, { atMs: 100, intensity: 0 }] }
    };
    const baseline = { x: 100, y: 100, radiusPx: 40, intensityScale: 1, color: "#ffffff", lightHeightCells: 0 };
    controller.apply("parent", effect, baseline);
    controller.apply("child", effect, baseline);
    controller.remove("parent");
    const scene = {
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: {
        child: { objectId: "child", objectName: "Child", activePresentationCues: [], lighting: { pointLight: baseline } }
      }
    } as unknown as GameRenderSceneSnapshot;

    const projected = controller.applyToScene(scene, 50);
    expect(projected.objectsById.child.lighting?.pointLight?.intensityScale).toBeCloseTo(0.5);
  });
});
