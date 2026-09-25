import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionDescriptor } from "./HostSessionDescriptor";

export interface HostStartSessionResult {
  result: HostResultEnvelope;
  session: HostSessionDescriptor | null;
  created: boolean;
}
