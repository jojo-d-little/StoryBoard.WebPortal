import { describe, expect, it } from "vitest";
import { projectPresentationCueSource } from "./presentationCueSourceProjection";

describe("Scale and Shake projection for attached sources", () => {
  it("keeps a child source attached to its own resolved pivot through intermediate cue frames", () => {
    const base = {
      sourceX: 95,
      sourceY: 42,
      anchorX: 80,
      anchorY: 40,
      rotationRadians: 0,
      artworkFitScale: 2,
      pivotLocalX: 10,
      pivotLocalY: 10,
      shakeLocalX: 2,
      shakeLocalY: 3
    };
    expect(projectPresentationCueSource({ ...base, cueScale: 1 })).toEqual({ x: 99, y: 48 });
    expect(projectPresentationCueSource({ ...base, cueScale: 1.5 })).toEqual({ x: 96.5, y: 39 });
  });

  it("rotates source and shake offsets while leaving Host-resolved situational placement unapplied", () => {
    const projected = projectPresentationCueSource({
      sourceX: 110,
      sourceY: 70,
      anchorX: 100,
      anchorY: 50,
      rotationRadians: Math.PI / 2,
      artworkFitScale: 1,
      pivotLocalX: 0,
      pivotLocalY: 0,
      cueScale: 2,
      shakeLocalX: 3,
      shakeLocalY: 1
    });
    expect(projected.x).toBeCloseTo(119);
    expect(projected.y).toBeCloseTo(93);
  });
});
