import type { GameRenderAppearanceOutlineStyle } from "./GameRenderAppearanceOutlineStyle";
import type { GameRenderAppearanceSilhouetteStyle } from "./GameRenderAppearanceSilhouetteStyle";
import type { GameRenderObjectStyledPointEffect } from "./GameRenderStyledPointEffect";
import type { GameRenderShakeStyle } from "./GameRenderShakeStyle";
import type { GameRenderScaleStyle } from "./GameRenderScaleStyle";

export interface GameRenderResolvedObjectEffectIdentity {
  effectKey: string;
  activationId?: string;
}

export interface GameRenderAppearanceOutlineEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "appearanceOutlineStyle";
  style: GameRenderAppearanceOutlineStyle;
}

export interface GameRenderAppearanceSilhouetteEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "appearanceSilhouetteStyle";
  style: GameRenderAppearanceSilhouetteStyle;
}

export interface GameRenderShakeEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "shakeStyle";
  style: GameRenderShakeStyle;
}

export interface GameRenderScaleEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "scaleStyle";
  style: GameRenderScaleStyle;
}

export interface GameRenderStyledPointEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "styledPointEffect";
  activationId: string;
  point: GameRenderObjectStyledPointEffect;
}

export type GameRenderResolvedObjectEffect =
  | GameRenderAppearanceOutlineEffect
  | GameRenderAppearanceSilhouetteEffect
  | GameRenderShakeEffect
  | GameRenderScaleEffect
  | GameRenderStyledPointEffect;
