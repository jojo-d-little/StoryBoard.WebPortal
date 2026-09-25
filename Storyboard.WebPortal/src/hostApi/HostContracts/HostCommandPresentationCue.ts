import type { HostPresentationCueType } from "./HostPresentationCueType";
import type { HostRoomChangeTravelDirection } from "./HostRoomChangeTravelDirection";

export interface HostCommandPresentationCue {
  cueType?: HostPresentationCueType;
  category: string;
  effectKey: string;
  moveDirection?: HostRoomChangeTravelDirection;
  movementDurationMs?: number;
  movementFrames?: number;
}
