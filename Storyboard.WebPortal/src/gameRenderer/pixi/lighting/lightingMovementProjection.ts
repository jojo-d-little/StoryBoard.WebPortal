import type {
  GameRenderObjectLighting,
  GameRenderSceneSnapshot
} from "../../contracts/sceneTypes";

export interface LightingMovementTween {
  from: GameRenderObjectLighting;
  to: GameRenderObjectLighting;
  durationMs: number;
  elapsedMs: number;
}

export interface SpriteAnchoredLightingPosition {
  spriteX: number;
  spriteY: number;
  fromSpriteX: number;
  fromSpriteY: number;
  toSpriteX: number;
  toSpriteY: number;
  progress: number;
}

function hasBlocker(lighting: GameRenderObjectLighting | undefined): boolean {
  return Boolean(lighting?.spatialFootprint && lighting.lightOcclusion);
}

function sameFootprint(
  left: GameRenderObjectLighting["spatialFootprint"],
  right: GameRenderObjectLighting["spatialFootprint"]
): boolean {
  return left?.cellX === right?.cellX
    && left?.cellY === right?.cellY
    && left?.xPx === right?.xPx
    && left?.yPx === right?.yPx
    && left?.sizeXCells === right?.sizeXCells
    && left?.sizeYCells === right?.sizeYCells
    && left?.cornerStyle === right?.cornerStyle
    && left?.elevationCells === right?.elevationCells;
}

function sameOcclusion(
  left: GameRenderObjectLighting["lightOcclusion"],
  right: GameRenderObjectLighting["lightOcclusion"]
): boolean {
  return left?.strength === right?.strength;
}

export function createLightingMovementTween(
  from: GameRenderObjectLighting | undefined,
  to: GameRenderObjectLighting | undefined,
  durationMs: number
): LightingMovementTween | undefined {
  if (!from || !to || !Number.isFinite(durationMs) || durationMs <= 0) {
    return undefined;
  }

  const pointPositionChanges = Boolean(from.pointLight && to.pointLight
    && (from.pointLight.x !== to.pointLight.x || from.pointLight.y !== to.pointLight.y));
  const blockerChanges = hasBlocker(from) !== hasBlocker(to)
    || (hasBlocker(from) && hasBlocker(to)
      && (!sameFootprint(from.spatialFootprint, to.spatialFootprint)
        || !sameOcclusion(from.lightOcclusion, to.lightOcclusion)));
  if (!pointPositionChanges && !blockerChanges) {
    return undefined;
  }

  return { from, to, durationMs, elapsedMs: 0 };
}

export function advanceLightingMovementTweens(
  tweens: Map<string, LightingMovementTween>,
  deltaMs: number,
  pausedObjectIds: ReadonlySet<string> = new Set()
): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return;
  }

  for (const [objectId, tween] of tweens) {
    if (pausedObjectIds.has(objectId)) {
      continue;
    }
    tween.elapsedMs = Math.min(tween.durationMs, tween.elapsedMs + deltaMs);
    if (tween.elapsedMs >= tween.durationMs) {
      tweens.delete(objectId);
    }
  }
}

function sampleTween(tween: LightingMovementTween): {
  progress: number;
  lighting: GameRenderObjectLighting;
} {
  const progress = Math.min(1, Math.max(0, tween.elapsedMs / tween.durationMs));
  const easedProgress = progress * (2 - progress);
  const lighting: GameRenderObjectLighting = { ...tween.to };

  if (tween.from.pointLight && tween.to.pointLight) {
    lighting.pointLight = {
      ...tween.to.pointLight,
      x: tween.from.pointLight.x + (tween.to.pointLight.x - tween.from.pointLight.x) * easedProgress,
      y: tween.from.pointLight.y + (tween.to.pointLight.y - tween.from.pointLight.y) * easedProgress
    };
  }

  if (progress < 1) {
    // Blocker geometry is cell-based, so hold the old whole-cell footprint until the
    // movement reaches its final leg boundary instead of inventing fractional cells.
    if (hasBlocker(tween.from)) {
      lighting.spatialFootprint = tween.from.spatialFootprint;
      lighting.lightOcclusion = tween.from.lightOcclusion;
    } else if (hasBlocker(tween.to)) {
      delete lighting.lightOcclusion;
    }
  }

  return { progress, lighting };
}

/**
 * Projects a light along the sprite's already-interpolated path. The sprite position
 * comes from the renderer's live movement tween, so multi-leg paths and retargets
 * stay in lockstep. The light's relative offset can still transition between Host
 * endpoints over the same movement progress.
 */
