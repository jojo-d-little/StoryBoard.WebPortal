/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSessionPhasePresentationWorkflow } from "./useSessionPhasePresentationWorkflow";
import type { HostSessionDataEnvelope } from "../hostApi/HostContracts";

function createBaseSessionData(): HostSessionDataEnvelope {
  return {
    sessionDeltaWatermark: "1",
    roomObjectChanges: [],
    soundCues: [],
    outputLines: [],
    diagnostics: [],
    orderedTextPresentationSteps: [],
    hasRoomChange: false,
    hasPhaseChange: true,
    phaseChange: {
      reason: "advance",
      newPhase: {
        phaseId: "phase-1",
        pathDisplayName: "Book/Chapter/Page",
        book: {
          nodeId: "book-1",
          displayName: "Book 1",
          title: "",
          prologue: "",
          narrative: ""
        },
        chapter: {
          nodeId: "chapter-1",
          displayName: "Chapter 1",
          title: "",
          prologue: "",
          narrative: ""
        },
        page: {
          nodeId: "page-1",
          displayName: "Page 1",
          title: "",
          prologue: "",
          narrative: ""
        }
      },
      orderedTextPresentationSteps: []
    }
  };
}

describe("useSessionPhasePresentationWorkflow", () => {
  it("routes echo and hud targets from ordered phase text steps", () => {
    const addDiagnostic = vi.fn();
    const appendSessionOutputLines = vi.fn();

    const { result } = renderHook(() =>
      useSessionPhasePresentationWorkflow({
        activeSessionId: "session-1",
        addDiagnostic,
        appendSessionOutputLines,
        resolveTextPresentationCue: (step) => {
          const effectKey = step.effectKey ?? step.presentationCueEffectKey ?? "";
          if (effectKey === "text.echo.page") {
            return { target: "echo" as const, isManualDismiss: false };
          }

          if (effectKey === "text.hud.page") {
            return { target: "hud-overlay" as const, isManualDismiss: true, durationMs: 0 };
          }

          return null;
        }
      })
    );

    const sessionData = createBaseSessionData();
    sessionData.orderedTextPresentationSteps = [
      {
        category: "Text",
        effectKey: "text.echo.page",
        bodyText: "Echo line",
        presentationCueEffectKey: "text.echo.page"
      },
      {
        category: "Text",
        effectKey: "text.hud.page",
        bodyText: "HUD line",
        presentationCueEffectKey: "text.hud.page"
      }
    ];

    act(() => {
      result.current.consumeSessionDeltaPhasePresentation(sessionData);
    });

    expect(appendSessionOutputLines).toHaveBeenCalledWith(["Echo line"], "phase-step");
    expect(result.current.hudOverlayEntries).toHaveLength(1);
    expect(result.current.hudOverlayEntries[0].text).toBe("HUD line");
    expect(result.current.hudOverlayEntries[0].isManualDismiss).toBe(true);

    act(() => {
      result.current.dismissHudOverlay();
    });

    expect(result.current.hudOverlayEntries).toHaveLength(0);
  });

  it("skips duplicate phase payloads for unchanged watermark", () => {
    const appendSessionOutputLines = vi.fn();

    const { result } = renderHook(() =>
      useSessionPhasePresentationWorkflow({
        activeSessionId: "session-1",
        addDiagnostic: vi.fn(),
        appendSessionOutputLines,
        resolveTextPresentationCue: () => ({ target: "echo" as const, isManualDismiss: false })
      })
    );

    const sessionData = createBaseSessionData();
    sessionData.orderedTextPresentationSteps = [
      {
        category: "Text",
        effectKey: "text.echo.page",
        bodyText: "Only once",
        presentationCueEffectKey: "text.echo.page"
      }
    ];

    act(() => {
      result.current.consumeSessionDeltaPhasePresentation(sessionData);
      result.current.consumeSessionDeltaPhasePresentation(sessionData);
    });

    expect(appendSessionOutputLines).toHaveBeenCalledTimes(1);
  });

  it("projects HudFullscreen cue metadata to HUD overlay entry", () => {
    const { result } = renderHook(() =>
      useSessionPhasePresentationWorkflow({
        activeSessionId: "session-1",
        addDiagnostic: vi.fn(),
        appendSessionOutputLines: vi.fn(),
        resolveTextPresentationCue: () => ({
          target: "hud-overlay" as const,
          isManualDismiss: false,
          layoutMode: "fullscreen",
          backdropMode: "solid",
          backdropOpacity: 0.72,
          titleFontSizePx: 42,
          bodyFontSizePx: 26,
          transitionStyle: "fade",
          motionInMs: 400,
          motionOutMs: 300,
          durationMs: 1200
        })
      })
    );

    const sessionData = createBaseSessionData();
    sessionData.orderedTextPresentationSteps = [
      {
        category: "Text",
        effectKey: "text.hud.fullscreen.page",
        titleText: "Alert",
        bodyText: "Important narrative beat.",
        presentationCueEffectKey: "text.hud.fullscreen.page"
      }
    ];

    act(() => {
      result.current.consumeSessionDeltaPhasePresentation(sessionData);
    });

    expect(result.current.hudOverlayEntries).toHaveLength(1);
    expect(result.current.hudOverlayEntries[0]).toMatchObject({
      text: "Alert\n\nImportant narrative beat.",
      titleText: "Alert",
      bodyText: "Important narrative beat.",
      layoutMode: "fullscreen",
      backdropMode: "solid",
      backdropOpacity: 0.72,
      panelOpacity: 0.95,
      panelBorderThicknessPx: 2,
      titleFontSizePx: 42,
      bodyFontSizePx: 26,
      transitionStyle: "fade",
      motionInMs: 400,
      motionOutMs: 300,
      isManualDismiss: false
    });
  });
});
