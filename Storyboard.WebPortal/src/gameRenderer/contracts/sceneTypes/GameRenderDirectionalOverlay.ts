import type { GameRenderAssetReference } from "./GameRenderAssetReference";

export interface GameRenderDirectionalOverlay {
  id: string;
  slot: string;
  /** Zero-based index in the Host room snapshot; identifies an image occurrence. */
  snapshotIndex?: number;
  asset: GameRenderAssetReference;
  /** Absolute bitmap draw origin in room-image pixels. */
  x: number;
  y: number;
  /** Host placement provenance; renderer placement always uses a fixed texture anchor of (0, 0). */
  hostAnchorX?: number;
  hostAnchorY?: number;
  hostIconOffsetX?: number;
  hostIconOffsetY?: number;
  rotationDegrees: number;
  scale: number;
  zOrder: number;
}
