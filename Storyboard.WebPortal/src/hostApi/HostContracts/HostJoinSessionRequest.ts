import type { HostRequestContext } from "./HostRequestContext";

export interface HostJoinSessionRequest {
  context: HostRequestContext;
  sessionId: string;
  inviteCode: string;
  requestOwnerApproval: boolean;
}
