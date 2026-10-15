import type { HostCommandPhaseChangeData } from "./HostCommandPhaseChangeData";
import type { HostCommandRemoteRoomObject } from "./HostCommandRemoteRoomObject";
import type { HostCommandRoomChangeData } from "./HostCommandRoomChangeData";
import type { HostCommandRoomObjectChange } from "./HostCommandRoomObjectChange";
import type { HostCommandSoundCue } from "./HostCommandSoundCue";
import type { HostSessionPresentationSettings } from "./HostSessionPresentationSettings";

export interface HostSessionPresentationData {
  sessionPresentationSettings?: HostSessionPresentationSettings | null;
  roomChange?: HostCommandRoomChangeData | null;
  phaseChange?: HostCommandPhaseChangeData | null;
  roomObjectChanges: HostCommandRoomObjectChange[];
  activeRoomObjectId?: string | null;
  activeRoomObjectName: string;
  activeRoomObjectSelectionCueEffectKey: string;
  secondaryActiveRoomObjectId?: string | null;
  secondaryActiveRoomObjectName: string;
  secondaryActiveRoomObjectSelectionCueEffectKey: string;
  authoredRenderWidth?: number | null;
  authoredRenderHeight?: number | null;
  soundCues: HostCommandSoundCue[];
  remoteRoomObjects?: HostCommandRemoteRoomObject[];
  outputLines: string[];
  diagnostics: string[];
  sessionDeltaWatermark?: string | null;
}
