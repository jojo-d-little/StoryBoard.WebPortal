import type {
  GameRenderAppearanceOutlineStyle,
  GameRenderAppearanceSilhouettePass,
  GameRenderAppearanceSilhouetteStyle,
  GameRenderPresentationCue
} from "../contracts/sceneTypes";
import type { HostCommandPresentationCueText } from "../../hostApi/HostContracts";

export interface PresentationCueCatalogEffect {
  category?: string;
  effectKey?: string;
  displayName?: string;
  textPresentation?: {
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
  };
  roomTransitionPresentation?: {
    mode?: string;
  };
  movementInterpolation?: {
    frameCount?: number;
    secondsPerFrame?: number;
  };
  appearanceOutlineStyle?: {
    outlineColorHex?: string;
    outlineThickness?: number;
    pulseMs?: number;
  };
  appearanceSilhouetteStyle?: {
    sourceToSilhouette?: {
      imageToSilhouetteMask?: {
        policy?: string;
        cutoff?: number;
      };
    };
    animation?: {
      pulseMs?: number;
    };
    passes?: Array<{
      name?: string;
      enabled?: boolean;
      blendMode?: string;
      colorStops?: string[];
      scaleStops?: number[];
      alphaStops?: number[];
    }>;
  };
  styledPointEffect?: {
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
  };
}

export interface PresentationCueCatalogDocument {
  schemaVersion?: string;
  effects?: PresentationCueCatalogEffect[];
}

export type ResolvedTextPresentationTarget = "echo" | "hud-overlay" | "narrative-dialog" | "unknown";

export interface ResolvedTextPresentationCue {
  target: ResolvedTextPresentationTarget;
  isManualDismiss: boolean;
  scrollMode?: "none" | "auto" | "manual";
  scrollSpeedPxPerSec?: number;
  layoutMode?: "edge-card" | "fullscreen";
  backdropMode?: "dim" | "solid";
  backdropOpacity?: number;
  panelOpacity?: number;
  panelBorderThicknessPx?: number;
  titleFontSizePx?: number;
  bodyFontSizePx?: number;
  durationMs?: number;
  transitionStyle?: "none" | "fade";
  motionInMs?: number;
  motionOutMs?: number;
}

export interface ResolvedStyledPointEffect {
  coreLayers: ResolvedStyledPointCoreLayer[];
  orbitLayer?: ResolvedStyledPointOrbitLayer;
  pulseMs: number;
  clearPolicy: "timebased" | "manual-removal";
  lifetimeMs?: number;
  cooldownMs?: number;
}

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

type NormalizedTextHow = "unknown" | "fade-in" | "fade-out" | "fade-both" | "other";

interface TextPresentationSource {
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

const DEFAULT_FADE_IN_MS = 240;
const DEFAULT_FADE_OUT_MS = 220;

function normalizeCategory(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeEffectKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toFiniteNonNegative(value: number | undefined): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const numericValue = Number(value);
  if (numericValue < 0) {
    return null;
  }

  return numericValue;
}

function resolveInterpolationDurationMs(effect: PresentationCueCatalogEffect | undefined): number | undefined {
  if (!effect) {
    return undefined;
  }

  const frameCount = toFiniteNonNegative(effect.movementInterpolation?.frameCount);
  const secondsPerFrame = toFiniteNonNegative(effect.movementInterpolation?.secondsPerFrame);
  if (frameCount === null || secondsPerFrame === null) {
    return undefined;
  }

  return Math.max(0, Math.round(frameCount * secondsPerFrame * 1000));
}

function normalizeTextTarget(value: string | undefined): ResolvedTextPresentationTarget {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "echo") {
    return "echo";
  }

  if (normalized === "hudoverlay"
    || normalized === "hud-overlay"
    || normalized === "hudedgecard"
    || normalized === "hudfullscreen") {
    return "hud-overlay";
  }

  if (normalized === "narrativedialog" || normalized === "narrative-dialog") {
    return "narrative-dialog";
  }

  return "unknown";
}

function normalizeHudLayoutMode(value: string | undefined): "edge-card" | "fullscreen" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "hudfullscreen") {
    return "fullscreen";
  }

  return "edge-card";
}

