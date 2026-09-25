import type { HostCommandPresentationCue } from "./HostCommandPresentationCue";

export interface HostCommandPresentationCueText extends HostCommandPresentationCue {
  titleText?: string;
  bodyText?: string;
  where?: string;
  how?: string;
  dismissMode?: string;
  displayDurationMs?: number;
  durationMs?: number;
  edgePosition?: string;
  backdropMode?: string;
  backdropOpacity?: number;
  panelOpacity?: number;
  panelBorderThicknessPx?: number;
  motionInMs?: number;
  motionOutMs?: number;
  titleFontSizePx?: number;
  bodyFontSizePx?: number;
  scrollSpeedPxPerSec?: number;
  // Legacy alias accepted during contract migration from HostCommandTextPresentationStep.
  presentationCueEffectKey?: string;
}