export function projectSpriteAnchoredPointLight(
  lighting: GameRenderObjectLighting,
  fromLighting: GameRenderObjectLighting | undefined,
  position: SpriteAnchoredLightingPosition
): GameRenderObjectLighting {
  const targetPoint = lighting.pointLight;
  if (!targetPoint) {
    return lighting;
  }

  const sourcePoint = fromLighting?.pointLight ?? targetPoint;
  const progress = Math.min(1, Math.max(0, position.progress));
  const easedProgress = progress * (2 - progress);
  const fromOffsetX = sourcePoint.x - position.fromSpriteX;
  const fromOffsetY = sourcePoint.y - position.fromSpriteY;
  const toOffsetX = targetPoint.x - position.toSpriteX;
  const toOffsetY = targetPoint.y - position.toSpriteY;

  return {
    ...lighting,
    pointLight: {
      ...targetPoint,
      x: position.spriteX + fromOffsetX + ((toOffsetX - fromOffsetX) * easedProgress),
      y: position.spriteY + fromOffsetY + ((toOffsetY - fromOffsetY) * easedProgress)
    }
  };
}

/**
 * Moves a Host-authored footprint with the sprite while preserving its sub-pixel
 * room-image position. Host footprints remain cell-authored; xPx/yPx are transient
 * renderer projections consumed by the lighting package.
 */
export function projectSpriteAnchoredBlocker(
  lighting: GameRenderObjectLighting,
  fromLighting: GameRenderObjectLighting | undefined,
  position: SpriteAnchoredLightingPosition,
  cellSizePx: number
): GameRenderObjectLighting {
  if (!Number.isFinite(cellSizePx) || cellSizePx <= 0) {
    return lighting;
  }

  const fromFootprint = fromLighting?.spatialFootprint;
  const toFootprint = lighting.spatialFootprint;
  const fromOcclusion = fromLighting?.lightOcclusion;
  const toOcclusion = lighting.lightOcclusion;
  const hasFromBlocker = Boolean(fromFootprint && fromOcclusion);
  const hasToBlocker = Boolean(toFootprint && toOcclusion);
  if (!hasFromBlocker && !hasToBlocker) {
    return lighting;
  }

  const footprint = hasFromBlocker ? fromFootprint! : toFootprint!;
  const progress = Math.min(1, Math.max(0, position.progress));
  const easedProgress = progress * (2 - progress);
  const fromPositionX = hasFromBlocker
    ? (fromFootprint!.xPx ?? fromFootprint!.cellX * cellSizePx)
    : undefined;
  const fromPositionY = hasFromBlocker
    ? (fromFootprint!.yPx ?? fromFootprint!.cellY * cellSizePx)
    : undefined;
  const targetPositionX = hasToBlocker
    ? (toFootprint!.xPx ?? toFootprint!.cellX * cellSizePx)
    : undefined;
  const targetPositionY = hasToBlocker
    ? (toFootprint!.yPx ?? toFootprint!.cellY * cellSizePx)
    : undefined;
  const targetOffsetX = hasToBlocker
    ? targetPositionX! - position.toSpriteX
    : undefined;
  const targetOffsetY = hasToBlocker
    ? targetPositionY! - position.toSpriteY
    : undefined;
  const fromOffsetX = hasFromBlocker
    ? fromPositionX! - position.fromSpriteX
    : targetOffsetX!;
  const fromOffsetY = hasFromBlocker
    ? fromPositionY! - position.fromSpriteY
    : targetOffsetY!;
  const toOffsetX = targetOffsetX ?? fromOffsetX;
  const toOffsetY = targetOffsetY ?? fromOffsetY;
  const currentXpx = position.spriteX + fromOffsetX + ((toOffsetX - fromOffsetX) * easedProgress);
  const currentYpx = position.spriteY + fromOffsetY + ((toOffsetY - fromOffsetY) * easedProgress);

  return {
    ...lighting,
    spatialFootprint: { ...footprint, xPx: currentXpx, yPx: currentYpx },
    lightOcclusion: hasFromBlocker ? fromOcclusion : toOcclusion
  };
}

export function projectLightingMovement(
  scene: GameRenderSceneSnapshot,
  tweens: ReadonlyMap<string, LightingMovementTween>
): GameRenderSceneSnapshot {
  if (tweens.size === 0) {
    return scene;
  }

  let objectsById: GameRenderSceneSnapshot["objectsById"] | undefined;
  for (const [objectId, tween] of tweens) {
    const object = scene.objectsById[objectId];
    if (!object?.lighting) {
      continue;
    }
    const sampled = sampleTween(tween);
    objectsById ??= { ...scene.objectsById };
    objectsById[objectId] = { ...object, lighting: sampled.lighting };
  }

  return objectsById ? { ...scene, objectsById } : scene;
}
