import type { GameRenderMoveLegTelemetry } from "../../contracts/sceneTypes";

export interface BuildLegByLegSegmentsInput {
  objectId: string;
  objectName: string;
  moveLegTelemetry?: GameRenderMoveLegTelemetry[];
  currentX: number;
  currentY: number;
  fallbackTargetX: number;
  fallbackTargetY: number;
  movementDurationMs: number;
}

export interface MovementTweenSegment {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  durationMs: number;
}

const FALLBACK_LEG_SEGMENT_DURATION_MS = 120;

export function buildLegByLegSegments(input: BuildLegByLegSegmentsInput): MovementTweenSegment[] {
  const allLegs = input.moveLegTelemetry ?? [];
  if (allLegs.length === 0) {
    return [];
  }

  const normalizedObjectId = input.objectId.trim().toLowerCase();
  const normalizedObjectName = input.objectName.trim().toLowerCase();

  const relevantLegs = allLegs
    .filter((leg) => {
      const targetObjectId = leg.targetObjectId?.trim().toLowerCase() ?? "";
      if (targetObjectId.length > 0 && normalizedObjectId.length > 0) {
        return targetObjectId === normalizedObjectId;
      }

      const targetObjectName = leg.targetObjectName.trim().toLowerCase();
      return targetObjectName.length > 0
        && normalizedObjectName.length > 0
        && targetObjectName === normalizedObjectName;
    })
    .sort((leftLeg, rightLeg) => leftLeg.legIndex - rightLeg.legIndex);

  if (relevantLegs.length <= 1) {
    return [];
  }

  if (relevantLegs[0].travelVisualizationMode === "Direct") {
    return [];
  }

  const points: Array<{ x: number; y: number }> = [{ x: input.currentX, y: input.currentY }];
  let cursorX = input.currentX;
  let cursorY = input.currentY;
  for (const leg of relevantLegs) {
    if (!leg.success) {
      break;
    }

    if (!Number.isFinite(leg.toX) || !Number.isFinite(leg.toY)) {
      continue;
    }

    const hasFrom = Number.isFinite(leg.fromX) && Number.isFinite(leg.fromY);
    if (hasFrom) {
      const deltaX = Number(leg.toX) - Number(leg.fromX);
      const deltaY = Number(leg.toY) - Number(leg.fromY);
      cursorX += deltaX;
      cursorY += deltaY;
      points.push({ x: cursorX, y: cursorY });
      continue;
    }

    // Fallback when from-coordinates are unavailable: trust absolute endpoint.
    cursorX = Number(leg.toX);
    cursorY = Number(leg.toY);
    points.push({ x: cursorX, y: cursorY });
  }

  if (points.length <= 1) {
    return [];
  }

  const finalPoint = points[points.length - 1];
  if (Math.abs(finalPoint.x - input.fallbackTargetX) > 0.001 || Math.abs(finalPoint.y - input.fallbackTargetY) > 0.001) {
    points.push({ x: input.fallbackTargetX, y: input.fallbackTargetY });
  }

  const travelWeights = relevantLegs
    .filter((leg) => leg.success)
    .map((leg) => {
      const applied = Math.max(0, Math.round(leg.appliedDistanceInCells));
      const requested = Math.max(0, Math.round(leg.requestedDistanceInCells));
      return Math.max(1, applied, requested);
    });

  const totalWeight = travelWeights.reduce((sum, value) => sum + value, 0);
  const normalizedMovementDurationMs = Math.max(0, Math.round(input.movementDurationMs));
  const useFallbackDuration = normalizedMovementDurationMs <= 0;
  const defaultSegmentDuration = points.length > 1
    ? Math.max(1, Math.round((useFallbackDuration
      ? FALLBACK_LEG_SEGMENT_DURATION_MS * (points.length - 1)
      : normalizedMovementDurationMs) / (points.length - 1)))
    : 0;

  const segments: MovementTweenSegment[] = [];
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const from = points[pointIndex - 1];
    const to = points[pointIndex];
    if (Math.abs(from.x - to.x) <= 0.001 && Math.abs(from.y - to.y) <= 0.001) {
      continue;
    }

    const weight = travelWeights[Math.min(pointIndex - 1, Math.max(0, travelWeights.length - 1))] ?? 1;
    const weightedDuration = !useFallbackDuration && totalWeight > 0
      ? Math.max(1, Math.round((normalizedMovementDurationMs * weight) / totalWeight))
      : defaultSegmentDuration;

    segments.push({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      durationMs: weightedDuration
    });
  }

  return segments;
}
