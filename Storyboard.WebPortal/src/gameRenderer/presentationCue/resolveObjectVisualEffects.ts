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
    if (category !== "highlight" && category !== "coloroverlay" && category !== "scale" && category !== "shake" && category !== "lighting" && category !== "appearance" && category !== "disappearance") continue;
    const catalogEffect = catalog?.effects?.find((candidate) =>
      normalizePresentationCategory(candidate.category ?? "") === category
      && candidate.effectKey?.trim().toLowerCase() === cue.effectKey.trim().toLowerCase()
    );
    if (!catalogEffect) continue;
    const identity = { effectKey: cue.effectKey, activationId: cue.activationId, activationStartAtMs: cue.activationStartAtMs };

    if ((category === "appearance" || category === "disappearance") && catalogEffect.opacityStyle) {
      const source = catalogEffect.opacityStyle;
      const steps = source.steps;
      const hasOnlyKeys = (value: object, allowed: string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
      const validStyleShape = typeof source === "object" && source !== null && !Array.isArray(source)
        && hasOnlyKeys(source, ["initialAlpha", "steps"]);
      let totalDurationMs = 0;
      const validSteps = validStyleShape && Array.isArray(steps) && steps.length >= 1 && steps.length <= 256
        && steps.every((step) => {
          const valid = typeof step === "object" && step !== null && !Array.isArray(step)
            && hasOnlyKeys(step, ["alpha", "durationMs", "transition"])
            && Number.isFinite(step.alpha) && step.alpha! >= 0 && step.alpha! <= 1
            && Number.isInteger(step.durationMs) && step.durationMs! >= 0
            && (step.transition === "immediate" || (step.transition === "linear" && step.durationMs! > 0));
          if (valid) totalDurationMs += step.durationMs!;
          return valid;
        }) && totalDurationMs <= 120000;
      if (cue.activationId && Number.isFinite(cue.activationStartAtMs)
        && Number.isFinite(source.initialAlpha) && source.initialAlpha! >= 0 && source.initialAlpha! <= 1
        && validSteps) {
        effects.push({
          ...identity,
          kind: "opacityStyle",
          category,
          style: {
            initialAlpha: source.initialAlpha!,
            steps: steps!.map((step) => ({
              alpha: step.alpha!, durationMs: step.durationMs!, transition: step.transition as "linear" | "immediate"
            }))
          }
        });
      }
    }

    if (category === "coloroverlay" && catalogEffect.appearanceColorOverlayTimelineStyle) {
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

    if (category !== "highlight" && category !== "shake" && category !== "scale") continue;

    if (category === "highlight" && catalogEffect.appearanceOutlineStyle) {
      const style = resolveAppearanceOutlineStyle([cue], catalog);
      if (style) effects.push({ ...identity, kind: "appearanceOutlineStyle", style });
    }
    if (category === "highlight" && catalogEffect.appearanceSilhouetteStyle) {
      const style = resolveAppearanceSilhouetteStyle([cue], catalog);
      if (style) effects.push({ ...identity, kind: "appearanceSilhouetteStyle", style });
    }

    if (category === "shake") {
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
    }

    if (category !== "scale") continue;
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
