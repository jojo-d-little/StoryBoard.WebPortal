import type { HostGameDetailsDescriptor } from "./HostGameDetailsDescriptor";
import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostGetGameDetailsResult {
  result: HostResultEnvelope;
  game: HostGameDetailsDescriptor | null;
}
