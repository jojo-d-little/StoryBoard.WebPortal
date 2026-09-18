import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostCurrentPrincipalResponse {
  result: HostResultEnvelope;
  principalName: string;
}
