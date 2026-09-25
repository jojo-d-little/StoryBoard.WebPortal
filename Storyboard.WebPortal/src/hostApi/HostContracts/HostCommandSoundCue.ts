import type { HostCommandSoundCueOperation } from "./HostCommandSoundCueOperation";
import type { HostSoundEffectLane } from "./HostSoundEffectLane";
import type { HostSoundEffectRepeatMode } from "./HostSoundEffectRepeatMode";
import type { HostSoundEffectReplayPolicy } from "./HostSoundEffectReplayPolicy";

export interface HostCommandSoundCue {
  operation: HostCommandSoundCueOperation;
  soundEffectId: string;
  soundEffectLane: HostSoundEffectLane;
  soundEffectKey: string;
  runtimeAssetRef: string;
  playRequestInstanceId?: string;
  commandCorrelationId: number;
  actionId: string;
  resultCode: string;
  sequenceIndex: number;
  repeatMode: HostSoundEffectRepeatMode;
  replayPolicy: HostSoundEffectReplayPolicy;
  repeatCount?: number;
  repeatDurationMs?: number;
  repeatIntervalMs?: number;
  startDelayMs?: number;
  sourceDurationMs?: number;
  maxPlayDurationMs?: number;
  repeatCooldownMs?: number;
  baseVolumeDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}