function normalizeBackdropMode(value: string | undefined): "dim" | "solid" {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "solid" ? "solid" : "dim";
}

function normalizeDismissMode(value: string | undefined): "auto" | "manual" | "unknown" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }

  if (normalized === "manual") {
    return "manual";
  }

  return "unknown";
}

function normalizeTextTransitionStyle(value: string | undefined): "none" | "fade" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "fade"
    || normalized === "fadein"
    || normalized === "fadeout"
    || normalized === "fadeinout") {
    return "fade";
  }

  return "none";
}

function normalizeTextHow(value: string | undefined): NormalizedTextHow {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "unknown") {
    return "unknown";
  }

  if (normalized === "fadein") {
    return "fade-in";
  }

  if (normalized === "fadeout") {
    return "fade-out";
  }

  if (normalized === "fade" || normalized === "fadeinout") {
    return "fade-both";
  }

  return "other";
}

function resolveScrollMode(value: string | undefined): "none" | "auto" | "manual" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "autoscroll") {
    return "auto";
  }

  if (normalized === "manualscroll") {
    return "manual";
  }

  return "none";
}

export function resolveCatalogCueDurationMs(
  catalog: PresentationCueCatalogDocument | null | undefined,
  category: string,
  effectKey: string
): number | undefined {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return undefined;
  }

  const normalizedCategory = normalizeCategory(category);
  const normalizedEffectKey = normalizeEffectKey(effectKey);
  if (!normalizedCategory || !normalizedEffectKey) {
    return undefined;
  }

  const effect = catalog.effects.find((candidate) => {
    return normalizeCategory(candidate.category) === normalizedCategory
      && normalizeEffectKey(candidate.effectKey) === normalizedEffectKey;
  });

  return resolveInterpolationDurationMs(effect);
}

export function resolveCatalogTextPresentationCue(
  catalog: PresentationCueCatalogDocument | null | undefined,
  effectKey: string
): ResolvedTextPresentationCue | null {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return null;
  }

  const normalizedEffectKey = normalizeEffectKey(effectKey);
  if (!normalizedEffectKey) {
    return null;
  }

  const effect = catalog.effects.find((candidate) => {
    return normalizeCategory(candidate.category) === "text"
      && normalizeEffectKey(candidate.effectKey) === normalizedEffectKey;
  });
  return resolveTextPresentationCueSource(effect?.textPresentation);
}

function resolveTextPresentationCueSource(source: TextPresentationSource | null | undefined): ResolvedTextPresentationCue | null {
  if (!source) {
    return null;
  }

  const target = normalizeTextTarget(source.where);
  if (target === "unknown") {
    return null;
  }

  // Keep a legacy fallback for clients with cached catalog payloads that still use durationMs.
  const durationMs = toFiniteNonNegative(
    source.displayDurationMs
      ?? source.durationMs
  );
  const dismissMode = normalizeDismissMode(source.dismissMode);
  const how = normalizeTextHow(source.how);
  const transitionStyle = normalizeTextTransitionStyle(source.how);
  const motionInMs = toFiniteNonNegative(source.motionInMs);
  const motionOutMs = toFiniteNonNegative(source.motionOutMs);
  const roundedDurationMs = durationMs === null ? undefined : Math.round(durationMs);
  const resolvedMotionInMs = motionInMs === null
    ? (transitionStyle === "fade" && (how === "fade-in" || how === "fade-both") ? DEFAULT_FADE_IN_MS : undefined)
    : Math.round(motionInMs);
  const resolvedMotionOutMs = motionOutMs === null
    ? (transitionStyle === "fade" && (how === "fade-out" || how === "fade-both") ? DEFAULT_FADE_OUT_MS : undefined)
    : Math.round(motionOutMs);
  const resolved: ResolvedTextPresentationCue = {
    target,
    isManualDismiss: dismissMode === "manual" || (roundedDurationMs !== undefined && roundedDurationMs <= 0),
    durationMs: roundedDurationMs,
    transitionStyle,
    motionInMs: resolvedMotionInMs,
    motionOutMs: resolvedMotionOutMs
  };

  if (target === "hud-overlay") {
    const layoutMode = normalizeHudLayoutMode(source.where);
    const backdropMode = normalizeBackdropMode(source.backdropMode);
    const backdropOpacity = toFiniteNonNegative(source.backdropOpacity);
    const panelOpacity = toFiniteNonNegative(source.panelOpacity);
    const panelBorderThicknessPx = toFiniteNonNegative(source.panelBorderThicknessPx);
    const titleFontSizePx = toFiniteNonNegative(source.titleFontSizePx);
    const bodyFontSizePx = toFiniteNonNegative(source.bodyFontSizePx);
    const scrollMode = resolveScrollMode(source.how);
    const scrollSpeedPxPerSec = toFiniteNonNegative(source.scrollSpeedPxPerSec);

    resolved.layoutMode = layoutMode;
    resolved.backdropMode = backdropMode;
    if (backdropOpacity !== null) {
      resolved.backdropOpacity = Math.min(1, backdropOpacity);
    }
    if (panelOpacity !== null) {
      resolved.panelOpacity = Math.min(1, panelOpacity);
    }
    if (panelBorderThicknessPx !== null) {
      resolved.panelBorderThicknessPx = panelBorderThicknessPx;
    }
    if (titleFontSizePx !== null) {
      resolved.titleFontSizePx = titleFontSizePx;
    }
    if (bodyFontSizePx !== null) {
      resolved.bodyFontSizePx = bodyFontSizePx;
    }
    if (scrollMode !== "none") {
      resolved.scrollMode = scrollMode;
    }
    if (scrollSpeedPxPerSec !== null && scrollSpeedPxPerSec > 0) {
      resolved.scrollSpeedPxPerSec = scrollSpeedPxPerSec;
    }
  }

  return resolved;
}

