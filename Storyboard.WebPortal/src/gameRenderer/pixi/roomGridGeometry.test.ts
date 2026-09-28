import { describe, expect, it } from "vitest";
import { buildRoomGridLines } from "./roomGridGeometry";

describe("buildRoomGridLines", () => {
  it("draws cell lines in room coordinates and includes partial room boundaries", () => {
    expect(buildRoomGridLines(100, 80, 40)).toEqual([
      { fromX: 0, fromY: 0, toX: 0, toY: 80 },
      { fromX: 40, fromY: 0, toX: 40, toY: 80 },
      { fromX: 80, fromY: 0, toX: 80, toY: 80 },
      { fromX: 100, fromY: 0, toX: 100, toY: 80 },
      { fromX: 0, fromY: 0, toX: 100, toY: 0 },
      { fromX: 0, fromY: 40, toX: 100, toY: 40 },
      { fromX: 0, fromY: 80, toX: 100, toY: 80 }
    ]);
  });

  it("rejects invalid geometry and excessive line counts", () => {
    expect(buildRoomGridLines(100, 80, 0)).toBeNull();
    expect(buildRoomGridLines(1_000_000, 1_000_000, 1)).toBeNull();
  });
});
