import type { GameRenderMovementCueMetadata } from "./GameRenderMovementCueMetadata";

/** Shared identity for active object cues and change-associated presentation cues. */
export interface GameRenderCueReference {
  category: string;
  effectKey: string;
  activationId?: string;
}

/** Adapter output after active and change-associated cues have been reconciled. */
export interface GameRenderPresentationCue extends GameRenderCueReference, GameRenderMovementCueMetadata {
  cueType?: string;
}
