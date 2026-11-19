import type { MovementTweenSegment } from "./legByLegPathBuilder";

export function getOrCreateTimelineOrigin(
  originsByCoordinationId: Map<string, number>,
  coordinationId: string,
  nowMs: number
): number {
  const key = coordinationId.trim().toLowerCase();
  const existing = originsByCoordinationId.get(key);
  if (existing !== undefined) return existing;
  originsByCoordinationId.set(key, nowMs);
  return nowMs;
}

export function resolveTimelineSegment(
  segments: MovementTweenSegment[],
  timelineOriginMs: number,
  nowMs: number
): { segmentIndex: number; elapsedInSegmentMs: number } | null {
  if (segments.length === 0) return null;
  const elapsedOnTimeline = nowMs - timelineOriginMs;
  let segmentIndex = segments.findIndex((segment) =>
    elapsedOnTimeline < (segment.startOffsetMs ?? 0) + segment.durationMs);
  if (segmentIndex < 0) segmentIndex = segments.length - 1;
  const segment = segments[segmentIndex]!;
  return {
    segmentIndex,
    elapsedInSegmentMs: Math.max(0, elapsedOnTimeline - (segment.startOffsetMs ?? 0))
  };
}
