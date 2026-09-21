/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostCommandSoundCue } from "../hostApi/HostContracts";
import { useHostRendererSessionWorkflow } from "./useHostRendererSessionWorkflow";
import type { HostApiClient } from "../hostApi/client";

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
        applyMovementCueDurations: (scene) => scene,
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
        applyMovementCueDurations: (scene) => scene,
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
        applyMovementCueDurations: (scene) => scene,
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

    await waitFor(() => {
      expect(useSessionDeltaPollingMock).toHaveBeenCalled();
    });

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
