/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostCommandSoundCue, HostSessionPresentationData } from "../hostApi/HostContracts";
import type { GameRenderSceneSnapshot } from "../gameRenderer/contracts/sceneTypes";
import { useHostRendererSessionWorkflow } from "./useHostRendererSessionWorkflow";
import type { HostApiClient } from "../hostApi/client";
import { webPortalAssetCache } from "../cache/webPortalAssetCache";

const useSessionDeltaPollingMock = vi.fn();

vi.mock("./useSessionDeltaPolling", () => ({
  useSessionDeltaPolling: (options: unknown) => {
    useSessionDeltaPollingMock(options);
  }
}));

function buildBaselineSoundCue(): HostCommandSoundCue {
  return {
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
  };
}

describe("useHostRendererSessionWorkflow reconnect sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useSessionDeltaPollingMock.mockReset();
  });

  async function waitForBaselineSyncReady(): Promise<void> {
    await waitFor(() => {
      const baselineReady = useSessionDeltaPollingMock.mock.calls
        .map((call) => call[0] as { enabled?: boolean })
        .some((call) => call.enabled === true);
      expect(baselineReady).toBe(true);
    });
  }

  it("waits for required global catalog assets before requesting the session baseline", async () => {
    let releaseCatalog!: (catalog: { effects: [] }) => void;
    const catalogReady = new Promise<{ effects: [] }>((resolve) => { releaseCatalog = resolve; });
    const ensurePresentationCueCatalogReady = vi.fn(() => catalogReady);
    const getSessionBaseline = vi.fn().mockResolvedValue({
      sessionDeltaWatermark: "1", soundCues: [], roomObjectChanges: [],
      activeRoomObjectName: "", activeRoomObjectSelectionCueEffectKey: "",
      secondaryActiveRoomObjectName: "", secondaryActiveRoomObjectSelectionCueEffectKey: "",
      outputLines: [], diagnostics: [], roomChange: { newRoom: {
        roomId: "room-1", name: "Atrium", roomDisplayMode: "Overlay", renderableRoomObjects: [], directionalRenderableImages: []
      } }
    });
    const hostApiClient = { getSessionBaseline, getSessionDeltas: vi.fn() } as unknown as HostApiClient;
    const { result } = renderHook(() => {
      const [scene, setScene] = useState<GameRenderSceneSnapshot | null>(null);
      useHostRendererSessionWorkflow({
        hostApiClient, credentialHandle: "cred-1", activeSessionId: "session-1", selectedGameId: "game-1", selectedGameKey: "game-key",
        presentationCueCatalogRevision: 0, rendererSceneSnapshot: scene, setRendererSceneSnapshot: setScene,
        applyPresentationCues: (snapshot) => snapshot, getCurrentPresentationCueCatalog: () => null,
        ensurePresentationCueCatalogReady, presentationCueCatalogSource: "none", getHudOverlayEntries: () => [],
        pollIntervalMs: 100, heartbeatEveryNPolls: 100, sessionDeltaResetEpoch: 0,
        consumeSessionDeltaPhasePresentation: vi.fn(), consumeSessionDeltaEcho: vi.fn(), consumeSessionDeltaSoundCues: vi.fn(),
        refreshCacheStats: vi.fn(), addDiagnostic: vi.fn()
      });
      return scene;
    });

    expect(ensurePresentationCueCatalogReady).toHaveBeenCalledTimes(1);
    expect(getSessionBaseline).not.toHaveBeenCalled();
    act(() => { releaseCatalog({ effects: [] }); });
    await waitFor(() => expect(getSessionBaseline).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current?.roomId).toBe("room-1"));
  });

  it("renders Shown objects without reporting movement and clears Hidden objects and cues", async () => {
    const hostApiClient = {
      getSessionBaseline: vi.fn().mockResolvedValue({
        sessionDeltaWatermark: "1",
        soundCues: [],
        roomChange: {
          newRoom: {
            roomId: "room-1",
            name: "Atrium",
            roomDisplayMode: "Overlay",
            renderableRoomObjects: [],
            directionalRenderableImages: []
          }
        }
      }),
      getSessionDeltas: vi.fn(),
      getAssetPreviewDataUrl: vi.fn()
    } as unknown as HostApiClient;
    const addDiagnostic = vi.fn();
    const refreshCacheStats = vi.fn();
    const { result } = renderHook(() => {
      const [scene, setScene] = useState<GameRenderSceneSnapshot | null>(null);
      useHostRendererSessionWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "game-key",
        presentationCueCatalogRevision: 0,
        rendererSceneSnapshot: scene,
        setRendererSceneSnapshot: setScene,
        applyPresentationCues: (snapshot) => snapshot,
        getCurrentPresentationCueCatalog: () => null,
        ensurePresentationCueCatalogReady: async () => ({ effects: [] }),
        presentationCueCatalogSource: "none",
        getHudOverlayEntries: () => [],
        pollIntervalMs: 100,
        heartbeatEveryNPolls: 100,
        sessionDeltaResetEpoch: 0,
        consumeSessionDeltaPhasePresentation: vi.fn(),
        consumeSessionDeltaEcho: vi.fn(),
        consumeSessionDeltaSoundCues: vi.fn(),
        refreshCacheStats,
        addDiagnostic
      });
      return scene;
    });

    await waitForBaselineSyncReady();
    await waitFor(() => expect(result.current?.roomId).toBe("room-1"));
    const onSessionData = () => {
      const options = useSessionDeltaPollingMock.mock.calls[useSessionDeltaPollingMock.mock.calls.length - 1]?.[0] as {
        onSessionData: (data: HostSessionPresentationData) => void;
      };
      return options.onSessionData;
    };
    const shownObject = {
      objectId: "obj-1",
      name: "Lantern",
      renderableImage: {
        imagePath: "data:image/png;base64,AAAA",
        anchorX: 0,
        anchorY: 0,
        iconOffsetX: 0,
        iconOffsetY: 0,
        x: 160,
        y: 80,
        rotationDegrees: 0,
        scale: 1
      },
      renderZOrder: 1,
      activePresentationCues: [{ category: "Appearance" as const, effectKey: "appearance.selection.outline.cyan", activationId: "shown-1" }]
    };
    const delta = (changeKind: "Shown" | "Hidden", watermark: string): HostSessionPresentationData => ({
      sessionDeltaWatermark: watermark,
      roomObjectChanges: [{
        changeKind,
        objectId: "obj-1",
        objectName: "Lantern",
        renderableRoomObject: shownObject,
      }],
      soundCues: [],
      outputLines: [],
      diagnostics: [],
      activeRoomObjectName: "",
      activeRoomObjectSelectionCueEffectKey: "",
      secondaryActiveRoomObjectName: "",
      secondaryActiveRoomObjectSelectionCueEffectKey: "",
    });

    act(() => onSessionData()(delta("Shown", "2")));
    await waitFor(() => expect(result.current?.objectsById["obj-1"]?.sprite?.x).toBe(160));
    expect(addDiagnostic.mock.calls.some(([, , message]) => message === "Movement cue resolution summary for session delta.")).toBe(false);
    expect(addDiagnostic.mock.calls.some(([, , message]) => message === "Delta timing ledger for movement and sound cues.")).toBe(false);

    addDiagnostic.mockClear();
    act(() => onSessionData()(delta("Hidden", "3")));
    await waitFor(() => expect(result.current?.objectsById["obj-1"]).toBeUndefined());
    expect(addDiagnostic.mock.calls.some(([, , message]) => message === "Mapped authoritative active presentation cues from Host session delta into the renderer scene.")).toBe(false);
    expect(addDiagnostic.mock.calls.some(([, , message]) => message === "Movement cue resolution summary for session delta.")).toBe(false);
  });

  it("warms discovered custom particle images when the session warm-up switch is enabled", async () => {
    const discoverAssets = vi.fn().mockResolvedValue({
      result: { success: true },
      resultCode: "Success",
      candidates: [{
        assetType: "Image",
        relativeLocator: "assets/particle/warmup-probe.webp",
        eTagHint: "etag-probe",
        priorityTier: "CurrentRoom",
        particleEffectAssociation: { effectKey: "particle.warmup-probe", imageSlot: "spark" },
        missing: false
      }],
      truncated: false,
      continuationToken: ""
    });
    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:image/webp;base64,AAAA");
    const hostApiClient = {
      getSessionBaseline: vi.fn().mockResolvedValue({
        sessionDeltaWatermark: "warmup-1",
        soundCues: [],
        roomChange: {
          newRoom: {
            roomId: "room-warmup-probe",
            name: "Warm-up probe",
            roomDisplayMode: "Overlay",
            renderableRoomObjects: [],
            directionalRenderableImages: [],
            particleEffectImageMappings: [{
              effectKey: "particle.warmup-probe",
              imageSlot: "spark",
              relativeLocator: "assets/particle/warmup-probe.webp"
            }]
          }
        }
      }),
      getSessionDeltas: vi.fn(),
      discoverAssets,
      getAssetPreviewDataUrl
    } as unknown as HostApiClient;
    const { result } = renderHook(() => {
      const [scene, setScene] = useState<GameRenderSceneSnapshot | null>(null);
      useHostRendererSessionWorkflow({
        hostApiClient,
        credentialHandle: "cred-warmup",
        activeSessionId: "session-warmup",
        selectedGameId: "game-warmup",
        selectedGameKey: "game-warmup-key",
        presentationCueCatalogRevision: 0,
        rendererSceneSnapshot: scene,
        setRendererSceneSnapshot: setScene,
        applyPresentationCues: (snapshot) => snapshot,
        getCurrentPresentationCueCatalog: () => null,
        ensurePresentationCueCatalogReady: async () => ({ effects: [] }),
        presentationCueCatalogSource: "none",
        particleAssetWarmupEnabled: true,
        getHudOverlayEntries: () => [],
        pollIntervalMs: 100,
        heartbeatEveryNPolls: 100,
        sessionDeltaResetEpoch: 0,
        consumeSessionDeltaPhasePresentation: vi.fn(),
        consumeSessionDeltaEcho: vi.fn(),
        consumeSessionDeltaSoundCues: vi.fn(),
        refreshCacheStats: vi.fn(),
        addDiagnostic: vi.fn()
      });
      return scene;
    });

    await waitForBaselineSyncReady();
    await waitFor(() => expect(getAssetPreviewDataUrl).toHaveBeenCalledWith(
      "cred-warmup", "assets/particle/warmup-probe.webp", "game-warmup", "game-warmup-key"
    ));
    expect(discoverAssets).toHaveBeenCalledWith("cred-warmup", "session-warmup", "Ancestors");
      await waitFor(() => expect(result.current?.roomId).toBe("room-warmup-probe"));
  });

  it("waits for baseline and starts delta polling from baseline watermark", async () => {
    const getSessionBaseline = vi.fn().mockResolvedValue({
      sessionDeltaWatermark: "42",
      soundCues: [buildBaselineSoundCue()],
    });

    const consumeSessionDeltaSoundCues = vi.fn();

    const hostApiClient = {
      getSessionBaseline,
      getSessionDeltas: vi.fn(),
      getAssetPreviewDataUrl: vi.fn().mockResolvedValue("")
    } as unknown as HostApiClient;

    renderHook(() =>
      useHostRendererSessionWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "game-key",
        presentationCueCatalogRevision: 0,
        rendererSceneSnapshot: null,
        setRendererSceneSnapshot: vi.fn(),
        applyPresentationCues: (scene) => scene,
        getCurrentPresentationCueCatalog: () => null,
        ensurePresentationCueCatalogReady: async () => ({ effects: [] }),
        presentationCueCatalogSource: "none",
        getHudOverlayEntries: () => [],
        pollIntervalMs: 100,
        heartbeatEveryNPolls: 100,
        sessionDeltaResetEpoch: 0,
        consumeSessionDeltaPhasePresentation: vi.fn(),
        consumeSessionDeltaEcho: vi.fn(),
        consumeSessionDeltaSoundCues,
        refreshCacheStats: vi.fn(),
        addDiagnostic: vi.fn()
      })
    );

    await waitFor(() => {
      expect(getSessionBaseline).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(consumeSessionDeltaSoundCues).toHaveBeenCalled();
    });

    await waitFor(() => {
      const matchingCall = useSessionDeltaPollingMock.mock.calls
        .map((call) => call[0] as { enabled?: boolean; initialWatermark?: string })
        .find((call) => call.enabled === true && call.initialWatermark === "42");
      expect(matchingCall).toBeDefined();
    });

    const firstCall = useSessionDeltaPollingMock.mock.calls[0]?.[0] as { enabled?: boolean; initialWatermark?: string };
    expect(firstCall?.enabled).toBe(false);
    expect(firstCall?.initialWatermark).toBe("");

    const firstSoundBatch = consumeSessionDeltaSoundCues.mock.calls[0]?.[0] as { sessionDeltaWatermark?: string; soundCues?: HostCommandSoundCue[] } | undefined;
    expect(firstSoundBatch?.sessionDeltaWatermark).toBe("42");
    expect(firstSoundBatch?.soundCues).toHaveLength(1);
    expect(firstSoundBatch?.soundCues?.[0]?.resultCode).toBe("SessionBaseline.PhaseAmbient");
  });

  it("publishes a baseline scene when one image request fails", async () => {
    vi.spyOn(webPortalAssetCache, "get").mockImplementation((cacheKey) => {
      return cacheKey.includes("wall.png")
        ? Promise.reject(new Error("Temporary cache failure"))
        : Promise.resolve({ entry: null, source: "none" });
    });
    vi.spyOn(webPortalAssetCache, "set").mockResolvedValue(undefined);
    const getAssetPreviewDataUrl = vi.fn().mockImplementation((_credential: string, path: string) => {
      return path === "assets/floor.png"
        ? Promise.reject(new Error("Temporary asset request failure"))
        : Promise.resolve("data:image/png;base64,AAAA");
    });
    const hostApiClient = {
      getSessionBaseline: vi.fn().mockResolvedValue({
        sessionDeltaWatermark: "42",
        soundCues: [],
        roomChange: {
          newRoom: {
            roomId: "room-1",
            name: "Sample Room",
            roomDisplayMode: "Overlay",
            directionalRenderableImages: ["assets/floor.png", "assets/wall.png"].map((imagePath, index) => ({
              slot: index === 0 ? "Down" : "North",
              renderableImage: { imagePath, x: 0, y: 0, rotationDegrees: 0, scale: 1 }
            })),
            renderableRoomObjects: []
          }
        },
        authoredRenderWidth: 800,
        authoredRenderHeight: 600
      }),
      getSessionDeltas: vi.fn(),
      getAssetPreviewDataUrl
    } as unknown as HostApiClient;
    const setRendererSceneSnapshot = vi.fn();
    const addDiagnostic = vi.fn();

    const workflowOptions: Parameters<typeof useHostRendererSessionWorkflow>[0] = {
      hostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "game-key",
      presentationCueCatalogRevision: 0,
      rendererSceneSnapshot: null,
      setRendererSceneSnapshot,
      applyPresentationCues: (scene) => scene,
      getCurrentPresentationCueCatalog: () => null,
      ensurePresentationCueCatalogReady: async () => ({ effects: [] }),
      presentationCueCatalogSource: "none",
      getHudOverlayEntries: () => [],
      pollIntervalMs: 100,
      heartbeatEveryNPolls: 100,
      sessionDeltaResetEpoch: 0,
      consumeSessionDeltaPhasePresentation: vi.fn(),
      consumeSessionDeltaEcho: vi.fn(),
      consumeSessionDeltaSoundCues: vi.fn(),
      refreshCacheStats: vi.fn(),
      addDiagnostic
    };
    renderHook(() => useHostRendererSessionWorkflow(workflowOptions));

    await waitFor(() => expect(setRendererSceneSnapshot.mock.calls.some(([scene]) => scene?.roomId === "room-1")).toBe(true));
    const scene = setRendererSceneSnapshot.mock.calls.find(([snapshot]) => snapshot?.roomId === "room-1")?.[0];
    expect(scene?.roomId).toBe("room-1");
    expect(scene?.directionalOverlays.map((overlay: { asset: { assetPath: string } }) => overlay.asset.assetPath)).toEqual([
      "assets/floor.png",
      "data:image/png;base64,AAAA"
    ]);
    expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(2);
    expect(addDiagnostic).toHaveBeenCalledWith(
      "warn",
      "session-render",
      "Failed to resolve image asset for renderer.",
      expect.objectContaining({ assetPath: "assets/floor.png" })
    );
    expect(addDiagnostic).toHaveBeenCalledWith(
      "warn",
      "asset-cache",
      "Could not read renderer image asset cache; fetching from Host.",
      expect.objectContaining({ assetPath: "assets/wall.png" })
    );
    await waitForBaselineSyncReady();
  });

  it("passes a resync baseline callback into polling workflow", async () => {
    const getSessionBaseline = vi.fn().mockResolvedValue({
      sessionDeltaWatermark: "42",
      soundCues: [],
    });

    const hostApiClient = {
      getSessionBaseline,
      getSessionDeltas: vi.fn(),
      getAssetPreviewDataUrl: vi.fn().mockResolvedValue("")
    } as unknown as HostApiClient;

    renderHook(() =>
      useHostRendererSessionWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "game-key",
        presentationCueCatalogRevision: 0,
        rendererSceneSnapshot: null,
        setRendererSceneSnapshot: vi.fn(),
        applyPresentationCues: (scene) => scene,
        getCurrentPresentationCueCatalog: () => null,
        ensurePresentationCueCatalogReady: async () => ({ effects: [] }),
        presentationCueCatalogSource: "none",
        getHudOverlayEntries: () => [],
        pollIntervalMs: 100,
        heartbeatEveryNPolls: 100,
        sessionDeltaResetEpoch: 0,
        consumeSessionDeltaPhasePresentation: vi.fn(),
        consumeSessionDeltaEcho: vi.fn(),
        consumeSessionDeltaSoundCues: vi.fn(),
        refreshCacheStats: vi.fn(),
        addDiagnostic: vi.fn()
      })
    );

    await waitFor(() => {
      const matchingCall = useSessionDeltaPollingMock.mock.calls
        .map((call) => call[0] as { onResyncBaseline?: unknown })
        .find((call) => typeof call.onResyncBaseline === "function");
      expect(matchingCall).toBeDefined();
    });
    await waitForBaselineSyncReady();
  });

  it("only pauses polling for a destination room that differs from the displayed room", async () => {
    const hostApiClient = {
      getSessionBaseline: vi.fn().mockResolvedValue({
        sessionDeltaWatermark: "1",
        soundCues: [],
        roomChange: {
          newRoom: {
            roomId: "room-1",
            name: "First Room",
            roomDisplayMode: 1,
            renderableRoomObjects: [],
            directionalRenderableImages: []
          }
        }
      }),
      getSessionDeltas: vi.fn(),
      getAssetPreviewDataUrl: vi.fn()
    } as unknown as HostApiClient;
    const consumeSessionDeltaPhasePresentation = vi.fn();
    const { result } = renderHook(() =>
      {
        const [scene, setScene] = useState<GameRenderSceneSnapshot | null>(null);
        const workflow = useHostRendererSessionWorkflow({
          hostApiClient,
          credentialHandle: "cred-1",
          activeSessionId: "session-1",
          selectedGameId: "game-1",
          selectedGameKey: "game-key",
          presentationCueCatalogRevision: 0,
          rendererSceneSnapshot: scene,
          setRendererSceneSnapshot: setScene,
          applyPresentationCues: (snapshot) => snapshot,
          getCurrentPresentationCueCatalog: () => null,
          ensurePresentationCueCatalogReady: async () => ({ effects: [] }),
          presentationCueCatalogSource: "none",
          getHudOverlayEntries: () => [],
          pollIntervalMs: 100,
          heartbeatEveryNPolls: 100,
          sessionDeltaResetEpoch: 0,
          consumeSessionDeltaPhasePresentation,
          consumeSessionDeltaEcho: vi.fn(),
          consumeSessionDeltaSoundCues: vi.fn(),
          refreshCacheStats: vi.fn(),
          addDiagnostic: vi.fn()
        });
        return { scene, workflow };
      }
    );

    await waitForBaselineSyncReady();
    await waitFor(() => expect(result.current.scene?.roomId).toBe("room-1"));

    const pollingOptions = useSessionDeltaPollingMock.mock.calls[useSessionDeltaPollingMock.mock.calls.length - 1]?.[0] as {
      isPaused: () => boolean;
      onSessionData: (sessionData: unknown) => void;
    };
    const currentRoomUpdate = {
      sessionDeltaWatermark: "2",
      roomObjectChanges: [],
      soundCues: [],
      outputLines: [],
      diagnostics: [],
      roomChange: {
        currentRoom: {
          roomId: "room-1",
          environmentalParticleEffects: []
        }
      }
    };
    act(() => pollingOptions.onSessionData(currentRoomUpdate));
    expect(pollingOptions.isPaused()).toBe(false);
    expect(consumeSessionDeltaPhasePresentation).toHaveBeenCalledWith(currentRoomUpdate);

    consumeSessionDeltaPhasePresentation.mockClear();
    const sameRoomNewRoomUpdate = {
      ...currentRoomUpdate,
      sessionDeltaWatermark: "3",
      roomChange: {
        newRoom: {
          roomId: "room-1",
          name: "First Room",
          roomDisplayMode: 1,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      }
    };
    act(() => pollingOptions.onSessionData(sameRoomNewRoomUpdate));
    expect(pollingOptions.isPaused()).toBe(false);
    expect(consumeSessionDeltaPhasePresentation).toHaveBeenCalledWith(sameRoomNewRoomUpdate);
    consumeSessionDeltaPhasePresentation.mockClear();

    const roomChange = {
      sessionDeltaWatermark: "4",
      roomObjectChanges: [],
      soundCues: [],
      outputLines: [],
      diagnostics: [],
      roomChange: {
        travelDirection: "East",
        presentationCues: [],
        newRoom: {
          roomId: "room-2",
          name: "Second Room",
          roomDisplayMode: 1,
          renderableRoomObjects: [],
          directionalRenderableImages: []
        }
      },
      authoredRenderWidth: 800,
      authoredRenderHeight: 600
    };

    act(() => {
      pollingOptions.onSessionData(roomChange);
    });
    expect(pollingOptions.isPaused()).toBe(true);
    expect(consumeSessionDeltaPhasePresentation).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.workflow.roomTransitionPreparationEpoch).toBe(1);
    });

    act(() => {
      result.current.workflow.reportRoomTransitionState("complete");
    });
    expect(pollingOptions.isPaused()).toBe(false);
    expect(consumeSessionDeltaPhasePresentation).toHaveBeenCalledWith(roomChange);
  });
});
