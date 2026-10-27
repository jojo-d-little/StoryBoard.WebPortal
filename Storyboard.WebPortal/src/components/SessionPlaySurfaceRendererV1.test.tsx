/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRESENTATION_ISOLATION_SETTINGS } from "../gameRenderer/presentationIsolation";
import type { GameRendererDiagnosticsEvent } from "../gameRenderer";
import { SessionPlaySurfaceRendererV1 } from "./SessionPlaySurfaceRendererV1";

const rendererMock = vi.hoisted(() => ({
  create: vi.fn(),
  handles: [] as Array<{ diagnosticsSink: (event: GameRendererDiagnosticsEvent) => void }>
}));

vi.mock("../gameRenderer", () => ({
  createGameRenderer: (...args: unknown[]) => rendererMock.create(...args)
}));

afterEach(() => {
  cleanup();
  rendererMock.create.mockReset();
  rendererMock.handles.length = 0;
  vi.unstubAllGlobals();
});

describe("SessionPlaySurfaceRendererV1 renderer diagnostics", () => {
  it("forwards to the current capture sink without recreating the renderer", () => {
    const rendererHandle = {
      dispose: vi.fn(),
      updateScene: vi.fn(),
      setPresentationIsolationSettings: vi.fn(),
      prepareRoomTransitionSnapshot: vi.fn(),
      setInteractionMode: vi.fn(),
      resize: vi.fn(),
      applyStyledPointEffectIntent: vi.fn()
    };
    rendererMock.create.mockImplementation((_mount, options) => {
      rendererMock.handles.push(options);
      return rendererHandle;
    });
    vi.stubGlobal("ResizeObserver", class {
      observe(): void {}
      disconnect(): void {}
    });

    const disabledCaptureSink = vi.fn();
    const enabledCaptureSink = vi.fn();
    const stoppedCaptureSink = vi.fn();
    const props = {
      activeSessionId: "session-1",
      sceneSnapshot: null,
      loadParticleEffectImage: async () => null,
      presentationIsolationSettings: DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
      roomTransitionPreparationEpoch: 0,
      gameplayInteractionSubstate: "DefaultClick" as const,
      waypointDraftCount: 0,
      waypointPointPlacementCueStyle: null,
      hasManualDismissHudOverlay: false,
      onDismissHudOverlay: vi.fn(),
      onRegisterWaypointInteractionRendererBridge: vi.fn(),
      onReportRendererDiagnostic: disabledCaptureSink,
      onReportRoomTransitionState: vi.fn(),
      onReportRendererScaleMetrics: vi.fn(),
      onReportRendererLastClickPoint: vi.fn(),
      onWaypointPointSelected: vi.fn(),
      onCommandPointSelected: vi.fn()
    };

    const { rerender } = render(<SessionPlaySurfaceRendererV1 {...props} />);
    expect(rendererMock.create).toHaveBeenCalledTimes(1);
    const originalSink = rendererMock.handles[0].diagnosticsSink;

    rerender(<SessionPlaySurfaceRendererV1 {...props} onReportRendererDiagnostic={enabledCaptureSink} />);
    originalSink({ category: "scene", level: "info", message: "capture enabled" });
    expect(enabledCaptureSink).toHaveBeenCalledTimes(1);
    expect(disabledCaptureSink).not.toHaveBeenCalled();

    rerender(<SessionPlaySurfaceRendererV1 {...props} onReportRendererDiagnostic={stoppedCaptureSink} />);
    originalSink({ category: "scene", level: "info", message: "capture stopped" });
    expect(stoppedCaptureSink).toHaveBeenCalledTimes(1);
    expect(enabledCaptureSink).toHaveBeenCalledTimes(1);
    expect(rendererMock.create).toHaveBeenCalledTimes(1);
  });
});
