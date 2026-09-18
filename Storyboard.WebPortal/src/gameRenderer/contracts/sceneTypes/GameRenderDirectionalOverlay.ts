import type { GameRenderAssetReference } from "./GameRenderAssetReference";

export interface GameRenderDirectionalOverlay {
  id: string;
  slot: string;
  asset: GameRenderAssetReference;
  offsetX: number;
  offsetY: number;
  rotationDegrees: number;
  scale: number;
  zOrder: number;
}
