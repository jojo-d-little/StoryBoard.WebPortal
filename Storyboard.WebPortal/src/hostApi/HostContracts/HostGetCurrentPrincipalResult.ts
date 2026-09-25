import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostGetCurrentPrincipalResult {
  result: HostResultEnvelope;
  principalName: string;
}
