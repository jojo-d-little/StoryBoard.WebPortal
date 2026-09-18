import type { HostRequestContext } from "./HostRequestContext";

export interface HostLeaveSessionRequest {
  context: HostRequestContext;
  sessionId: string;
}
