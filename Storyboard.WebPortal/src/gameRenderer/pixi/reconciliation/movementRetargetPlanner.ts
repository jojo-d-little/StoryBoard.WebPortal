export interface ExistingMovementTweenTarget {
  toX: number;
  toY: number;
  durationMs: number;
}

export interface PlanMovementRetargetInput {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  durationMs: number;
  previousAuthoritativeX?: number;
  previousAuthoritativeY?: number;
  existingTween?: ExistingMovementTweenTarget;
}

export type MovementRetargetPlan =
  | { kind: "snap"; x: number; y: number }
  | { kind: "noop" }
  | { kind: "tween"; fromX: number; fromY: number; toX: number; toY: number; durationMs: number };

export function planMovementRetarget(input: PlanMovementRetargetInput): MovementRetargetPlan {
  const hasPositionDelta = input.currentX !== input.targetX || input.currentY !== input.targetY;
  const durationMs = Math.max(0, Math.round(input.durationMs));

  if (!hasPositionDelta || durationMs <= 0) {
    return {
      kind: "snap",
      x: input.targetX,
      y: input.targetY
    };
  }

  if (input.existingTween
    && input.existingTween.toX === input.targetX
    && input.existingTween.toY === input.targetY
    && input.existingTween.durationMs === durationMs) {
    return { kind: "noop" };
  }

  const hasPreviousAuthoritative = input.previousAuthoritativeX !== undefined
    && input.previousAuthoritativeY !== undefined;
  const startedFromPriorSnapshot = hasPreviousAuthoritative
    && (input.previousAuthoritativeX !== input.targetX || input.previousAuthoritativeY !== input.targetY);

  return {
    kind: "tween",
    fromX: startedFromPriorSnapshot ? input.currentX : input.targetX,
    fromY: startedFromPriorSnapshot ? input.currentY : input.targetY,
    toX: input.targetX,
    toY: input.targetY,
    durationMs
  };
}
