/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePortalStartupAudioGate } from "./usePortalStartupAudioGate";

class FakeAudio {
  static blocked = true;
  currentTime = 0;
  preload = "";
  volume = 1;
  play = vi.fn(async (): Promise<void> => {
    if (FakeAudio.blocked) {
      throw new DOMException("Autoplay blocked", "NotAllowedError");
    }
  });
  pause = vi.fn();

  constructor(public readonly source: string) {
    void source;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeAudio.blocked = true;
});

describe("usePortalStartupAudioGate", () => {
  it("requests user action when startup playback is blocked and enables audio from the gesture retry", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    const { result } = renderHook(() => usePortalStartupAudioGate());

    await waitFor(() => {
      expect(result.current.status).toBe("needs-user-action");
      expect(result.current.startupAudioReady).toBe(false);
    });

    FakeAudio.blocked = false;
    await act(async () => {
      await result.current.enableAudio();
    });

    expect(result.current.status).toBe("enabled");
    expect(result.current.startupAudioReady).toBe(true);
  });

  it("allows the session to continue muted after startup audio is denied", async () => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    const { result } = renderHook(() => usePortalStartupAudioGate());

    await waitFor(() => {
      expect(result.current.status).toBe("needs-user-action");
    });

    act(() => {
      result.current.continueMuted();
    });

    expect(result.current.status).toBe("muted");
    expect(result.current.startupAudioReady).toBe(true);
  });
});
