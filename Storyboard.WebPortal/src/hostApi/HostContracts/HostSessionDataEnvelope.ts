import type { HostCommandSoundCue } from "./HostCommandSoundCue";

export interface HostRenderableImage {
  imagePath: string;
  anchorX: number;
  anchorY: number;
  iconOffsetX: number;
  iconOffsetY: number;
  x: number;
  y: number;
  rotationDegrees: number;
  scale: number;
  additionalSituationalScale?: number;
}

export interface HostRoomDirectionalImage {
  slot: string;
  renderableImage: HostRenderableImage;
}

export type HostPresentationCueType = "movement" | "appearance" | "disappearance" | "text" | "roomTransition" | "custom";

export interface HostPresentationCue {
  cueType?: HostPresentationCueType;
  category: string;
  effectKey: string;
  moveDirection?: HostRoomChangeTravelDirection;
  movementDurationMs?: number;
  movementFrames?: number;
}

export interface HostCommandPresentationCueText extends HostPresentationCue {
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

export type HostRoomChangeTravelDirection =
  | "North"
  | "NorthEast"
  | "East"
  | "SouthEast"
  | "South"
  | "SouthWest"
  | "West"
  | "NorthWest"
  | "Up"
  | "Down";

export type HostRoomDisplayMode = "Independent" | "Overlay" | 0 | 1;

export interface HostRenderableRoomObject {
  objectId: string;
  name: string;
  renderableImage: HostRenderableImage;
  renderZOrder: number;
}

export type HostRoomObjectChangeKind = "Added" | "Updated" | "Removed";

export type HostMovementTravelVisualizationMode = "Direct" | "LegByLeg";

export interface HostCommandMoveLegTelemetry {
  targetObjectId?: string;
  targetObjectName: string;
  legIndex: number;
  requestedDirection: string;
  requestedDistanceInCells: number;
  appliedDistanceInCells: number;
  success: boolean;
  resultCode: string;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  travelVisualizationMode: HostMovementTravelVisualizationMode;
}

export interface HostRoomObjectChange {
  changeKind: HostRoomObjectChangeKind;
  objectId: string;
  objectName: string;
  renderableRoomObject?: HostRenderableRoomObject;
  presentationCues: HostPresentationCue[];
  moveLegTelemetry?: HostCommandMoveLegTelemetry[];
}

export interface HostNewRoomSummary {
  roomId: string;
  name: string;
  roomDisplayMode: HostRoomDisplayMode;
  roomImageCanvasWidth?: number;
  roomImageCanvasHeight?: number;
  directionalRenderableImages: HostRoomDirectionalImage[];
  renderableRoomObjects: HostRenderableRoomObject[];
}

export interface HostRoomChangeData {
  newRoom?: HostNewRoomSummary;
  travelDirection?: HostRoomChangeTravelDirection;
  presentationCues?: HostPresentationCue[];
}

export interface HostCommandPhaseNodeSummary {
  nodeId: string;
  displayName: string;
  title: string;
  prologue: string;
  narrative: string;
}

export interface HostCommandPhaseSummary {
  phaseId: string;
  pathDisplayName: string;
  book: HostCommandPhaseNodeSummary;
  chapter: HostCommandPhaseNodeSummary;
  page: HostCommandPhaseNodeSummary;
}

export interface HostCommandPhaseChangeData {
  reason: string;
  oldPhase?: HostCommandPhaseSummary;
  newPhase?: HostCommandPhaseSummary;
  isResume?: boolean;
  changedBook?: boolean;
  changedChapter?: boolean;
  changedPage?: boolean;
  orderedTextPresentationSteps?: HostCommandPresentationCueText[];
}

export interface HostSessionDataEnvelope {
  sessionDeltaWatermark: string;
  roomObjectChanges: HostRoomObjectChange[];
  soundCues: HostCommandSoundCue[];
  outputLines: string[];
  diagnostics: string[];
  roomChange?: HostRoomChangeData;
  phaseChange?: HostCommandPhaseChangeData;
  orderedTextPresentationSteps: HostCommandPresentationCueText[];
  authoredRenderWidth?: number;
  authoredRenderHeight?: number;
  hasRoomChange: boolean;
  hasPhaseChange: boolean;
}
