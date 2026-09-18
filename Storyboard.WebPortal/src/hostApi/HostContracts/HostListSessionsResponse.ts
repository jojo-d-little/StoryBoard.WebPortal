import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionDescriptor } from "./HostSessionDescriptor";

export interface HostListSessionsResponse {
  result: HostResultEnvelope;
  sessions: HostSessionDescriptor[];
  totalAvailableCount: number;
}
