import type { GameRenderTravelDirection } from "./GameRenderTravelDirection";

export interface GameRenderPresentationCue {
  cueType?: string;
  category: string;
  effectKey: string;
  moveDirection?: GameRenderTravelDirection;
  movementDurationMs?: number;
  movementFrames?: number;
}
