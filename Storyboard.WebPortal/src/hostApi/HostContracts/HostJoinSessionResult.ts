import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionDescriptor } from "./HostSessionDescriptor";

export interface HostJoinSessionResult {
  result: HostResultEnvelope;
  session: HostSessionDescriptor | null;
  joined: boolean;
}
