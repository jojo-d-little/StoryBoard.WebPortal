import type { GameRenderMoveLegTelemetry, GameRenderMovementSegment } from "../../contracts/sceneTypes";

export interface BuildLegByLegSegmentsInput {
  objectId: string;
  objectName: string;
  moveLegTelemetry?: GameRenderMoveLegTelemetry[];
  currentX: number;
  currentY: number;
  fallbackTargetX: number;
  fallbackTargetY: number;
  movementDurationMs: number;
  roomId?: string;
  completedMovementSegmentIds?: ReadonlySet<string>;
}

export interface MovementTweenSegment {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  durationMs: number;
  startOffsetMs?: number;
  coordinationId?: string;
  segmentIndex?: number;
  kind?: GameRenderMovementSegment["kind"];
  isIncomingRoomTransfer?: boolean;
  sourceRoomId?: string;
  destinationRoomId?: string;
  rotationDeltaDegrees?: number;
  fromRotationDegrees?: number;
  toRotationDegrees?: number;
  fromScale?: number;
  toScale?: number;
  fromAdditionalSituationalScale?: number;
  toAdditionalSituationalScale?: number;
  fromPivotOffsetXPx?: number;
  fromPivotOffsetYPx?: number;
  toPivotOffsetXPx?: number;
  toPivotOffsetYPx?: number;
  identityKeys?: string[];
}

const FALLBACK_LEG_SEGMENT_DURATION_MS = 120;

