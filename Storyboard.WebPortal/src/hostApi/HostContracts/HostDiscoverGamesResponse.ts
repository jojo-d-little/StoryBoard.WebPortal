import type { HostDiscoveredGame } from "./HostDiscoveredGame";
import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostDiscoverGamesResponse {
  result: HostResultEnvelope;
  totalAvailableCount: number;
  games: HostDiscoveredGame[];
}
