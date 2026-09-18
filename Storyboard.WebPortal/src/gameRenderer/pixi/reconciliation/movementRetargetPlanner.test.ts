import { describe, expect, it } from "vitest";
import { planMovementRetarget } from "./movementRetargetPlanner";

describe("planMovementRetarget", () => {
  it("retargets mid-flight from current rendered position", () => {
    const plan = planMovementRetarget({
      currentX: 118,
      currentY: 80,
      targetX: 220,
      targetY: 80,
      durationMs: 1200,
      previousAuthoritativeX: 100,
      previousAuthoritativeY: 80,
      existingTween: {
        toX: 160,
        toY: 80,
        durationMs: 1200
      }
    });

    expect(plan).toEqual({
      kind: "tween",
      fromX: 118,
      fromY: 80,
      toX: 220,
      toY: 80,
      durationMs: 1200
    });
  });

  it("returns noop when an equivalent tween is already active", () => {
    const plan = planMovementRetarget({
      currentX: 130,
      currentY: 80,
      targetX: 220,
      targetY: 80,
      durationMs: 1200,
      previousAuthoritativeX: 100,
      previousAuthoritativeY: 80,
      existingTween: {
        toX: 220,
        toY: 80,
        durationMs: 1200
      }
    });

    expect(plan).toEqual({ kind: "noop" });
  });

  it("snaps when duration is zero", () => {
    const plan = planMovementRetarget({
      currentX: 130,
      currentY: 80,
      targetX: 220,
      targetY: 80,
      durationMs: 0,
      previousAuthoritativeX: 100,
      previousAuthoritativeY: 80
    });

    expect(plan).toEqual({ kind: "snap", x: 220, y: 80 });
  });

  it("snaps when already at target", () => {
    const plan = planMovementRetarget({
      currentX: 220,
      currentY: 80,
      targetX: 220,
      targetY: 80,
      durationMs: 1200,
      previousAuthoritativeX: 200,
      previousAuthoritativeY: 80
    });

    expect(plan).toEqual({ kind: "snap", x: 220, y: 80 });
  });
});