export function buildLegByLegSegments(input: BuildLegByLegSegmentsInput): MovementTweenSegment[] {
  const allLegs = input.moveLegTelemetry ?? [];
  if (allLegs.length === 0) {
    return [];
  }

  const normalizedObjectId = input.objectId.trim().toLowerCase();
  const normalizedObjectName = input.objectName.trim().toLowerCase();
  const hasAcceptedSegmentData = allLegs.some((leg) => leg.movementSegments !== undefined
    && (leg.targetObjectId?.trim().toLowerCase() === normalizedObjectId
      || leg.movementSegments.some((segment) => segment.objectId.trim().toLowerCase() === normalizedObjectId)));
  if (hasAcceptedSegmentData) {
    const seen = new Set<string>();
    const output: MovementTweenSegment[] = [];
    const incomingTransfersByCoordination = new Map<string, GameRenderMovementSegment[]>();
    if (input.roomId) {
      for (const leg of allLegs) {
        for (const segment of leg.movementSegments ?? []) {
          if (segment.objectId.trim().toLowerCase() !== normalizedObjectId
            || segment.kind !== "RoomTransfer"
            || segment.destinationRoomId !== input.roomId) continue;
          const key = segment.coordinationId.trim().toLowerCase();
          const transfers = incomingTransfersByCoordination.get(key) ?? [];
          transfers.push(segment);
          incomingTransfersByCoordination.set(key, transfers);
        }
      }
    }
    // Collapse only within one Host leg record. Distinct records can mark a clarification boundary.
    for (const leg of allLegs) {
      const accepted = (leg.movementSegments ?? [])
        .filter((segment) => {
          if (segment.objectId.trim().toLowerCase() !== normalizedObjectId) return false;
          if (input.roomId && segment.kind === "RoomTransfer" && segment.destinationRoomId !== input.roomId) return false;
          if (input.roomId && segment.kind !== "RoomTransfer"
            && (segment.sourceRoomId !== input.roomId || segment.destinationRoomId !== input.roomId)) return false;
          const identity = `${segment.objectId.toLowerCase()}\u0000${segment.coordinationId.toLowerCase()}\u0000${segment.segmentIndex}`;
          if (seen.has(identity) || input.completedMovementSegmentIds?.has(identity)) return false;
          seen.add(identity);
          return true;
        })
        .sort((left, right) => left.startOffsetMs - right.startOffsetMs || left.segmentIndex - right.segmentIndex);
      const mapped = accepted.map((segment) => {
        if (segment.kind === "RoomTransfer" && segment.destinationRoomId === input.roomId) {
          return mapIncomingRoomTransfer(segment);
        }

        const incomingTransfer = (incomingTransfersByCoordination.get(segment.coordinationId.trim().toLowerCase()) ?? [])
          .filter((candidate) => candidate.segmentIndex < segment.segmentIndex
            && candidate.startOffsetMs + candidate.durationMs <= segment.startOffsetMs)
          .sort((left, right) => right.segmentIndex - left.segmentIndex)[0];
        if (incomingTransfer && segment.sourceRoomId === input.roomId && segment.destinationRoomId === input.roomId) {
          const commandOffsetAtArrival = incomingTransfer.startOffsetMs + incomingTransfer.durationMs;
          return mapAcceptedSegment({
            ...segment,
            startOffsetMs: Math.max(0, segment.startOffsetMs - commandOffsetAtArrival)
          });
        }
        return mapAcceptedSegment(segment);
      });
      output.push(...(leg.travelVisualizationMode === "Direct" ? collapseTranslationRuns(mapped) : mapped));
    }
    return output;
  }

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

function collapseTranslationRuns(segments: MovementTweenSegment[]): MovementTweenSegment[] {
  const output: MovementTweenSegment[] = [];
  for (let index = 0; index < segments.length;) {
    const first = segments[index];
    if (first.kind !== "Translation") {
      output.push(first);
      index += 1;
      continue;
    }

    let last = first;
    let next = index + 1;
    while (next < segments.length && first.sourceRoomId === first.destinationRoomId) {
      const candidate = segments[next];
      const previousEnd = Number(last.startOffsetMs ?? 0) + last.durationMs;
      if (candidate.kind !== "Translation"
        || candidate.coordinationId !== first.coordinationId
        || candidate.sourceRoomId !== first.sourceRoomId
        || candidate.destinationRoomId !== first.destinationRoomId
        || candidate.sourceRoomId !== candidate.destinationRoomId
        || Math.abs(Number(candidate.startOffsetMs ?? 0) - previousEnd) > 0.001) break;
      last = candidate;
      next += 1;
    }

    if (last === first) {
      output.push(first);
    } else {
      output.push({
        ...first,
        toX: last.toX,
        toY: last.toY,
        durationMs: Number(last.startOffsetMs ?? 0) + last.durationMs - Number(first.startOffsetMs ?? 0),
        toRotationDegrees: last.toRotationDegrees,
        toScale: last.toScale,
        toAdditionalSituationalScale: last.toAdditionalSituationalScale,
        toPivotOffsetXPx: last.toPivotOffsetXPx,
        toPivotOffsetYPx: last.toPivotOffsetYPx,
        identityKeys: segments.slice(index, next).flatMap((segment) => segment.identityKeys ?? [])
      });
    }
    index = next;
  }
  return output;
}

function mapIncomingRoomTransfer(segment: GameRenderMovementSegment): MovementTweenSegment {
  // The incoming room has its own coordinate space. Present the accepted destination
  // image at both ends of this zero-time marker so no source-room coordinate is drawn.
  const destinationImage = segment.toRenderableImage;
  return {
    ...mapAcceptedSegment({ ...segment, fromRenderableImage: destinationImage, startOffsetMs: 0 }),
    isIncomingRoomTransfer: true
  };
}

function mapAcceptedSegment(segment: GameRenderMovementSegment): MovementTweenSegment {
  const from = segment.fromRenderableImage;
  const to = segment.toRenderableImage;
  return {
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    durationMs: segment.kind === "RoomTransfer" ? 0 : Math.max(0, segment.durationMs),
    startOffsetMs: Math.max(0, segment.startOffsetMs),
    coordinationId: segment.coordinationId,
    segmentIndex: segment.segmentIndex,
    kind: segment.kind,
    identityKeys: [`${segment.objectId.toLowerCase()}\u0000${segment.coordinationId.toLowerCase()}\u0000${segment.segmentIndex}`],
    sourceRoomId: segment.sourceRoomId,
    destinationRoomId: segment.destinationRoomId,
    rotationDeltaDegrees: segment.rotationDeltaDegrees,
    fromRotationDegrees: from.rotationDegrees,
    toRotationDegrees: to.rotationDegrees,
    fromScale: from.scale,
    toScale: to.scale,
    fromAdditionalSituationalScale: from.additionalSituationalScale,
    toAdditionalSituationalScale: to.additionalSituationalScale,
    fromPivotOffsetXPx: Number.isFinite(from.situationalScalePivotOffsetXPx) && Number.isFinite(from.situationalScalePivotOffsetYPx)
      ? from.anchorX + from.situationalScalePivotOffsetXPx! - from.x : undefined,
    fromPivotOffsetYPx: Number.isFinite(from.situationalScalePivotOffsetXPx) && Number.isFinite(from.situationalScalePivotOffsetYPx)
      ? from.anchorY + from.situationalScalePivotOffsetYPx! - from.y : undefined,
    toPivotOffsetXPx: Number.isFinite(to.situationalScalePivotOffsetXPx) && Number.isFinite(to.situationalScalePivotOffsetYPx)
      ? to.anchorX + to.situationalScalePivotOffsetXPx! - to.x : undefined,
    toPivotOffsetYPx: Number.isFinite(to.situationalScalePivotOffsetXPx) && Number.isFinite(to.situationalScalePivotOffsetYPx)
      ? to.anchorY + to.situationalScalePivotOffsetYPx! - to.y : undefined
  };
}
