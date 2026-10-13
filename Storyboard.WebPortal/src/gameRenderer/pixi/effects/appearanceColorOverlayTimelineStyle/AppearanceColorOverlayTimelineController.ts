import { Filter, Sprite, defaultFilterVert, type Container } from "pixi.js";
import type { GameRenderAppearanceColorOverlayTimelineEffect } from "../../../contracts/presentationEffects/GameRenderResolvedObjectEffect";

interface ActiveOverlay {
  activationId: string;
  host: Container;
  source: Sprite;
  overlay: Sprite;
  filter: Filter;
  effect: GameRenderAppearanceColorOverlayTimelineEffect;
  finalFrameSampled?: boolean;
}

function makeFilter(policy: "binaryThreshold" | "sourceCoverage", threshold: number): Filter {
  return Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: `
        in vec2 vTextureCoord;
        out vec4 finalColor;
        uniform sampler2D uTexture;
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uBinary;
        uniform float uThreshold;
        void main(void) {
          float alpha = texture(uTexture, vTextureCoord).a;
          if (uBinary > 0.5) alpha = alpha >= uThreshold ? 1.0 : 0.0;
          float outAlpha = alpha * uStrength;
          finalColor = vec4(uColor * outAlpha, outAlpha);
        }
      `
    },
    resources: { overlayUniforms: {
      uColor: { value: [1, 1, 1], type: "vec3<f32>" },
      uStrength: { value: 0, type: "f32" },
      uBinary: { value: policy === "binaryThreshold" ? 1 : 0, type: "f32" },
      uThreshold: { value: threshold, type: "f32" }
    } }
  });
}

function sample(effect: GameRenderAppearanceColorOverlayTimelineEffect, nowMs: number): { color: string; strength: number; done: boolean } {
  const frames = effect.style.frames;
  const elapsed = Math.max(0, nowMs - effect.timelineStartAtMs);
  const last = frames[frames.length - 1];
  if (elapsed >= last.atMs) return { color: last.color, strength: last.strength, done: true };
  let index = 0;
  while (index + 1 < frames.length && frames[index + 1].atMs <= elapsed) index += 1;
  const from = frames[index];
  const to = frames[index + 1];
  const t = Math.min(1, Math.max(0, (elapsed - from.atMs) / (to.atMs - from.atMs)));
  const rgb = (color: string, shift: number) => Number.parseInt(color.slice(1), 16) >> shift & 0xff;
  const mixed = [16, 8, 0].map((shift) => Math.round(rgb(from.color, shift) + (rgb(to.color, shift) - rgb(from.color, shift)) * t));
  return { color: `#${mixed.map((part) => part.toString(16).padStart(2, "0")).join("")}`, strength: from.strength + (to.strength - from.strength) * t, done: false };
}

function setSample(state: ActiveOverlay, color: string, strength: number): void {
  const rgb = Number.parseInt(color.slice(1), 16);
  const uniforms = (state.filter.resources as { overlayUniforms?: { uniforms?: Record<string, unknown> } }).overlayUniforms?.uniforms;
  if (!uniforms) return;
  uniforms.uColor = [((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255];
  uniforms.uStrength = strength;
}

export class AppearanceColorOverlayTimelineController {
  private readonly active = new Map<string, ActiveOverlay>();
  private readonly completedActivationIds = new Set<string>();

  replaceEvent(objectId: string, timelineStartAtMs: number | undefined): void {
    const state = this.active.get(objectId);
    if (state && timelineStartAtMs !== undefined && state.effect.timelineStartAtMs !== timelineStartAtMs) this.remove(objectId);
  }

  apply(objectId: string, host: Container, source: Sprite, effect: GameRenderAppearanceColorOverlayTimelineEffect | undefined): void {
    const prior = this.active.get(objectId);
    if (!effect) { this.remove(objectId); return; }
    if (this.completedActivationIds.has(effect.activationId ?? "")) return;
    if (prior && prior.activationId === effect.activationId) {
      prior.host = host; prior.source = source; this.sync(prior); return;
    }
    this.remove(objectId);
    const filter = makeFilter(effect.style.maskPolicy, effect.style.alphaThreshold ?? 0.5);
    const overlay = new Sprite(source.texture);
    overlay.anchor.copyFrom(source.anchor);
    overlay.position.copyFrom(source.position);
    overlay.rotation = source.rotation;
    overlay.scale.copyFrom(source.scale);
    overlay.zIndex = source.zIndex + 0.1;
    overlay.filters = [filter];
    overlay.blendMode = effect.style.blendMode;
    overlay.eventMode = "none";
    host.addChild(overlay);
    const state = { activationId: effect.activationId ?? "", host, source, overlay, filter, effect };
    this.active.set(objectId, state);
    this.sync(state);
  }

  tick(nowMs: number): void {
    for (const [objectId, state] of this.active) {
      const value = sample(state.effect, nowMs);
      setSample(state, value.color, value.strength);
      this.sync(state);
      if (value.done) {
        if (!state.finalFrameSampled) { state.finalFrameSampled = true; continue; }
        this.completedActivationIds.add(state.activationId);
        if (this.completedActivationIds.size > 4096) this.completedActivationIds.delete(this.completedActivationIds.values().next().value ?? "");
        this.remove(objectId);
      }
    }
  }

  remove(objectId: string): void {
    const state = this.active.get(objectId);
    if (!state) return;
    this.active.delete(objectId);
    this.completedActivationIds.add(state.activationId);
    state.overlay.removeFromParent();
    state.filter.destroy();
    state.overlay.destroy();
  }

  clear(): void { for (const id of [...this.active.keys()]) this.remove(id); }

  private sync(state: ActiveOverlay): void {
    if (state.overlay.texture !== state.source.texture) state.overlay.texture = state.source.texture;
    state.overlay.anchor.copyFrom(state.source.anchor);
    state.overlay.position.copyFrom(state.source.position);
    state.overlay.rotation = state.source.rotation;
    state.overlay.scale.copyFrom(state.source.scale);
    state.overlay.zIndex = state.source.zIndex + 0.1;
  }
}
