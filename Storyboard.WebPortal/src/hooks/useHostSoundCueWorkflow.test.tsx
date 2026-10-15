/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostCommandActiveObjectSoundCue, HostCommandSoundCue, HostSessionPresentationData } from "../hostApi/HostContracts";
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

class FakeStereoPanner {
  pan = { value: 0 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  static panners: FakeStereoPanner[] = [];
  state: AudioContextState = "running";
  destination = {} as AudioDestinationNode;
  createMediaElementSource = vi.fn(() => ({ connect: vi.fn() }));
  createStereoPanner = vi.fn(() => {
    const panner = new FakeStereoPanner();
    FakeAudioContext.panners.push(panner);
    return panner as unknown as StereoPannerNode;
  });
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
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

function buildSessionData(soundCues: HostCommandSoundCue[], watermark = "2"): HostSessionPresentationData {
  return {
    sessionDeltaWatermark: watermark,
    roomObjectChanges: [],
    soundCues,
    outputLines: [],
    diagnostics: [],
    activeRoomObjectName: "",
    activeRoomObjectSelectionCueEffectKey: "",
    secondaryActiveRoomObjectName: "",
    secondaryActiveRoomObjectSelectionCueEffectKey: "",
  };
}

function buildActiveCue(overrides: Partial<HostCommandActiveObjectSoundCue> = {}): HostCommandActiveObjectSoundCue {
  return {
    activationId: "activation-1",
    soundEffectId: "11111111-1111-1111-1111-111111111111",
    soundEffectLane: "Ambient",
    soundEffectKey: "sound.ambience.rain",
    runtimeAssetRef: "assets/sounds/rain.mp3",
    repeatMode: "UntilCanceled",
    replayPolicy: "PlayAgain",
    volumeMultiplier: 0.5,
    pan: -0.4,
    ...overrides
  };
}

function buildObjectCueSession(
  activeSoundCues: HostCommandActiveObjectSoundCue[],
  watermark = "2"
): HostSessionPresentationData {
  return {
    ...buildSessionData([], watermark),
    roomObjectChanges: [{
      changeKind: "Updated",
      objectId: "rain-emitter",
      objectName: "Rain Emitter",
      renderableRoomObject: {
        objectId: "rain-emitter",
        name: "Rain Emitter",
        renderableImage: {
          imagePath: "",
          anchorX: 0,
          anchorY: 0,
          iconOffsetX: 0,
          iconOffsetY: 0,
          x: 0,
          y: 0,
          rotationDegrees: 0,
          scale: 1
        },
        renderZOrder: 0,
        activeSoundCues
      }
    }]
  };
}

describe("useHostSoundCueWorkflow", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    FakeAudio.instances = [];
    FakeAudio.blockedByAutoplayPolicy = false;
    FakeAudioContext.panners = [];
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

  it("hydrates active object cues and updates volume and pan in place by activation id", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    vi.stubGlobal("AudioContext", FakeAudioContext as unknown as typeof AudioContext);
    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const { result } = renderHook(() => useHostSoundCueWorkflow({
      hostApiClient: { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "tiny-adventure",
      audioUnlockRequired: false,
      audioLanes: {
        sfx: { muted: false, volumePercent: 100 },
        ambient: { muted: false, volumePercent: 80 }
      },
      addDiagnostic
    }));

    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession([buildActiveCue()]));
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.4);
    expect(FakeAudioContext.panners[0]?.pan.value).toBeCloseTo(-0.4);

    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession([
      buildActiveCue({ volumeMultiplier: 0.25, pan: 0.75 })
    ], "3"));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.2);
    expect(FakeAudioContext.panners[0]?.pan.value).toBeCloseTo(0.75);
  });

  it("stops removed active object cues and does not replay a seen one-time activation", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const { result } = renderHook(() => useHostSoundCueWorkflow({
      hostApiClient: { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "tiny-adventure",
      audioUnlockRequired: false,
      audioLanes: {
        sfx: { muted: false, volumePercent: 100 },
        ambient: { muted: false, volumePercent: 100 }
      },
      addDiagnostic: vi.fn()
    }));

    const oneTimeCue = buildActiveCue({ repeatMode: "None" });
    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession([oneTimeCue]));
    await Promise.resolve();
    await Promise.resolve();
    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession([], "3"));
    expect(FakeAudio.instances[0]?.pauseCalls).toBe(1);

    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession([oneTimeCue], "4"));
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it("hydrates and clears remote room object cues from the authoritative snapshot", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const { result } = renderHook(() => useHostSoundCueWorkflow({
      hostApiClient: { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "tiny-adventure",
      audioUnlockRequired: false,
      audioLanes: {
        sfx: { muted: false, volumePercent: 100 },
        ambient: { muted: false, volumePercent: 100 }
      },
      addDiagnostic: vi.fn()
    }));

    result.current.consumeSessionDeltaSoundCues({
      ...buildSessionData([]),
      remoteRoomObjects: [{
        objectId: "remote-rain",
        objectName: "Remote Rain",
        sourceRoomId: "outside",
        sourceRoomName: "Outside",
        activeSoundCues: [buildActiveCue({ activationId: "remote-activation" })]
      }]
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(1);

    result.current.consumeSessionDeltaSoundCues({ ...buildSessionData([], "3"), remoteRoomObjects: [] });
    expect(FakeAudio.instances[0]?.pauseCalls).toBe(1);
  });

  it("tracks multiple object emitters independently by activation id", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const { result } = renderHook(() => useHostSoundCueWorkflow({
      hostApiClient: { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "tiny-adventure",
      audioUnlockRequired: false,
      audioLanes: {
        sfx: { muted: false, volumePercent: 100 },
        ambient: { muted: false, volumePercent: 100 }
      },
      addDiagnostic: vi.fn()
    }));

    const cues = [
      buildActiveCue({ activationId: "activation-rain", soundEffectKey: "ambience.rain" }),
      buildActiveCue({ activationId: "activation-thunder", soundEffectKey: "ambience.thunder", pan: 0.8 }),
      buildActiveCue({ activationId: "activation-wind", soundEffectKey: "ambience.wind", volumeMultiplier: 0.3 })
    ];
    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession(cues));
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(3);
    expect(FakeAudio.instances.map((audio) => audio.playCalls)).toEqual([1, 1, 1]);

    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession(cues.slice(1), "3"));
    expect(FakeAudio.instances[0]?.pauseCalls).toBe(1);
    expect(FakeAudio.instances[1]?.pauseCalls).toBe(0);
    expect(FakeAudio.instances[2]?.pauseCalls).toBe(0);
  });

  it("keeps playback alive when the same activation moves from the local to remote snapshot", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const { result } = renderHook(() => useHostSoundCueWorkflow({
      hostApiClient: { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "tiny-adventure",
      audioUnlockRequired: false,
      audioLanes: {
        sfx: { muted: false, volumePercent: 100 },
        ambient: { muted: false, volumePercent: 100 }
      },
      addDiagnostic: vi.fn()
    }));

    const cue = buildActiveCue({ activationId: "transitioning-activation" });
    result.current.consumeSessionDeltaSoundCues(buildObjectCueSession([cue]));
    await Promise.resolve();
    await Promise.resolve();
    result.current.consumeSessionDeltaSoundCues({
      ...buildSessionData([]),
      roomObjectChanges: [{
        changeKind: "Removed",
        objectId: "rain-emitter",
        objectName: "Rain Emitter"
      }],
      remoteRoomObjects: [{
        objectId: "rain-emitter",
        objectName: "Rain Emitter",
        sourceRoomId: "outside",
        sourceRoomName: "Outside",
        activeSoundCues: [buildActiveCue({ activationId: cue.activationId, volumeMultiplier: 0.2 })]
      }]
    });

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0]?.playCalls).toBe(1);
    expect(FakeAudio.instances[0]?.pauseCalls).toBe(0);
    expect(FakeAudio.instances[0]?.volume).toBeCloseTo(0.2);
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

  it("keeps SFX and ambient lane volume controls independent for active playback", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;
    const { result, rerender } = renderHook(
      ({ sfxVolumePercent, ambientVolumePercent }) => useHostSoundCueWorkflow({
        hostApiClient,
        credentialHandle: "cred-1",
        activeSessionId: "session-1",
        selectedGameId: "game-1",
        selectedGameKey: "tiny-adventure",
        audioUnlockRequired: false,
        audioLanes: {
          sfx: { muted: false, volumePercent: sfxVolumePercent },
          ambient: { muted: false, volumePercent: ambientVolumePercent }
        },
        addDiagnostic: vi.fn()
      }),
      { initialProps: { sfxVolumePercent: 25, ambientVolumePercent: 75 } }
    );

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({ soundEffectLane: "Sfx", soundEffectKey: "sound.effect.sfx" }),
      buildCue({ soundEffectLane: "Ambient", soundEffectKey: "sound.effect.ambient", sequenceIndex: 1 })
    ], "lane-volume-1"));

    await waitFor(() => {
      expect(FakeAudio.instances).toHaveLength(2);
    });
    expect(FakeAudio.instances[0]?.volume).toBe(0.25);
    expect(FakeAudio.instances[1]?.volume).toBe(0.75);

    rerender({ sfxVolumePercent: 50, ambientVolumePercent: 10 });

    await waitFor(() => {
      expect(FakeAudio.instances[0]?.volume).toBe(0.5);
      expect(FakeAudio.instances[1]?.volume).toBe(0.1);
    });
  });

  it("mutes one lane without muting the other and keeps suppressed cue diagnostics", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const getAssetPreviewDataUrl = vi.fn().mockResolvedValue("data:audio/mpeg;base64,AAAA");
    const addDiagnostic = vi.fn();
    const hostApiClient = { getAssetPreviewDataUrl } as unknown as import("../hostApi/client").HostApiClient;

    const { result } = renderHook(() => useHostSoundCueWorkflow({
      hostApiClient,
      credentialHandle: "cred-1",
      activeSessionId: "session-1",
      selectedGameId: "game-1",
      selectedGameKey: "tiny-adventure",
      audioUnlockRequired: false,
      audioLanes: {
        sfx: { muted: true, volumePercent: 100 },
        ambient: { muted: false, volumePercent: 100 }
      },
      addDiagnostic
    }));

    result.current.consumeSessionDeltaSoundCues(buildSessionData([
      buildCue({ soundEffectLane: "Sfx", soundEffectKey: "sound.effect.muted" }),
      buildCue({ soundEffectLane: "Ambient", soundEffectKey: "sound.effect.audible", sequenceIndex: 1 })
    ], "lane-mute-1"));

    await waitFor(() => {
      expect(FakeAudio.instances).toHaveLength(2);
    });
    expect(FakeAudio.instances[0]?.volume).toBe(0);
    expect(FakeAudio.instances[1]?.volume).toBe(1);
    expect(addDiagnostic).toHaveBeenCalledWith(
      "info",
      "session-audio",
      "Accepted sound cue playback request.",
      expect.objectContaining({ lane: "Sfx", laneMuted: true })
    );
    expect(addDiagnostic).toHaveBeenCalledWith(
      "info",
      "timing-sync",
      "Sound cue playback started.",
      expect.objectContaining({ lane: "Ambient" })
    );
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
