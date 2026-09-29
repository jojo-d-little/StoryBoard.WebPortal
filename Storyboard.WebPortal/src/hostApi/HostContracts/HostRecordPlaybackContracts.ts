import type { HostRequestContext } from "./HostRequestContext";
import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostClarificationAnswer } from "./HostClarificationAnswer";
import type { HostCommandMoveLegTelemetry } from "./HostCommandMoveLegTelemetry";

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
  compatibility: "Compatible" | "Incompatible" | "Unknown";
  startKind: "FreshSession" | "UnknownLegacy" | "CapturedState";
  stateToken: string;
  state: string;
  createdUtc: string;
  updatedUtc: string;
  stepCount: number;
}

export interface HostListRecordingsRequest {
  context: HostRequestContext;
  gameId: string;
  scope?: "Scratch" | "Saved";
  pageSize: number;
  continuationToken?: string | null;
}
export interface HostListRecordingsResult {
  result: HostResultEnvelope;
  recordings: HostRecordingDescriptor[];
  nextContinuationToken?: string | null;
}
export interface HostGetRecordingRequest {
  context: HostRequestContext;
  gameId: string;
  recordingId: string;
  stepOffset: number;
  stepPageSize: number;
}
export interface HostGetRecordingResult {
  result: HostResultEnvelope;
  recording?: HostRecordingDescriptor;
  steps: HostRecordedStep[];
  nextStepOffset?: string | null;
}
export interface HostPromoteRecordingRequest {
  context: HostRequestContext;
  gameId: string;
  recordingId: string;
  expectedRecordingToken: string;
  displayName: string;
}
export interface HostPromoteRecordingResult { result: HostResultEnvelope; recording?: HostRecordingDescriptor; }
export interface HostDiscardScratchRecordingRequest {
  context: HostRequestContext;
  gameId: string;
  recordingId: string;
  expectedRecordingToken: string;
}
export interface HostDiscardScratchRecordingResult { result: HostResultEnvelope; discarded: boolean; }
export interface HostRecordedStep {
  sequence: number;
  acceptedUtc: string;
  deltaMsFromPrevious: number;
  commandCorrelationId?: string | null;
  rawCommandText: string;
  clarificationAnswers: HostClarificationAnswer[];
  success: boolean;
  resultCode: string;
  outputLines: string[];
  diagnostics: string[];
  moveLegTelemetry: HostCommandMoveLegTelemetry[];
}

export interface HostStartPlaybackRequest {
  context: HostRequestContext;
  recordingId: string;
  expectedRecordingToken: string;
  mode: "Timed" | "Manual";
  speedMultiplier: number;
}
export interface HostStartPlaybackResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; }
export interface HostPausePlaybackRequest { context: HostRequestContext; playbackId: string; expectedPlaybackVersion: number; }
export interface HostPausePlaybackResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; }
export interface HostResumePlaybackRequest { context: HostRequestContext; playbackId: string; expectedPlaybackVersion: number; }
export interface HostResumePlaybackResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; }
export interface HostStopPlaybackRequest { context: HostRequestContext; playbackId: string; expectedPlaybackVersion: number; }
export interface HostStopPlaybackResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; }
export interface HostSetPlaybackSpeedRequest { context: HostRequestContext; playbackId: string; expectedPlaybackVersion: number; speedMultiplier: number; }
export interface HostSetPlaybackSpeedResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; }
export interface HostSwitchToManualPlaybackRequest { context: HostRequestContext; playbackId: string; expectedPlaybackVersion: number; }
export interface HostSwitchToManualPlaybackResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; }
export interface HostGetNextPlaybackStepRequest { context: HostRequestContext; playbackId: string; }
export interface HostGetNextPlaybackStepResult { result: HostResultEnvelope; playbackStatus?: HostPlaybackStatus; nextStep?: HostNextPlaybackStep; }
export interface HostAdvancePlaybackRequest {
  context: HostRequestContext;
  playbackId: string;
  expectedPlaybackVersion: number;
  expectedStepToken: string;
}
export interface HostAdvancePlaybackResult {
  result: HostResultEnvelope;
  playbackStatus?: HostPlaybackStatus;
  stepOutcome?: HostPlaybackStepOutcome;
}
export interface HostContinueRecordingFromHereRequest {
  context: HostRequestContext;
  playbackId: string;
  recordingId: string;
  expectedPlaybackVersion: number;
  expectedRecordingToken: string;
}
export interface HostContinueRecordingFromHereResult {
  result: HostResultEnvelope;
  recordingStatus?: HostRecordingStatus;
  recording?: HostRecordingDescriptor;
}
export interface HostNextPlaybackStep {
  stepIndex: number;
  stepToken: string;
  rawCommandText: string;
  clarificationAnswers: HostClarificationAnswer[];
  recordedDelayMs: number;
  commandCorrelationId: string;
}
export interface HostPlaybackStepOutcome {
  stepIndex: number;
  commandCorrelationId: string;
  success: boolean;
  resultCode: string;
  diagnostics: string[];
  completedUtc: string;
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
