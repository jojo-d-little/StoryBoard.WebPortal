import { describe, expect, it } from "vitest";
import { Texture } from "pixi.js";
import { TopDownStainSystem } from "@jojo-d-little/storyboard-particles/advanced";

describe("installed particle package stain direction normalization", () => {
  it("accepts negative authored angles and normalizes the rendered stain orientation", () => {
    const pair = { base: Texture.WHITE, detail: Texture.WHITE };
    const stains = new TopDownStainSystem({
      textures: { splatter: pair, patch: pair, streak: pair }
    });

    expect(() => stains.upsertStain({
      id: "negative-angle-stain",
      style: "streak",
      xPx: 50,
      yPx: 60,
      sizePx: 24,
      directionDegrees: -45
    })).not.toThrow();
    expect(stains.preLight.children[0].rotation).toBeCloseTo(315 * Math.PI / 180);

    stains.dispose();
  });
});
