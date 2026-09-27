import type { HostCommandNewRoomSummary } from "./HostCommandNewRoomSummary";
import type { HostCommandPresentationCue } from "./HostCommandPresentationCue";
import type { HostRoomChangeTravelDirection } from "./HostRoomChangeTravelDirection";

export interface HostCommandRoomChangeData {
  newRoom?: HostCommandNewRoomSummary | null;
  travelDirection?: HostRoomChangeTravelDirection;
  presentationCues?: HostCommandPresentationCue[];
}
