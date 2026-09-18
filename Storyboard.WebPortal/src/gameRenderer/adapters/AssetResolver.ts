import type { GameRenderAssetReference } from "../contracts/sceneTypes";

export interface ResolveAssetInput {
  asset: GameRenderAssetReference;
}

export interface ResolvedAsset {
  sourceUrl: string;
  cacheKey?: string;
}

export type ResolveAsset = (input: ResolveAssetInput) => Promise<ResolvedAsset>;
