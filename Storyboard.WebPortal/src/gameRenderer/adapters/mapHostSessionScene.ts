import type { HostCommandMoveLegTelemetry, HostCommandRenderableRoomObject, HostRoomDisplayMode, HostSessionPresentationData, HostSessionPresentationSettings, HostEnvironmentalParticleEffectInstance, HostObjectParticleEffectInstance, HostParticleEffectBurst } from "../../hostApi/HostContracts";
import type { GameRenderDisplayMode, GameRenderMoveLegTelemetry, GameRenderObjectLighting, GameRenderRoomObject, GameRenderSceneObject, GameRenderSceneSnapshot } from "../contracts/sceneTypes";
import { buildDirectionalOverlayScene } from "../scene";
import { toSpriteComponent } from "../scene/sceneObjects";
import type { GameRenderParticleEffect, GameRenderParticleBurst } from "../contracts/presentationEffects";

const FALLBACK_ROOM_WIDTH = 800;
const FALLBACK_ROOM_HEIGHT = 600;
type HostRoomTransitionCue = NonNullable<NonNullable<HostSessionPresentationData["roomChange"]>["presentationCues"]>[number];

function mapDisplayMode(raw: HostRoomDisplayMode): GameRenderDisplayMode {
  if (typeof raw === "string") {
    return raw.localeCompare("Independent", undefined, { sensitivity: "accent" }) === 0
      ? "independent"
      : "composed";
  }

  return raw === 0 ? "independent" : "composed";
}

function resolveRoomDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }

  return Math.round(value);
}

function toNonNegativeInt(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.round(value ?? 0));
}

function isMovementCueCategory(value: string): boolean {
  return value.trim().toLowerCase() === "movement";
}

function isRoomTransitionCue(cue: HostRoomTransitionCue): boolean {
  if (cue.cueType === "roomTransition") {
    return true;
  }

  return cue.category.replace(/\s+/g, "").trim().toLowerCase() === "roomtransition";
}

function resolveRoomTransitionCueEffectKey(roomChange: HostSessionPresentationData["roomChange"]): string | undefined {
  if (!roomChange) {
    return undefined;
  }

  for (const cue of roomChange.presentationCues ?? []) {
    if (!isRoomTransitionCue(cue)) {
      continue;
    }

    const effectKey = cue.effectKey.trim();
    if (effectKey.length > 0) {
      return effectKey;
    }
  }

  return undefined;
}

function resolveMovementTimingFromCues(cues: Array<Pick<GameRenderSceneObject["activePresentationCues"][number], "category">
  & Partial<Pick<GameRenderSceneObject["activePresentationCues"][number], "movementDurationMs" | "movementFrames">>>): {
  movementDurationMs?: number;
  movementFrames?: number;
} {
  let fallbackTiming: { movementDurationMs?: number; movementFrames?: number } | null = null;

  for (const cue of cues) {
    if (!isMovementCueCategory(cue.category)) {
      continue;
    }

    const movementDurationMs = toNonNegativeInt(cue.movementDurationMs);
    const movementFrames = toNonNegativeInt(cue.movementFrames);

    if (fallbackTiming === null) {
      fallbackTiming = {
        movementDurationMs,
        movementFrames
      };
    }

    if ((movementDurationMs ?? 0) > 0 || (movementFrames ?? 0) > 0) {
      return {
        movementDurationMs,
        movementFrames
      };
    }
  }

  return fallbackTiming ?? {};
}

export interface HostPresentationSceneSource {
  roomChange?: HostSessionPresentationData["roomChange"];
  sessionPresentationSettings?: HostSessionPresentationSettings | null;
  authoredRenderWidth?: number | null;
  authoredRenderHeight?: number | null;
}

function mapObjectLighting(roomObject: HostCommandRenderableRoomObject): GameRenderObjectLighting | undefined {
  const pointLight = roomObject.pointLight;
  const spatialFootprint = roomObject.spatialFootprint;
  const lightOcclusion = roomObject.lightOcclusion;
  if (!pointLight && !spatialFootprint && !lightOcclusion) {
    return undefined;
  }

  return {
    ...(pointLight ? { pointLight } : {}),
    ...(spatialFootprint ? { spatialFootprint } : {}),
    ...(lightOcclusion ? { lightOcclusion } : {})
  };
}

