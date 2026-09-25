import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostLeaveSessionResult {
  result: HostResultEnvelope;
  sessionId: string;
  left: boolean;
}
