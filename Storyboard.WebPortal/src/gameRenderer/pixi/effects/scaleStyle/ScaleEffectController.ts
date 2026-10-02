import type { Container } from "pixi.js";
import type { GameRenderResolvedObjectEffect, GameRenderScaleEffect, GameRenderScaleStyle } from "../../../contracts/presentationEffects";
import { cueActivationKey } from "../shared/cueActivationKey";

interface ScaleActivationState {
  startedAtMs: number;
  fromMultiplier: number;
  style: GameRenderScaleStyle;
}

interface ObjectScaleState {
  container: Container;
  activations: Map<string, ScaleActivationState>;
}

export interface ScaleEffectController {
  reconcileObject: (
    objectId: string,
    container: Container,
    effects: GameRenderResolvedObjectEffect[],
    isBaseline: boolean,
    previousEffects: GameRenderResolvedObjectEffect[]
  ) => void;
  tick: (nowMs: number, enabled: boolean) => void;
  removeObject: (objectId: string) => void;
  clear: () => void;
}

function update(state: ObjectScaleState, nowMs: number): void {
  let multiplier = 1;
  for (const activation of state.activations.values()) {
    const progress = Math.max(0, Math.min(1,
      (nowMs - activation.startedAtMs) / activation.style.transitionDurationMs
    ));
    const eased = progress * (2 - progress);
    multiplier *= activation.fromMultiplier
      + ((activation.style.targetScaleMultiplier - activation.fromMultiplier) * eased);
  }
  state.container.scale.set(Math.max(0.1, Math.min(8, multiplier)));
}

export function createScaleEffectController(): ScaleEffectController {
  const objects = new Map<string, ObjectScaleState>();
  return {
    reconcileObject: (objectId, container, effects, isBaseline, previousEffects) => {
      const scaleEffects = effects.filter((effect): effect is GameRenderScaleEffect => effect.kind === "scaleStyle");
      if (scaleEffects.length === 0) {
        container.scale.set(1);
        objects.delete(objectId);
        return;
      }

      let state = objects.get(objectId);
      if (!state || state.container !== container) {
        state = { container, activations: new Map() };
        objects.set(objectId, state);
      }
      const activeKeys = new Set(scaleEffects.map(cueActivationKey));
      const previousKeys = new Set(previousEffects.map(cueActivationKey));
      for (const key of state.activations.keys()) {
        if (!activeKeys.has(key)) state.activations.delete(key);
      }
      const nowMs = performance.now();
      for (const effect of scaleEffects) {
        const key = cueActivationKey(effect);
        const existing = state.activations.get(key);
        state.activations.set(key, {
          startedAtMs: existing?.startedAtMs
            ?? (isBaseline || previousKeys.has(key) ? nowMs - effect.style.transitionDurationMs : nowMs),
          fromMultiplier: existing?.fromMultiplier ?? 1,
          style: effect.style
        });
      }
      update(state, nowMs);
    },
    tick: (nowMs, enabled) => {
      for (const state of objects.values()) {
        if (enabled) update(state, nowMs);
        else state.container.scale.set(1);
      }
    },
    removeObject: (objectId) => { objects.delete(objectId); },
    clear: () => { objects.clear(); }
  };
}
