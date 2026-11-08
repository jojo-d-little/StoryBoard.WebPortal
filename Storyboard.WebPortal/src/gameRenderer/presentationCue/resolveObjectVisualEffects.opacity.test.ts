import { describe, expect, it } from "vitest";
import { resolveObjectVisualEffects } from "./resolveObjectVisualEffects";

const catalog = {
  effects: [
    { category: "Appearance", effectKey: "appearance.fade.in", opacityStyle: { initialAlpha: 0, steps: [{ alpha: 1, durationMs: 2000, transition: "linear" }] } },
    { category: "Appearance", effectKey: "appearance.flicker.in", opacityStyle: { initialAlpha: 0, steps: [
      { alpha: 1, durationMs: 90, transition: "immediate" }, { alpha: 0, durationMs: 70, transition: "immediate" },
      { alpha: 0.6, durationMs: 140, transition: "linear" }, { alpha: 0.1, durationMs: 60, transition: "immediate" },
      { alpha: 1, durationMs: 250, transition: "linear" }
    ] } },
    { category: "Disappearance", effectKey: "disappearance.fade.out", opacityStyle: { initialAlpha: 1, steps: [{ alpha: 0, durationMs: 2000, transition: "linear" }] } },
    { category: "Disappearance", effectKey: "disappearance.flicker.out", opacityStyle: { initialAlpha: 1, steps: [
      { alpha: 0, durationMs: 90, transition: "immediate" }, { alpha: 1, durationMs: 70, transition: "immediate" },
      { alpha: 0.4, durationMs: 140, transition: "linear" }, { alpha: 0.9, durationMs: 60, transition: "immediate" },
      { alpha: 0, durationMs: 250, transition: "linear" }
    ] } }
  ]
};

describe("appearance and disappearance opacity catalog resolution", () => {
  it("resolves the four delivered recipes by catalog category, preserving activation origins", () => {
    const effects = resolveObjectVisualEffects([
      { category: "Appearance", effectKey: "appearance.fade.in", activationId: "fade-in", activationStartAtMs: 500 },
      { category: "Appearance", effectKey: "appearance.flicker.in", activationId: "flicker-in", activationStartAtMs: 500 },
      { category: "Disappearance", effectKey: "disappearance.fade.out", activationId: "fade-out", activationStartAtMs: 500 },
      { category: "Disappearance", effectKey: "disappearance.flicker.out", activationId: "flicker-out", activationStartAtMs: 500 }
    ], catalog);
    expect(effects.map((effect) => effect.kind)).toEqual(["opacityStyle", "opacityStyle", "opacityStyle", "opacityStyle"]);
    expect(effects.map((effect) => effect.kind === "opacityStyle" ? effect.style.steps.length : 0)).toEqual([1, 5, 1, 5]);
    expect(effects.map((effect) => effect.activationStartAtMs)).toEqual([500, 500, 500, 500]);
    expect(effects.map((effect) => effect.kind === "opacityStyle" ? effect.category : "")).toEqual(["appearance", "appearance", "disappearance", "disappearance"]);
  });

  it("rejects malformed style data without inferring category from appearance-prefixed keys", () => {
    const effects = resolveObjectVisualEffects([
      { category: "Appearance", effectKey: "appearance.bad", activationId: "bad", activationStartAtMs: 10 },
      { category: "Highlight", effectKey: "appearance.fade.in", activationId: "wrong-category", activationStartAtMs: 10 }
    ], { effects: [
      { category: "Appearance", effectKey: "appearance.bad", opacityStyle: { initialAlpha: 0, steps: [{ alpha: 1, durationMs: 1, transition: "sine" }] } },
      { category: "Highlight", effectKey: "appearance.fade.in", opacityStyle: { initialAlpha: 0, steps: [{ alpha: 1, durationMs: 1, transition: "linear" }] } }
    ] });
    expect(effects).toEqual([]);
  });
});
