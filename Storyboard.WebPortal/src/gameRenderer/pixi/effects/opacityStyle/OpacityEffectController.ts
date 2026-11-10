import type { Container } from "pixi.js";
import type { GameRenderOpacityEffect } from "../../../contracts/presentationEffects";

export function sampleOpacityStyle(effect: GameRenderOpacityEffect, elapsedMs: number): number {
  let alpha = effect.style.initialAlpha;
  let stepStartMs = 0;
  const elapsed = Math.max(0, elapsedMs);
  for (const step of effect.style.steps) {
    const stepEndMs = stepStartMs + step.durationMs;
    if (step.durationMs === 0) {
      if (elapsed >= stepStartMs) {
        alpha = step.alpha;
        continue;
      }
      return alpha;
    }
    if (elapsed >= stepEndMs) {
      alpha = step.alpha;
      stepStartMs = stepEndMs;
      continue;
    }
    if (step.transition === "immediate") return step.alpha;
    const progress = Math.max(0, Math.min(1, (elapsed - stepStartMs) / step.durationMs));
    return alpha + (step.alpha - alpha) * progress;
  }
  return alpha;
}

interface ActiveOpacityObject {
  host: Container;
  effects: GameRenderOpacityEffect[];
}

export class OpacityEffectController {
  private readonly objects = new Map<string, ActiveOpacityObject>();
  private enabled = true;
  private readonly enabledCategories = new Set(["appearance", "disappearance"]);

  reconcileObject(objectId: string, host: Container, effects: GameRenderOpacityEffect[]): void {
    if (effects.length === 0) {
      this.removeObject(objectId);
      return;
    }
    this.objects.set(objectId, { host, effects });
    this.applyObject(objectId, performance.now());
  }

  setEnabled(enabled: boolean, categories?: { appearance: boolean; disappearance: boolean }): void {
    this.enabled = enabled;
    if (categories) {
      for (const category of ["appearance", "disappearance"]) {
        if (categories[category as "appearance" | "disappearance"]) this.enabledCategories.add(category);
        else this.enabledCategories.delete(category);
      }
    }
    if (!enabled) {
      for (const { host } of this.objects.values()) host.alpha = 1;
    }
  }

  tick(nowMs: number): void {
    if (!this.enabled) return;
    for (const objectId of this.objects.keys()) this.applyObject(objectId, nowMs);
  }

  startTimingAt(nowMs: number): void {
    for (const [objectId, object] of this.objects) {
      object.effects = object.effects.map((effect) => ({ ...effect, activationStartAtMs: nowMs }));
      this.applyObject(objectId, nowMs);
    }
  }

  removeObject(objectId: string): void {
    const object = this.objects.get(objectId);
    if (object) object.host.alpha = 1;
    this.objects.delete(objectId);
  }

  clear(): void {
    for (const { host } of this.objects.values()) host.alpha = 1;
    this.objects.clear();
  }

  private applyObject(objectId: string, nowMs: number): void {
    const object = this.objects.get(objectId);
    if (!object) return;
    if (!this.enabled) {
      object.host.alpha = 1;
      return;
    }
    object.host.alpha = object.effects.reduce((alpha, effect) => {
      if (!this.enabledCategories.has(effect.category)) return alpha;
      const elapsedMs = nowMs - (effect.activationStartAtMs ?? nowMs);
      return alpha * sampleOpacityStyle(effect, elapsedMs);
    }, 1);
  }
}
