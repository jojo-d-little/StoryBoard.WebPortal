/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameRenderSceneSnapshot } from "../gameRenderer";
import type { GameRenderTravelDirection } from "../gameRenderer/contracts/sceneTypes";
import type { PresentationCueCatalogDocument } from "../gameRenderer/contracts/presentationEffects";
import { usePresentationCueWorkflow } from "./usePresentationCueWorkflow";

function buildSceneSnapshot(
  travelDirection: GameRenderTravelDirection,
  roomTransitionCueEffectKey?: string
): GameRenderSceneSnapshot {
  return {
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [],
    objectsById: {},
    roomTransition: {
      travelDirection,
      cueEffectKey: roomTransitionCueEffectKey
    }
  };
}

function buildCatalog(effects: PresentationCueCatalogDocument["effects"]): PresentationCueCatalogDocument {
  return {
    schemaVersion: "1.0",
    effects: effects ?? []
  };
}

function buildOptions(overrides: {
  catalog?: PresentationCueCatalogDocument | null;
  scene?: GameRenderSceneSnapshot | null;
  enabled?: boolean;
  respectTravelDirection?: boolean;
  presentationCueCatalogRevision?: number;
  activeSessionId?: string;
} = {}) {
  const catalog = overrides.catalog ?? null;
  return {
    activeSessionId: overrides.activeSessionId ?? "session-1",
    roomTransitionDefaults: {
      enabled: overrides.enabled ?? true,
      cueCategory: "RoomTransition",
      cueEffectKey: "room.transition.default",
      cueEffectKeyOverridesByTravelDirection: {
        Up: "room.transition.vertical.up",
        Down: "room.transition.vertical.down"
      },
      respectTravelDirection: overrides.respectTravelDirection ?? true,
      fallbackDurationMs: 650
    },
    presentationCueCatalogRelativeLocator: "catalog/presentation-cues.json",
    selectedGameId: "game-1",
    selectedGameKey: "tiny-adventure",
    presentationCueCatalogRevision: overrides.presentationCueCatalogRevision ?? 1,
    presentationCueCatalogSource: "network" as const,
    presentationCueCatalogError: "",
    rendererSceneSnapshot: overrides.scene ?? buildSceneSnapshot("East"),
    getCurrentPresentationCueCatalog: () => catalog
  };
}

function buildWindowCueScene(appearanceActivationId: string, lightingActivationId: string): GameRenderSceneSnapshot {
  return {
    ...buildSceneSnapshot("East"),
    objectsById: {
      window: {
        objectId: "window",
        objectName: "WindowPanes",
        sprite: {
          asset: { assetPath: "window.png", cacheKey: "window.png" },
          x: 0,
          y: 0,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 1
        },
        activePresentationCues: [
          { category: "", effectKey: "appearance.overlay.lightning", activationId: appearanceActivationId },
          { category: "", effectKey: "lighting.point-light.lightning.timeline", activationId: lightingActivationId }
        ]
      }
    }
  };
}

