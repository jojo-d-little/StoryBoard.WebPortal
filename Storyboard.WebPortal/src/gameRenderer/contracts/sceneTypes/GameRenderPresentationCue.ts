import type { GameRenderTravelDirection } from "./GameRenderTravelDirection";

export interface GameRenderPresentationCue {
  cueType?: string;
  category: string;
  effectKey: string;
  activationId?: string;
  moveDirection?: GameRenderTravelDirection;
  movementDurationMs?: number;
  movementFrames?: number;
  shakeStyle?: {
    horizontalDisplacementPx: number;
    verticalDisplacementPx: number;
    speedHz: number;
  };
  scaleStyle?: {
    targetScaleMultiplier: number;
    transitionDurationMs: number;
  };
}
