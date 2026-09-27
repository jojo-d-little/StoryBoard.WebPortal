export interface GameRenderAmbientLighting {
  ambient?: number;
  ambientColor?: string;
}

export interface GameRenderPointLightDefaults {
  radiusPx?: number;
  intensityScale?: number;
  color?: string;
  outerColor?: string;
  gradientExponent?: number;
  lightHeightCells?: number;
  swayAmountPx?: number;
  swayHz?: number;
  swayDirectionDeg?: number;
  flickerAmount?: number;
  flickerHz?: number;
  flickerStyle?: "swell" | "flame";
}

export interface GameRenderPointLight {
  x: number;
  y: number;
  radiusPx?: number;
  directionDeg?: number;
  coneAngleDeg?: number;
  intensityScale?: number;
  color?: string;
  outerColor?: string;
  gradientExponent?: number;
  lightHeightCells?: number;
  motionMode?: "static" | "sway" | "flicker" | "sway-flicker";
  phase?: number;
  swayAmountPx?: number;
  swayHz?: number;
  swayDirectionDeg?: number;
  flickerAmount?: number;
  flickerHz?: number;
  flickerStyle?: "swell" | "flame";
}

export interface GameRenderSpatialFootprint {
  cellX: number;
  cellY: number;
  /** Transient room-image top-left used while the associated sprite is tweening. */
  xPx?: number;
  /** Transient room-image top-left used while the associated sprite is tweening. */
  yPx?: number;
  sizeXCells?: number;
  sizeYCells?: number;
  cornerStyle?: "sharp" | "rounded";
  elevationCells?: number;
}

export interface GameRenderLightOcclusion {
  strength?: number;
}

export interface GameRenderObjectLighting {
  pointLight?: GameRenderPointLight;
  spatialFootprint?: GameRenderSpatialFootprint;
  lightOcclusion?: GameRenderLightOcclusion;
}

export interface GameRenderLightingState {
  cellSizePx?: number;
  pointLightDefaults?: GameRenderPointLightDefaults | null;
  ambientLighting?: GameRenderAmbientLighting | null;
}
