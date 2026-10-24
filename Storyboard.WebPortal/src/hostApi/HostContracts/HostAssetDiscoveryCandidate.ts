import type { HostParticleEffectAssetAssociation } from "./HostParticleEffectAssetAssociation";

export interface HostAssetDiscoveryCandidate {
  assetType: "Other" | "Image" | "Audio";
  relativeLocator: string;
  contentHashHint?: string | null;
  eTagHint: string;
  byteSizeHint?: number | null;
  priorityTier: "CurrentRoom" | "AdjacentRoom" | "AncestorActionLikely" | "GlobalHotset";
  reasonTags?: string[];
  particleEffectAssociation?: HostParticleEffectAssetAssociation | null;
  missing: boolean;
}
