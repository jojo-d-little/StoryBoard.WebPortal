export interface GameRenderHudOverlayEntry {
  id: string;
  text: string;
  titleText?: string;
  bodyText?: string;
  cueEffectKey: string;
  isManualDismiss: boolean;
  scrollMode?: "none" | "auto" | "manual";
  scrollSpeedPxPerSec?: number;
  layoutMode?: "edge-card" | "fullscreen";
  backdropMode?: "dim" | "solid";
  backdropOpacity?: number;
  panelOpacity?: number;
  panelBorderThicknessPx?: number;
  titleFontSizePx?: number;
  bodyFontSizePx?: number;
  transitionStyle?: "none" | "fade";
  motionInMs?: number;
  motionOutMs?: number;
}