export function resolveHostTextPresentationCue(
  step: HostCommandPresentationCueText,
  catalog: PresentationCueCatalogDocument | null | undefined
): ResolvedTextPresentationCue | null {
  const fromStep = resolveTextPresentationCueSource(step);
  const effectKey = (step.effectKey ?? step.presentationCueEffectKey ?? "").trim();
  const fromCatalog = effectKey
    ? resolveCatalogTextPresentationCue(catalog, effectKey)
    : null;

  if (!fromStep) {
    return fromCatalog;
  }

  if (fromStep.target !== "hud-overlay" || !fromCatalog || fromCatalog.target !== "hud-overlay") {
    return fromStep;
  }

  return {
    ...fromCatalog,
    ...fromStep,
    layoutMode: fromStep.layoutMode ?? fromCatalog.layoutMode,
    backdropMode: fromStep.backdropMode ?? fromCatalog.backdropMode,
    backdropOpacity: fromStep.backdropOpacity ?? fromCatalog.backdropOpacity,
    panelOpacity: fromStep.panelOpacity ?? fromCatalog.panelOpacity,
    panelBorderThicknessPx: fromStep.panelBorderThicknessPx ?? fromCatalog.panelBorderThicknessPx,
    titleFontSizePx: fromStep.titleFontSizePx ?? fromCatalog.titleFontSizePx,
    bodyFontSizePx: fromStep.bodyFontSizePx ?? fromCatalog.bodyFontSizePx,
    scrollMode: fromStep.scrollMode ?? fromCatalog.scrollMode,
    scrollSpeedPxPerSec: fromStep.scrollSpeedPxPerSec ?? fromCatalog.scrollSpeedPxPerSec
  };
}

export function resolveCatalogRoomTransitionMode(
  catalog: PresentationCueCatalogDocument | null | undefined,
  category: string,
  effectKey: string
): "slide" | "fade" | "fade-blackout" | undefined {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return undefined;
  }

  const normalizedCategory = normalizeCategory(category);
  const normalizedEffectKey = normalizeEffectKey(effectKey);
  if (!normalizedCategory || !normalizedEffectKey) {
    return undefined;
  }

  const effect = catalog.effects.find((candidate) => {
    return normalizeCategory(candidate.category) === normalizedCategory
      && normalizeEffectKey(candidate.effectKey) === normalizedEffectKey;
  });

  const mode = (effect?.roomTransitionPresentation?.mode ?? "").trim().toLowerCase();
  if (mode === "crossfade") {
    return "fade";
  }

  if (mode === "blackoutswapfade") {
    return "fade-blackout";
  }

  if (mode === "directionalslide") {
    return "slide";
  }

  return undefined;
}

