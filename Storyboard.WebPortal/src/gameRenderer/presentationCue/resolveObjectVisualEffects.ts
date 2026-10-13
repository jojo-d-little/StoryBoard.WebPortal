import type { GameRenderPresentationCue, GameRenderResolvedObjectEffect } from "../contracts/presentationEffects";
import {
  resolveAppearanceOutlineStyle,
  resolveAppearanceSilhouetteStyle,
  type PresentationCueCatalogDocument
} from "./presentationCueCatalog";
import { normalizePresentationCategory } from "../presentationIsolation";

export function resolveObjectVisualEffects(
  cues: GameRenderPresentationCue[],
  catalog: PresentationCueCatalogDocument | null | undefined
): GameRenderResolvedObjectEffect[] {
  const effects: GameRenderResolvedObjectEffect[] = [];
  for (const cue of cues) {
    const category = normalizePresentationCategory(cue.category);
    if (category !== "appearance" && category !== "lighting") continue;
    const catalogEffect = catalog?.effects?.find((candidate) =>
      normalizePresentationCategory(candidate.category ?? "") === category
      && candidate.effectKey?.trim().toLowerCase() === cue.effectKey.trim().toLowerCase()
    );
    if (!catalogEffect) continue;
    const identity = { effectKey: cue.effectKey, activationId: cue.activationId };

    if (category === "appearance" && catalogEffect.appearanceColorOverlayTimelineStyle) {
      const source = catalogEffect.appearanceColorOverlayTimelineStyle;
      const frames = source.timeline?.frames;
      const maskPolicy = source.maskPolicy;
      const validFrames = Array.isArray(frames) && frames.length >= 2 && frames.length <= 256
        && frames.every((frame, index) => Number.isInteger(frame.atMs) && frame.atMs! >= 0 && frame.atMs! <= 120000
          && (index === 0 ? frame.atMs === 0 : frame.atMs! > frames[index - 1].atMs!)
          && /^#[0-9a-fA-F]{6}$/.test(frame.color ?? "")
          && Number.isFinite(frame.strength) && frame.strength! >= 0 && frame.strength! <= 1)
        && frames[frames.length - 1].atMs! > 0;
      const validMask = maskPolicy === "sourceCoverage"
        || (maskPolicy === "binaryThreshold" && Number.isFinite(source.alphaThreshold)
          && source.alphaThreshold! >= 0 && source.alphaThreshold! <= 1);
      if (cue.activationId && Number.isFinite(cue.timelineStartAtMs) && validFrames && validMask) {
        effects.push({
          ...identity,
          kind: "appearanceColorOverlayTimelineStyle",
          timelineStartAtMs: cue.timelineStartAtMs!,
          style: {
            maskPolicy: maskPolicy as "binaryThreshold" | "sourceCoverage",
            ...(source.alphaThreshold === undefined ? {} : { alphaThreshold: source.alphaThreshold }),
            blendMode: source.blendMode === "add" ? "add" : "normal",
            frames: frames!.map((frame) => ({ atMs: frame.atMs!, color: frame.color!, strength: frame.strength! }))
          }
        });
      }
    }

    if (category === "lighting" && catalogEffect.pointLightTimelineStyle) {
      const frames = catalogEffect.pointLightTimelineStyle.timeline?.frames;
      const validFrames = Array.isArray(frames) && frames.length >= 2 && frames.length <= 256
        && frames.every((frame, index) => Number.isInteger(frame.atMs) && frame.atMs! >= 0 && frame.atMs! <= 120000
          && (index === 0 ? frame.atMs === 0 : frame.atMs! > frames[index - 1].atMs!)
          && (frame.enabled === undefined || typeof frame.enabled === "boolean")
          && (frame.intensity === undefined || (Number.isFinite(frame.intensity) && frame.intensity! >= 0))
          && (frame.radius === undefined || (Number.isFinite(frame.radius) && frame.radius! >= 20 && frame.radius! <= 600))
          && (frame.color === undefined || /^#[0-9a-fA-F]{6}$/.test(frame.color)))
        && frames[frames.length - 1].atMs! > 0;
      if (cue.activationId && Number.isFinite(cue.timelineStartAtMs) && validFrames) {
        effects.push({
          ...identity,
          kind: "pointLightTimelineStyle",
          timelineStartAtMs: cue.timelineStartAtMs!,
          style: { frames: frames!.map((frame) => ({ ...frame, atMs: frame.atMs! })) }
        });
      }
    }

    if (category !== "appearance") continue;

    if (catalogEffect.appearanceOutlineStyle) {
      const style = resolveAppearanceOutlineStyle([cue], catalog);
      if (style) effects.push({ ...identity, kind: "appearanceOutlineStyle", style });
    }
    if (catalogEffect.appearanceSilhouetteStyle) {
      const style = resolveAppearanceSilhouetteStyle([cue], catalog);
      if (style) effects.push({ ...identity, kind: "appearanceSilhouetteStyle", style });
    }

    const horizontal = catalogEffect.shakeStyle?.horizontalDisplacementPx;
    const vertical = catalogEffect.shakeStyle?.verticalDisplacementPx;
    const speedHz = catalogEffect.shakeStyle?.speedHz;
    if (Number.isFinite(horizontal) && horizontal! >= 0 && horizontal! <= 256
      && Number.isFinite(vertical) && vertical! >= 0 && vertical! <= 256
      && Number.isFinite(speedHz) && speedHz! > 0 && speedHz! <= 20) {
      effects.push({
        ...identity,
        kind: "shakeStyle",
        style: { horizontalDisplacementPx: horizontal!, verticalDisplacementPx: vertical!, speedHz: speedHz! }
      });
    }

    const targetScaleMultiplier = catalogEffect.scaleStyle?.targetScaleMultiplier;
    const transitionDurationMs = catalogEffect.scaleStyle?.transitionDurationMs;
    if (Number.isFinite(targetScaleMultiplier) && targetScaleMultiplier! >= 0.1 && targetScaleMultiplier! <= 8
      && Number.isInteger(transitionDurationMs) && transitionDurationMs! >= 1 && transitionDurationMs! <= 10000) {
      effects.push({
        ...identity,
        kind: "scaleStyle",
        style: { targetScaleMultiplier: targetScaleMultiplier!, transitionDurationMs: transitionDurationMs! }
      });
    }
  }
  return effects;
}
