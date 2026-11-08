import type { GameRenderAppearanceOutlineStyle } from "./GameRenderAppearanceOutlineStyle";
import type { GameRenderAppearanceSilhouetteStyle } from "./GameRenderAppearanceSilhouetteStyle";
import type { GameRenderObjectStyledPointEffect } from "./GameRenderStyledPointEffect";
import type { GameRenderShakeStyle } from "./GameRenderShakeStyle";
import type { GameRenderScaleStyle } from "./GameRenderScaleStyle";

export interface GameRenderResolvedObjectEffectIdentity {
  effectKey: string;
  activationId?: string;
  activationStartAtMs?: number;
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

export interface GameRenderAppearanceColorOverlayTimelineEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "appearanceColorOverlayTimelineStyle";
  timelineStartAtMs: number;
  style: {
    maskPolicy: "binaryThreshold" | "sourceCoverage";
    alphaThreshold?: number;
    blendMode: "normal" | "add";
    frames: Array<{ atMs: number; color: string; strength: number }>;
  };
}

export interface GameRenderPointLightTimelineEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "pointLightTimelineStyle";
  timelineStartAtMs: number;
  style: { frames: Array<{ atMs: number; enabled?: boolean; intensity?: number; color?: string; radius?: number }> };
}

export interface GameRenderOpacityEffect extends GameRenderResolvedObjectEffectIdentity {
  kind: "opacityStyle";
  category: "appearance" | "disappearance";
  style: { initialAlpha: number; steps: Array<{ alpha: number; durationMs: number; transition: "linear" | "immediate" }> };
}

export type GameRenderResolvedObjectEffect =
  | GameRenderAppearanceOutlineEffect
  | GameRenderAppearanceSilhouetteEffect
  | GameRenderShakeEffect
  | GameRenderScaleEffect
  | GameRenderStyledPointEffect
  | GameRenderAppearanceColorOverlayTimelineEffect
  | GameRenderPointLightTimelineEffect
  | GameRenderOpacityEffect;
