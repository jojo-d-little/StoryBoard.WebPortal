import { describe, expect, it } from "vitest";
import type { HostSessionDataEnvelope } from "../../hostApi/HostContracts";
import { mapHostPresentationToSceneSnapshot, mapHostSessionDataToSceneSnapshot } from "./mapHostSessionScene";

function buildSessionData(overrides: Partial<HostSessionDataEnvelope> = {}): HostSessionDataEnvelope {
  const normalizedOrderedTextSteps = overrides.orderedTextPresentationSteps ?? [];

  return {
    sessionDeltaWatermark: "1",
    roomObjectChanges: [],
    soundCues: [],
    outputLines: [],
    diagnostics: [],
    orderedTextPresentationSteps: normalizedOrderedTextSteps,
    hasRoomChange: true,
    hasPhaseChange: false,
    roomChange: {
      travelDirection: "East",
      presentationCues: [
        {
          cueType: "roomTransition",
          category: "RoomTransition",
          effectKey: "room.transition.authored.east",
          movementDurationMs: 0,
          movementFrames: 0
        }
      ],
      newRoom: {
        roomId: "room-1",
        name: "Atrium",
        roomDisplayMode: 1,
        renderableRoomObjects: [
          {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 120,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          }
        ],
        directionalRenderableImages: [
          {
            slot: "Down",
            renderableImage: {
              imagePath: "assets/images/floor.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 0,
              y: 0,
              rotationDegrees: 0,
              scale: 1
            }
          },
          {
            slot: "NorthEast",
            renderableImage: {
              imagePath: "assets/images/corner.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: -20,
              y: 15,
              rotationDegrees: 90,
              scale: 1
            }
          }
        ]
      }
    },
    authoredRenderWidth: 800,
    authoredRenderHeight: 600,
    ...overrides
  };
}

