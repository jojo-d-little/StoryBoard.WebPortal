import { describe, expect, it } from "vitest";
import { resolveObjectVisualEffects } from "./resolveObjectVisualEffects";

describe("Scale catalog resolution", () => {
  it.each([0, 1, 5000, 10000])("accepts integer duration %s", (transitionDurationMs) => {
    const effects = resolveObjectVisualEffects([{
      category: "Scale", effectKey: "scale.synthetic", activationId: "activation", activationStartAtMs: 1000
    }], { effects: [{
      category: "Scale", effectKey: "scale.synthetic",
      scaleStyle: { targetScaleMultiplier: 2, transitionDurationMs }
    }] });
    expect(effects).toEqual([{
      kind: "scaleStyle", effectKey: "scale.synthetic", activationId: "activation", activationStartAtMs: 1000,
      style: { targetScaleMultiplier: 2, transitionDurationMs }
    }]);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 10001])(
    "rejects invalid duration %s", (transitionDurationMs) => {
      expect(resolveObjectVisualEffects([{
        category: "Scale", effectKey: "scale.synthetic", activationId: "activation", activationStartAtMs: 1000
      }], { effects: [{
        category: "Scale", effectKey: "scale.synthetic",
        scaleStyle: { targetScaleMultiplier: 2, transitionDurationMs }
      }] })).toEqual([]);
    }
  );

  it.each([0.09, 8.01, Number.NaN, Number.POSITIVE_INFINITY])(
    "preserves multiplier bounds for %s", (targetScaleMultiplier) => {
      expect(resolveObjectVisualEffects([{
        category: "Scale", effectKey: "scale.synthetic", activationId: "activation", activationStartAtMs: 1000
      }], { effects: [{
        category: "Scale", effectKey: "scale.synthetic",
        scaleStyle: { targetScaleMultiplier, transitionDurationMs: 0 }
      }] })).toEqual([]);
    }
  );
});
