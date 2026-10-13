/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostCommandSoundCue, HostSessionDataEnvelope } from "../hostApi/HostContracts";
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

  it("renders Shown objects without reporting movement and clears Hidden objects and cues", async () => {
    const hostApiClient = {
      getSessionBaseline: vi.fn().mockResolvedValue({
        sessionDeltaWatermark: "1",
        soundCues: [],
        orderedTextPresentationSteps: [],
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
        onSessionData: (data: HostSessionDataEnvelope) => void;
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
    const delta = (changeKind: "Shown" | "Hidden", watermark: string): HostSessionDataEnvelope => ({
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
      orderedTextPresentationSteps: [],
      hasRoomChange: false,
      hasPhaseChange: false
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

  it("waits for baseline and starts delta polling from baseline watermark", async () => {
    const getSessionBaseline = vi.fn().mockResolvedValue({
      sessionDeltaWatermark: "42",
      soundCues: [buildBaselineSoundCue()],
      orderedTextPresentationSteps: []
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
        orderedTextPresentationSteps: [],
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
      orderedTextPresentationSteps: []
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

  it("pauses polling for a room-change delta and defers phase presentation until renderer completion", async () => {
    const hostApiClient = {
      getSessionBaseline: vi.fn().mockResolvedValue({
        sessionDeltaWatermark: "1",
        soundCues: [],
        orderedTextPresentationSteps: []
      }),
      getSessionDeltas: vi.fn(),
      getAssetPreviewDataUrl: vi.fn()
    } as unknown as HostApiClient;
    const consumeSessionDeltaPhasePresentation = vi.fn();
    const { result } = renderHook(() =>
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
      })
    );

    await waitForBaselineSyncReady();

    const pollingOptions = useSessionDeltaPollingMock.mock.calls[useSessionDeltaPollingMock.mock.calls.length - 1]?.[0] as {
      isPaused: () => boolean;
      onSessionData: (sessionData: unknown) => void;
    };
    const roomChange = {
      sessionDeltaWatermark: "2",
      roomObjectChanges: [],
      soundCues: [],
      outputLines: [],
      diagnostics: [],
      orderedTextPresentationSteps: [{ sequence: 1 }],
      hasRoomChange: true,
      hasPhaseChange: true,
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
      expect(result.current.roomTransitionPreparationEpoch).toBe(1);
    });

    act(() => {
      result.current.reportRoomTransitionState("complete");
    });
    expect(pollingOptions.isPaused()).toBe(false);
    expect(consumeSessionDeltaPhasePresentation).toHaveBeenCalledWith(roomChange);
  });
});
