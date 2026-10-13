import type { HostRoomChangeTravelDirection } from "./HostRoomChangeTravelDirection";

/** Resolved movement data for an active movement cue. */
export interface HostCommandActiveObjectMovementPayload {
  moveDirection: HostRoomChangeTravelDirection;
  movementDurationMs: number;
  movementFrames: number;
}
