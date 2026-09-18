import type { HostRequestContext } from "./HostRequestContext";

export interface HostGetCurrentPrincipalRequest {
  context: HostRequestContext;
  credentialHandle: string;
}
