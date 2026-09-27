export interface HostObjectPointLight {
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