export function resolveMovementCueDurationMs(
  cues: GameRenderPresentationCue[],
  catalog: PresentationCueCatalogDocument | null | undefined
): number | undefined {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return undefined;
  }

  for (const cue of cues) {
    if (normalizeCategory(cue.category) !== "movement") {
      continue;
    }

    const cueEffectKey = normalizeEffectKey(cue.effectKey);
    if (!cueEffectKey) {
      continue;
    }

    return resolveCatalogCueDurationMs(catalog, "Movement", cueEffectKey);
  }

  return undefined;
}

function normalizeColorHex(value: string | undefined): string | undefined {
  const raw = (value ?? "").trim();
  if (!raw) {
    return undefined;
  }

  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toUpperCase()
    : undefined;
}

export function resolveAppearanceOutlineStyle(
  cues: GameRenderPresentationCue[],
  catalog: PresentationCueCatalogDocument | null | undefined
): GameRenderAppearanceOutlineStyle | undefined {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return undefined;
  }

  for (const cue of cues) {
    if (normalizeCategory(cue.category) !== "appearance") {
      continue;
    }

    const cueEffectKey = normalizeEffectKey(cue.effectKey);
    if (!cueEffectKey) {
      continue;
    }

    const effect = catalog.effects.find((candidate) => {
      return normalizeCategory(candidate.category) === "appearance"
        && normalizeEffectKey(candidate.effectKey) === cueEffectKey;
    });

    if (!effect?.appearanceOutlineStyle) {
      continue;
    }

    const colorHex = normalizeColorHex(effect.appearanceOutlineStyle.outlineColorHex);
    const thickness = toFiniteNonNegative(effect.appearanceOutlineStyle.outlineThickness);
    const pulseMs = toFiniteNonNegative(effect.appearanceOutlineStyle.pulseMs);
    if (!colorHex || thickness === null || thickness <= 0) {
      continue;
    }

    return {
      outlineColorHex: colorHex,
      outlineThickness: Math.max(1, Math.round(thickness)),
      pulseMs: pulseMs === null ? undefined : Math.max(1, Math.round(pulseMs))
    };
  }

  return undefined;
}

function normalizeColorHexStops(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalizedStops: string[] = [];
  for (const candidate of values) {
    const normalized = normalizeColorHex(candidate);
    if (normalized) {
      normalizedStops.push(normalized);
    }
  }

  return normalizedStops;
}

function normalizeScaleStops(values: number[] | undefined): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalizedStops: number[] = [];
  for (const candidate of values) {
    const value = toFiniteNonNegative(candidate);
    if (value === null || value <= 1) {
      continue;
    }

    normalizedStops.push(value);
  }

  return normalizedStops;
}

function normalizeAlphaStops(values: number[] | undefined): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const normalizedStops: number[] = [];
  for (const candidate of values) {
    if (!Number.isFinite(candidate)) {
      continue;
    }

    const value = Number(candidate);
    if (value < 0 || value > 1) {
      continue;
    }

    normalizedStops.push(value);
  }

  return normalizedStops;
}

function normalizeDensityStops(values: number[] | undefined): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const normalizedStops: number[] = [];
  for (const candidate of values) {
    if (!Number.isFinite(candidate)) {
      continue;
    }

    const rounded = Math.round(Number(candidate));
    if (rounded < 1 || rounded > 128) {
      continue;
    }

    normalizedStops.push(rounded);
  }

  return normalizedStops;
}

function normalizeRadiusStops(values: number[] | undefined): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const normalizedStops: number[] = [];
  for (const candidate of values) {
    if (!Number.isFinite(candidate)) {
      continue;
    }

    const numericValue = Number(candidate);
    if (numericValue <= 0 || numericValue > 512) {
      continue;
    }

    normalizedStops.push(numericValue);
  }

  return normalizedStops;
}

