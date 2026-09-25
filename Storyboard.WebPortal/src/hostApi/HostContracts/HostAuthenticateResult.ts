import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostAuthenticateResult {
  result: HostResultEnvelope;
  principalName: string;
  credentialHandle: string;
}
