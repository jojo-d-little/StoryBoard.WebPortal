import { describe, expect, it } from "vitest";
import type { GameRenderMoveLegTelemetry } from "../../contracts/sceneTypes";
import { buildLegByLegSegments } from "./legByLegPathBuilder";

describe("buildLegByLegSegments", () => {
  it("uses accepted per-object segments, retains stationary turns, and does not replay legacy leg endpoints", () => {
    const makeImage = (x: number, rotationDegrees: number) => ({
      imagePath: "assets/trunk.png", anchorX: x, anchorY: 80, iconOffsetX: 0, iconOffsetY: 0,
      x, y: 80, rotationDegrees, scale: 1, situationalScalePivotOffsetXPx: 20,
      situationalScalePivotOffsetYPx: 20
    });
    const telemetry: GameRenderMoveLegTelemetry[] = [{
      targetObjectId: "player", targetObjectName: "Player", legIndex: 0,
      requestedDirection: "South", requestedDistanceInCells: 1, appliedDistanceInCells: 1,
      success: true, resultCode: "Success", fromX: 80, fromY: 80, toX: 80, toY: 120,
      travelVisualizationMode: "LegByLeg",
      movementSegments: [
        {
          objectId: "player", coordinationId: "coord", segmentIndex: 0, kind: "Turn",
          sourceRoomId: "room", destinationRoomId: "room", startOffsetMs: 0, durationMs: 160,
          fromRenderableImage: makeImage(80, 0), toRenderableImage: makeImage(80, 90), rotationDeltaDegrees: 90
        },
        {
          objectId: "player", coordinationId: "coord", segmentIndex: 1, kind: "Translation",
          sourceRoomId: "room", destinationRoomId: "room", startOffsetMs: 160, durationMs: 320,
          fromRenderableImage: makeImage(80, 90), toRenderableImage: makeImage(80, 90)
        },
        {
          objectId: "trunk", coordinationId: "coord", segmentIndex: 0, kind: "Translation",
          sourceRoomId: "room", destinationRoomId: "room", startOffsetMs: 0, durationMs: 160,
          fromRenderableImage: makeImage(40, 0), toRenderableImage: makeImage(40, 0)
        }
      ]
    }];

    const playerSegments = buildLegByLegSegments({
      objectId: "player", objectName: "Player", moveLegTelemetry: telemetry,
      currentX: 80, currentY: 80, fallbackTargetX: 80, fallbackTargetY: 120, movementDurationMs: 480
    });
    expect(playerSegments).toHaveLength(2);
    expect(playerSegments[0]).toMatchObject({ kind: "Turn", fromX: 80, toX: 80, durationMs: 160, rotationDeltaDegrees: 90 });
    expect(playerSegments[1]).toMatchObject({ kind: "Translation", startOffsetMs: 160, toY: 80 });

    telemetry[0].movementSegments = [];
    expect(buildLegByLegSegments({
      objectId: "player", objectName: "Player", moveLegTelemetry: telemetry,
      currentX: 80, currentY: 80, fallbackTargetX: 80, fallbackTargetY: 120, movementDurationMs: 480
    })).toEqual([]);
  });

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

  it("keeps Direct turns and collapses only a contiguous translation run within its leg", () => {
    const image = (x: number, rotationDegrees = 0) => ({
      imagePath: "assets/player.png", anchorX: x, anchorY: 80, iconOffsetX: 0, iconOffsetY: 0,
      x, y: 80, rotationDegrees, scale: 1
    });
    const telemetry: GameRenderMoveLegTelemetry[] = [{
      targetObjectId: "player", targetObjectName: "Player", legIndex: 0,
      requestedDirection: "East", requestedDistanceInCells: 2, appliedDistanceInCells: 2,
      success: true, resultCode: "Success", travelVisualizationMode: "Direct",
      movementSegments: [
        { objectId: "player", coordinationId: "c", segmentIndex: 0, kind: "Turn", sourceRoomId: "r1", destinationRoomId: "r1", startOffsetMs: 0, durationMs: 100, fromRenderableImage: image(80, 0), toRenderableImage: image(80, 90), rotationDeltaDegrees: 90 },
        { objectId: "player", coordinationId: "c", segmentIndex: 1, kind: "Translation", sourceRoomId: "r1", destinationRoomId: "r1", startOffsetMs: 100, durationMs: 200, fromRenderableImage: image(80, 90), toRenderableImage: image(120, 90) },
        { objectId: "player", coordinationId: "c", segmentIndex: 2, kind: "Translation", sourceRoomId: "r1", destinationRoomId: "r1", startOffsetMs: 300, durationMs: 200, fromRenderableImage: image(120, 90), toRenderableImage: image(160, 90) },
        { objectId: "player", coordinationId: "c", segmentIndex: 3, kind: "RoomTransfer", sourceRoomId: "r1", destinationRoomId: "r2", startOffsetMs: 500, durationMs: 0, fromRenderableImage: image(160, 90), toRenderableImage: image(40, 90) },
        { objectId: "player", coordinationId: "c", segmentIndex: 4, kind: "Translation", sourceRoomId: "r2", destinationRoomId: "r2", startOffsetMs: 500, durationMs: 100, fromRenderableImage: image(40, 90), toRenderableImage: image(80, 90) }
      ]
    }];
    const result = buildLegByLegSegments({
      objectId: "player", objectName: "Player", moveLegTelemetry: telemetry,
      currentX: 80, currentY: 80, fallbackTargetX: 80, fallbackTargetY: 80, movementDurationMs: 600
    });

    expect(result.map(({ kind, fromX, toX, startOffsetMs, durationMs }) => ({ kind, fromX, toX, startOffsetMs, durationMs }))).toEqual([
      { kind: "Turn", fromX: 80, toX: 80, startOffsetMs: 0, durationMs: 100 },
      { kind: "Translation", fromX: 80, toX: 160, startOffsetMs: 100, durationMs: 400 },
      { kind: "RoomTransfer", fromX: 160, toX: 40, startOffsetMs: 500, durationMs: 0 },
      { kind: "Translation", fromX: 40, toX: 80, startOffsetMs: 500, durationMs: 100 }
    ]);
  });

  it("rebases incoming-room playback at the accepted destination arrival pose", () => {
    const image = (x: number, y: number) => ({
      imagePath: "assets/suitcase.png", anchorX: x, anchorY: y, iconOffsetX: 0, iconOffsetY: 0,
      x, y, rotationDegrees: 0, scale: 1
    });
    const telemetry: GameRenderMoveLegTelemetry[] = [{
      targetObjectId: "suitcase", targetObjectName: "Suitcase", legIndex: 0,
      requestedDirection: "North", requestedDistanceInCells: 20, appliedDistanceInCells: 11,
      success: true, resultCode: "MovedPartialDistance", travelVisualizationMode: "LegByLeg",
      movementSegments: [
        { objectId: "suitcase", coordinationId: "push", segmentIndex: 0, kind: "Translation", sourceRoomId: "r1", destinationRoomId: "r1", startOffsetMs: 0, durationMs: 5000, fromRenderableImage: image(160, 400), toRenderableImage: image(160, 0) },
        { objectId: "suitcase", coordinationId: "push", segmentIndex: 1, kind: "RoomTransfer", sourceRoomId: "r1", destinationRoomId: "r2", startOffsetMs: 5000, durationMs: 1, fromRenderableImage: image(160, 0), toRenderableImage: image(200, 684) },
        { objectId: "suitcase", coordinationId: "push", segmentIndex: 2, kind: "Translation", sourceRoomId: "r2", destinationRoomId: "r2", startOffsetMs: 5001, durationMs: 4500, fromRenderableImage: image(200, 684), toRenderableImage: image(200, 324) }
      ]
    }];

    const result = buildLegByLegSegments({
      objectId: "suitcase", objectName: "Suitcase", moveLegTelemetry: telemetry,
      currentX: 200, currentY: 324, fallbackTargetX: 200, fallbackTargetY: 324,
      movementDurationMs: 4500, roomId: "r2"
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      kind: "RoomTransfer", isIncomingRoomTransfer: true,
      fromX: 200, fromY: 684, toX: 200, toY: 684, startOffsetMs: 0, durationMs: 0
    });
    expect(result[1]).toMatchObject({
      kind: "Translation", fromX: 200, fromY: 684, toX: 200, toY: 324,
      startOffsetMs: 0, durationMs: 4500, sourceRoomId: "r2", destinationRoomId: "r2"
    });
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
