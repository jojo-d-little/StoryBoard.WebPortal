import { describe, expect, it } from "vitest";
import type { GameRenderSceneSnapshot } from "../contracts/sceneTypes";
import { mapLightingFrameInput } from "./mapLightingFrameInput";

function scene(overrides: Partial<GameRenderSceneSnapshot> = {}): GameRenderSceneSnapshot {
  return {
    roomId: "room-1",
    displayMode: "composed",
    bounds: { width: 800, height: 600 },
    directionalOverlays: [],
    objectsById: {},
    lighting: { cellSizePx: 40 },
    ...overrides
  };
}

describe("mapLightingFrameInput", () => {
  it("maps room geometry and supplies legacy full ambient with complete empty arrays", () => {
    const result = mapLightingFrameInput(scene());

    expect(result).toEqual({
      ok: true,
      geometry: { widthPx: 800, heightPx: 600, cellSizePx: 40 },
      frame: {
        roomLighting: { ambient: 1, ambientColor: "#FFFFFF" },
        pointLights: [],
        blockers: []
      },
      diagnostics: []
    });
  });

  it("maps light-only and sprite-and-light objects, preserving zeros and room coordinates", () => {
    const result = mapLightingFrameInput(scene({
      lighting: {
        cellSizePx: 40,
        ambientLighting: { ambient: 0, ambientColor: "#506070" },
        pointLightDefaults: { radiusPx: 200, intensityScale: 0, flickerAmount: 0 }
      },
      objectsById: {
        lantern: {
          objectId: "lantern",
          objectName: "Lantern",
          presentationCues: [],
          sprite: {
            asset: { assetPath: "lantern.png", cacheKey: "lantern.png" },
            x: 300,
            y: 400,
            rotationDegrees: 0,
            scale: 1,
            zOrder: 1
          },
          lighting: {
            pointLight: { x: 92.5, y: 144.25, radiusPx: 0, intensityScale: 0, motionMode: "static" },
            spatialFootprint: { cellX: 2, cellY: 3, sizeXCells: 1, sizeYCells: 2, shape: "rounded-rectangle", elevationCells: 0 },
            lightOcclusion: { strength: 0 }
          }
        },
        hiddenLight: {
          objectId: "hiddenLight",
          objectName: "Hidden light",
          presentationCues: [],
          lighting: { pointLight: { x: 12, y: 18, coneAngleDeg: 0 } }
        },
        blockerOnly: {
          objectId: "blockerOnly",
          objectName: "Blocker only",
          presentationCues: [],
          lighting: {
            spatialFootprint: { cellX: 6, cellY: 7, shape: "rectangle" },
            lightOcclusion: { strength: 1 }
          }
        },
        footprintOnly: {
          objectId: "footprintOnly",
          objectName: "Footprint only",
          presentationCues: [],
          lighting: { spatialFootprint: { cellX: 4, cellY: 5 } }
        },
        occlusionOnly: {
          objectId: "occlusionOnly",
          objectName: "Occlusion only",
          presentationCues: [],
          lighting: { lightOcclusion: { strength: 1 } }
        }
      }
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry).toEqual({ widthPx: 800, heightPx: 600, cellSizePx: 40 });
    expect(result.frame).toEqual({
      roomLighting: { ambient: 0, ambientColor: "#506070" },
      pointLightDefaults: { radiusPx: 200, intensityScale: 0, flickerAmount: 0 },
      pointLights: [
        { x: 12, y: 18, coneAngleDeg: 0 },
        { x: 92.5, y: 144.25, radiusPx: 0, intensityScale: 0, motionMode: "static" }
      ],
      blockers: [
        { cellX: 6, cellY: 7, sizeXCells: 1, sizeYCells: 1, cornerStyle: "square", strength: 1 },
        { cellX: 2, cellY: 3, sizeXCells: 1, sizeYCells: 2, cornerStyle: "round", elevationCells: 0, strength: 0 }
      ]
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects invalid room geometry so the caller can use the raw room path", () => {
    const result = mapLightingFrameInput(scene({ lighting: { cellSizePx: 0 } }));
    expect(result).toMatchObject({ ok: false, reason: "invalid-geometry" });
    expect(result.diagnostics[0]?.capability).toBe("geometry");
  });

  it("reports out-of-range ambient and safely uses full ambient", () => {
    const result = mapLightingFrameInput(scene({
      lighting: { cellSizePx: 40, ambientLighting: { ambient: 1.5 } }
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frame.roomLighting).toEqual({ ambient: 1, ambientColor: "#FFFFFF" });
    expect(result.diagnostics).toEqual([
      { capability: "roomLighting", reason: "Ambient must be finite and between 0 and 1; using full ambient." }
    ]);
  });

  it("drops malformed capabilities and reports why without losing valid entries", () => {
    const result = mapLightingFrameInput(scene({
      objectsById: {
        invalidLight: {
          objectId: "invalidLight",
          objectName: "Invalid light",
          presentationCues: [],
          lighting: { pointLight: { x: Number.NaN, y: 10 } }
        },
        invalidBlocker: {
          objectId: "invalidBlocker",
          objectName: "Invalid blocker",
          presentationCues: [],
          lighting: {
            spatialFootprint: { cellX: 1.5, cellY: 2 },
            lightOcclusion: { strength: 0.5 }
          }
        },
        validLight: {
          objectId: "validLight",
          objectName: "Valid light",
          presentationCues: [],
          lighting: { pointLight: { x: 0, y: 0, radiusPx: Number.NaN } }
        }
      }
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frame.pointLights).toEqual([{ x: 0, y: 0 }]);
    expect(result.frame.blockers).toEqual([]);
    expect(result.diagnostics).toEqual([
      { capability: "blocker", objectId: "invalidBlocker", reason: "Blocker footprint or occlusion is outside the supported cell geometry." },
      { capability: "pointLight", objectId: "invalidLight", reason: "Light coordinates must be finite room-pixel values." },
      { capability: "pointLight", objectId: "validLight", reason: "Ignoring non-finite radiusPx." }
    ]);
  });

  it("rejects frames above the configured package capacities rather than allowing silent truncation", () => {
    const result = mapLightingFrameInput(scene({
      objectsById: {
        one: { objectId: "one", objectName: "One", presentationCues: [], lighting: { pointLight: { x: 1, y: 2 } } },
        two: { objectId: "two", objectName: "Two", presentationCues: [], lighting: { pointLight: { x: 3, y: 4 } } }
      }
    }), { maxLights: 1, maxBlockers: 1 });

    expect(result).toMatchObject({ ok: false, reason: "capacity-exceeded" });
    expect(result.diagnostics[result.diagnostics.length - 1]).toMatchObject({ capability: "capacity" });
  });
});
