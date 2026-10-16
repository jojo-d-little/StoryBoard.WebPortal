import type { HostRequestContext } from "./HostRequestContext";
import type { HostResultEnvelope } from "./HostResultEnvelope";

export type HostGameScopeDumpPreset =
  | "All"
  | "RoomAndAncestors"
  | "RoomAndDecendents"
  | "RoomAndRelatives"
  | "PhaseAndAncestors"
  | "PhaseAll";

export interface HostGetGameScopeDumpCapabilitiesRequest {
  context: HostRequestContext;
  gameId: string;
}

export interface HostGameScopeDumpCapabilities {
  available: boolean;
  maxItems: number;
  maxRecordBytes: number;
  maxTotalBytes: number;
  maxDurationMilliseconds: number;
}

export interface HostGetGameScopeDumpCapabilitiesResult {
  result: HostResultEnvelope;
  capabilities: HostGameScopeDumpCapabilities;
}

export interface HostGameScopeDumpRequest {
  context: HostRequestContext;
  gameId: string;
  scope: HostGameScopeDumpPreset;
}

export interface HostGameScopeDumpResult {
  result: HostResultEnvelope;
  dumpId: string;
  gameId: string;
  sessionId: string;
  scope: HostGameScopeDumpPreset;
  outcome: "Completed" | "Truncated" | "Failed" | "Rejected";
  startedUtc: string | null;
  completedUtc: string;
  itemCount: number;
  errorCode: string | null;
  message: string | null;
}
