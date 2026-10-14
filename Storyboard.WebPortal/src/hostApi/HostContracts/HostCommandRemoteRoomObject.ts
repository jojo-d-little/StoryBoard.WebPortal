import type { HostCommandActiveObjectSoundCue } from "./HostCommandActiveObjectSoundCue";

export interface HostCommandRemoteRoomObject {
  objectId: string;
  objectName: string;
  sourceRoomId: string;
  sourceRoomName: string;
  activeSoundCues: HostCommandActiveObjectSoundCue[];
}