function normalizePositiveStops(values: number[] | undefined): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const normalizedStops: number[] = [];
  for (const candidate of values) {
    if (!Number.isFinite(candidate)) {
      continue;
    }

    const numericValue = Number(candidate);
    if (numericValue <= 0) {
      continue;
    }

    normalizedStops.push(numericValue);
  }

  return normalizedStops;
}

function normalizeRoundedIntegerInRange(
  value: number | undefined,
  min: number,
  max: number
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(Number(value));
  if (rounded < min || rounded > max) {
    return null;
  }

  return rounded;
}

function normalizeNumberInRange(
  value: number | undefined,
  minInclusive: number,
  maxInclusive: number
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const numericValue = Number(value);
  if (numericValue < minInclusive || numericValue > maxInclusive) {
    return null;
  }

  return numericValue;
}

function normalizeStrictPositiveNumberInRange(
  value: number | undefined,
  maxInclusive: number
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const numericValue = Number(value);
  if (numericValue <= 0 || numericValue > maxInclusive) {
    return null;
  }

  return numericValue;
}

function normalizeStyledPointBlendMode(value: string | undefined): ResolvedStyledPointBlendMode {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "add") {
    return "add";
  }

  if (normalized === "screen") {
    return "screen";
  }

  if (normalized === "multiply") {
    return "multiply";
  }

  return "normal";
}

function normalizeStyledPointCoreLayers(
  values: NonNullable<PresentationCueCatalogEffect["styledPointEffect"]>["coreLayers"]
): ResolvedStyledPointCoreLayer[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const normalizedLayers: ResolvedStyledPointCoreLayer[] = [];
  for (const layer of values) {
    if (!layer || layer.enabled === false) {
      continue;
    }

    const colorHexStops = normalizeColorHexStops(layer.colorStops);
    const alphaStops = normalizeAlphaStops(layer.alphaStops);
    const radiusStops = normalizeRadiusStops(layer.radiusStops);
    if (colorHexStops.length === 0 || alphaStops.length === 0 || radiusStops.length === 0) {
      continue;
    }

    const radiusScaleRaw = normalizeStrictPositiveNumberInRange(layer.radiusScale, 8);
    const layerName = (layer.name ?? "").trim();

    normalizedLayers.push({
      name: layerName.length > 0 ? layerName : undefined,
      blendMode: normalizeStyledPointBlendMode(layer.blendMode),
      colorHexStops,
      alphaStops,
      radiusStops,
      radiusScale: radiusScaleRaw ?? 1
    });
  }

  return normalizedLayers;
}

