import { describe, expect, it } from "vitest";
import { getOrCreateTimelineOrigin, resolveTimelineSegment } from "./coordinatedMovementTimeline";
import type { MovementTweenSegment } from "./legByLegPathBuilder";

describe("coordinated movement timeline", () => {
  it("shares one origin when paired objects arrive at different times", () => {
    const origins = new Map<string, number>();
    const playerOrigin = getOrCreateTimelineOrigin(origins, "coord-1", 1_000);
    const delayedTrunkOrigin = getOrCreateTimelineOrigin(origins, "COORD-1", 1_175);
    const segments: MovementTweenSegment[] = [
      { fromX: 10, fromY: 20, toX: 10, toY: 20, startOffsetMs: 100, durationMs: 200 },
      { fromX: 10, fromY: 20, toX: 50, toY: 20, startOffsetMs: 300, durationMs: 400 }
    ];

    expect(playerOrigin).toBe(1_000);
    expect(delayedTrunkOrigin).toBe(playerOrigin);
    expect(resolveTimelineSegment(segments, delayedTrunkOrigin, 1_375)).toEqual({ segmentIndex: 1, elapsedInSegmentMs: 75 });
  });

  it("holds before delayed offsets and resolves to the final accepted segment after completion", () => {
    const segments: MovementTweenSegment[] = [
      { fromX: 0, fromY: 0, toX: 0, toY: 0, startOffsetMs: 200, durationMs: 100 },
      { fromX: 0, fromY: 0, toX: 10, toY: 0, startOffsetMs: 300, durationMs: 100 }
    ];

    expect(resolveTimelineSegment(segments, 500, 600)).toEqual({ segmentIndex: 0, elapsedInSegmentMs: 0 });
    expect(resolveTimelineSegment(segments, 500, 950)).toEqual({ segmentIndex: 1, elapsedInSegmentMs: 150 });
  });
});
