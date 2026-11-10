import { describe, expect, it, vi } from "vitest";
import type { Container } from "pixi.js";
import type { GameRenderResolvedObjectEffect, GameRenderScaleEffect } from "../../../contracts/presentationEffects";
import { createScaleEffectController } from "./ScaleEffectController";

function host() {
  const scale = { x: 1, y: 1, set(value: number) { this.x = value; this.y = value; } };
  return { scale } as unknown as Container;
}

function scaleEffect(effectKey: string, targetScaleMultiplier: number, transitionDurationMs: number): GameRenderScaleEffect {
  return {
    kind: "scaleStyle", effectKey, activationId: effectKey, activationStartAtMs: 1000,
    style: { targetScaleMultiplier, transitionDurationMs }
  };
}

describe("ScaleEffectController immediate effects", () => {
  it.each([
    ["double", 2, true], ["half", 0.5, true],
    ["double", 2, false], ["half", 0.5, false]
  ] as const)("applies %s on first reconciliation at activation time (factor %s, baseline %s)", (name, multiplier, isBaseline) => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      const controller = createScaleEffectController();
      const container = host();
      const effect = scaleEffect(name, multiplier, 0);
      controller.reconcileObject("object", container, [effect], isBaseline, []);
      expect(container.scale.x).toBe(multiplier);
      expect(container.scale.y).toBe(multiplier);
      controller.tick(1000, true);
      controller.tick(6000, true);
      expect(container.scale.x).toBe(multiplier);
    } finally {
      clock.mockRestore();
    }
  });

  it.each([
    ["double", 2, 0.5], ["half", 0.5, 2]
  ] as const)("composes immediate %s with timed inverse and restores the ordinary scale layers", (name, immediate, inverse) => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      const controller = createScaleEffectController();
      const container = host();
      const effects = [scaleEffect(name, immediate, 0), scaleEffect(`${name}-inverse`, inverse, 5000)];
      controller.reconcileObject("object", container, effects, true, []);
      expect(container.scale.x).toBe(immediate);
      controller.tick(3500, true);
      expect(container.scale.x).toBeCloseTo(immediate * (1 + (inverse - 1) * 0.75));
      controller.tick(6000, true);
      expect(container.scale.x).toBe(1);
      clock.mockReturnValue(6000);
      controller.reconcileObject("object", container, effects, false, effects);
      expect(container.scale.x).toBe(1);
      controller.reconcileObject("object", container, [], false, effects);
      expect(container.scale.x).toBe(1);
    } finally {
      clock.mockRestore();
    }
  });

  it("preserves activation identity, clamping, and non-Scale category isolation", () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      const controller = createScaleEffectController();
      const container = host();
      const double = scaleEffect("double", 2, 0);
      const half = scaleEffect("half", 0.5, 0);
      controller.reconcileObject("object", container, [double, half], true, []);
      expect(container.scale.x).toBe(1);
      controller.reconcileObject("object", container, [double], false, [double, half]);
      expect(container.scale.x).toBe(2);
      controller.reconcileObject("object", container, [double, {
        kind: "shakeStyle", effectKey: "shake", activationId: "shake",
        style: { horizontalDisplacementPx: 1, verticalDisplacementPx: 1, speedHz: 1 }
      } as GameRenderResolvedObjectEffect], false, [double]);
      expect(container.scale.x).toBe(2);
      controller.reconcileObject("object", container, Array.from({ length: 4 }, (_, index) =>
        scaleEffect(`double-${index}`, 2, 0)), false, [double]);
      expect(container.scale.x).toBe(8);
    } finally {
      clock.mockRestore();
    }
  });
});
