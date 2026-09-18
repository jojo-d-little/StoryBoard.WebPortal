import type { HostRequestContext } from "./HostRequestContext";

export interface HostListSessionsRequest {
  context: HostRequestContext;
  gameId: string;
  gameKey: string;
  includeOwnOnly: boolean;
  includeJoinableOnly: boolean;
  maxItems: number;
}
