import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostAuthenticateResponse {
  result: HostResultEnvelope;
  principalName: string;
  credentialHandle: string;
}
