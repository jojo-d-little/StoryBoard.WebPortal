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
    if (normalizePresentationCategory(cue.category) !== "appearance") continue;
    const catalogEffect = catalog?.effects?.find((candidate) =>
      normalizePresentationCategory(candidate.category ?? "") === "appearance"
      && candidate.effectKey?.trim().toLowerCase() === cue.effectKey.trim().toLowerCase()
    );
    if (!catalogEffect) continue;
    const identity = { effectKey: cue.effectKey, activationId: cue.activationId };

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
