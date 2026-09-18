import type { HostGameDetailsDescriptor } from "./HostGameDetailsDescriptor";
import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostGetGameDetailsResponse {
  result: HostResultEnvelope;
  game: HostGameDetailsDescriptor | null;
}
