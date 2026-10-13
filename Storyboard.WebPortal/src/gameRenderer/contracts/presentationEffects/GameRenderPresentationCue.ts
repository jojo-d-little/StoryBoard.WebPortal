import type { GameRenderMovementCueMetadata } from "./GameRenderMovementCueMetadata";

/** Identity and resolved compatibility metadata for an active object cue. */
export interface GameRenderCueReference {
  category: string;
  effectKey: string;
  activationId?: string;
}

/** Active cue state mapped into the Portal scene. */
export interface GameRenderPresentationCue extends GameRenderCueReference, GameRenderMovementCueMetadata {
  cueType?: string;
  activationStartAtMs?: number;
  timelineStartAtMs?: number;
}
