/**
 * Renderer-neutral shape passed from the scene mapper to the Lighting package.
 * Keep this structurally aligned with the package contracts without importing
 * the package outside the Pixi lighting controller.
 */
export interface GameRenderRoomGeometryInput {
  widthPx: number;
  heightPx: number;
  cellSizePx: number;
}

export interface GameRenderLightingPointLightInput {
  x: number;
  y: number;
  radiusPx?: number;
  directionDeg?: number;
  coneAngleDeg?: number;
  motionMode?: "static" | "sway" | "flicker" | "sway-flicker";
  phase?: number;
  color?: string;
  outerColor?: string;
  gradientExponent?: number;
  intensityScale?: number;
  lightHeightCells?: number;
  swayAmountPx?: number;
  swayHz?: number;
  swayDirectionDeg?: number;
  flickerAmount?: number;
  flickerHz?: number;
  flickerStyle?: "swell" | "flame";
}

export interface GameRenderLightingBlockerInput {
  cellX: number;
  cellY: number;
  sizeXCells?: number;
  sizeYCells?: number;
  cornerStyle?: "square" | "round";
  elevationCells?: number;
  strength?: number;
}

export interface GameRenderLightingFrameInput {
  roomLighting: {
    ambient: number;
    ambientColor: string;
  };
  /** Omitted when the current session has no authored defaults. */
  pointLightDefaults?: {
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
  };
  pointLights: GameRenderLightingPointLightInput[];
  blockers: GameRenderLightingBlockerInput[];
}
