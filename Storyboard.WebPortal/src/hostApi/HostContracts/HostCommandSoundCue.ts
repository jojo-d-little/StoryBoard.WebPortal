export type HostCommandSoundCueOperation = "Play" | "Cancel";

export type HostSoundEffectLane = "Sfx" | "Ambient";

export type HostSoundEffectRepeatMode = "None" | "RepeatForDuration" | "RepeatCount" | "UntilCanceled";

export type HostSoundEffectReplayPolicy = "PlayAgain" | "CancelPreviousAtNextPlay" | "IgnoreIfAlreadyPlaying";

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