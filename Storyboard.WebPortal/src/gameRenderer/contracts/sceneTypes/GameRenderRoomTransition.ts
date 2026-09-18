import type { GameRenderTravelDirection } from "./GameRenderTravelDirection";

export interface GameRenderRoomTransition {
  travelDirection?: GameRenderTravelDirection;
  durationMs?: number;
  cueCategory?: string;
  cueEffectKey?: string;
  mode?: "slide" | "fade" | "fade-blackout";
}
