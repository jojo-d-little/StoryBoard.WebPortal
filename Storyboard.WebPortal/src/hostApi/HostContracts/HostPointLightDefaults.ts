export interface HostPointLightDefaults {
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
