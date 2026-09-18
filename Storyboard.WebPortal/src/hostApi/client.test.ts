/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { HostApiClient } from "./client";

describe("HostApiClient", () => {
  it("maps authenticate response payload and supports PascalCase fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Result: {
          Success: true,
          Code: "Identity.Authenticate.Success",
          DiagnosticsMessages: []
        },
        Principal: {
          Username: "admin"
        },
        CredentialHandle: "cred-123"
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.authenticate("admin", "admin");

    expect(response.result.success).toBe(true);
    expect(response.result.code).toBe("Identity.Authenticate.Success");
    expect(response.principalName).toBe("admin");
    expect(response.credentialHandle).toBe("cred-123");

    vi.unstubAllGlobals();
  });

  it("maps discover-games list and total count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          success: true,
          code: "Discovery.Success",
          diagnosticsMessages: []
        },
        totalAvailableCount: 1,
        games: [
          {
            gameId: "g-1",
            gameKey: "sample.game",
            displayName: "Sample Game",
            description: "desc"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.discoverGames("cred-123", "", 10);

    expect(response.result.success).toBe(true);
    expect(response.totalAvailableCount).toBe(1);
    expect(response.games).toHaveLength(1);
    expect(response.games[0].gameKey).toBe("sample.game");

    vi.unstubAllGlobals();
  });

  it("maps game-details response including preview images", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          success: true,
          code: "GameDetails.Success",
          diagnosticsMessages: []
        },
        game: {
          gameId: "g-1",
          gameKey: "sample.game",
          displayName: "Sample Game",
          summary: "A sample game.",
          access: {
            canView: true,
            canStartSession: true,
            denialCode: "",
            denialMessage: ""
          },
          previewImages: ["Previews/sample.png"]
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.getGameDetails("cred-123", "g-1", "sample.game");

    expect(response.result.success).toBe(true);
    expect(response.game?.gameKey).toBe("sample.game");
    expect(response.game?.previewImages[0]).toBe("Previews/sample.png");

    vi.unstubAllGlobals();
  });

  it("retrieves asset payload as UTF-8 text", async () => {
    const jsonText = "{\"schemaVersion\":\"1.0\",\"effects\":[]}";
    const payloadBytes = btoa(jsonText);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          success: true,
          code: "Asset.Get.Success",
          diagnosticsMessages: []
        },
        contentType: "application/json",
        payloadBytes
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.getAssetText("cred-123", "assets/PresentationCues/presentation-effects.catalog.json", "g-1", "sample.game");

    expect(response).not.toBeNull();
    expect(response?.contentType).toBe("application/json");
    expect(response?.text).toBe(jsonText);

    vi.unstubAllGlobals();
  });

  it("retrieves asset payload as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          success: true,
          code: "Asset.Get.Success",
          diagnosticsMessages: []
        },
        contentType: "application/json",
        payloadBytes: btoa("{\"schemaVersion\":\"1.0\",\"effects\":[{\"effectKey\":\"movement.speed.fast\"}]}")
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.getAssetJson<{ schemaVersion: string; effects: Array<{ effectKey: string }> }>(
      "cred-123",
      "assets/PresentationCues/presentation-effects.catalog.json",
      "g-1",
      "sample.game"
    );

    expect(response?.schemaVersion).toBe("1.0");
    expect(response?.effects[0].effectKey).toBe("movement.speed.fast");

    vi.unstubAllGlobals();
  });

  it("maps start-session and list-sessions lifecycle payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            success: true,
            code: "Session.Start.Success",
            diagnosticsMessages: []
          },
          created: true,
          session: {
            sessionId: "s-1",
            gameId: "g-1",
            gameKey: "sample.game",
            sessionName: "Session One",
            sessionState: "active",
            ownerPrincipalId: "admin",
            joinPolicy: { policy: "ownerOnly" },
            access: { canJoin: true, canLeave: true },
            membership: { isJoined: true, isOwner: true }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            success: true,
            code: "Session.List.Success",
            diagnosticsMessages: []
          },
          totalAvailableCount: 1,
          sessions: [
            {
              sessionId: "s-1",
              gameId: "g-1",
              gameKey: "sample.game",
              sessionName: "Session One",
              sessionState: "active",
              ownerPrincipalId: "admin",
              joinPolicy: { policy: "ownerOnly" },
              access: { canJoin: true, canLeave: true },
              membership: { isJoined: true, isOwner: true }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const started = await client.startSession("cred-1", "g-1", "sample.game", "Session One", "ownerOnly");
    const listed = await client.listSessions("cred-1", { gameId: "g-1", gameKey: "sample.game" });

    expect(started.created).toBe(true);
    expect(started.session?.sessionId).toBe("s-1");
    expect(listed.totalAvailableCount).toBe(1);
    expect(listed.sessions[0].sessionId).toBe("s-1");

    vi.unstubAllGlobals();
  });

  it("maps session delta room-change payload for opening room render", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCode: "Success",
        sessionData: {
          roomChange: {
            travelDirection: "East",
            presentationCues: [
              {
                "$cueType": "roomTransition",
                category: "RoomTransition",
                effectKey: "room.transition.authored.cue",
                movementDurationMs: 0,
                movementFrames: 0
              }
            ],
            newRoom: {
              roomId: "room-1",
              name: "Atrium",
              roomDisplayMode: "Overlay",
              roomImageCanvasWidth: 600,
              roomImageCanvasHeight: 800,
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
                  x: 140,
                  y: 95,
                  rotationDegrees: 15,
                  scale: 1
                },
                renderZOrder: 1002
              },
              presentationCues: [
                {
                  "$cueType": "movement",
                  category: "Movement",
                  effectKey: "walk",
                  moveDirection: "East",
                  movementDurationMs: 640,
                  movementFrames: 16
                }
              ],
              moveLegTelemetry: []
            }
          ],
          soundCues: [],
          outputLines: [],
          diagnostics: [],
          phaseChange: {
            reason: "advance",
            newPhase: {
              phaseId: "phase-3",
              pathDisplayName: "Book A / Chapter 2 / Page 7",
              book: {
                nodeId: "book-a",
                displayName: "Book A",
                title: "Book Title",
                prologue: "",
                narrative: ""
              },
              chapter: {
                nodeId: "chapter-2",
                displayName: "Chapter 2",
                title: "",
                prologue: "",
                narrative: ""
              },
              page: {
                nodeId: "page-7",
                displayName: "Page 7",
                title: "",
                prologue: "",
                narrative: ""
              }
            },
            orderedTextPresentationSteps: [
              {
                where: "HudEdgeCard",
                how: "FadeIn",
                dismissMode: "Auto",
                displayDurationMs: 5000,
                motionInMs: 500,
                motionOutMs: 500,
                bodyText: "A cold wind passes through the room.",
                presentationCueEffectKey: "text.overlay.page"
              }
            ]
          },
          sessionDeltaWatermark: "2"
        },
        sessionDeltaWatermark: "2",
        diagnostics: []
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.getSessionDeltas("cred-1", "session-1", "1", "Medium");

    expect(response.resultCode).toBe("Success");
    expect(response.sessionData?.roomChange?.newRoom?.name).toBe("Atrium");
    expect(response.sessionData?.roomChange?.travelDirection).toBe("East");
    expect(response.sessionData?.roomChange?.presentationCues?.[0].cueType).toBe("roomTransition");
    expect(response.sessionData?.roomChange?.presentationCues?.[0].effectKey).toBe("room.transition.authored.cue");
    expect(response.sessionData?.roomChange?.newRoom?.roomDisplayMode).toBe("Overlay");
    expect(response.sessionData?.roomChange?.newRoom?.roomImageCanvasWidth).toBe(600);
    expect(response.sessionData?.roomChange?.newRoom?.roomImageCanvasHeight).toBe(800);
    expect(response.sessionData?.roomChange?.newRoom?.directionalRenderableImages[0].slot).toBe("NorthEast");
    expect(response.sessionData?.roomChange?.newRoom?.renderableRoomObjects[0].objectId).toBe("obj-1");
    expect(response.sessionData?.roomObjectChanges[0].changeKind).toBe("Updated");
    expect(response.sessionData?.roomObjectChanges[0].renderableRoomObject?.renderableImage.x).toBe(140);
    expect(response.sessionData?.roomObjectChanges[0].presentationCues[0].effectKey).toBe("walk");
    expect(response.sessionData?.roomObjectChanges[0].presentationCues[0].cueType).toBe("movement");
    expect(response.sessionData?.roomObjectChanges[0].presentationCues[0].moveDirection).toBe("East");
    expect(response.sessionData?.roomObjectChanges[0].presentationCues[0].movementDurationMs).toBe(640);
    expect(response.sessionData?.roomObjectChanges[0].presentationCues[0].movementFrames).toBe(16);
    expect(response.sessionData?.authoredRenderWidth).toBe(800);
    expect(response.sessionData?.authoredRenderHeight).toBe(600);
    expect(response.sessionData?.hasPhaseChange).toBe(true);
    expect(response.sessionData?.phaseChange?.newPhase?.pathDisplayName).toBe("Book A / Chapter 2 / Page 7");
    expect(response.sessionData?.orderedTextPresentationSteps[0].presentationCueEffectKey).toBe("text.overlay.page");
    expect(response.sessionData?.orderedTextPresentationSteps[0].where).toBe("HudEdgeCard");
    expect(response.sessionData?.orderedTextPresentationSteps[0].how).toBe("FadeIn");
    expect(response.sessionData?.orderedTextPresentationSteps[0].motionInMs).toBe(500);

    vi.unstubAllGlobals();
  });

  it("maps baseline payload with room-change data for initial scene hydration", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionDeltaWatermark: "7",
        roomChange: {
          travelDirection: "Down",
          newRoom: {
            roomId: "room-9",
            name: "Atrium",
            roomDisplayMode: 1,
            roomImageCanvasWidth: 600,
            roomImageCanvasHeight: 800,
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
              }
            ]
          }
        },
        phaseChange: {
          reason: "resume",
          orderedTextPresentationSteps: [
            {
              where: "HudEdgeCard",
              how: "AutoScroll",
              dismissMode: "Manual",
              displayDurationMs: 0,
              bodyText: "Welcome back.",
              presentationCueEffectKey: "text.hudoverlay.autoscroll.manualdismiss"
            }
          ]
        },
        soundCues: [
          {
            operation: "Play",
            soundEffectId: "11111111-1111-1111-1111-111111111111",
            soundEffectLane: "Ambient",
            soundEffectKey: "sound.phase.ambient",
            runtimeAssetRef: "assets/sounds/phase-ambient.mp3",
            playRequestInstanceId: "22222222-2222-2222-2222-222222222222",
            commandCorrelationId: -1,
            actionId: "00000000-0000-0000-0000-000000000000",
            resultCode: "SessionBaseline.PhaseAmbient",
            sequenceIndex: 0,
            repeatMode: "UntilCanceled",
            replayPolicy: "IgnoreIfAlreadyPlaying"
          }
        ],
        authoredRenderWidth: 800,
        authoredRenderHeight: 600
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const baseline = await client.getSessionBaseline("cred-1", "session-1", "Low");

    expect(baseline.sessionDeltaWatermark).toBe("7");
    expect(baseline.roomChange?.newRoom?.roomId).toBe("room-9");
    expect(baseline.roomChange?.travelDirection).toBe("Down");
    expect(baseline.roomChange?.newRoom?.roomImageCanvasWidth).toBe(600);
    expect(baseline.roomChange?.newRoom?.roomImageCanvasHeight).toBe(800);
    expect(baseline.roomChange?.newRoom?.directionalRenderableImages[0].slot).toBe("Down");
    expect(baseline.roomChange?.newRoom?.renderableRoomObjects[0].name).toBe("Lantern");
    expect(baseline.orderedTextPresentationSteps).toHaveLength(1);
    expect(baseline.orderedTextPresentationSteps?.[0].presentationCueEffectKey).toBe("text.hudoverlay.autoscroll.manualdismiss");
    expect(baseline.orderedTextPresentationSteps?.[0].where).toBe("HudEdgeCard");
    expect(baseline.orderedTextPresentationSteps?.[0].how).toBe("AutoScroll");
    expect(baseline.orderedTextPresentationSteps?.[0].displayDurationMs).toBe(0);
    expect(baseline.soundCues).toHaveLength(1);
    expect(baseline.soundCues[0].soundEffectLane).toBe("Ambient");
    expect(baseline.soundCues[0].resultCode).toBe("SessionBaseline.PhaseAmbient");
    expect(baseline.authoredRenderWidth).toBe(800);
    expect(baseline.authoredRenderHeight).toBe(600);

    vi.unstubAllGlobals();
  });

  it("maps typed sound cue payload with operation and repeat defaults", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCode: "Success",
        sessionData: {
          roomObjectChanges: [],
          soundCues: [
            {
              operation: "Play",
              soundEffectId: "11111111-1111-1111-1111-111111111111",
              soundEffectLane: "Ambient",
              soundEffectKey: "sound.ambient.wind",
              runtimeAssetRef: "assets/sounds/wind.mp3",
              playRequestInstanceId: "22222222-2222-2222-2222-222222222222",
              commandCorrelationId: 42,
              actionId: "33333333-3333-3333-3333-333333333333",
              resultCode: "SoundCue.Play",
              sequenceIndex: 3,
              repeatMode: "RepeatForDuration",
              replayPolicy: "IgnoreIfAlreadyPlaying",
              repeatDurationMs: 2000,
              repeatIntervalMs: 100,
              repeatCooldownMs: 50,
              startDelayMs: 25,
              sourceDurationMs: 1200,
              maxPlayDurationMs: 500,
              baseVolumeDb: -6,
              fadeInMs: 100,
              fadeOutMs: 150
            },
            {
              operation: "UnknownOperation",
              soundEffectLane: "UnknownLane",
              soundEffectKey: "sound.sfx.click",
              runtimeAssetRef: "assets/sounds/click.mp3",
              commandCorrelationId: 43,
              actionId: "44444444-4444-4444-4444-444444444444",
              resultCode: "SoundCue.Play",
              sequenceIndex: 4,
              repeatMode: "Unexpected",
              replayPolicy: "UnexpectedReplayPolicy",
              SourceDurationMs: 321
            }
          ],
          outputLines: [],
          diagnostics: [],
          sessionDeltaWatermark: "5"
        },
        sessionDeltaWatermark: "5",
        diagnostics: []
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.getSessionDeltas("cred-1", "session-1", "4", "Medium");

    expect(response.resultCode).toBe("Success");
    expect(response.sessionData?.soundCues).toHaveLength(2);

    const firstCue = response.sessionData?.soundCues[0];
    expect(firstCue?.operation).toBe("Play");
    expect(firstCue?.soundEffectLane).toBe("Ambient");
    expect(firstCue?.repeatMode).toBe("RepeatForDuration");
    expect(firstCue?.replayPolicy).toBe("IgnoreIfAlreadyPlaying");
    expect(firstCue?.repeatDurationMs).toBe(2000);
    expect(firstCue?.repeatIntervalMs).toBe(100);
    expect(firstCue?.repeatCooldownMs).toBe(50);
    expect(firstCue?.startDelayMs).toBe(25);
    expect(firstCue?.sourceDurationMs).toBe(1200);
    expect(firstCue?.maxPlayDurationMs).toBe(500);
    expect(firstCue?.baseVolumeDb).toBe(-6);
    expect(firstCue?.fadeInMs).toBe(100);
    expect(firstCue?.fadeOutMs).toBe(150);

    const secondCue = response.sessionData?.soundCues[1];
    expect(secondCue?.operation).toBe("Play");
    expect(secondCue?.soundEffectLane).toBe("Sfx");
    expect(secondCue?.repeatMode).toBe("None");
    expect(secondCue?.replayPolicy).toBe("PlayAgain");
    expect(secondCue?.sourceDurationMs).toBe(321);

    vi.unstubAllGlobals();
  });

  it("maps legacy numeric enum payloads for room and sound cues", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCode: "Success",
        sessionData: {
          roomChange: {
            travelDirection: 2,
            newRoom: {
              roomId: "room-legacy",
              name: "Legacy Room",
              roomDisplayMode: 1,
              renderableRoomObjects: [],
              directionalRenderableImages: []
            }
          },
          roomObjectChanges: [],
          soundCues: [
            {
              operation: 0,
              soundEffectId: "11111111-1111-1111-1111-111111111111",
              soundEffectLane: 0,
              soundEffectKey: "sound.sfx.drag",
              runtimeAssetRef: "assets/sounds/drag.mp3",
              commandCorrelationId: -1,
              actionId: "22222222-2222-2222-2222-222222222222",
              resultCode: "Success",
              sequenceIndex: 0,
              repeatMode: 3,
              replayPolicy: 2
            },
            {
              operation: 1,
              soundEffectId: "33333333-3333-3333-3333-333333333333",
              soundEffectLane: 1,
              soundEffectKey: "sound.amb.wind",
              runtimeAssetRef: "assets/sounds/wind.mp3",
              commandCorrelationId: -1,
              actionId: "44444444-4444-4444-4444-444444444444",
              resultCode: "Success",
              sequenceIndex: 1,
              repeatMode: 0,
              replayPolicy: 1
            }
          ],
          outputLines: [],
          diagnostics: [],
          sessionDeltaWatermark: "6"
        },
        sessionDeltaWatermark: "6",
        diagnostics: []
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostApiClient({ baseUrl: "http://127.0.0.1:5199" });
    const response = await client.getSessionDeltas("cred-1", "session-1", "5", "Medium");

    expect(response.resultCode).toBe("Success");
    expect(response.sessionData?.roomChange?.travelDirection).toBe("East");
    expect(response.sessionData?.roomChange?.newRoom?.roomDisplayMode).toBe(1);

    const firstCue = response.sessionData?.soundCues[0];
    expect(firstCue?.operation).toBe("Play");
    expect(firstCue?.soundEffectLane).toBe("Sfx");
    expect(firstCue?.repeatMode).toBe("UntilCanceled");
    expect(firstCue?.replayPolicy).toBe("IgnoreIfAlreadyPlaying");

    const secondCue = response.sessionData?.soundCues[1];
    expect(secondCue?.operation).toBe("Cancel");
    expect(secondCue?.soundEffectLane).toBe("Ambient");
    expect(secondCue?.repeatMode).toBe("None");
    expect(secondCue?.replayPolicy).toBe("CancelPreviousAtNextPlay");

    vi.unstubAllGlobals();
  });
});
