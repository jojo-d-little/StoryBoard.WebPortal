import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostLeaveSessionResponse {
  result: HostResultEnvelope;
  sessionId: string;
  left: boolean;
}