describe("usePresentationCueWorkflow", () => {
  it("plays unseen active timeline activations from snapshots once and shares their start time", () => {
    const catalog = buildCatalog([
      {
        category: "Appearance",
        effectKey: "appearance.overlay.lightning",
        appearanceColorOverlayTimelineStyle: {
          maskPolicy: "sourceCoverage",
          blendMode: "add",
          timeline: { frames: [{ atMs: 0, color: "#ffffff", strength: 1 }, { atMs: 120, color: "#ffffff", strength: 0 }] }
        }
      },
      {
        category: "Lighting",
        effectKey: "lighting.point-light.lightning.timeline",
        pointLightTimelineStyle: {
          timeline: { frames: [{ atMs: 0, intensity: 1 }, { atMs: 120, intensity: 0 }] }
        }
      }
    ]);
    const { result, rerender } = renderHook((props: ReturnType<typeof buildOptions>) => usePresentationCueWorkflow(props), {
      initialProps: buildOptions({ catalog, scene: buildWindowCueScene("appearance-1", "lighting-1") })
    });
    const clock = vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(300);
    const readTimelineStarts = (scene: GameRenderSceneSnapshot): number[] => {
      const effects = scene.objectsById.window.resolvedObjectEffects ?? [];
      return effects
        .filter((effect) => effect.kind === "appearanceColorOverlayTimelineStyle" || effect.kind === "pointLightTimelineStyle")
        .map((effect) => effect.timelineStartAtMs);
    };

    const initial = result.current.applyPresentationCues(buildWindowCueScene("appearance-1", "lighting-1"));
    expect(readTimelineStarts(initial)).toEqual([100, 100]);
    expect(initial.objectsById.window.activePresentationCues.map((cue) => cue.activationStartAtMs)).toEqual([100, 100]);

    const repeated = result.current.applyPresentationCues(buildWindowCueScene("appearance-1", "lighting-1"));
    expect(readTimelineStarts(repeated)).toEqual([100, 100]);

    const retriggered = result.current.applyPresentationCues(buildWindowCueScene("appearance-2", "lighting-2"));
    expect(readTimelineStarts(retriggered)).toEqual([200, 200]);

    rerender(buildOptions({ activeSessionId: "session-2", catalog }));
    const newSession = result.current.applyPresentationCues(buildWindowCueScene("appearance-1", "lighting-1"));
    const newSessionStarts = readTimelineStarts(newSession);
    expect(newSessionStarts[0]).toBe(newSessionStarts[1]);
    expect(newSessionStarts[0]).toBeGreaterThan(200);
    clock.mockRestore();
  });

  it("assigns movement activations a stable one-time acceptance origin", () => {
    const { result } = renderHook(() => usePresentationCueWorkflow(buildOptions()));
    const clock = vi.spyOn(performance, "now").mockReturnValueOnce(450).mockReturnValueOnce(500);
    const buildMovementScene = (activationId: string): GameRenderSceneSnapshot => ({
      ...buildSceneSnapshot("East"),
      objectsById: {
        mover: {
          objectId: "mover",
          objectName: "Mover",
          sprite: {
            asset: { assetPath: "mover.png", cacheKey: "mover.png" },
            x: 100,
            y: 100,
            rotationDegrees: 0,
            scale: 1,
            zOrder: 1
          },
          activePresentationCues: [{
            category: "Movement",
            effectKey: "movement.walk",
            activationId,
            movementDurationMs: 300
          }]
        }
      }
    });

    const startFor = (activationId: string): number | undefined => {
      return result.current.applyPresentationCues(buildMovementScene(activationId))
        .objectsById.mover.activePresentationCues[0]?.activationStartAtMs;
    };

    expect(startFor("move-1")).toBe(450);
    expect(startFor("move-1")).toBe(450);
    expect(startFor("move-2")).toBe(500);
    clock.mockRestore();
  });

  it("uses directional overrides for vertical travel and falls back to default for planar travel", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        displayName: "Default Slide",
        roomTransitionPresentation: { mode: "DirectionalSlide" },
        movementInterpolation: {
          frameCount: 10,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.vertical.up",
        displayName: "Climb",
        roomTransitionPresentation: { mode: "CrossFade" },
        movementInterpolation: {
          frameCount: 8,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.vertical.down",
        displayName: "Descend",
        roomTransitionPresentation: { mode: "DirectionalSlide" },
        movementInterpolation: {
          frameCount: 9,
          secondsPerFrame: 0.1
        }
      }
    ]);

    const { result, rerender } = renderHook((props: ReturnType<typeof buildOptions>) => usePresentationCueWorkflow(props), {
      initialProps: buildOptions({ catalog, scene: buildSceneSnapshot("Up") })
    });

    expect(result.current.roomTransitionCatalogStatus.selectedCueEffectKey).toBe("room.transition.vertical.up");
    expect(result.current.roomTransitionCatalogStatus.selectedCueDurationMs).toBe(800);

    rerender(buildOptions({ catalog, scene: buildSceneSnapshot("East") }));
    expect(result.current.roomTransitionCatalogStatus.selectedCueEffectKey).toBe("room.transition.default");
    expect(result.current.roomTransitionCatalogStatus.selectedCueDurationMs).toBe(1000);
  });

  it("prefers manually selected cue effect key over directional default/override", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        movementInterpolation: {
          frameCount: 10,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.vertical.up",
        movementInterpolation: {
          frameCount: 8,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.manual",
        roomTransitionPresentation: { mode: "CrossFade" },
        movementInterpolation: {
          frameCount: 7,
          secondsPerFrame: 0.1
        }
      }
    ]);

    const { result } = renderHook(() =>
      usePresentationCueWorkflow(buildOptions({ catalog, scene: buildSceneSnapshot("Up") }))
    );

    act(() => {
      result.current.setSelectedRoomTransitionCueEffectKey("room.transition.manual");
    });

    const withDurations = result.current.applyPresentationCues(buildSceneSnapshot("Up"));
    expect(withDurations.roomTransition?.cueEffectKey).toBe("room.transition.manual");
    expect(withDurations.roomTransition?.durationMs).toBe(700);
    expect(withDurations.roomTransition?.mode).toBe("fade");
  });

  it("uses runtime-authored room transition cue effect when present and catalog-resolved", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        roomTransitionPresentation: { mode: "DirectionalSlide" },
        movementInterpolation: {
          frameCount: 10,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.authored.east",
        roomTransitionPresentation: { mode: "CrossFade" },
        movementInterpolation: {
          frameCount: 11,
          secondsPerFrame: 0.1
        }
      }
    ]);

    const { result } = renderHook(() =>
      usePresentationCueWorkflow(
        buildOptions({
          catalog,
          scene: buildSceneSnapshot("East", "room.transition.authored.east")
        })
      )
    );

    const applied = result.current.applyPresentationCues(buildSceneSnapshot("East", "room.transition.authored.east"));
    expect(result.current.roomTransitionCatalogStatus.selectedCueEffectKey).toBe("room.transition.authored.east");
    expect(result.current.roomTransitionCatalogStatus.selectedCueDurationMs).toBe(1100);
    expect(applied.roomTransition?.cueEffectKey).toBe("room.transition.authored.east");
    expect(applied.roomTransition?.durationMs).toBe(1100);
    expect(applied.roomTransition?.mode).toBe("fade");
  });

  it("maps blackout-swap transition mode when selected effect key uses BlackoutSwapFade", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        roomTransitionPresentation: { mode: "DirectionalSlide" },
        movementInterpolation: {
          frameCount: 10,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.fade.blackoutswap.medium",
        roomTransitionPresentation: { mode: "BlackoutSwapFade" },
        movementInterpolation: {
          frameCount: 12,
          secondsPerFrame: 0.1
        }
      }
    ]);

    const { result } = renderHook(() =>
      usePresentationCueWorkflow(
        buildOptions({
          catalog,
          scene: buildSceneSnapshot("East", "room.transition.fade.blackoutswap.medium")
        })
      )
    );

    const applied = result.current.applyPresentationCues(
      buildSceneSnapshot("East", "room.transition.fade.blackoutswap.medium")
    );
    expect(result.current.roomTransitionCatalogStatus.selectedCueEffectKey).toBe("room.transition.fade.blackoutswap.medium");
    expect(applied.roomTransition?.mode).toBe("fade-blackout");
    expect(applied.roomTransition?.durationMs).toBe(1200);
  });

  it("falls back to configured defaults when runtime-authored room transition cue is unresolved", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        roomTransitionPresentation: { mode: "DirectionalSlide" },
        movementInterpolation: {
          frameCount: 10,
          secondsPerFrame: 0.1
        }
      }
    ]);

    const { result } = renderHook(() =>
      usePresentationCueWorkflow(
        buildOptions({
          catalog,
          scene: buildSceneSnapshot("East", "room.transition.missing")
        })
      )
    );

    const applied = result.current.applyPresentationCues(buildSceneSnapshot("East", "room.transition.missing"));
    expect(result.current.roomTransitionCatalogStatus.selectedCueEffectKey).toBe("room.transition.default");
    expect(result.current.roomTransitionCatalogStatus.selectedCueDurationMs).toBe(1000);
    expect(applied.roomTransition?.cueEffectKey).toBe("room.transition.default");
    expect(applied.roomTransition?.durationMs).toBe(1000);
    expect(applied.roomTransition?.mode).toBe("slide");
  });

  it("uses fallback duration when transitions are enabled and catalog cue duration is missing", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        roomTransitionPresentation: { mode: "DirectionalSlide" }
      }
    ]);

    const { result } = renderHook(() =>
      usePresentationCueWorkflow(buildOptions({ catalog, scene: buildSceneSnapshot("East") }))
    );

    const applied = result.current.applyPresentationCues(buildSceneSnapshot("East"));
    expect(result.current.roomTransitionCatalogStatus.usingFallbackDuration).toBe(true);
    expect(result.current.roomTransitionCatalogStatus.selectedCueDurationMs).toBeUndefined();
    expect(applied.roomTransition?.durationMs).toBe(650);
    expect(applied.roomTransition?.mode).toBe("slide");
  });

  it("does not set transition duration when transitions are disabled", () => {
    const catalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.default",
        roomTransitionPresentation: { mode: "CrossFade" },
        movementInterpolation: {
          frameCount: 9,
          secondsPerFrame: 0.1
        }
      }
    ]);

    const { result } = renderHook(() =>
      usePresentationCueWorkflow(buildOptions({
        catalog,
        enabled: false,
        scene: buildSceneSnapshot("East")
      }))
    );

    const applied = result.current.applyPresentationCues(buildSceneSnapshot("East"));
    expect(applied.roomTransition?.cueCategory).toBe("RoomTransition");
    expect(applied.roomTransition?.cueEffectKey).toBe("room.transition.default");
    expect(applied.roomTransition?.mode).toBe("fade");
    expect(applied.roomTransition?.durationMs).toBeUndefined();
  });

  it("resets selected cue when catalog changes and selected key disappears", async () => {
    const firstCatalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.alpha",
        displayName: "Alpha"
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.beta",
        displayName: "Beta"
      }
    ]);

    const secondCatalog = buildCatalog([
      {
        category: "RoomTransition",
        effectKey: "room.transition.alpha",
        displayName: "Alpha"
      }
    ]);

    const { result, rerender } = renderHook((props: ReturnType<typeof buildOptions>) => usePresentationCueWorkflow(props), {
      initialProps: buildOptions({
        catalog: firstCatalog,
        presentationCueCatalogRevision: 1
      })
    });

    act(() => {
      result.current.setSelectedRoomTransitionCueEffectKey("room.transition.beta");
    });
    expect(result.current.selectedRoomTransitionCueEffectKey).toBe("room.transition.beta");

    rerender(buildOptions({
      catalog: secondCatalog,
      presentationCueCatalogRevision: 2
    }));

    await waitFor(() => {
      expect(result.current.selectedRoomTransitionCueEffectKey).toBe("room.transition.alpha");
    });
  });
});