function resolveStyledPointOrbitLayer(
  orbitLayer: NonNullable<PresentationCueCatalogEffect["styledPointEffect"]>["orbitLayer"]
): ResolvedStyledPointOrbitLayer | undefined | null {
  if (!orbitLayer) {
    return undefined;
  }

  if (orbitLayer.enabled !== true) {
    return undefined;
  }

  const blendMode = normalizeStyledPointBlendMode(orbitLayer.blendMode);
  const style = (orbitLayer.style ?? "").trim().toLowerCase();

  if (style === "spinner") {
    const spinner = orbitLayer.spinner;
    if (!spinner) {
      return null;
    }

    const colorHexStops = normalizeColorHexStops(spinner.colorStops);
    const alphaStops = normalizeAlphaStops(spinner.alphaStops);
    const densityStops = normalizeDensityStops(spinner.densityStops);
    const radiusScaleBase = normalizeStrictPositiveNumberInRange(spinner.radiusScaleBase, 16);
    const radiusScaleStep = normalizeNumberInRange(spinner.radiusScaleStep, 0, 8);
    const radiusScaleBands = normalizeRoundedIntegerInRange(spinner.radiusScaleBands, 1, 16);
    const sparkRadiusScale = normalizeStrictPositiveNumberInRange(spinner.sparkRadiusScale, 4);
    const angularSpeedScale = normalizeStrictPositiveNumberInRange(spinner.angularSpeedScale, 16);
    const baseRadiusScale = normalizeStrictPositiveNumberInRange(spinner.baseRadiusScale, 16);
    const alphaScale = normalizeNumberInRange(spinner.alphaScale ?? 1, 0, 1);

    if (colorHexStops.length === 0
      || alphaStops.length === 0
      || densityStops.length === 0
      || radiusScaleBase === null
      || radiusScaleStep === null
      || radiusScaleBands === null
      || sparkRadiusScale === null
      || angularSpeedScale === null
      || baseRadiusScale === null
      || alphaScale === null) {
      return null;
    }

    return {
      enabled: true,
      blendMode,
      style: "spinner",
      spinner: {
        colorHexStops,
        alphaStops,
        densityStops,
        radiusScaleBase,
        radiusScaleStep,
        radiusScaleBands,
        sparkRadiusScale,
        angularSpeedScale,
        baseRadiusScale,
        alphaScale
      }
    };
  }

  if (style === "ring-pulse") {
    const ringPulse = orbitLayer.ringPulse;
    if (!ringPulse) {
      return null;
    }

    const colorHexStops = normalizeColorHexStops(ringPulse.colorStops);
    const alphaStops = normalizeAlphaStops(ringPulse.alphaStops);
    const ringCount = normalizeRoundedIntegerInRange(ringPulse.ringCount, 1, 12);
    const ringSpacingScale = normalizeStrictPositiveNumberInRange(ringPulse.ringSpacingScale, 8);
    const radialGrowthStops = normalizePositiveStops(ringPulse.radialGrowthStops);
    const ringThicknessPx = normalizeStrictPositiveNumberInRange(ringPulse.ringThicknessPx, 64);
    const phaseOffsetStep = normalizeNumberInRange(ringPulse.phaseOffsetStep, 0, 1);
    const baseRadiusScale = normalizeStrictPositiveNumberInRange(ringPulse.baseRadiusScale, 16);
    const alphaScale = normalizeNumberInRange(ringPulse.alphaScale ?? 1, 0, 1);

    if (colorHexStops.length === 0
      || alphaStops.length === 0
      || ringCount === null
      || ringSpacingScale === null
      || radialGrowthStops.length === 0
      || ringThicknessPx === null
      || phaseOffsetStep === null
      || baseRadiusScale === null
      || alphaScale === null) {
      return null;
    }

    return {
      enabled: true,
      blendMode,
      style: "ring-pulse",
      ringPulse: {
        colorHexStops,
        alphaStops,
        ringCount,
        ringSpacingScale,
        radialGrowthStops,
        ringThicknessPx,
        phaseOffsetStep,
        baseRadiusScale,
        alphaScale
      }
    };
  }

  return null;
}

export function resolveCatalogStyledPointEffect(
  catalog: PresentationCueCatalogDocument | null | undefined,
  effectKey: string
): ResolvedStyledPointEffect | null {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return null;
  }

  const normalizedEffectKey = normalizeEffectKey(effectKey);
  if (!normalizedEffectKey) {
    return null;
  }

  const effect = catalog.effects.find((candidate) => {
    return normalizeCategory(candidate.category) === "styledpointeffect"
      && normalizeEffectKey(candidate.effectKey) === normalizedEffectKey;
  });

  if (!effect?.styledPointEffect) {
    return null;
  }

  const coreLayers = normalizeStyledPointCoreLayers(effect.styledPointEffect.coreLayers);
  if (coreLayers.length === 0) {
    return null;
  }

  const pulseMsRaw = toFiniteNonNegative(effect.styledPointEffect.pulseMs);
  if (pulseMsRaw === null || pulseMsRaw <= 0) {
    return null;
  }

  const clearPolicy = (effect.styledPointEffect.lifecycle?.clearPolicy ?? "").trim().toLowerCase();
  if (clearPolicy !== "timebased" && clearPolicy !== "manual-removal") {
    return null;
  }

  const lifetimeMsRaw = toFiniteNonNegative(effect.styledPointEffect.lifecycle?.lifetimeMs);
  if (clearPolicy === "timebased" && (lifetimeMsRaw === null || lifetimeMsRaw <= 0)) {
    return null;
  }

  const cooldownMsSource = effect.styledPointEffect.lifecycle?.cooldownMs;
  const cooldownMsRaw = toFiniteNonNegative(cooldownMsSource);
  if (cooldownMsSource !== undefined && (cooldownMsRaw === null || cooldownMsRaw <= 0)) {
    return null;
  }

  const orbitLayer = resolveStyledPointOrbitLayer(effect.styledPointEffect.orbitLayer);
  if (orbitLayer === null) {
    return null;
  }

  const cooldownMs = clearPolicy === "timebased" && cooldownMsRaw !== null && cooldownMsRaw > 0
    ? Math.max(1, Math.round(cooldownMsRaw))
    : undefined;

  return {
    coreLayers,
    orbitLayer,
    pulseMs: Math.max(1, Math.round(pulseMsRaw)),
    clearPolicy,
    lifetimeMs: clearPolicy === "timebased"
      ? Math.max(1, Math.round(lifetimeMsRaw ?? 1))
      : undefined,
    cooldownMs
  };
}

