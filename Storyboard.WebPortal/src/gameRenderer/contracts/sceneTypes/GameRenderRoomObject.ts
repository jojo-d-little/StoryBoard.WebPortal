import type { GameRenderAppearanceOutlineStyle } from "../presentationEffects/GameRenderAppearanceOutlineStyle";
import type { GameRenderAppearanceSilhouetteStyle } from "../presentationEffects/GameRenderAppearanceSilhouetteStyle";
import type { GameRenderAssetReference } from "./GameRenderAssetReference";
import type { GameRenderPresentationCue } from "../presentationEffects/GameRenderPresentationCue";
import type { GameRenderResolvedObjectEffect } from "../presentationEffects/GameRenderResolvedObjectEffect";

export interface GameRenderRoomObject {
  objectId: string;
  objectName: string;
  asset: GameRenderAssetReference;
  x: number;
  y: number;
  rotationDegrees: number;
  scale: number;
  additionalSituationalScale?: number;
  zOrder: number;
  presentationCues: GameRenderPresentationCue[];
  resolvedObjectEffects?: GameRenderResolvedObjectEffect[];
  movementDurationMs?: number;
  movementFrames?: number;
  /** @deprecated Direct scene callers only. Host cues resolve into resolvedObjectEffects. */
  appearanceOutlineStyle?: GameRenderAppearanceOutlineStyle;
  /** @deprecated Direct scene callers only. Host cues resolve into resolvedObjectEffects. */
  appearanceSilhouetteStyle?: GameRenderAppearanceSilhouetteStyle;
}
