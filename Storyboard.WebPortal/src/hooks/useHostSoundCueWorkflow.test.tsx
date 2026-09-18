/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostCommandSoundCue, HostSessionDataEnvelope } from "../hostApi/HostContracts";
import { useHostSoundCueWorkflow } from "./useHostSoundCueWorkflow";

class FakeAudio {
  static instances: FakeAudio[] = [];
  static blockedByAutoplayPolicy = false;

  src: string;
  preload = "";
  loop = false;
  volume = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  playCalls = 0;
  pauseCalls = 0;

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (FakeAudio.blockedByAutoplayPolicy) {
      const error = new Error("Autoplay blocked");
      error.name = "NotAllowedError";
      return Promise.reject(error);
    }
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
  }
}

function buildCue(overrides: Partial<HostCommandSoundCue> = {}): HostCommandSoundCue {
  return {
    operation: "Play",
    soundEffectId: "11111111-1111-1111-1111-111111111111",
    soundEffectLane: "Sfx",
    soundEffectKey: "sound.effect.door",
    runtimeAssetRef: "assets/sounds/door.mp3",
    commandCorrelationId: 101,
    actionId: "22222222-2222-2222-2222-222222222222",
    resultCode: "SoundCue.Play",
    sequenceIndex: 0,
    repeatMode: "None",
    replayPolicy: "PlayAgain",
    ...overrides
  };
}

function buildSessionData(soundCues: HostCommandSoundCue[], watermark = "2"): HostSessionDataEnvelope {
  return {
    sessionDeltaWatermark: watermark,
    roomObjectChanges: [],
    soundCues,
    outputLines: [],
    diagnostics: [],
    orderedTextPresentationSteps: [],
    hasRoomChange: false,
    hasPhaseChange: false
  };
}

describe("useHostSoundCueWorkflow", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    FakeAudio.instances = [];
    FakeAudio.blockedByAutoplayPolicy = false;
  });

  it("plays a sound cue after start delay and stops at max play duration", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({ startDelayMs: 50, maxPlayDurationMs: 200 })
    ]));

    await Promise.resolve();
    await Promise.resolve();

    expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(1);

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(0);

    await vi.advanceTimersByTimeAsync(49);
    expect(FakeAudio.instances[0].playCalls).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(FakeAudio.instances[0].pauseCalls).toBe(1);
  });

  it("dedupes repeated sound cue batches by watermark and cue identity", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    const sessionData = buildSessionData([buildCue()], "2");
    result.current.consumeSessionDeltaSoundCues(sessionData);
    result.current.consumeSessionDeltaSoundCues(sessionData);

    await waitFor(() => {
      expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(1);
    });
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);
  });

  it("skips duplicate lane/key playback when replay policy is IgnoreIfAlreadyPlaying", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({ replayPolicy: "IgnoreIfAlreadyPlaying" })
    ], "2"));

    await waitFor(() => {
      expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(1);
      expect(FakeAudio.instances).toHaveLength(1);
      expect(FakeAudio.instances[0].playCalls).toBe(1);
    });

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({ replayPolicy: "IgnoreIfAlreadyPlaying", sequenceIndex: 1, playRequestInstanceId: "77777777-7777-7777-7777-777777777777" })
    ], "3"));

    await waitFor(() => {
      expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(1);
    });
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);
  });

  it("allows overlap playback when replay policy is PlayAgain", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({ replayPolicy: "PlayAgain" }),
      buildCue({ replayPolicy: "PlayAgain", sequenceIndex: 1, playRequestInstanceId: "88888888-8888-8888-8888-888888888888" })
    ], "2"));

    await waitFor(() => {
      expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(2);
    });
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    expect(FakeAudio.instances[1].playCalls).toBe(1);
  });

  it("cancels active playback by playRequestInstanceId", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({
        repeatMode: "UntilCanceled",
        playRequestInstanceId: "33333333-3333-3333-3333-333333333333"
      })
    ]));

    await waitFor(() => {
      expect(FakeAudio.instances).toHaveLength(1);
      expect(FakeAudio.instances[0].playCalls).toBe(1);
    });

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({
        operation: "Cancel",
        playRequestInstanceId: "33333333-3333-3333-3333-333333333333"
      })
    ], "3"));

    expect(FakeAudio.instances[0].pauseCalls).toBe(1);
  });

  it("applies fade-in and fade-out timing when configured", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({
        playRequestInstanceId: "55555555-5555-5555-5555-555555555555",
        baseVolumeDb: -6,
        fadeInMs: 100,
        fadeOutMs: 100
      })
    ], "10"));

    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].volume).toBe(0);

    await vi.advanceTimersByTimeAsync(120);
    expect(FakeAudio.instances[0].volume).toBeGreaterThan(0.4);
    expect(FakeAudio.instances[0].volume).toBeLessThanOrEqual(0.6);

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({
        operation: "Cancel",
        playRequestInstanceId: "55555555-5555-5555-5555-555555555555"
      })
    ], "11"));

    expect(FakeAudio.instances[0].pauseCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(120);
    expect(FakeAudio.instances[0].pauseCalls).toBe(1);
  });

  it("queues blocked cues and replays them after manual audio unlock", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    FakeAudio.blockedByAutoplayPolicy = true;

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: true,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([buildCue()], "20"));
    await waitFor(() => {
      expect(result.current.soundCueStatus.isAudioUnlocked).toBe(false);
      expect(result.current.soundCueStatus.pendingUnlockCueCount).toBe(1);
      expect(result.current.soundCueStatus.autoplayBlockedCount).toBe(1);
    });

    FakeAudio.blockedByAutoplayPolicy = false;
    result.current.requestAudioUnlock();
    await waitFor(() => {
      expect(result.current.soundCueStatus.isAudioUnlocked).toBe(true);
      expect(result.current.soundCueStatus.pendingUnlockCueCount).toBe(0);
    });

    expect(getAssetPreviewDataUrl).toHaveBeenCalledTimes(2);
  });

  it("uses repeat interval plus cooldown delay before repeated playback", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({
        repeatMode: "RepeatCount",
        repeatCount: 1,
        repeatIntervalMs: 100,
        repeatCooldownMs: 50
      })
    ], "30"));
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);

    FakeAudio.instances[0].onended?.();

    await vi.advanceTimersByTimeAsync(149);
    expect(FakeAudio.instances[0].playCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(FakeAudio.instances[0].playCalls).toBe(2);
  });

  it("treats source duration as metadata and does not force-stop playback", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() =>
      useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: 100 },
          ambient: { muted: false, volumePercent: 100 }
        },
        addDiagnostic
      })
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({
        sourceDurationMs: 120,
        maxPlayDurationMs: undefined
      })
    ], "31"));

    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(FakeAudio.instances[0].pauseCalls).toBe(0);
  });
});