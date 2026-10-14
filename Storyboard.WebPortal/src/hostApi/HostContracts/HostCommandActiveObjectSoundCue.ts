export interface HostCommandActiveObjectSoundCue {
  activationId: string;
  soundEffectId: string;
  soundEffectLane: "Sfx" | "Ambient";
  soundEffectKey: string;
  runtimeAssetRef: string;
  repeatMode: "None" | "RepeatForDuration" | "RepeatCount" | "UntilCanceled";
  replayPolicy: "PlayAgain" | "CancelPreviousAtNextPlay" | "IgnoreIfAlreadyPlaying";
  repeatCount?: number | null;
  repeatDurationMs?: number | null;
  repeatIntervalMs?: number | null;
  repeatIntervalMinMs?: number | null;
  repeatIntervalMaxMs?: number | null;
  repeatCooldownMs?: number | null;
  concurrencyGroup?: string | null;
  concurrencyGroupImportance?: number | null;
  importance?: number | null;
  startDelayMs?: number | null;
  fadeInMs?: number | null;
  fadeOutMs?: number | null;
  sourceDurationMs?: number | null;
  maxPlayDurationMs?: number | null;
  baseVolumeDb?: number | null;
  volumeMultiplier: number;
  pan: number;
}