function mapLightingState(source: HostPresentationSceneSource): NonNullable<GameRenderSceneSnapshot["lighting"]> {
  const settings = source.sessionPresentationSettings;
  return {
    ...(settings && Number.isFinite(settings.cellSizePx) ? { cellSizePx: settings.cellSizePx } : {}),
    ...(settings ? { pointLightDefaults: settings.pointLightDefaults } : settings === null ? { pointLightDefaults: null } : {}),
    ...(source.roomChange?.newRoom?.ambientLighting === undefined
      ? {}
      : { ambientLighting: source.roomChange.newRoom.ambientLighting })
  };
}

function mapHostObject(
  roomObject: HostCommandRenderableRoomObject,
  activePresentationCues: GameRenderSceneObject["activePresentationCues"] = []
): GameRenderSceneObject {
  const spriteObject = mapRenderableRoomObject(roomObject);
  const lighting = mapObjectLighting(roomObject);
  return {
    objectId: roomObject.objectId,
    objectName: roomObject.name,
    ...(spriteObject ? { sprite: toSpriteComponent(spriteObject) } : {}),
    ...(lighting ? { lighting } : {}),
    ...(roomObject.particleEffect ? { particleEffect: mapObjectParticleEffect(roomObject.objectId, roomObject.particleEffect, roomObject.renderZOrder) } : {}),
    activePresentationCues,
    ...resolveMovementTimingFromCues(activePresentationCues)
  };
}

function mapParticleControls(targetControls: HostObjectParticleEffectInstance["targetControls"]): GameRenderParticleEffect["tuning"] {
  const tuning: GameRenderParticleEffect["tuning"] = {};
  for (const [name, value] of Object.entries(targetControls ?? {})) {
    if (value.valueType === "Numeric" && Number.isFinite(value.numericValue)) {
      (tuning as Record<string, unknown>)[name] = value.numericValue;
    } else if (value.valueType === "String" && typeof value.stringValue === "string") {
      if (name === "Colors") {
        try {
          const colors = JSON.parse(value.stringValue) as { primary?: unknown; secondary?: unknown };
          if (typeof colors.primary === "string" && typeof colors.secondary === "string") {
            tuning.Colors = { primary: colors.primary, secondary: colors.secondary };
          }
        } catch { /* Invalid colors are ignored; the packaged recipe palette remains active. */ }
      } else if (name === "Tint") {
        tuning.Tint = value.stringValue;
      }
    }
  }
  return tuning;
}

function mapObjectParticleEffect(objectId: string, effect: HostObjectParticleEffectInstance, order: number): GameRenderParticleEffect {
  return {
    id: objectId,
    effectKey: effect.effectKey,
    x: effect.x,
    y: effect.y,
    enabled: effect.isProducing,
    order,
    tuning: mapParticleControls(effect.targetControls)
  };
}

function mapEnvironmentalParticleEffect(effect: HostEnvironmentalParticleEffectInstance): GameRenderParticleEffect {
  return {
    id: effect.instanceId,
    effectKey: effect.effectKey,
    enabled: effect.isProducing,
    order: effect.renderOrder,
    tuning: mapParticleControls(effect.targetControls)
  };
}

function mapParticleBurst(burst: HostParticleEffectBurst): GameRenderParticleBurst {
  return {
    id: burst.burstId,
    sourceObjectId: burst.sourceObjectId,
    roomId: burst.roomId,
    effectKey: burst.effectKey,
    x: burst.x,
    y: burst.y,
    enabled: true,
    order: 0,
    tuning: mapParticleControls(burst.targetControls)
  };
}

