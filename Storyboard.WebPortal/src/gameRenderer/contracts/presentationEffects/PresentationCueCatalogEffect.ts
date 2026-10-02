// Catalog input shapes mirror the properties in effect.schema.json. Values remain
// optional here because the renderer validates each style before using it.
export interface CatalogTextPresentation {
  where?: string;
  how?: string;
  dismissMode?: string;
  backdropMode?: string;
  backdropOpacity?: number;
  panelOpacity?: number;
  panelBorderThicknessPx?: number;
  titleFontSizePx?: number;
  bodyFontSizePx?: number;
  scrollSpeedPxPerSec?: number;
  motionInMs?: number;
  motionOutMs?: number;
  displayDurationMs?: number;
  durationMs?: number;
}

export interface CatalogRoomTransitionPresentation {
  mode?: string;
}

export interface CatalogMovementInterpolation {
  frameCount?: number;
  secondsPerFrame?: number;
}

export interface CatalogAppearanceOutlineStyle {
  outlineColorHex?: string;
  outlineThickness?: number;
  pulseMs?: number;
}

export interface CatalogAppearanceSilhouetteStyle {
  sourceToSilhouette?: {
    imageToSilhouetteMask?: { policy?: string; cutoff?: number };
  };
  animation?: { pulseMs?: number };
  passes?: Array<{
    name?: string;
    enabled?: boolean;
    blendMode?: string;
    colorStops?: string[];
    scaleStops?: number[];
    alphaStops?: number[];
  }>;
}

export interface CatalogStyledPointEffect {
  coreLayers?: Array<{
    name?: string;
    enabled?: boolean;
    blendMode?: string;
    colorStops?: string[];
    alphaStops?: number[];
    radiusStops?: number[];
    radiusScale?: number;
  }>;
  orbitLayer?: {
    enabled?: boolean;
    style?: string;
    blendMode?: string;
    spinner?: {
      colorStops?: string[];
      alphaStops?: number[];
      densityStops?: number[];
      radiusScaleBase?: number;
      radiusScaleStep?: number;
      radiusScaleBands?: number;
      sparkRadiusScale?: number;
      angularSpeedScale?: number;
      baseRadiusScale?: number;
      alphaScale?: number;
    };
    ringPulse?: {
      colorStops?: string[];
      alphaStops?: number[];
      ringCount?: number;
      ringSpacingScale?: number;
      radialGrowthStops?: number[];
      ringThicknessPx?: number;
      phaseOffsetStep?: number;
      baseRadiusScale?: number;
      alphaScale?: number;
    };
  };
  pulseMs?: number;
  lifecycle?: {
    clearPolicy?: string;
    lifetimeMs?: number;
    cooldownMs?: number;
  };
}

export interface CatalogShakeStyle {
  horizontalDisplacementPx?: number;
  verticalDisplacementPx?: number;
  speedHz?: number;
}

export interface CatalogScaleStyle {
  targetScaleMultiplier?: number;
  transitionDurationMs?: number;
}

export interface PresentationCueCatalogEffect {
  category?: string;
  effectKey?: string;
  displayName?: string;
  textPresentation?: CatalogTextPresentation;
  roomTransitionPresentation?: CatalogRoomTransitionPresentation;
  movementInterpolation?: CatalogMovementInterpolation;
  appearanceOutlineStyle?: CatalogAppearanceOutlineStyle;
  appearanceSilhouetteStyle?: CatalogAppearanceSilhouetteStyle;
  styledPointEffect?: CatalogStyledPointEffect;
  shakeStyle?: CatalogShakeStyle;
  scaleStyle?: CatalogScaleStyle;
}

export interface PresentationCueCatalogDocument {
  schemaVersion?: string;
  effects?: PresentationCueCatalogEffect[];
}
