import type { HostRequestContext } from "./HostRequestContext";

export interface HostDiscoverGamesRequest {
  context: HostRequestContext;
  searchText: string;
  maxItems: number;
}
