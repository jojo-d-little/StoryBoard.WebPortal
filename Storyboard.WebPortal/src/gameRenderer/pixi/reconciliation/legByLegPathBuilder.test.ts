import { describe, expect, it } from "vitest";
import type { GameRenderMoveLegTelemetry } from "../../contracts/sceneTypes";
import { buildLegByLegSegments } from "./legByLegPathBuilder";

describe("buildLegByLegSegments", () => {
  it("builds two sequential segments from anchor-space telemetry using sprite-space deltas", () => {
    const telemetry: GameRenderMoveLegTelemetry[] = [
      {
        targetObjectId: "ff115f6b-5f58-417b-904a-e2ece7a06bd3",
        targetObjectName: "BlackKnight",
        legIndex: 0,
        requestedDirection: "N",
        requestedDistanceInCells: 2,
        appliedDistanceInCells: 2,
        success: true,
        resultCode: "MovedFullDistance",
        fromX: 640,
        fromY: 512,
        toX: 640,
        toY: 384,
        travelVisualizationMode: "LegByLeg"
      },
      {
        targetObjectId: "ff115f6b-5f58-417b-904a-e2ece7a06bd3",
        targetObjectName: "BlackKnight",
        legIndex: 1,
        requestedDirection: "W",
        requestedDistanceInCells: 1,
        appliedDistanceInCells: 1,
        success: true,
        resultCode: "MovedFullDistance",
        fromX: 640,
        fromY: 384,
        toX: 576,
        toY: 384,
        travelVisualizationMode: "LegByLeg"
      }
    ];

    const segments = buildLegByLegSegments({
      objectId: "ff115f6b-5f58-417b-904a-e2ece7a06bd3",
      objectName: "BlackKnight",
      moveLegTelemetry: telemetry,
      currentX: 651,
      currentY: 507,
      fallbackTargetX: 587,
      fallbackTargetY: 379,
      movementDurationMs: 4500
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      fromX: 651,
      fromY: 507,
      toX: 651,
      toY: 379
    });
    expect(segments[1]).toMatchObject({
      fromX: 651,
      fromY: 379,
      toX: 587,
      toY: 379
    });
    expect(segments[0].durationMs).toBe(3000);
    expect(segments[1].durationMs).toBe(1500);
  });

  it("returns no segments when travel visualization mode is direct", () => {
    const telemetry: GameRenderMoveLegTelemetry[] = [
      {
        targetObjectId: "runner",
        targetObjectName: "Runner",
        legIndex: 0,
        requestedDirection: "E",
        requestedDistanceInCells: 1,
        appliedDistanceInCells: 1,
        success: true,
        resultCode: "MovedFullDistance",
        fromX: 100,
        fromY: 100,
        toX: 140,
        toY: 100,
        travelVisualizationMode: "Direct"
      },
      {
        targetObjectId: "runner",
        targetObjectName: "Runner",
        legIndex: 1,
        requestedDirection: "E",
        requestedDistanceInCells: 1,
        appliedDistanceInCells: 1,
        success: true,
        resultCode: "MovedFullDistance",
        fromX: 140,
        fromY: 100,
        toX: 180,
        toY: 100,
        travelVisualizationMode: "Direct"
      }
    ];

    const segments = buildLegByLegSegments({
      objectId: "runner",
      objectName: "Runner",
      moveLegTelemetry: telemetry,
      currentX: 100,
      currentY: 100,
      fallbackTargetX: 180,
      fallbackTargetY: 100,
      movementDurationMs: 900
    });

    expect(segments).toHaveLength(0);
  });

  it("stops path construction at first failed leg and animates only successful prefix", () => {
    const telemetry: GameRenderMoveLegTelemetry[] = [
      {
        targetObjectId: "runner",
        targetObjectName: "Runner",
        legIndex: 0,
        requestedDirection: "N",
        requestedDistanceInCells: 2,
        appliedDistanceInCells: 2,
        success: true,
        resultCode: "MovedFullDistance",
        fromX: 640,
        fromY: 512,
        toX: 640,
        toY: 384,
        travelVisualizationMode: "LegByLeg"
      },
      {
        targetObjectId: "runner",
        targetObjectName: "Runner",
        legIndex: 1,
        requestedDirection: "W",
        requestedDistanceInCells: 1,
        appliedDistanceInCells: 0,
        success: false,
        resultCode: "BlockedByCollision",
        fromX: 640,
        fromY: 384,
        toX: 576,
        toY: 384,
        travelVisualizationMode: "LegByLeg"
      }
    ];

    const segments = buildLegByLegSegments({
      objectId: "runner",
      objectName: "Runner",
      moveLegTelemetry: telemetry,
      currentX: 651,
      currentY: 507,
      fallbackTargetX: 651,
      fallbackTargetY: 379,
      movementDurationMs: 2400
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      fromX: 651,
      fromY: 507,
      toX: 651,
      toY: 379,
      durationMs: 2400
    });
  });
});