describe("mapHostSessionDataToSceneSnapshot", () => {
  it("maps directional overlay room payload into a renderer snapshot", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());
    expect(snapshot).not.toBeNull();
    expect(snapshot?.roomId).toBe("room-1");
    expect(snapshot?.displayMode).toBe("composed");
    expect(snapshot?.bounds.width).toBe(800);
    expect(snapshot?.bounds.height).toBe(600);
    expect(snapshot?.directionalOverlays).toHaveLength(2);
    expect(snapshot?.roomObjects).toHaveLength(1);
    expect(snapshot?.roomTransition?.travelDirection).toBe("East");
    expect(snapshot?.roomTransition?.cueEffectKey).toBe("room.transition.authored.east");
    expect(snapshot?.roomObjects[0]).toMatchObject({
      objectId: "obj-1",
      objectName: "Lantern",
      x: 120,
      y: 80,
      zOrder: 1002
    });
    expect(snapshot?.directionalOverlays[1]).toMatchObject({
      slot: "NorthEast",
      offsetX: -20,
      offsetY: 15,
      rotationDegrees: 90
    });
  });

  it("maps room transition effect from roomTransition presentation cues", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        travelDirection: "East",
        presentationCues: [
          {
            cueType: "roomTransition",
            category: "RoomTransition",
            effectKey: "room.transition.cue",
            movementDurationMs: 0,
            movementFrames: 0
          }
        ],
        newRoom: {
          roomId: "room-1",
          name: "Atrium",
          roomDisplayMode: 1,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    }));

    expect(snapshot?.roomTransition?.cueEffectKey).toBe("room.transition.cue");
  });

  it("prefers room-level bounds over authored defaults when new-room dimensions are present", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      authoredRenderWidth: 800,
      authoredRenderHeight: 600,
      roomChange: {
        travelDirection: "East",
        newRoom: {
          roomId: "room-portrait",
          name: "Portrait Hall",
          roomDisplayMode: 1,
          roomImageCanvasWidth: 600,
          roomImageCanvasHeight: 800,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    }));

    expect(snapshot?.bounds.width).toBe(600);
    expect(snapshot?.bounds.height).toBe(800);
  });

  it("falls back to authored defaults when new-room dimensions are missing or invalid", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      authoredRenderWidth: 1024,
      authoredRenderHeight: 768,
      roomChange: {
        travelDirection: "East",
        newRoom: {
          roomId: "room-invalid-bounds",
          name: "Fallback Room",
          roomDisplayMode: 1,
          roomImageCanvasWidth: 0,
          roomImageCanvasHeight: -1,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    }));

    expect(snapshot?.bounds.width).toBe(1024);
    expect(snapshot?.bounds.height).toBe(768);
  });

  it("refreshes bounds across sequential mixed-aspect room transitions without stale carryover", () => {
    const first = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        travelDirection: "East",
        newRoom: {
          roomId: "room-landscape-a",
          name: "Landscape A",
          roomDisplayMode: 1,
          roomImageCanvasWidth: 800,
          roomImageCanvasHeight: 600,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    }));

    expect(first?.bounds.width).toBe(800);
    expect(first?.bounds.height).toBe(600);

    const second = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        travelDirection: "East",
        newRoom: {
          roomId: "room-portrait-b",
          name: "Portrait B",
          roomDisplayMode: 1,
          roomImageCanvasWidth: 600,
          roomImageCanvasHeight: 800,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    }), first);

    expect(second?.bounds.width).toBe(600);
    expect(second?.bounds.height).toBe(800);

    const third = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        travelDirection: "West",
        newRoom: {
          roomId: "room-landscape-c",
          name: "Landscape C",
          roomDisplayMode: 1,
          roomImageCanvasWidth: 800,
          roomImageCanvasHeight: 600,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    }), second);

    expect(third?.bounds.width).toBe(800);
    expect(third?.bounds.height).toBe(600);
    expect(third?.roomId).toBe("room-landscape-c");
  });

  it("maps move leg telemetry for downstream leg-by-leg renderer playback", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          presentationCues: [],
          moveLegTelemetry: [
            {
              targetObjectId: "obj-1",
              targetObjectName: "Lantern",
              legIndex: 0,
              requestedDirection: "East",
              requestedDistanceInCells: 1,
              appliedDistanceInCells: 1,
              success: true,
              resultCode: "MovedFullDistance",
              fromX: 120,
              fromY: 80,
              toX: 160,
              toY: 80,
              travelVisualizationMode: "LegByLeg"
            },
            {
              targetObjectId: "obj-1",
              targetObjectName: "Lantern",
              legIndex: 1,
              requestedDirection: "South",
              requestedDistanceInCells: 1,
              appliedDistanceInCells: 1,
              success: true,
              resultCode: "MovedFullDistance",
              fromX: 160,
              fromY: 80,
              toX: 160,
              toY: 120,
              travelVisualizationMode: "LegByLeg"
            }
          ]
        }
      ]
    }));

    expect(snapshot?.moveLegTelemetry).toHaveLength(2);
    expect(snapshot?.moveLegTelemetry?.[0]).toMatchObject({
      targetObjectId: "obj-1",
      targetObjectName: "Lantern",
      legIndex: 0,
      toX: 160,
      toY: 80,
      travelVisualizationMode: "LegByLeg"
    });
  });

  it("uses independent-mode slot selection when display mode is independent", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        newRoom: {
          roomId: "room-1",
          name: "Atrium",
          roomDisplayMode: 0,
          renderableRoomObjects: [],
          directionalRenderableImages: [
            {
              slot: "South",
              renderableImage: {
                imagePath: "assets/images/south.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 2,
                y: 3,
                rotationDegrees: 0,
                scale: 1
              }
            },
            {
              slot: "Default",
              renderableImage: {
                imagePath: "assets/images/default.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 0,
                y: 0,
                rotationDegrees: 0,
                scale: 1
              }
            }
          ]
        }
      }
    }));

    expect(snapshot?.displayMode).toBe("independent");
    expect(snapshot?.directionalOverlays).toHaveLength(1);
    expect(snapshot?.directionalOverlays[0].slot).toBe("Default");
    expect(snapshot?.roomObjects).toHaveLength(0);
  });

  it("uses composed directional overlay behavior when display mode is Overlay string", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        newRoom: {
          roomId: "room-1",
          name: "Atrium",
          roomDisplayMode: "Overlay",
          renderableRoomObjects: [],
          directionalRenderableImages: [
            {
              slot: "Down",
              renderableImage: {
                imagePath: "assets/images/down.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 0,
                y: 0,
                rotationDegrees: 0,
                scale: 1
              }
            },
            {
              slot: "North",
              renderableImage: {
                imagePath: "assets/images/north.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 0,
                y: 0,
                rotationDegrees: 0,
                scale: 1
              }
            }
          ]
        }
      }
    }));

    expect(snapshot?.displayMode).toBe("composed");
    expect(snapshot?.directionalOverlays).toHaveLength(2);
  });

  it("returns null when room change payload is absent", () => {
    const snapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: undefined,
      hasRoomChange: false
    }));

    expect(snapshot).toBeNull();
  });

  it("maps baseline-shaped presentation payload for initial room hydration", () => {
    const snapshot = mapHostPresentationToSceneSnapshot({
      roomChange: {
        newRoom: {
          roomId: "room-2",
          name: "Start Room",
          roomDisplayMode: 1,
          roomImageCanvasWidth: 600,
          roomImageCanvasHeight: 800,
          renderableRoomObjects: [
            {
              objectId: "obj-2",
              name: "Backpack",
              renderableImage: {
                imagePath: "assets/images/backpack.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 490,
                y: 361,
                rotationDegrees: 0,
                scale: 0.57
              },
              renderZOrder: 1003
            }
          ],
          directionalRenderableImages: [
            {
              slot: "Down",
              renderableImage: {
                imagePath: "assets/images/floor-start.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 0,
                y: 0,
                rotationDegrees: 0,
                scale: 1
              }
            }
          ]
        }
      },
      authoredRenderWidth: 1024,
      authoredRenderHeight: 768
    });

    expect(snapshot?.roomId).toBe("room-2");
    expect(snapshot?.bounds.width).toBe(600);
    expect(snapshot?.bounds.height).toBe(800);
    expect(snapshot?.directionalOverlays).toHaveLength(1);
    expect(snapshot?.roomObjects).toHaveLength(1);
  });

  it("applies room-object delta changes when no room-change payload is present", () => {
    const previousSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());
    expect(previousSnapshot).not.toBeNull();

    const deltaOnly = buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 144,
              y: 96,
              rotationDegrees: 15,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "movement",
              category: "Movement",
              effectKey: "walk",
              moveDirection: "East",
              movementDurationMs: 640,
              movementFrames: 16
            }
          ]
        },
        {
          changeKind: "Added",
          objectId: "obj-2",
          objectName: "Key",
          renderableRoomObject: {
            objectId: "obj-2",
            name: "Key",
            renderableImage: {
              imagePath: "assets/images/key.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 200,
              y: 240,
              rotationDegrees: 0,
              scale: 0.4
            },
            renderZOrder: 1004
          },
          presentationCues: []
        }
      ]
    });

    const merged = mapHostSessionDataToSceneSnapshot(deltaOnly, previousSnapshot);
    expect(merged).not.toBeNull();
    expect(merged?.roomObjects).toHaveLength(2);
    expect(merged?.roomObjects.find((entry) => entry.objectId === "obj-1")?.x).toBe(144);
    expect(merged?.roomObjects.find((entry) => entry.objectId === "obj-1")?.presentationCues).toHaveLength(1);
    expect(merged?.roomObjects.find((entry) => entry.objectId === "obj-1")?.movementDurationMs).toBe(640);
    expect(merged?.roomObjects.find((entry) => entry.objectId === "obj-1")?.movementFrames).toBe(16);

    const removed = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Removed",
          objectId: "obj-1",
          objectName: "Lantern",
          presentationCues: []
        }
      ]
    }), merged);

    expect(removed?.roomObjects).toHaveLength(1);
    expect(removed?.roomObjects[0].objectId).toBe("obj-2");
  });

  it("keeps room metadata and directional overlays stable during delta-only movement updates", () => {
    const previousSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());
    expect(previousSnapshot).not.toBeNull();

    const moved = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 320,
              y: 220,
              rotationDegrees: 45,
              scale: 0.9
            },
            renderZOrder: 1002
          },
          presentationCues: []
        }
      ]
    }), previousSnapshot);

    expect(moved).not.toBeNull();
    expect(moved?.roomId).toBe(previousSnapshot?.roomId);
    expect(moved?.roomLabel).toBe(previousSnapshot?.roomLabel);
    expect(moved?.directionalOverlays).toEqual(previousSnapshot?.directionalOverlays);
    expect(moved?.roomObjects).toHaveLength(1);
    expect(moved?.roomObjects[0]).toMatchObject({
      objectId: "obj-1",
      x: 320,
      y: 220,
      rotationDegrees: 45,
      scale: 0.9
    });
  });

  it("sorts room objects deterministically by z-order then object id after delta merges", () => {
    const previousSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomChange: {
        newRoom: {
          roomId: "room-1",
          name: "Atrium",
          roomDisplayMode: 1,
          renderableRoomObjects: [
            {
              objectId: "z-2",
              name: "Second",
              renderableImage: {
                imagePath: "assets/images/second.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 100,
                y: 100,
                rotationDegrees: 0,
                scale: 1
              },
              renderZOrder: 1005
            },
            {
              objectId: "z-1",
              name: "First",
              renderableImage: {
                imagePath: "assets/images/first.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 80,
                y: 80,
                rotationDegrees: 0,
                scale: 1
              },
              renderZOrder: 1005
            }
          ],
          directionalRenderableImages: [
            {
              slot: "Down",
              renderableImage: {
                imagePath: "assets/images/floor.png",
                anchorX: 0,
                anchorY: 0,
                iconOffsetX: 0,
                iconOffsetY: 0,
                x: 0,
                y: 0,
                rotationDegrees: 0,
                scale: 1
              }
            }
          ]
        }
      }
    }));

    const merged = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Added",
          objectId: "a-0",
          objectName: "Lowest",
          renderableRoomObject: {
            objectId: "a-0",
            name: "Lowest",
            renderableImage: {
              imagePath: "assets/images/lowest.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 10,
              y: 10,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1001
          },
          presentationCues: []
        }
      ]
    }), previousSnapshot);

    expect(merged).not.toBeNull();
    expect(merged?.roomObjects.map((entry) => entry.objectId)).toEqual(["a-0", "z-1", "z-2"]);
  });

  it("prefers movement cue timing with non-zero duration when multiple movement cues are present", () => {
    const previousSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());
    expect(previousSnapshot).not.toBeNull();

    const moved = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 160,
              y: 120,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "movement",
              category: "Movement",
              effectKey: "movement.speed.quantum",
              moveDirection: "East",
              movementDurationMs: 0,
              movementFrames: 0
            },
            {
              cueType: "movement",
              category: "Movement",
              effectKey: "movement.speed.slow",
              moveDirection: "East",
              movementDurationMs: 640,
              movementFrames: 16
            }
          ]
        }
      ]
    }), previousSnapshot);

    const movedObject = moved?.roomObjects.find((entry) => entry.objectId === "obj-1");
    expect(movedObject?.movementDurationMs).toBe(640);
    expect(movedObject?.movementFrames).toBe(16);
  });

  it("uses only movement cues from the latest update when appearance cues are omitted", () => {
    const baselineSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());

    const previousSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 120,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "appearance",
              category: "Appearance",
              effectKey: "appearance.selection.silhouette.default"
            }
          ]
        }
      ]
    }), baselineSnapshot);

    const moved = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 180,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "movement",
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 600,
              movementFrames: 15
            }
          ]
        }
      ]
    }), previousSnapshot);

    const movedObject = moved?.roomObjects.find((entry) => entry.objectId === "obj-1");
    expect(movedObject?.presentationCues.some((cue) => cue.category.toLowerCase() === "appearance")).toBe(false);
    expect(movedObject?.presentationCues.some((cue) => cue.category.toLowerCase() === "movement")).toBe(true);
  });

  it("uses only movement cues from the latest update when room-change payload accompanies movement", () => {
    const baselineSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());

    const selectedSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 120,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "appearance",
              category: "Appearance",
              effectKey: "appearance.selection.silhouette.default"
            }
          ]
        }
      ]
    }), baselineSnapshot);

    const movedWithRoomChange = mapHostSessionDataToSceneSnapshot(buildSessionData({
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 220,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "movement",
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 600,
              movementFrames: 15
            }
          ]
        }
      ]
    }), selectedSnapshot);

    const movedObject = movedWithRoomChange?.roomObjects.find((entry) => entry.objectId === "obj-1");
    expect(movedObject?.presentationCues.some((cue) => cue.category.toLowerCase() === "appearance")).toBe(false);
    expect(movedObject?.presentationCues.some((cue) => cue.category.toLowerCase() === "movement")).toBe(true);
  });

  it("clears existing appearance cues when host sends an explicit empty cue list", () => {
    const baselineSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData());

    const selectedSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 120,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: [
            {
              cueType: "appearance",
              category: "Appearance",
              effectKey: "appearance.selection.silhouette.default"
            }
          ]
        }
      ]
    }), baselineSnapshot);

    const clearedSnapshot = mapHostSessionDataToSceneSnapshot(buildSessionData({
      hasRoomChange: false,
      roomChange: undefined,
      roomObjectChanges: [
        {
          changeKind: "Updated",
          objectId: "obj-1",
          objectName: "Lantern",
          renderableRoomObject: {
            objectId: "obj-1",
            name: "Lantern",
            renderableImage: {
              imagePath: "assets/images/lantern.png",
              anchorX: 0,
              anchorY: 0,
              iconOffsetX: 0,
              iconOffsetY: 0,
              x: 120,
              y: 80,
              rotationDegrees: 0,
              scale: 1
            },
            renderZOrder: 1002
          },
          presentationCues: []
        }
      ]
    }), selectedSnapshot);

    const clearedObject = clearedSnapshot?.roomObjects.find((entry) => entry.objectId === "obj-1");
    expect(clearedObject?.presentationCues).toHaveLength(0);
  });
});
