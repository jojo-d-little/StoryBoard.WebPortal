import type { HostRequestContext } from "./HostRequestContext";
import type { HostResultEnvelope } from "./HostResultEnvelope";

/** F04 shapes mirrored from the shared SessionRecordPlaybackDtos schemas. */
export interface HostGetRecordPlaybackCapabilitiesRequest { context: HostRequestContext; gameId: string; }
export interface HostGetRecordPlaybackCapabilitiesResult { result: HostResultEnvelope; capabilities: HostRecordPlaybackCapabilities; }
export interface HostGetStatusRequest { context: HostRequestContext; }
export interface HostGetStatusResult { result: HostResultEnvelope; recordingStatus?: HostRecordingStatus; playbackStatus?: HostPlaybackStatus; }
export interface HostStartRecordingRequest { context: HostRequestContext; displayName?: string | null; }
export interface HostStartRecordingResult { result: HostResultEnvelope; recordingStatus?: HostRecordingStatus; }
export interface HostStopRecordingRequest { context: HostRequestContext; recordingId: string; expectedRecordingToken: string; }
export interface HostStopRecordingResult { result: HostResultEnvelope; recordingStatus?: HostRecordingStatus; recording?: HostRecordingDescriptor; }

export interface HostPlaybackStatus {
  playbackId: string;
  recordingId: string;
  recordingStateToken: string;
  mode: "Timed" | "Manual";
  state: "Preparing" | "Ready" | "Running" | "Paused" | "Completed" | "Cancelled" | "Failed";
  version: number;
  nextStepIndex: number;
  totalSteps: number;
  speedMultiplier: number;
  startAdvisoryCodes: string[];
  startedUtc: string;
  updatedUtc: string;
  endedUtc?: string | null;
  failureCode?: string | null;
}

export interface HostRecordingDescriptor {
  recordingId: string;
  gameId: string;
  sourceSessionId?: string | null;
  scope: "Scratch" | "Saved";
  displayName: string;
  artifactSchemaVersion: string;
  compatibility: string;
  startKind: "FreshSession" | "UnknownLegacy";
  stateToken: string;
  state: string;
  createdUtc: string;
  updatedUtc: string;
  stepCount: number;
}

export interface HostRecordPlaybackCapabilities {
  available: boolean;
  canRecord: boolean;
  canList: boolean;
  canPromote: boolean;
  canDiscardScratch: boolean;
  canPlayTimed: boolean;
  canPlayManual: boolean;
  canContinue: boolean;
  supportedArtifactVersions: string[];
  maxPageSize: number;
  minSpeedMultiplier: number;
  maxSpeedMultiplier: number;
}

export interface HostRecordingStatus {
  recordingId: string;
  stateToken: string;
  state: "Recording" | "Finalizing" | "Stopped" | "Failed" | "Discarded";
  scope: "Scratch" | "Saved";
  stepCount: number;
  startedUtc: string;
  updatedUtc: string;
  failureCode?: string | null;
}
