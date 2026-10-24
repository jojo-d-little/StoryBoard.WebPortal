import type { HostRequestContext } from "./HostRequestContext";

export interface HostDiscoverAssetsRequest {
  context: HostRequestContext;
  roomOverrideId?: string | null;
  policyProfile: "Conservative" | "Balanced" | "Aggressive";
  scopeDepth: "NearMe" | "Ancestors";
  continuationToken: string;
}
