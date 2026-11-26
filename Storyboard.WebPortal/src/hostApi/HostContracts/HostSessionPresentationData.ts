import type { HostCommandPhaseChangeData } from "./HostCommandPhaseChangeData";
import type { HostCommandClarificationPrompt } from "./HostCommandClarificationPrompt";
import type { HostCommandCompletion } from "./HostCommandCompletion";
import type { HostCommandRemoteRoomObject } from "./HostCommandRemoteRoomObject";
import type { HostCommandRoomChangeData } from "./HostCommandRoomChangeData";
import type { HostCommandRoomObjectChange } from "./HostCommandRoomObjectChange";
import type { HostCommandSoundCue } from "./HostCommandSoundCue";
import type { HostParticleEffectBurst } from "./HostParticleEffectBurst";
import type { HostSessionPresentationSettings } from "./HostSessionPresentationSettings";

export interface HostSessionPresentationData {
  sessionPresentationSettings?: HostSessionPresentationSettings | null;
  roomChange?: HostCommandRoomChangeData | null;
  phaseChange?: HostCommandPhaseChangeData | null;
  clarificationPrompt?: HostCommandClarificationPrompt | null;
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
  particleEffectBursts?: HostParticleEffectBurst[];
  remoteRoomObjects?: HostCommandRemoteRoomObject[];
  outputLines: string[];
  diagnostics: string[];
  /** Terminal outcomes of Started root commands, in delivery order; omitted or empty means none. */
  commandCompletions?: HostCommandCompletion[];
  sessionDeltaWatermark?: string | null;
}
