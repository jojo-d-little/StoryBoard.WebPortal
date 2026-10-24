import type { HostCommandNewRoomSummary } from "./HostCommandNewRoomSummary";
import type { HostCommandPresentationCue } from "./HostCommandPresentationCue";
import type { HostRoomChangeTravelDirection } from "./HostRoomChangeTravelDirection";
import type { HostCommandCurrentRoomUpdate } from "./HostCommandCurrentRoomUpdate";

export interface HostCommandRoomChangeData {
  newRoom?: HostCommandNewRoomSummary | null;
  currentRoom?: HostCommandCurrentRoomUpdate;
  travelDirection?: HostRoomChangeTravelDirection;
  presentationCues?: HostCommandPresentationCue[];
}
