import type { GameRenderAppearanceOutlineStyle } from "./GameRenderAppearanceOutlineStyle";
import type { GameRenderAppearanceSilhouetteStyle } from "./GameRenderAppearanceSilhouetteStyle";
import type { GameRenderAssetReference } from "./GameRenderAssetReference";
import type { GameRenderPresentationCue } from "./GameRenderPresentationCue";

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
  movementDurationMs?: number;
  movementFrames?: number;
  appearanceOutlineStyle?: GameRenderAppearanceOutlineStyle;
  appearanceSilhouetteStyle?: GameRenderAppearanceSilhouetteStyle;
}
