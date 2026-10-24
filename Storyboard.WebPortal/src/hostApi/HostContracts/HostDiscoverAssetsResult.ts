import type { HostAssetDiscoveryCandidate } from "./HostAssetDiscoveryCandidate";
import type { HostResultEnvelope } from "./HostResultEnvelope";

export interface HostDiscoverAssetsResult {
  result: HostResultEnvelope;
  resultCode: "Success" | "Forbidden" | "InvalidScope" | "SourceUnavailable" | "Failure";
  candidates: HostAssetDiscoveryCandidate[];
  truncated: boolean;
  continuationToken: string;
}
