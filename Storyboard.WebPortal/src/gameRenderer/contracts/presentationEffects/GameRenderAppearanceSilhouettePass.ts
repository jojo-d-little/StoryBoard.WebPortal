export interface GameRenderAppearanceSilhouettePass {
  name?: string;
  enabled?: boolean;
  blendMode?: "normal" | "vivid" | "neon";
  colorHexStops: string[];
  scaleMultiplierStops: number[];
  alphaStops?: number[];
}
