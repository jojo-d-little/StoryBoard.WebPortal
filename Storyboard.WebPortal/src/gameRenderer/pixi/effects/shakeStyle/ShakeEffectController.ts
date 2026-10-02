import type { Container } from "pixi.js";
import type { GameRenderResolvedObjectEffect, GameRenderShakeEffect, GameRenderShakeStyle } from "../../../contracts/presentationEffects";
import { cueActivationKey } from "../shared/cueActivationKey";

interface ShakeActivationState {
  startedAtMs: number;
  style: GameRenderShakeStyle;
}

interface ObjectShakeState {
  container: Container;
  activations: Map<string, ShakeActivationState>;
}

export interface ShakeEffectController {
  reconcileObject: (objectId: string, container: Container, effects: GameRenderResolvedObjectEffect[]) => void;
  tick: (nowMs: number, enabled: boolean) => void;
  removeObject: (objectId: string) => void;
  clear: () => void;
}

function update(state: ObjectShakeState, nowMs: number): void {
  let offsetX = 0;
  let offsetY = 0;
  for (const activation of state.activations.values()) {
    const phase = ((nowMs - activation.startedAtMs) / 1000) * activation.style.speedHz * Math.PI * 2;
    offsetX += Math.sin(phase) * activation.style.horizontalDisplacementPx;
    offsetY += Math.cos(phase) * activation.style.verticalDisplacementPx;
  }
  state.container.position.set(
    Math.max(-256, Math.min(256, offsetX)),
    Math.max(-256, Math.min(256, offsetY))
  );
}

export function createShakeEffectController(): ShakeEffectController {
  const objects = new Map<string, ObjectShakeState>();
  return {
    reconcileObject: (objectId, container, effects) => {
      const shakeEffects = effects.filter((effect): effect is GameRenderShakeEffect => effect.kind === "shakeStyle");
      if (shakeEffects.length === 0) {
        container.position.set(0, 0);
        objects.delete(objectId);
        return;
      }

      let state = objects.get(objectId);
      if (!state || state.container !== container) {
        state = { container, activations: new Map() };
        objects.set(objectId, state);
      }
      const activeKeys = new Set(shakeEffects.map(cueActivationKey));
      for (const key of state.activations.keys()) {
        if (!activeKeys.has(key)) state.activations.delete(key);
      }
      const nowMs = performance.now();
      for (const effect of shakeEffects) {
        const key = cueActivationKey(effect);
        state.activations.set(key, {
          startedAtMs: state.activations.get(key)?.startedAtMs ?? nowMs,
          style: effect.style
        });
      }
      update(state, nowMs);
    },
    tick: (nowMs, enabled) => {
      for (const state of objects.values()) {
        if (enabled) update(state, nowMs);
        else state.container.position.set(0, 0);
      }
    },
    removeObject: (objectId) => { objects.delete(objectId); },
    clear: () => { objects.clear(); }
  };
}
