import type { GameRenderTravelDirection } from "../sceneTypes/GameRenderTravelDirection";

/** Resolved movement data carried by an active movement cue. */
export interface GameRenderMovementCueMetadata {
  moveDirection?: GameRenderTravelDirection;
  movementDurationMs?: number;
  movementFrames?: number;
}
