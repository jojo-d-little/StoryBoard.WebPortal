import { describe, expect, it } from "vitest";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import {
  advanceLightingMovementTweens,
  createLightingMovementTween,
  projectSpriteAnchoredBlocker,
  projectSpriteAnchoredPointLight,
  projectLightingMovement
} from "./lightingMovementProjection";

const fromLighting = {
  pointLight: { x: 20, y: 30, radiusPx: 100 },
  spatialFootprint: { cellX: 1, cellY: 2, sizeXCells: 1, sizeYCells: 1 },
  lightOcclusion: { strength: 1 }
};

function scene(): GameRenderSceneSnapshot {
  return {
    roomId: "room-1",
    displayMode: "composed",
    bounds: { width: 800, height: 600 },
    directionalOverlays: [],
    objectsById: {
      crate: {
        objectId: "crate",
        objectName: "Crate",
        presentationCues: [],
        lighting: {
          pointLight: { x: 120, y: 130, radiusPx: 200 },
          spatialFootprint: { cellX: 4, cellY: 5, sizeXCells: 2, sizeYCells: 1 },
          lightOcclusion: { strength: 0.5 }
        }
      }
    },
    lighting: { cellSizePx: 40 }
  };
}

describe("lightingMovementProjection", () => {
  it("interpolates the light position and holds blocker cells until the final movement boundary", () => {
    const snapshot = scene();
    const target = snapshot.objectsById.crate!.lighting!;
    const tween = createLightingMovementTween(fromLighting, target, 100);
    expect(tween).toBeDefined();
    if (!tween) return;

    const tweens = new Map([["crate", tween]]);
    advanceLightingMovementTweens(tweens, 50);
    const projected = projectLightingMovement(snapshot, tweens);

    expect(projected.objectsById.crate?.lighting).toEqual({
      pointLight: { x: 95, y: 105, radiusPx: 200 },
      spatialFootprint: fromLighting.spatialFootprint,
      lightOcclusion: fromLighting.lightOcclusion
    });
    expect(snapshot.objectsById.crate?.lighting?.pointLight?.x).toBe(120);

    advanceLightingMovementTweens(tweens, 50);
    expect(tweens.size).toBe(0);
    expect(projectLightingMovement(snapshot, tweens)).toBe(snapshot);
  });

  it("uses the Host replacement footprint when no source blocker exists until movement completes", () => {
    const snapshot = scene();
    const target = snapshot.objectsById.crate!.lighting!;
    const tween = createLightingMovementTween({ pointLight: { x: 20, y: 30 } }, target, 100);
    expect(tween).toBeDefined();
    if (!tween) return;

    const tweens = new Map([["crate", tween]]);
    advanceLightingMovementTweens(tweens, 50);
    const projected = projectLightingMovement(snapshot, tweens);
    expect(projected.objectsById.crate?.lighting?.lightOcclusion).toBeUndefined();
    expect(projected.objectsById.crate?.lighting?.pointLight?.x).toBe(95);
  });

  it("anchors an object's light to the sprite's live routed position instead of the endpoint line", () => {
    const lighting = scene().objectsById.crate!.lighting!;
    const projected = projectSpriteAnchoredPointLight(lighting, fromLighting, {
      // A leg-by-leg sprite can be at this waypoint even though the straight line
      // between its start and finish would still be near y=0.
      spriteX: 40,
      spriteY: 100,
      fromSpriteX: 0,
      fromSpriteY: 0,
      toSpriteX: 100,
      toSpriteY: 100,
      progress: 0.5
    });

    expect(projected.pointLight?.x).toBe(60);
    expect(projected.pointLight?.y).toBe(130);
  });

  it("moves a sprite-owned blocker footprint smoothly along the live path before the final leg completes", () => {
    const lighting = scene().objectsById.crate!.lighting!;
    const projected = projectSpriteAnchoredBlocker(lighting, fromLighting, {
      spriteX: 40.25,
      spriteY: 100.5,
      fromSpriteX: 0,
      fromSpriteY: 0,
      toSpriteX: 100,
      toSpriteY: 100,
      progress: 0.5
    }, 40);

    expect(projected.spatialFootprint).toMatchObject({ cellX: 1, cellY: 2, xPx: 95.25, yPx: 195.5, sizeXCells: 1, sizeYCells: 1 });
    expect(projected.lightOcclusion).toEqual(fromLighting.lightOcclusion);
  });
});
