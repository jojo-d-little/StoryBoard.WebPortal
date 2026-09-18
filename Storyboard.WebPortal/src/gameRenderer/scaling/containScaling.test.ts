import { describe, expect, it } from "vitest";
import { computeContainScale, computeContainTransform, mapViewportPointToRoomPoint } from "./containScaling";

describe("containScaling", () => {
  it("scales up to 2x when room fits and space allows", () => {
    const scale = computeContainScale(800, 600, 1600, 1200);
    expect(scale).toBe(2);
  });

  it("caps upscale at 2x when viewport is much larger", () => {
    const scale = computeContainScale(800, 600, 3200, 2400);
    expect(scale).toBe(2);
  });

  it("uses soft minimum when candidate scale lands above minimum", () => {
    const scale = computeContainScale(800, 600, 400, 300);
    expect(scale).toBe(0.5);
  });

  it("allows scaling below soft minimum when required for visibility", () => {
    const scale = computeContainScale(800, 600, 320, 240);
    expect(scale).toBe(0.4);
  });

  it("honors hard soft minimum when allowBelowSoftMinWhenNeeded is disabled", () => {
    const scale = computeContainScale(800, 600, 320, 240, {
      maxScale: 2,
      softMinScale: 0.5,
      allowBelowSoftMinWhenNeeded: false
    });
    expect(scale).toBe(0.5);
  });

  it("computes centered offsets while preserving room aspect ratio", () => {
    const transform = computeContainTransform(800, 600, 1600, 900);

    expect(transform.scale).toBe(1.5);
    expect(transform.renderedWidth).toBe(1200);
    expect(transform.renderedHeight).toBe(900);
    expect(transform.offsetX).toBe(200);
    expect(transform.offsetY).toBe(0);
  });

  it("maps 2x bottom-right viewport click back to native room bounds", () => {
    const transform = computeContainTransform(800, 600, 1600, 1200);
    const mapped = mapViewportPointToRoomPoint(transform, 1600, 1200);

    expect(mapped.roomX).toBe(800);
    expect(mapped.roomY).toBe(600);
    expect(mapped.insideRoom).toBe(true);
  });

  it("maps clicks in left pillar area to near-zero room x and marks outside", () => {
    const transform = computeContainTransform(800, 600, 1600, 900);
    const mapped = mapViewportPointToRoomPoint(transform, 245.4, 3.4);

    expect(mapped.roomX).toBeCloseTo(30.27, 2);
    expect(mapped.roomY).toBeCloseTo(2.27, 2);
    expect(mapped.insideRoom).toBe(true);

    const outside = mapViewportPointToRoomPoint(transform, 150, 3.4);
    expect(outside.roomX).toBe(0);
    expect(outside.insideRoom).toBe(false);
  });

  it("maps portrait room center correctly when viewport is landscape with pillarbox", () => {
    const transform = computeContainTransform(600, 800, 1600, 900);
    const centerViewportX = transform.offsetX + (transform.renderedWidth / 2);
    const centerViewportY = transform.offsetY + (transform.renderedHeight / 2);
    const mapped = mapViewportPointToRoomPoint(transform, centerViewportX, centerViewportY);

    expect(mapped.roomX).toBeCloseTo(300, 4);
    expect(mapped.roomY).toBeCloseTo(400, 4);
    expect(mapped.insideRoom).toBe(true);
  });

  it("clamps clicks in portrait-letterbox side area and marks outside", () => {
    const transform = computeContainTransform(600, 800, 1600, 900);
    const outside = mapViewportPointToRoomPoint(transform, transform.offsetX - 10, transform.offsetY + 50);

    expect(outside.roomX).toBe(0);
    expect(outside.roomY).toBeGreaterThanOrEqual(0);
    expect(outside.roomY).toBeLessThanOrEqual(800);
    expect(outside.insideRoom).toBe(false);
  });
});