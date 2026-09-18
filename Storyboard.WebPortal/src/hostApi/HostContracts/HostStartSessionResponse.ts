import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionDescriptor } from "./HostSessionDescriptor";

export interface HostStartSessionResponse {
  result: HostResultEnvelope;
  session: HostSessionDescriptor | null;
  created: boolean;
}
