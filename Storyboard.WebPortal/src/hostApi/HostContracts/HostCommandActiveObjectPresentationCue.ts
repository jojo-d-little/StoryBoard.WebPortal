import type { HostCommandActiveObjectMovementPayload } from "./HostCommandActiveObjectMovementPayload";

/**
 * Represents an active object cue and its resolved category-specific data.
 */
export interface HostCommandActiveObjectPresentationCue {
  category: "Movement" | "Appearance" | "Disappearance" | "Text" | "RoomTransition" | "StyledPointEffect" | "Custom" | "Lighting";
  effectKey: string;
  activationId: string;
  /** Present only for movement-category cues. */
  movement?: HostCommandActiveObjectMovementPayload;
}
