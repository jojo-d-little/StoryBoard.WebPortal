import type { HostCommandNewRoomSummary } from "./HostCommandNewRoomSummary";
import type { HostCommandPresentationCue } from "./HostCommandPresentationCue";
import type { HostRoomChangeTravelDirection } from "./HostRoomChangeTravelDirection";

export interface HostCommandRoomChangeData {
  newRoom?: HostCommandNewRoomSummary;
  travelDirection?: HostRoomChangeTravelDirection;
  presentationCues?: HostCommandPresentationCue[];
}
