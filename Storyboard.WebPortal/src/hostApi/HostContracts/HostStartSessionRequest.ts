import type { HostRequestContext } from "./HostRequestContext";

export interface HostStartSessionRequest {
  context: HostRequestContext;
  gameId: string;
  gameKey: string;
  requestedSessionName: string;
  requestedJoinPolicy: string;
}
