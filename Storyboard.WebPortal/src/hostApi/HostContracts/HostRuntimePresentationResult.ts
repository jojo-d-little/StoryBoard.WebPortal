import type {
  HostCommandPhaseChangeData
} from "./HostCommandPhaseChangeData";
import type { HostCommandPresentationCueText } from "./HostCommandPresentationCueText";
import type { HostCommandRoomChangeData } from "./HostCommandRoomChangeData";
import type { HostCommandSoundCue } from "./HostCommandSoundCue";

export interface HostRuntimePresentationResult {
  sessionDeltaWatermark: string;
  roomChange?: HostCommandRoomChangeData;
  phaseChange?: HostCommandPhaseChangeData;
  soundCues: HostCommandSoundCue[];
  orderedTextPresentationSteps?: HostCommandPresentationCueText[];
  authoredRenderWidth?: number;
  authoredRenderHeight?: number;
}