function normalizeSilhouetteBlendMode(value: string | undefined): "normal" | "vivid" | "neon" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "neon") {
    return "neon";
  }

  if (normalized === "vivid") {
    return "vivid";
  }

  return "normal";
}

function normalizeMaskAlphaMode(value: string | undefined): "soft" | "binary" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "binary") {
    return "binary";
  }

  return "soft";
}

function normalizeMaskAlphaCutoff(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, Number(value)));
}

function normalizeSilhouettePasses(
  passes: NonNullable<PresentationCueCatalogEffect["appearanceSilhouetteStyle"]>["passes"]
): GameRenderAppearanceSilhouettePass[] {
  if (!Array.isArray(passes) || passes.length === 0) {
    return [];
  }

  const normalizedPasses: GameRenderAppearanceSilhouettePass[] = [];
  for (const pass of passes) {
    if (pass?.enabled === false) {
      continue;
    }

    const colorStops = normalizeColorHexStops(pass?.colorStops);
    const scaleStops = normalizeScaleStops(pass?.scaleStops);
    const alphaStops = normalizeAlphaStops(pass?.alphaStops);

    if (colorStops.length === 0 || scaleStops.length === 0) {
      continue;
    }

    const blend = normalizeSilhouetteBlendMode(pass?.blendMode);

    normalizedPasses.push({
      name: (pass?.name ?? "").trim() || undefined,
      enabled: true,
      blendMode: blend,
      colorHexStops: colorStops,
      scaleMultiplierStops: scaleStops,
      alphaStops: alphaStops.length > 0 ? alphaStops : undefined
    });
  }

  return normalizedPasses;
}

export function resolveAppearanceSilhouetteStyle(
  cues: GameRenderPresentationCue[],
  catalog: PresentationCueCatalogDocument | null | undefined
): GameRenderAppearanceSilhouetteStyle | undefined {
  if (!catalog?.effects || catalog.effects.length === 0) {
    return undefined;
  }

  for (const cue of cues) {
    if (normalizeCategory(cue.category) !== "appearance") {
      continue;
    }

    const cueEffectKey = normalizeEffectKey(cue.effectKey);
    if (!cueEffectKey) {
      continue;
    }

    const effect = catalog.effects.find((candidate) => {
      return normalizeCategory(candidate.category) === "appearance"
        && normalizeEffectKey(candidate.effectKey) === cueEffectKey;
    });

    if (!effect?.appearanceSilhouetteStyle) {
      continue;
    }

    const normalizedPasses = normalizeSilhouettePasses(effect.appearanceSilhouetteStyle.passes);
    if (normalizedPasses.length === 0) {
      continue;
    }

    const pulseMs = toFiniteNonNegative(effect.appearanceSilhouetteStyle.animation?.pulseMs);

    const maskAlphaMode = normalizeMaskAlphaMode(
      effect.appearanceSilhouetteStyle.sourceToSilhouette?.imageToSilhouetteMask?.policy
    );

    const maskAlphaCutoff = normalizeMaskAlphaCutoff(
      effect.appearanceSilhouetteStyle.sourceToSilhouette?.imageToSilhouetteMask?.cutoff
    );

    const resolvedStyle: GameRenderAppearanceSilhouetteStyle = {
      maskAlphaMode,
      maskAlphaCutoff,
      pulseMs: pulseMs === null ? undefined : Math.max(1, Math.round(pulseMs)),
      passes: normalizedPasses
    };

    return resolvedStyle;
  }

  return undefined;
}
