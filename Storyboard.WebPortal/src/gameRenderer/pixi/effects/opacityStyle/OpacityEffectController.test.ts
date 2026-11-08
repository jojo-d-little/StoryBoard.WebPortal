import { describe, expect, it } from "vitest";
import type { GameRenderOpacityEffect } from "../../../contracts/presentationEffects";
import { OpacityEffectController, sampleOpacityStyle } from "./OpacityEffectController";

function effect(category: "appearance" | "disappearance", activationStartAtMs: number, steps: GameRenderOpacityEffect["style"]["steps"], initialAlpha = 0): GameRenderOpacityEffect {
  return { kind: "opacityStyle", category, effectKey: "test", activationId: `${activationStartAtMs}`, activationStartAtMs, style: { initialAlpha, steps } };
}

describe("opacity step sampling", () => {
  it("samples immediate and linear boundaries, zero-duration chains, skipped frames, and final hold", () => {
    const recipe = effect("appearance", 0, [
      { alpha: 0.5, durationMs: 0, transition: "immediate" },
      { alpha: 1, durationMs: 10, transition: "immediate" },
      { alpha: 0, durationMs: 0, transition: "immediate" },
      { alpha: 0.8, durationMs: 20, transition: "linear" }
    ]);
    // The following immediate step also starts at t=0, so it wins that boundary.
    expect(sampleOpacityStyle(recipe, 0)).toBe(1);
    expect(sampleOpacityStyle(recipe, 10)).toBe(0);
    expect(sampleOpacityStyle(recipe, 20)).toBeCloseTo(0.4);
    expect(sampleOpacityStyle(recipe, 30)).toBe(0.8);
    expect(sampleOpacityStyle(recipe, 500)).toBe(0.8);
  });

  it("multiplies activation identities and restores base alpha when effects are removed or isolated", () => {
    const host = { alpha: 1 } as import("pixi.js").Container;
    const controller = new OpacityEffectController();
    const a = effect("appearance", 0, [{ alpha: 0.5, durationMs: 100, transition: "linear" }], 1);
    const b = effect("disappearance", 0, [{ alpha: 0.4, durationMs: 100, transition: "linear" }], 1);
    controller.reconcileObject("object", host, [a, b]);
    controller.tick(50);
    expect(host.alpha).toBeCloseTo(0.525);
    controller.setEnabled(true, { appearance: false, disappearance: true });
    controller.tick(50);
    expect(host.alpha).toBeCloseTo(0.7);
    controller.setEnabled(false);
    expect(host.alpha).toBe(1);
    controller.setEnabled(true, { appearance: true, disappearance: true });
    controller.tick(50);
    expect(host.alpha).toBeCloseTo(0.525);
    controller.reconcileObject("object", host, []);
    expect(host.alpha).toBe(1);
  });
});
