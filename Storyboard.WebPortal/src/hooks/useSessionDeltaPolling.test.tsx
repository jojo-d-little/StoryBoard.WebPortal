/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionDeltaPolling } from "./useSessionDeltaPolling";

describe("useSessionDeltaPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("logs basic poll stats when poll returns data", async () => {
    const addDiagnostic = vi.fn();
    const getSessionDeltas = vi.fn().mockResolvedValue({
      resultCode: "Success",
      sessionData: {
        sessionDeltaWatermark: "2",
        roomObjectChanges: [{ id: "a" }],
        soundCues: [],
        outputLines: ["hello"],
        diagnostics: ["trace"],
        hasRoomChange: true,
        hasPhaseChange: false
      },
      sessionDeltaWatermark: "2",
      diagnostics: []
    });

    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline: vi.fn()
    } as unknown as import("../hostApi/client").HostApiClient;

    renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        settings: {
          pollIntervalMs: 750,
          heartbeatEveryNPolls: 100
        },
        enabled: true,
        allowInTest: true,
        addDiagnostic
      })
    );

    await waitFor(() => {
      expect(getSessionDeltas).toHaveBeenCalledTimes(1);
    });

    expect(addDiagnostic).toHaveBeenCalledWith(
      "info",
      "session-delta",
      "Session delta poll returned data.",
      expect.objectContaining({
        fromWatermark: "(none)",
        toWatermark: "2",
        roomObjectChanges: 1,
        outputLines: 1,
        diagnostics: 1
      })
    );
  });

  it("uses provided initial watermark for the first poll request", async () => {
    const addDiagnostic = vi.fn();
    const getSessionDeltas = vi.fn().mockResolvedValue({
      resultCode: "Success",
      sessionData: {
        sessionDeltaWatermark: "9",
        roomObjectChanges: [],
        soundCues: [],
        outputLines: [],
        diagnostics: [],
        hasRoomChange: false,
        hasPhaseChange: false
      },
      sessionDeltaWatermark: "9",
      diagnostics: []
    });

    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline: vi.fn()
    } as unknown as import("../hostApi/client").HostApiClient;

    renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        initialWatermark: "8",
        settings: {
          pollIntervalMs: 750,
          heartbeatEveryNPolls: 100
        },
        enabled: true,
        allowInTest: true,
        addDiagnostic
      })
    );

    await waitFor(() => {
      expect(getSessionDeltas).toHaveBeenCalledTimes(1);
    });

    expect(getSessionDeltas).toHaveBeenCalledWith(
      "cred-1",
      "session-1",
      "8",
      "Medium"
    );
  });

  it("logs every data-returning poll even when it is below the heartbeat cadence", async () => {
    const addDiagnostic = vi.fn();
    const getSessionDeltas = vi.fn().mockResolvedValue({
      resultCode: "Success",
      sessionData: {
        sessionDeltaWatermark: "2",
        roomObjectChanges: [],
        soundCues: [],
        outputLines: ["one output line"],
        diagnostics: [],
        hasRoomChange: false,
        hasPhaseChange: false
      },
      sessionDeltaWatermark: "2",
      diagnostics: []
    });

    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline: vi.fn()
    } as unknown as import("../hostApi/client").HostApiClient;

    renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        settings: {
          pollIntervalMs: 750,
          heartbeatEveryNPolls: 100
        },
        enabled: true,
        allowInTest: true,
        addDiagnostic
      })
    );

    await waitFor(() => {
      expect(getSessionDeltas).toHaveBeenCalledTimes(1);
    });

    expect(addDiagnostic).toHaveBeenCalledWith(
      "info",
      "session-delta",
      "Session delta poll returned data.",
      expect.objectContaining({ outputLines: 1 })
    );
  });

  it("emits heartbeat log on configured no-op cadence", async () => {
    vi.useFakeTimers();

    const addDiagnostic = vi.fn();
    const getSessionDeltas = vi.fn().mockResolvedValue({
      resultCode: "Success",
      sessionData: {
        sessionDeltaWatermark: "1",
        roomObjectChanges: [],
        soundCues: [],
        outputLines: [],
        diagnostics: [],
        hasRoomChange: false,
        hasPhaseChange: false
      },
      sessionDeltaWatermark: "1",
      diagnostics: []
    });

    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline: vi.fn()
    } as unknown as import("../hostApi/client").HostApiClient;

    const { unmount } = renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        settings: {
          pollIntervalMs: 100,
          heartbeatEveryNPolls: 2
        },
        enabled: true,
        allowInTest: true,
        addDiagnostic
      })
    );

    await vi.advanceTimersByTimeAsync(360);
    await Promise.resolve();

    expect(getSessionDeltas.mock.calls.length).toBeGreaterThanOrEqual(3);

    expect(addDiagnostic).toHaveBeenCalledWith(
      "info",
      "session-delta",
      "Session delta poll heartbeat (no-op).",
      expect.objectContaining({
        heartbeatEveryNPolls: 2
      })
    );

    unmount();
  });

  it("logs diagnostics-only payloads even when the watermark is unchanged", async () => {
    vi.useFakeTimers();

    const addDiagnostic = vi.fn();
    const getSessionDeltas = vi.fn().mockResolvedValue({
      resultCode: "Success",
      sessionData: {
        sessionDeltaWatermark: "",
        roomObjectChanges: [],
        soundCues: [],
        outputLines: [],
        diagnostics: ["poll trace"],
        hasRoomChange: false,
        hasPhaseChange: false
      },
      sessionDeltaWatermark: "",
      diagnostics: []
    });

    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline: vi.fn()
    } as unknown as import("../hostApi/client").HostApiClient;

    const { unmount } = renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        settings: {
          pollIntervalMs: 100,
          heartbeatEveryNPolls: 2
        },
        enabled: true,
        allowInTest: true,
        addDiagnostic
      })
    );

    await vi.advanceTimersByTimeAsync(260);
    await Promise.resolve();

    const dataLogs = addDiagnostic.mock.calls.filter((call) => call[2] === "Session delta poll returned data.");
    expect(dataLogs.length).toBeGreaterThanOrEqual(1);

    const heartbeatLogs = addDiagnostic.mock.calls.filter((call) => call[2] === "Session delta poll heartbeat (no-op).");
    expect(heartbeatLogs).toHaveLength(0);

    unmount();
  });

  it("fetches and forwards baseline when poll requires resync", async () => {
    const addDiagnostic = vi.fn();
    const onResyncBaseline = vi.fn().mockResolvedValue(undefined);
    const getSessionDeltas = vi
      .fn()
      .mockResolvedValueOnce({
        resultCode: "ResyncRequired",
        sessionData: null,
        sessionDeltaWatermark: "",
        diagnostics: ["stale watermark"]
      })
      .mockResolvedValue({
        resultCode: "Success",
        sessionData: {
          sessionDeltaWatermark: "10",
          roomObjectChanges: [],
          soundCues: [],
          outputLines: [],
          diagnostics: [],
          hasRoomChange: false,
          hasPhaseChange: false
        },
        sessionDeltaWatermark: "10",
        diagnostics: []
      });

    const baseline = {
      sessionDeltaWatermark: "9",
      soundCues: [],
      orderedTextPresentationSteps: []
    };

    const getSessionBaseline = vi.fn().mockResolvedValue(baseline);

    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline
    } as unknown as import("../hostApi/client").HostApiClient;

    renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        settings: {
          pollIntervalMs: 750,
          heartbeatEveryNPolls: 100
        },
        enabled: true,
        allowInTest: true,
        onResyncBaseline,
        addDiagnostic
      })
    );

    await waitFor(() => {
      expect(getSessionBaseline).toHaveBeenCalledTimes(1);
    });

    expect(onResyncBaseline).toHaveBeenCalledWith(baseline);
    expect(addDiagnostic).toHaveBeenCalledWith(
      "warn",
      "session-delta",
      "Session delta polling requested resync; baseline fetched.",
      expect.objectContaining({
        baselineWatermark: "9",
        pollResultCode: "ResyncRequired"
      })
    );
  });

  it("pauses without resetting the watermark and resumes from the last consumed delta", async () => {
    vi.useFakeTimers();
    let paused = false;
    const getSessionDeltas = vi.fn().mockImplementation(async () => ({
      resultCode: "Success",
      sessionData: {
        sessionDeltaWatermark: "2",
        roomObjectChanges: [],
        soundCues: [],
        outputLines: [],
        diagnostics: [],
        hasRoomChange: false,
        hasPhaseChange: false
      },
      sessionDeltaWatermark: "2",
      diagnostics: []
    }));
    const hostApiClient = {
      getSessionDeltas,
      getSessionBaseline: vi.fn()
    } as unknown as import("../hostApi/client").HostApiClient;

    const { unmount } = renderHook(() =>
      useSessionDeltaPolling({
        hostApiClient,
        credentialHandle: "cred-1",
        sessionId: "session-1",
        initialWatermark: "1",
        settings: {
          pollIntervalMs: 100,
          heartbeatEveryNPolls: 100
        },
        enabled: true,
        allowInTest: true,
        isPaused: () => paused,
        onSessionData: () => {
          paused = true;
        },
        addDiagnostic: vi.fn()
      })
    );

    await vi.advanceTimersByTimeAsync(150);
    expect(getSessionDeltas).toHaveBeenCalledTimes(1);
    expect(getSessionDeltas).toHaveBeenLastCalledWith("cred-1", "session-1", "1", "Medium");

    await vi.advanceTimersByTimeAsync(500);
    expect(getSessionDeltas).toHaveBeenCalledTimes(1);

    paused = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(getSessionDeltas.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getSessionDeltas.mock.calls[1]).toEqual(["cred-1", "session-1", "2", "Medium"]);

    unmount();
  });
});