function mapActivePresentationCues(roomObject: HostCommandRenderableRoomObject): GameRenderSceneObject["activePresentationCues"] {
  const cuesByActivationId = new Map<string, GameRenderSceneObject["activePresentationCues"][number]>();
  for (const cue of roomObject.activePresentationCues ?? []) {
    const effectKey = cue.effectKey.trim();
    const activationId = cue.activationId.trim();
    if (!effectKey || !activationId) {
      continue;
    }

    if (!cuesByActivationId.has(activationId)) {
      cuesByActivationId.set(activationId, {
        category: cue.category,
        effectKey,
        activationId,
        ...(cue.movement ? {
          moveDirection: cue.movement.moveDirection,
          movementDurationMs: toNonNegativeInt(cue.movement.movementDurationMs),
          movementFrames: toNonNegativeInt(cue.movement.movementFrames)
        } : {})
      });
    }
  }

  return [...cuesByActivationId.values()];
}

function mapRoomObjectsFromNewRoom(source: HostPresentationSceneSource): Record<string, GameRenderSceneObject> {
  const roomObjects = source.roomChange?.newRoom?.renderableRoomObjects ?? [];
  return Object.fromEntries(roomObjects.map((roomObject) => {
    const mapped = mapHostObject(roomObject, mapActivePresentationCues(roomObject));
    return [mapped.objectId, mapped];
  }));
}

function applyObjectChanges(
  initial: Record<string, GameRenderSceneObject>,
  changes: HostSessionPresentationData["roomObjectChanges"]
): Record<string, GameRenderSceneObject> {
  const objectsById = { ...initial };
  for (const change of changes) {
    if (change.changeKind === "Removed" || change.changeKind === "Hidden") {
      delete objectsById[change.objectId];
      continue;
    }

    const renderableRoomObject = change.renderableRoomObject;
    if (change.changeKind === "Shown" && !renderableRoomObject) {
      continue;
    }
    const previous = objectsById[change.objectId];
    const activePresentationCues = renderableRoomObject
      ? (change.changeKind === "Updated" && renderableRoomObject.activePresentationCues == null
          ? previous?.activePresentationCues ?? []
          : mapActivePresentationCues(renderableRoomObject))
      : [];
    const mapped = renderableRoomObject
      ? mapHostObject(renderableRoomObject, activePresentationCues)
      : {
          objectId: change.objectId,
          objectName: change.objectName,
          activePresentationCues: [],
          ...resolveMovementTimingFromCues([])
        };
    const lightingTransitionFrom = change.fromRenderableObject
      ? mapObjectLighting(change.fromRenderableObject)
      : undefined;
    objectsById[change.objectId] = {
      ...mapped,
      objectId: change.objectId,
      objectName: change.objectName || mapped.objectName,
      ...(lightingTransitionFrom ? { lightingTransitionFrom } : {})
    };
  }

  return objectsById;
}

function applyLightingSessionSettings(
  previous: NonNullable<GameRenderSceneSnapshot["lighting"]>,
  settings: HostSessionPresentationSettings | null | undefined
): NonNullable<GameRenderSceneSnapshot["lighting"]> {
  if (settings === undefined) {
    return previous;
  }

  if (settings === null) {
    return {
      ...previous,
      cellSizePx: undefined,
      pointLightDefaults: null
    };
  }

  return {
    ...previous,
    ...(Number.isFinite(settings.cellSizePx) ? { cellSizePx: settings.cellSizePx } : { cellSizePx: undefined }),
    pointLightDefaults: settings.pointLightDefaults ?? null
  };
}

function resolveRoomBounds(source: HostPresentationSceneSource): { width: number; height: number } {
  const roomSummary = source.roomChange?.newRoom;
  return {
    width: resolveRoomDimension(roomSummary?.roomImageCanvasWidth, resolveRoomDimension(source.authoredRenderWidth ?? undefined, FALLBACK_ROOM_WIDTH)),
    height: resolveRoomDimension(roomSummary?.roomImageCanvasHeight, resolveRoomDimension(source.authoredRenderHeight ?? undefined, FALLBACK_ROOM_HEIGHT))
  };
}

