import type { HostCommandMoveLegTelemetry, HostCommandRenderableRoomObject, HostRoomDisplayMode, HostSessionDataEnvelope } from "../../hostApi/HostContracts";
import type { GameRenderDisplayMode, GameRenderMoveLegTelemetry, GameRenderRoomObject, GameRenderSceneSnapshot } from "../contracts/sceneTypes";
import { buildDirectionalOverlayScene } from "../scene";

const FALLBACK_ROOM_WIDTH = 800;
const FALLBACK_ROOM_HEIGHT = 600;
type HostRoomTransitionCue = NonNullable<NonNullable<HostSessionDataEnvelope["roomChange"]>["presentationCues"]>[number];

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

function resolveRoomTransitionCueEffectKey(roomChange: HostSessionDataEnvelope["roomChange"]): string | undefined {
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

function mergePresentationCues(
  previous: GameRenderRoomObject["presentationCues"],
  incoming: GameRenderRoomObject["presentationCues"]
): GameRenderRoomObject["presentationCues"] {
  void previous;
  // Host-provided cue list is authoritative for this object update.
  return incoming;
}

function resolveMovementTimingFromCues(cues: HostSessionDataEnvelope["roomObjectChanges"][number]["presentationCues"]): {
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
  roomChange?: HostSessionDataEnvelope["roomChange"];
  authoredRenderWidth?: number;
  authoredRenderHeight?: number;
}

function resolveRoomBounds(source: HostPresentationSceneSource): { width: number; height: number } {
  const roomSummary = source.roomChange?.newRoom;
  return {
    width: resolveRoomDimension(roomSummary?.roomImageCanvasWidth, resolveRoomDimension(source.authoredRenderWidth, FALLBACK_ROOM_WIDTH)),
    height: resolveRoomDimension(roomSummary?.roomImageCanvasHeight, resolveRoomDimension(source.authoredRenderHeight, FALLBACK_ROOM_HEIGHT))
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
    ...(additionalSituationalScale === undefined ? {} : { additionalSituationalScale }),
    zOrder: roomObject.renderZOrder,
    presentationCues: []
  };
}

function mapRoomObjectsFromNewRoom(source: HostPresentationSceneSource): GameRenderRoomObject[] {
  const roomObjects = source.roomChange?.newRoom?.renderableRoomObjects ?? [];
  return roomObjects
    .map((roomObject) => mapRenderableRoomObject(roomObject))
    .filter((roomObject): roomObject is GameRenderRoomObject => Boolean(roomObject));
}

function applyRoomObjectChanges(
  initialObjects: GameRenderRoomObject[],
  changes: HostSessionDataEnvelope["roomObjectChanges"]
): GameRenderRoomObject[] {
  if (changes.length === 0) {
    return initialObjects;
  }

  const byId = new Map<string, GameRenderRoomObject>(initialObjects.map((roomObject) => [roomObject.objectId, roomObject]));

  for (const change of changes) {
    if (change.changeKind === "Removed") {
      byId.delete(change.objectId);
      continue;
    }

    const renderableRoomObject = change.renderableRoomObject;
    if (!renderableRoomObject) {
      continue;
    }

    const mappedObject = mapRenderableRoomObject(renderableRoomObject);
    if (!mappedObject) {
      byId.delete(change.objectId);
      continue;
    }

    const previousRoomObject = byId.get(change.objectId);
    const incomingPresentationCues = change.presentationCues.map((cue) => ({
      cueType: cue.cueType,
      category: cue.category,
      effectKey: cue.effectKey,
      moveDirection: cue.moveDirection,
      movementDurationMs: cue.movementDurationMs,
      movementFrames: cue.movementFrames
    }));
    const mergedPresentationCues = mergePresentationCues(
      previousRoomObject?.presentationCues ?? [],
      incomingPresentationCues);

    byId.set(change.objectId, {
      ...mappedObject,
      objectId: change.objectId,
      objectName: change.objectName || mappedObject.objectName,
      presentationCues: mergedPresentationCues,
      ...resolveMovementTimingFromCues(change.presentationCues)
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.zOrder !== right.zOrder) {
      return left.zOrder - right.zOrder;
    }

    return left.objectId.localeCompare(right.objectId);
  });
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

function collectMoveLegTelemetry(changes: HostSessionDataEnvelope["roomObjectChanges"]): GameRenderMoveLegTelemetry[] {
  if (changes.length === 0) {
    return [];
  }

  return changes.flatMap((change) => mapMoveLegTelemetry(change.moveLegTelemetry ?? []));
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
    roomObjects: mapRoomObjectsFromNewRoom(source),
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
  sessionData: HostSessionDataEnvelope,
  previousSnapshot?: GameRenderSceneSnapshot | null
): GameRenderSceneSnapshot | null {
  const baselineSnapshot = mapHostPresentationToSceneSnapshot(sessionData);

  if (baselineSnapshot) {
    return {
      ...baselineSnapshot,
      moveLegTelemetry: collectMoveLegTelemetry(sessionData.roomObjectChanges),
      roomObjects: applyRoomObjectChanges(baselineSnapshot.roomObjects, sessionData.roomObjectChanges)
    };
  }

  if (!previousSnapshot) {
    return null;
  }

  return {
    ...previousSnapshot,
    moveLegTelemetry: collectMoveLegTelemetry(sessionData.roomObjectChanges),
    roomObjects: applyRoomObjectChanges(previousSnapshot.roomObjects, sessionData.roomObjectChanges)
  };
}
