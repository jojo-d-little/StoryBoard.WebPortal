import type { GameRenderAppearanceSilhouettePass } from "./GameRenderAppearanceSilhouettePass";

export interface GameRenderAppearanceSilhouetteStyle {
  maskAlphaMode?: "soft" | "binary";
  maskAlphaCutoff?: number;
  pulseMs?: number;
  passes: GameRenderAppearanceSilhouettePass[];
}