function mapRenderableRoomObject(
  roomObject: HostCommandRenderableRoomObject
): GameRenderRoomObject | null {
  const imagePath = roomObject.renderableImage.imagePath.trim();
  if (!imagePath) {
    return null;
  }

  const additionalSituationalScale = Number.isFinite(roomObject.renderableImage.additionalSituationalScale)
    ? roomObject.renderableImage.additionalSituationalScale
    : undefined;

  return {
    objectId: roomObject.objectId,
    objectName: roomObject.name,
    asset: {
      assetPath: imagePath,
      cacheKey: imagePath
    },
    x: roomObject.renderableImage.x,
    y: roomObject.renderableImage.y,
    rotationDegrees: roomObject.renderableImage.rotationDegrees,
    scale: Number.isFinite(roomObject.renderableImage.scale) && roomObject.renderableImage.scale > 0
      ? roomObject.renderableImage.scale
      : 1,
    ...(Number.isFinite(roomObject.imageTransparency)
      ? { imageTransparency: Math.min(1, Math.max(0, roomObject.imageTransparency!)) }
      : {}),
    ...(additionalSituationalScale === undefined ? {} : { additionalSituationalScale }),
    zOrder: roomObject.renderZOrder,
    activePresentationCues: []
  };
}

function mapMoveLegTelemetry(entries: HostCommandMoveLegTelemetry[]): GameRenderMoveLegTelemetry[] {
  if (entries.length === 0) {
    return [];
  }

  return entries.map((entry) => ({
    targetObjectId: entry.targetObjectId,
    targetObjectName: entry.targetObjectName,
    legIndex: entry.legIndex,
    requestedDirection: entry.requestedDirection,
    requestedDistanceInCells: entry.requestedDistanceInCells,
    appliedDistanceInCells: entry.appliedDistanceInCells,
    success: entry.success,
    resultCode: entry.resultCode,
    fromX: entry.fromX,
    fromY: entry.fromY,
    toX: entry.toX,
    toY: entry.toY,
    travelVisualizationMode: entry.travelVisualizationMode
  }));
}

function collectMoveLegTelemetry(changes: HostSessionPresentationData["roomObjectChanges"]): GameRenderMoveLegTelemetry[] {
  if (changes.length === 0) {
    return [];
  }

  return changes.flatMap((change) => change.changeKind === "Added" || change.changeKind === "Updated"
    ? mapMoveLegTelemetry(change.moveLegTelemetry ?? [])
    : []);
}

export function mapHostPresentationToSceneSnapshot(source: HostPresentationSceneSource): GameRenderSceneSnapshot | null {
  const newRoom = source.roomChange?.newRoom;
  if (!newRoom) {
    return null;
  }

  const directionalOverlays = buildDirectionalOverlayScene({
    overlays: newRoom.directionalRenderableImages
      .filter((entry) => entry.renderableImage.imagePath.trim().length > 0)
      .map((entry, index) => ({
        id: `${newRoom.roomId}:${entry.slot}:${index}`,
        slot: entry.slot,
        asset: {
          assetPath: entry.renderableImage.imagePath,
          cacheKey: entry.renderableImage.imagePath
        },
        offsetX: entry.renderableImage.x,
        offsetY: entry.renderableImage.y,
        rotationDegrees: entry.renderableImage.rotationDegrees,
        scale: Number.isFinite(entry.renderableImage.scale) && entry.renderableImage.scale > 0 ? entry.renderableImage.scale : 1,
        zOrder: index
      })),
    displayMode: mapDisplayMode(newRoom.roomDisplayMode)
  });

  return {
    roomId: newRoom.roomId,
    roomLabel: newRoom.name,
    displayMode: mapDisplayMode(newRoom.roomDisplayMode),
    bounds: resolveRoomBounds(source),
    directionalOverlays,
    objectsById: mapRoomObjectsFromNewRoom(source),
    environmentalParticleEffects: (Array.isArray(newRoom.environmentalParticleEffects) ? newRoom.environmentalParticleEffects : []).map(mapEnvironmentalParticleEffect),
    particleEffectImageMappings: newRoom.particleEffectImageMappings ?? [],
    lighting: mapLightingState(source),
    moveLegTelemetry: [],
    roomTransition: source.roomChange?.travelDirection
      ? {
          travelDirection: source.roomChange.travelDirection,
          cueEffectKey: resolveRoomTransitionCueEffectKey(source.roomChange)
        }
      : undefined
  };
}

