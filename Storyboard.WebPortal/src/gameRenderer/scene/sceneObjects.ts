import type { GameRenderRoomObject, GameRenderSceneObject, GameRenderSceneSnapshot } from "../contracts/sceneTypes";
import type { GameRenderSpriteComponent } from "../contracts/sceneTypes";

function toSceneObject(roomObject: GameRenderRoomObject): GameRenderSceneObject {
  const {
    objectId,
    objectName,
    presentationCues,
    resolvedObjectEffects,
    movementDurationMs,
    movementFrames,
    ...sprite
  } = roomObject;

  return {
    objectId,
    objectName,
    sprite,
    presentationCues,
    ...(resolvedObjectEffects === undefined ? {} : { resolvedObjectEffects }),
    ...(movementDurationMs === undefined ? {} : { movementDurationMs }),
    ...(movementFrames === undefined ? {} : { movementFrames })
  };
}

function toRenderableRoomObject(object: GameRenderSceneObject): GameRenderRoomObject | undefined {
  if (!object.sprite) {
    return undefined;
  }

  return {
    objectId: object.objectId,
    objectName: object.objectName,
    ...object.sprite,
    presentationCues: object.presentationCues,
    ...(object.resolvedObjectEffects === undefined ? {} : { resolvedObjectEffects: object.resolvedObjectEffects }),
    ...(object.movementDurationMs === undefined ? {} : { movementDurationMs: object.movementDurationMs }),
    ...(object.movementFrames === undefined ? {} : { movementFrames: object.movementFrames })
  };
}

export function createSceneObjectsFromRoomObjects(
  roomObjects: GameRenderRoomObject[]
): Record<string, GameRenderSceneObject> {
  return Object.fromEntries(roomObjects.map((roomObject) => {
    const object = toSceneObject(roomObject);
    return [object.objectId, object];
  }));
}

export function selectRenderableRoomObjects(scene: GameRenderSceneSnapshot): GameRenderRoomObject[] {
  return Object.values(scene.objectsById)
    .map(toRenderableRoomObject)
    .filter((roomObject): roomObject is GameRenderRoomObject => Boolean(roomObject))
    .sort((left, right) => left.zOrder - right.zOrder || left.objectId.localeCompare(right.objectId));
}

export function replaceRenderableRoomObjects(
  scene: GameRenderSceneSnapshot,
  roomObjects: GameRenderRoomObject[]
): GameRenderSceneSnapshot {
  const objectsById: Record<string, GameRenderSceneObject> = {};
  for (const [objectId, object] of Object.entries(scene.objectsById)) {
    if (!object.sprite) {
      objectsById[objectId] = object;
      continue;
    }

    const { sprite: _sprite, ...withoutSprite } = object;
    if (object.lighting || object.presentationCues.length > 0 || (object.resolvedObjectEffects?.length ?? 0) > 0) {
      objectsById[objectId] = withoutSprite;
    }
  }

  for (const roomObject of roomObjects) {
    const nextObject = toSceneObject(roomObject);
    const previousObject = objectsById[nextObject.objectId];
    objectsById[nextObject.objectId] = {
      ...previousObject,
      ...nextObject,
      lighting: previousObject?.lighting
    };
  }

  return { ...scene, objectsById };
}

export function mapRenderableRoomObjects(
  scene: GameRenderSceneSnapshot,
  map: (roomObject: GameRenderRoomObject) => GameRenderRoomObject
): GameRenderSceneSnapshot {
  return replaceRenderableRoomObjects(scene, selectRenderableRoomObjects(scene).map(map));
}

export function toSpriteComponent(roomObject: GameRenderRoomObject): GameRenderSpriteComponent {
  const { objectId: _objectId, objectName: _objectName, presentationCues: _cues, resolvedObjectEffects: _effects, movementDurationMs: _duration, movementFrames: _frames, ...sprite } = roomObject;
  return sprite;
}
