import type { HostCommandPhaseChangeData } from "./HostCommandPhaseChangeData";
import type { HostCommandPresentationCueText } from "./HostCommandPresentationCueText";
import type { HostCommandRoomChangeData } from "./HostCommandRoomChangeData";
import type { HostCommandRoomObjectChange } from "./HostCommandRoomObjectChange";
import type { HostCommandSoundCue } from "./HostCommandSoundCue";

export interface HostSessionDataEnvelope {
  sessionDeltaWatermark: string;
  roomObjectChanges: HostCommandRoomObjectChange[];
  soundCues: HostCommandSoundCue[];
  outputLines: string[];
  diagnostics: string[];
  roomChange?: HostCommandRoomChangeData;
  phaseChange?: HostCommandPhaseChangeData;
  orderedTextPresentationSteps: HostCommandPresentationCueText[];
  authoredRenderWidth?: number;
  authoredRenderHeight?: number;
  hasRoomChange: boolean;
  hasPhaseChange: boolean;
}
