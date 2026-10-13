import type { GameRenderPointLightTimelineEffect } from "../../../contracts/presentationEffects/GameRenderResolvedObjectEffect";
import type { GameRenderPointLight, GameRenderSceneSnapshot } from "../../../contracts/sceneTypes";
import type { GameRendererDiagnosticsSink } from "../../../diagnostics/RendererDiagnostics";

interface ActivePointLightTimeline {
  activationId: string;
  effect: GameRenderPointLightTimelineEffect;
  baseline: GameRenderPointLight;
  finalFrameSampled?: boolean;
}

function mix(from: number, to: number, t: number): number { return from + (to - from) * t; }
function mixColor(from: string, to: string, t: number): string {
  const a = Number.parseInt(from.slice(1), 16); const b = Number.parseInt(to.slice(1), 16);
  return `#${[16, 8, 0].map((shift) => Math.round(mix((a >> shift) & 255, (b >> shift) & 255, t)).toString(16).padStart(2, "0")).join("")}`;
}

export class PointLightTimelineController {
  private readonly active = new Map<string, ActivePointLightTimeline>();
  private readonly completed = new Set<string>();
  private readonly lastReportedFrameByActivation = new Map<string, number>();
  constructor(private readonly diagnostics?: GameRendererDiagnosticsSink) {}

  replaceEvent(objectId: string, timelineStartAtMs: number | undefined): void {
    const state = this.active.get(objectId);
    if (state && timelineStartAtMs !== undefined && state.effect.timelineStartAtMs !== timelineStartAtMs) this.remove(objectId);
  }

  apply(objectId: string, effect: GameRenderPointLightTimelineEffect | undefined, baseline: GameRenderPointLight | undefined): void {
    if (!effect) return;
    const activationId = effect.activationId ?? "";
    if (this.completed.has(activationId)) return;
    if (!baseline) {
      this.diagnostics?.({ category: "scene", level: "warning", message: "Skipped point-light timeline because the target has no usable point light.", details: { objectId, effectKey: effect.effectKey, activationId } });
      return;
    }
    const prior = this.active.get(objectId);
    if (prior?.activationId === activationId) return;
    this.active.set(objectId, { activationId, effect, baseline: { ...baseline } });
    this.diagnostics?.({
      category: "scene",
      level: "info",
      message: "Started a point-light timeline track.",
      details: {
        objectId,
        effectKey: effect.effectKey,
        activationId,
        startAtMs: effect.timelineStartAtMs,
        frameCount: effect.style.frames.length,
        durationMs: effect.style.frames[effect.style.frames.length - 1]?.atMs,
        baseline: {
          enabled: true,
          radiusPx: baseline.radiusPx,
          intensityScale: baseline.intensityScale,
          color: baseline.color,
          x: baseline.x,
          y: baseline.y
        }
      }
    });
  }

  remove(objectId: string): void {
    const existing = this.active.get(objectId);
    if (existing) this.completed.add(existing.activationId);
    this.active.delete(objectId);
  }
  clear(): void { for (const objectId of [...this.active.keys()]) this.remove(objectId); }

  applyToScene(scene: GameRenderSceneSnapshot, nowMs: number): GameRenderSceneSnapshot {
    let objectsById: GameRenderSceneSnapshot["objectsById"] | undefined;
    for (const [objectId, active] of this.active) {
      const object = scene.objectsById[objectId];
      if (!object) { this.active.delete(objectId); continue; }
      const frames = active.effect.style.frames;
      const elapsed = Math.max(0, nowMs - active.effect.timelineStartAtMs);
      const last = frames[frames.length - 1];
      if (elapsed >= last.atMs && active.finalFrameSampled) {
        this.active.delete(objectId);
        this.completed.add(active.activationId);
        if (this.completed.size > 4096) this.completed.delete(this.completed.values().next().value ?? "");
        continue;
      }
      let index = 0;
      while (index + 1 < frames.length && frames[index + 1].atMs <= elapsed) index += 1;
      const from = frames[index]; const to = frames[Math.min(index + 1, frames.length - 1)];
      const t = from === to ? 0 : (elapsed - from.atMs) / (to.atMs - from.atMs);
      const discrete = from;
      const nextLight: GameRenderPointLight = {
        ...active.baseline,
        ...(object.lighting?.pointLight ? { x: object.lighting.pointLight.x, y: object.lighting.pointLight.y } : {}),
        ...(from.intensity === undefined && to.intensity === undefined ? {} : {
          intensityScale: mix(from.intensity ?? active.baseline.intensityScale ?? 1, to.intensity ?? active.baseline.intensityScale ?? 1, t)
        }),
        ...(from.radius === undefined && to.radius === undefined ? {} : {
          radiusPx: mix(from.radius ?? active.baseline.radiusPx ?? 20, to.radius ?? active.baseline.radiusPx ?? 20, t)
        }),
        ...(from.color === undefined && to.color === undefined ? {} : {
          color: mixColor(from.color ?? active.baseline.color ?? "#ffffff", to.color ?? active.baseline.color ?? "#ffffff", t)
        })
      };
      const activationKey = `${objectId}:${active.activationId}`;
      if (this.lastReportedFrameByActivation.get(activationKey) !== index) {
        this.lastReportedFrameByActivation.set(activationKey, index);
        this.diagnostics?.({
          category: "scene",
          level: "debug",
          message: "Sampled point-light timeline frame.",
          details: {
            objectId,
            effectKey: active.effect.effectKey,
            activationId: active.activationId,
            elapsedMs: Math.round(elapsed),
            frameIndex: index,
            nextFrameAtMs: to.atMs,
            enabled: discrete.enabled !== false,
            sampledLight: discrete.enabled === false ? null : {
              radiusPx: nextLight.radiusPx,
              intensityScale: nextLight.intensityScale,
              color: nextLight.color,
              x: nextLight.x,
              y: nextLight.y
            }
          }
        });
      }
      if (objectsById === undefined) objectsById = { ...scene.objectsById };
      if (elapsed >= last.atMs) active.finalFrameSampled = true;
      objectsById[objectId] = {
        ...object,
        lighting: { ...object.lighting, pointLight: discrete.enabled === false ? undefined : nextLight }
      };
    }
    return objectsById ? { ...scene, objectsById } : scene;
  }
}