export function mapHostSessionDataToSceneSnapshot(
  sessionData: HostSessionPresentationData,
  previousSnapshot?: GameRenderSceneSnapshot | null
): GameRenderSceneSnapshot | null {
  const baselineSnapshot = mapHostPresentationToSceneSnapshot(sessionData);

  if (baselineSnapshot) {
    const baselineLighting = baselineSnapshot.lighting!;
    const baselineObjects = baselineSnapshot.objectsById;
    const previousLighting = previousSnapshot?.lighting;
    const roomLightingWithRetainedSessionSettings = sessionData.sessionPresentationSettings === undefined && previousLighting
      ? {
          ...baselineLighting,
          ...(previousLighting.cellSizePx === undefined ? {} : { cellSizePx: previousLighting.cellSizePx }),
          ...(previousLighting.pointLightDefaults === undefined ? {} : { pointLightDefaults: previousLighting.pointLightDefaults })
        }
      : baselineLighting;
    return {
      ...baselineSnapshot,
      moveLegTelemetry: collectMoveLegTelemetry(sessionData.roomObjectChanges),
      objectsById: applyObjectChanges(baselineObjects, sessionData.roomObjectChanges),
      lighting: {
        ...applyLightingSessionSettings(roomLightingWithRetainedSessionSettings, sessionData.sessionPresentationSettings),
      },
      ...(sessionData.particleEffectBursts === undefined ? {} : { particleEffectBursts: sessionData.particleEffectBursts.map(mapParticleBurst) }),
      particleEffectImageMappings: mergeParticleEffectImageMappings(previousSnapshot?.particleEffectImageMappings, baselineSnapshot.particleEffectImageMappings)
    };
  }

  if (!previousSnapshot) {
    return null;
  }

  const previousLighting = previousSnapshot.lighting ?? {};
  const lightingWithSettings = applyLightingSessionSettings(previousLighting, sessionData.sessionPresentationSettings);
  const currentRoomUpdate = sessionData.roomChange?.currentRoom;
  const currentRoomMatchesDisplayedRoom = currentRoomUpdate?.roomId === previousSnapshot.roomId;
  const currentRoomEnvironment = currentRoomUpdate?.environmentalParticleEffects;
  const imageMappings = currentRoomMatchesDisplayedRoom
    ? currentRoomUpdate?.particleEffectImageMappings
    : undefined;

  return {
    ...previousSnapshot,
    moveLegTelemetry: collectMoveLegTelemetry(sessionData.roomObjectChanges),
    objectsById: applyObjectChanges(previousSnapshot.objectsById, sessionData.roomObjectChanges),
    lighting: {
      ...lightingWithSettings,
      ...(sessionData.roomChange?.newRoom?.ambientLighting !== undefined
        ? { ambientLighting: sessionData.roomChange.newRoom.ambientLighting }
        : {}),
      ...(currentRoomMatchesDisplayedRoom && currentRoomUpdate?.ambientLighting !== undefined
        ? { ambientLighting: currentRoomUpdate.ambientLighting }
        : {}),
    },
    ...(currentRoomMatchesDisplayedRoom
      && Array.isArray(currentRoomEnvironment)
      ? { environmentalParticleEffects: currentRoomEnvironment.map(mapEnvironmentalParticleEffect) }
      : {}),
    ...(sessionData.particleEffectBursts === undefined ? { particleEffectBursts: [] } : { particleEffectBursts: sessionData.particleEffectBursts.map(mapParticleBurst) }),
    ...(imageMappings === undefined ? {} : { particleEffectImageMappings: mergeParticleEffectImageMappings(previousSnapshot.particleEffectImageMappings, imageMappings) })
  };
}

function mergeParticleEffectImageMappings(
  previous: GameRenderSceneSnapshot["particleEffectImageMappings"],
  additions: GameRenderSceneSnapshot["particleEffectImageMappings"]
): GameRenderSceneSnapshot["particleEffectImageMappings"] {
  const merged = new Map<string, NonNullable<GameRenderSceneSnapshot["particleEffectImageMappings"]>[number]>();
  for (const mapping of [...(previous ?? []), ...(additions ?? [])]) {
    merged.set(`${mapping.effectKey}\u0000${mapping.imageSlot}`, mapping);
  }
  return [...merged.values()];
}
