import { Container, Graphics } from "pixi.js";
import type { GameRendererDiagnosticsSink } from "../../../diagnostics/RendererDiagnostics";
import type { ResolvedStyledPointEffect } from "../../../presentationCue/resolveMovementCueDuration";

interface StyledPointEffectInstance {
  handleKey: string;
  coreGraphics: Graphics[];
  orbitGraphics: Graphics | null;
  roomX: number;
  roomY: number;
  createdAtMs: number;
  style: ResolvedStyledPointEffect;
}

export type StyledPointEffectIntent =
  | {
    intent: "show";
    handleKey: string;
    roomX: number;
    roomY: number;
    style: ResolvedStyledPointEffect;
  }
  | {
    intent: "cancel";
    handleKey: string;
  };

export interface StyledPointEffectController {
  applyIntent: (input: StyledPointEffectIntent) => void;
  tick: (nowMs: number) => void;
  clear: () => void;
  dispose: () => void;
}

interface CreateStyledPointEffectControllerOptions {
  layer: Container;
  diagnostics?: GameRendererDiagnosticsSink;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizePulsePhase(nowMs: number, createdAtMs: number, pulseMs: number): number {
  if (pulseMs <= 0) {
    return 0;
  }

  const elapsed = Math.max(0, nowMs - createdAtMs);
  return (elapsed % pulseMs) / pulseMs;
}

function sampleStops(stops: number[], phase: number): number {
  if (stops.length === 0) {
    return 0;
  }

  if (stops.length === 1) {
    return stops[0] ?? 0;
  }

  const wrappedPhase = phase - Math.floor(phase);
  const scaled = wrappedPhase * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const t = scaled - lowerIndex;

  const lower = stops[lowerIndex] ?? stops[0] ?? 0;
  const upper = stops[upperIndex] ?? lower;
  return lower + ((upper - lower) * t);
}

function hexToRgb(hexColor: string): { r: number; g: number; b: number } | null {
  const normalized = hexColor.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): number {
  const r = clamp(Math.round(rgb.r), 0, 255);
  const g = clamp(Math.round(rgb.g), 0, 255);
  const b = clamp(Math.round(rgb.b), 0, 255);
  return (r << 16) | (g << 8) | b;
}

function sampleColor(stops: string[], phase: number): number {
  if (stops.length === 0) {
    return 0x22d3ee;
  }

  if (stops.length === 1) {
    const one = hexToRgb(stops[0] ?? "");
    return one ? rgbToHex(one) : 0x22d3ee;
  }

  const wrappedPhase = phase - Math.floor(phase);
  const scaled = wrappedPhase * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const t = scaled - lowerIndex;

  const lower = hexToRgb(stops[lowerIndex] ?? "");
  const upper = hexToRgb(stops[upperIndex] ?? "");
  if (!lower || !upper) {
    return 0x22d3ee;
  }

  return rgbToHex({
    r: lower.r + ((upper.r - lower.r) * t),
    g: lower.g + ((upper.g - lower.g) * t),
    b: lower.b + ((upper.b - lower.b) * t)
  });
}

function removeGraphics(graphics: Graphics | null | undefined): void {
  if (!graphics) {
    return;
  }

  graphics.clear();
  if (graphics.parent) {
    graphics.parent.removeChild(graphics);
  }
  graphics.destroy();
}

export function createStyledPointEffectController(
  options: CreateStyledPointEffectControllerOptions
): StyledPointEffectController {
  const activeByHandle = new Map<string, StyledPointEffectInstance>();

  function removeInstance(instance: StyledPointEffectInstance): void {
    activeByHandle.delete(instance.handleKey);
    for (const graphics of instance.coreGraphics) {
      removeGraphics(graphics);
    }
    removeGraphics(instance.orbitGraphics);
  }

  function clear(): void {
    for (const instance of [...activeByHandle.values()]) {
      removeInstance(instance);
    }
  }

  return {
    applyIntent: (input) => {
      const handleKey = input.handleKey.trim();
      if (!handleKey) {
        return;
      }

      const existing = activeByHandle.get(handleKey);
      if (existing) {
        removeInstance(existing);
      }

      if (input.intent === "cancel") {
        options.diagnostics?.({
          category: "scene",
          level: "debug",
          message: "Styled point effect canceled.",
          details: { handleKey }
        });
        return;
      }

      const coreGraphics: Graphics[] = [];
      for (let index = 0; index < input.style.coreLayers.length; index += 1) {
        const layer = input.style.coreLayers[index];
        if (!layer) {
          continue;
        }

        const layerGraphics = new Graphics();
        layerGraphics.zIndex = 100_000 + index;
        layerGraphics.blendMode = layer.blendMode;
        options.layer.addChild(layerGraphics);
        coreGraphics[index] = layerGraphics;
      }

      let orbitGraphics: Graphics | null = null;
      if (input.style.orbitLayer) {
        orbitGraphics = new Graphics();
        orbitGraphics.zIndex = 100_500;
        orbitGraphics.blendMode = input.style.orbitLayer.blendMode;
        options.layer.addChild(orbitGraphics);
      }

      activeByHandle.set(handleKey, {
        handleKey,
        coreGraphics,
        orbitGraphics,
        roomX: input.roomX,
        roomY: input.roomY,
        createdAtMs: performance.now(),
        style: input.style
      });

      options.diagnostics?.({
        category: "scene",
        level: "debug",
        message: "Styled point effect spawned.",
        details: {
          handleKey,
          roomX: input.roomX,
          roomY: input.roomY,
          pulseMs: input.style.pulseMs,
          coreLayerCount: input.style.coreLayers.length,
          orbitStyle: input.style.orbitLayer?.style,
          clearPolicy: input.style.clearPolicy,
          lifetimeMs: input.style.lifetimeMs,
          cooldownMs: input.style.cooldownMs
        }
      });
    },
    tick: (nowMs) => {
      for (const instance of [...activeByHandle.values()]) {
        const ageMs = Math.max(0, nowMs - instance.createdAtMs);
        let isCoolingDown = false;
        let cooldownProgress = 0;

        if (instance.style.clearPolicy === "timebased"
          && Number.isFinite(instance.style.lifetimeMs)) {
          const lifetimeMs = instance.style.lifetimeMs ?? 0;
          if (ageMs > lifetimeMs) {
            const cooldownMs = instance.style.cooldownMs ?? 0;
            if (cooldownMs <= 0) {
              removeInstance(instance);
              continue;
            }

            const cooldownAgeMs = ageMs - lifetimeMs;
            if (cooldownAgeMs >= cooldownMs) {
              removeInstance(instance);
              continue;
            }

            isCoolingDown = true;
            cooldownProgress = clamp(cooldownAgeMs / cooldownMs, 0, 1);
          }
        }

        const phase = normalizePulsePhase(nowMs, instance.createdAtMs, instance.style.pulseMs);
        const coreLayerCount = instance.style.coreLayers.length;
        const coreLayersHiddenFromFront = isCoolingDown
          ? Math.floor(cooldownProgress * coreLayerCount)
          : 0;
        const sampledCoreRadii: number[] = [];
        for (let index = 0; index < instance.style.coreLayers.length; index += 1) {
          const layer = instance.style.coreLayers[index];
          const graphics = instance.coreGraphics[index];
          if (!layer || !graphics) {
            continue;
          }

          const isCoreLayerVisible = !isCoolingDown || index >= coreLayersHiddenFromFront;
          if (!isCoreLayerVisible) {
            graphics.clear();
            continue;
          }

          const sampledRadius = Math.max(0.5, sampleStops(layer.radiusStops, phase) * layer.radiusScale);
          const sampledAlpha = clamp(sampleStops(layer.alphaStops, phase), 0, 1);
          const sampledColor = sampleColor(layer.colorHexStops, phase);

          sampledCoreRadii.push(sampledRadius);
          graphics.clear();
          graphics.circle(instance.roomX, instance.roomY, sampledRadius)
            .fill({ color: sampledColor, alpha: sampledAlpha });
        }

        const orbitLayer = instance.style.orbitLayer;
        const orbitGraphics = instance.orbitGraphics;
        if (!orbitLayer || !orbitGraphics) {
          continue;
        }

        orbitGraphics.clear();
        if (isCoolingDown) {
          continue;
        }

        const baseCoreRadius = sampledCoreRadii.length > 0
          ? Math.max(...sampledCoreRadii)
          : 1;

        if (orbitLayer.style === "spinner") {
          const sampledDensity = clamp(Math.round(sampleStops(orbitLayer.spinner.densityStops, phase)), 1, 128);
          const sampledAlpha = clamp(sampleStops(orbitLayer.spinner.alphaStops, phase) * orbitLayer.spinner.alphaScale, 0, 1);
          const sampledColor = sampleColor(orbitLayer.spinner.colorHexStops, phase);
          const orbitBaseRadius = Math.max(0.5, baseCoreRadius * orbitLayer.spinner.baseRadiusScale);

          for (let index = 0; index < sampledDensity; index += 1) {
            const normalized = sampledDensity <= 1 ? 0 : index / sampledDensity;
            const theta = (normalized * Math.PI * 2) + (phase * Math.PI * 2 * orbitLayer.spinner.angularSpeedScale);
            const orbitRadius = orbitBaseRadius * (
              orbitLayer.spinner.radiusScaleBase
              + ((index % orbitLayer.spinner.radiusScaleBands) * orbitLayer.spinner.radiusScaleStep)
            );
            const sparkX = instance.roomX + (Math.cos(theta) * orbitRadius);
            const sparkY = instance.roomY + (Math.sin(theta) * orbitRadius);
            const sparkRadius = Math.max(0.5, orbitBaseRadius * orbitLayer.spinner.sparkRadiusScale);

            orbitGraphics.circle(sparkX, sparkY, sparkRadius)
              .fill({ color: sampledColor, alpha: sampledAlpha });
          }
          continue;
        }

        const orbitBaseRadius = Math.max(0.5, baseCoreRadius * orbitLayer.ringPulse.baseRadiusScale);
        for (let ringIndex = 0; ringIndex < orbitLayer.ringPulse.ringCount; ringIndex += 1) {
          const ringPhase = (phase + (ringIndex * orbitLayer.ringPulse.phaseOffsetStep)) % 1;
          const sampledGrowth = Math.max(0.01, sampleStops(orbitLayer.ringPulse.radialGrowthStops, ringPhase));
          const sampledAlpha = clamp(sampleStops(orbitLayer.ringPulse.alphaStops, ringPhase) * orbitLayer.ringPulse.alphaScale, 0, 1);
          const sampledColor = sampleColor(orbitLayer.ringPulse.colorHexStops, ringPhase);
          const ringRadius = orbitBaseRadius
            * (1 + (ringIndex * orbitLayer.ringPulse.ringSpacingScale))
            * sampledGrowth;

          orbitGraphics.circle(instance.roomX, instance.roomY, ringRadius)
            .stroke({
              width: orbitLayer.ringPulse.ringThicknessPx,
              color: sampledColor,
              alpha: sampledAlpha
            });
        }
      }
    },
    clear,
    dispose: () => {
      clear();
    }
  };
}
