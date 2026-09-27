import type {
  GameRenderLightingBlockerInput,
  GameRenderLightingFrameInput,
  GameRenderLightingPointLightInput,
  GameRenderRoomGeometryInput,
  GameRenderSceneSnapshot
} from "../contracts/sceneTypes";

export const DEFAULT_LIGHTING_MAX_LIGHTS = 64;
export const DEFAULT_LIGHTING_MAX_BLOCKERS = 64;

export interface LightingFrameMappingDiagnostic {
  capability: "geometry" | "roomLighting" | "pointLight" | "blocker" | "pointLightDefaults" | "capacity";
  objectId?: string;
  reason: string;
}

export type LightingFrameMappingResult =
  | {
      ok: true;
      geometry: GameRenderRoomGeometryInput;
      frame: GameRenderLightingFrameInput;
      diagnostics: LightingFrameMappingDiagnostic[];
    }
  | {
      ok: false;
      reason: "invalid-geometry" | "capacity-exceeded";
      diagnostics: LightingFrameMappingDiagnostic[];
    };

export interface LightingFrameMappingOptions {
  maxLights?: number;
  maxBlockers?: number;
}

const pointLightNumericFields = [
  "radiusPx",
  "directionDeg",
  "coneAngleDeg",
  "phase",
  "gradientExponent",
  "intensityScale",
  "lightHeightCells",
  "swayAmountPx",
  "swayHz",
  "swayDirectionDeg",
  "flickerAmount",
  "flickerHz"
] as const;

const defaultsNumericFields = [
  "radiusPx",
  "intensityScale",
  "gradientExponent",
  "lightHeightCells",
  "swayAmountPx",
  "swayHz",
  "swayDirectionDeg",
  "flickerAmount",
  "flickerHz"
] as const;

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidGeometry(scene: GameRenderSceneSnapshot): boolean {
  return Number.isInteger(scene.bounds.width)
    && isFinitePositive(scene.bounds.width)
    && Number.isInteger(scene.bounds.height)
    && isFinitePositive(scene.bounds.height)
    && isFinitePositive(scene.lighting?.cellSizePx ?? Number.NaN);
}

function mapPointLight(
  objectId: string,
  source: NonNullable<GameRenderSceneSnapshot["objectsById"][string]["lighting"]>["pointLight"],
  diagnostics: LightingFrameMappingDiagnostic[]
): GameRenderLightingPointLightInput | undefined {
  if (!source) {
    return undefined;
  }
  if (!Number.isFinite(source.x) || !Number.isFinite(source.y)) {
    diagnostics.push({ capability: "pointLight", objectId, reason: "Light coordinates must be finite room-pixel values." });
    return undefined;
  }

  const result: GameRenderLightingPointLightInput = { x: source.x, y: source.y };
  for (const field of pointLightNumericFields) {
    const value = source[field];
    if (value === undefined) {
      continue;
    }
    if (!Number.isFinite(value)) {
      diagnostics.push({ capability: "pointLight", objectId, reason: `Ignoring non-finite ${field}.` });
      continue;
    }
    result[field] = value;
  }
  if (source.color !== undefined) result.color = source.color;
  if (source.outerColor !== undefined) result.outerColor = source.outerColor;
  if (source.motionMode !== undefined) result.motionMode = source.motionMode;
  if (source.flickerStyle !== undefined) result.flickerStyle = source.flickerStyle;
  return result;
}

function mapDefaults(
  defaults: NonNullable<GameRenderSceneSnapshot["lighting"]>["pointLightDefaults"],
  diagnostics: LightingFrameMappingDiagnostic[]
): GameRenderLightingFrameInput["pointLightDefaults"] {
  if (!defaults) {
    return undefined;
  }

  const result: NonNullable<GameRenderLightingFrameInput["pointLightDefaults"]> = {};
  for (const field of defaultsNumericFields) {
    const value = defaults[field];
    if (value === undefined) {
      continue;
    }
    if (!Number.isFinite(value)) {
      diagnostics.push({ capability: "pointLightDefaults", reason: `Ignoring non-finite ${field}.` });
      continue;
    }
    result[field] = value;
  }
  if (defaults.color !== undefined) result.color = defaults.color;
  if (defaults.outerColor !== undefined) result.outerColor = defaults.outerColor;
  if (defaults.flickerStyle !== undefined) result.flickerStyle = defaults.flickerStyle;
  return result;
}

