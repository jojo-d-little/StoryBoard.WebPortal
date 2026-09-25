import type { HostResultEnvelope } from "./HostResultEnvelope";
import type { HostSessionDescriptor } from "./HostSessionDescriptor";

export interface HostListSessionsResult {
  result: HostResultEnvelope;
  sessions: HostSessionDescriptor[];
  totalAvailableCount: number;
}
