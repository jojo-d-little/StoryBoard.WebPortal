import type { GameRenderAppearanceOutlineStyle } from "../presentationEffects/GameRenderAppearanceOutlineStyle";
import type { GameRenderAppearanceSilhouetteStyle } from "../presentationEffects/GameRenderAppearanceSilhouetteStyle";
import type { GameRenderAssetReference } from "./GameRenderAssetReference";
import type { GameRenderPresentationCue } from "../presentationEffects/GameRenderPresentationCue";
import type { GameRenderResolvedObjectEffect } from "../presentationEffects/GameRenderResolvedObjectEffect";
import type { GameRenderParticleEffect } from "../presentationEffects/GameRenderParticleEffect";

export interface GameRenderRoomObject {
  objectId: string;
  objectName: string;
  asset: GameRenderAssetReference;
  x: number;
  y: number;
  rotationDegrees: number;
  scale: number;
  imageTransparency?: number;
  additionalSituationalScale?: number;
  /** Paired room-axis pivot vector from the image draw origin, resolved by the Host adapter. */
  situationalScalePivotOffsetFromImageXPx?: number;
  situationalScalePivotOffsetFromImageYPx?: number;
  zOrder: number;
  activePresentationCues: GameRenderPresentationCue[];
  resolvedObjectEffects?: GameRenderResolvedObjectEffect[];
  particleEffect?: GameRenderParticleEffect;
  movementDurationMs?: number;
  movementFrames?: number;
  /** @deprecated Direct scene callers only. Host cues resolve into resolvedObjectEffects. */
  appearanceOutlineStyle?: GameRenderAppearanceOutlineStyle;
  /** @deprecated Direct scene callers only. Host cues resolve into resolvedObjectEffects. */
  appearanceSilhouetteStyle?: GameRenderAppearanceSilhouetteStyle;
}
