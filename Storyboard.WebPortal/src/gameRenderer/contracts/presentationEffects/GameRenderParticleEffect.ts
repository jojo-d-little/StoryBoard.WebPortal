import type { CatalogResolvedTuning } from "@jojo-d-little/storyboard-particles";

export interface GameRenderParticleEffect {
  id: string;
  effectKey: string;
  x?: number;
  y?: number;
  enabled: boolean;
  order: number;
  tuning: CatalogResolvedTuning;
}

export interface GameRenderParticleBurst extends GameRenderParticleEffect {
  sourceObjectId: string;
  roomId: string;
}
