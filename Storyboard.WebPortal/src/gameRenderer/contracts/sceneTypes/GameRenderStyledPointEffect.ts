export type ResolvedStyledPointBlendMode = "normal" | "add" | "screen" | "multiply";

export interface ResolvedStyledPointCoreLayer {
  name?: string;
  blendMode: ResolvedStyledPointBlendMode;
  colorHexStops: string[];
  alphaStops: number[];
  radiusStops: number[];
  radiusScale: number;
}

export type ResolvedStyledPointOrbitLayer =
  | {
      enabled: true;
      blendMode: ResolvedStyledPointBlendMode;
      style: "spinner";
      spinner: {
        colorHexStops: string[];
        alphaStops: number[];
        densityStops: number[];
        radiusScaleBase: number;
        radiusScaleStep: number;
        radiusScaleBands: number;
        sparkRadiusScale: number;
        angularSpeedScale: number;
        baseRadiusScale: number;
        alphaScale: number;
      };
    }
  | {
      enabled: true;
      blendMode: ResolvedStyledPointBlendMode;
      style: "ring-pulse";
      ringPulse: {
        colorHexStops: string[];
        alphaStops: number[];
        ringCount: number;
        ringSpacingScale: number;
        radialGrowthStops: number[];
        ringThicknessPx: number;
        phaseOffsetStep: number;
        baseRadiusScale: number;
        alphaScale: number;
      };
    };

export interface ResolvedStyledPointEffect {
  coreLayers: ResolvedStyledPointCoreLayer[];
  orbitLayer?: ResolvedStyledPointOrbitLayer;
  pulseMs: number;
  clearPolicy: "timebased" | "manual-removal";
  lifetimeMs?: number;
  cooldownMs?: number;
}

export interface GameRenderObjectStyledPointEffect {
  activationId: string;
  effectKey: string;
  footprintCenterXpx: number;
  footprintCenterYpx: number;
  objectX: number;
  objectY: number;
  style: ResolvedStyledPointEffect;
}