function mapBlocker(
  objectId: string,
  lighting: NonNullable<GameRenderSceneSnapshot["objectsById"][string]["lighting"]>,
  cellSizePx: number,
  diagnostics: LightingFrameMappingDiagnostic[]
): GameRenderLightingBlockerInput | undefined {
  const footprint = lighting.spatialFootprint;
  const occlusion = lighting.lightOcclusion;
  if (!footprint || !occlusion) {
    return undefined;
  }

  const sizeXCells = footprint.sizeXCells ?? 1;
  const sizeYCells = footprint.sizeYCells ?? 1;
  const elevationCells = footprint.elevationCells;
  const strength = occlusion.strength;
  const cornerStyle = footprint.cornerStyle;
  const xPx = footprint.xPx ?? footprint.cellX * cellSizePx;
  const yPx = footprint.yPx ?? footprint.cellY * cellSizePx;
  const valid = Number.isInteger(footprint.cellX)
    && Number.isInteger(footprint.cellY)
    && Number.isFinite(xPx)
    && Number.isFinite(yPx)
    && Number.isInteger(sizeXCells) && sizeXCells > 0
    && Number.isInteger(sizeYCells) && sizeYCells > 0
    && (elevationCells === undefined || (Number.isFinite(elevationCells) && elevationCells >= 0))
    && (strength === undefined || (Number.isFinite(strength) && strength >= 0 && strength <= 1))
    && (cornerStyle === undefined || cornerStyle === "sharp" || cornerStyle === "rounded");
  if (!valid) {
    diagnostics.push({ capability: "blocker", objectId, reason: "Blocker footprint or occlusion is outside the supported cell geometry." });
    return undefined;
  }

  return {
    xPx,
    yPx,
    sizeXCells,
    sizeYCells,
    cornerStyle: cornerStyle === "rounded" ? "round" : "square",
    ...(elevationCells === undefined ? {} : { elevationCells }),
    ...(strength === undefined ? {} : { strength })
  };
}

export function mapLightingFrameInput(
  scene: GameRenderSceneSnapshot,
  options: LightingFrameMappingOptions = {}
): LightingFrameMappingResult {
  const diagnostics: LightingFrameMappingDiagnostic[] = [];
  if (!isValidGeometry(scene)) {
    diagnostics.push({
      capability: "geometry",
      reason: "Room width, height, and cell size must be finite positive room-pixel values; room dimensions must be integers."
    });
    return { ok: false, reason: "invalid-geometry", diagnostics };
  }

  const geometry: GameRenderRoomGeometryInput = {
    widthPx: scene.bounds.width,
    heightPx: scene.bounds.height,
    cellSizePx: scene.lighting!.cellSizePx!
  };
  const pointLights: GameRenderLightingPointLightInput[] = [];
  const blockers: GameRenderLightingBlockerInput[] = [];
  for (const [objectId, object] of Object.entries(scene.objectsById).sort(([left], [right]) => left.localeCompare(right))) {
    if (!object.lighting) {
      continue;
    }
    const pointLight = mapPointLight(objectId, object.lighting.pointLight, diagnostics);
    if (pointLight) pointLights.push(pointLight);
    const blocker = mapBlocker(objectId, object.lighting, geometry.cellSizePx, diagnostics);
    if (blocker) blockers.push(blocker);
  }

  const maxLights = options.maxLights ?? DEFAULT_LIGHTING_MAX_LIGHTS;
  const maxBlockers = options.maxBlockers ?? DEFAULT_LIGHTING_MAX_BLOCKERS;
  if (pointLights.length > maxLights || blockers.length > maxBlockers) {
    diagnostics.push({
      capability: "capacity",
      reason: `Scene has ${pointLights.length} lights and ${blockers.length} blockers; configured capacities are ${maxLights} and ${maxBlockers}.`
    });
    return { ok: false, reason: "capacity-exceeded", diagnostics };
  }

  const ambient = scene.lighting?.ambientLighting?.ambient;
  const ambientColor = scene.lighting?.ambientLighting?.ambientColor;
  if (ambient !== undefined && (!Number.isFinite(ambient) || ambient < 0 || ambient > 1)) {
    diagnostics.push({ capability: "roomLighting", reason: "Ambient must be finite and between 0 and 1; using full ambient." });
  }
  const pointLightDefaults = mapDefaults(scene.lighting?.pointLightDefaults, diagnostics);
  return {
    ok: true,
    geometry,
    frame: {
      roomLighting: {
        ambient: ambient !== undefined && Number.isFinite(ambient) && ambient >= 0 && ambient <= 1 ? ambient : 1,
        ambientColor: ambientColor ?? "#FFFFFF"
      },
      ...(pointLightDefaults === undefined ? {} : { pointLightDefaults }),
      pointLights,
      blockers
    },
    diagnostics
  };
}
