import type { HostGameDescriptor } from "./HostGameDescriptor";
import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostDiscoverGamesResult {
  result: HostResultEnvelope;
  totalAvailableCount: number;
  games: HostGameDescriptor[];
}
