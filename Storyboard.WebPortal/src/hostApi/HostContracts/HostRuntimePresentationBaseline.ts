import type {
  HostCommandPhaseChangeData,
  HostCommandPresentationCueText,
  HostRoomChangeData
} from "./HostSessionDataEnvelope";
import type { HostCommandSoundCue } from "./HostCommandSoundCue";

export interface HostRuntimePresentationBaseline {
  sessionDeltaWatermark: string;
  roomChange?: HostRoomChangeData;
  phaseChange?: HostCommandPhaseChangeData;
  soundCues: HostCommandSoundCue[];
  orderedTextPresentationSteps?: HostCommandPresentationCueText[];
  authoredRenderWidth?: number;
  authoredRenderHeight?: number;
}
