import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionDescriptor } from "./HostSessionDescriptor";

export interface HostJoinSessionResponse {
  result: HostResultEnvelope;
  session: HostSessionDescriptor | null;
  joined: boolean;
}
