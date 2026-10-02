import type { GameRenderTravelDirection } from "../sceneTypes/GameRenderTravelDirection";

/** Change-associated timing for an object's room-coordinate movement. */
export interface GameRenderMovementCueMetadata {
  moveDirection?: GameRenderTravelDirection;
  movementDurationMs?: number;
  movementFrames?: number;
}
