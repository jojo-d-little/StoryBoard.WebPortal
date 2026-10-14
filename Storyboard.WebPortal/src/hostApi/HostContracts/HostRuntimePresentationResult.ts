import type {
  HostCommandPhaseChangeData
} from "./HostCommandPhaseChangeData";
import type { HostCommandPresentationCueText } from "./HostCommandPresentationCueText";
import type { HostCommandRoomChangeData } from "./HostCommandRoomChangeData";
import type { HostCommandSoundCue } from "./HostCommandSoundCue";
import type { HostCommandRoomObjectChange } from "./HostCommandRoomObjectChange";
import type { HostCommandRemoteRoomObject } from "./HostCommandRemoteRoomObject";
import type { HostSessionPresentationSettings } from "./HostSessionPresentationSettings";

export interface HostRuntimePresentationResult {
  sessionDeltaWatermark: string;
  sessionPresentationSettings?: HostSessionPresentationSettings | null;
  roomChange?: HostCommandRoomChangeData;
  phaseChange?: HostCommandPhaseChangeData;
  soundCues: HostCommandSoundCue[];
  roomObjectChanges?: HostCommandRoomObjectChange[];
  remoteRoomObjects?: HostCommandRemoteRoomObject[];
  orderedTextPresentationSteps?: HostCommandPresentationCueText[];
  authoredRenderWidth?: number;
  authoredRenderHeight?: number;
}
