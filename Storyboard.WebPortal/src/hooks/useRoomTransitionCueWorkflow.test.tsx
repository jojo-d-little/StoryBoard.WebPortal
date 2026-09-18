/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameRenderSceneSnapshot } from "../gameRenderer";
import type { GameRenderTravelDirection } from "../gameRenderer/contracts/sceneTypes";
import type { PresentationCueCatalogDocument } from "../gameRenderer/presentationCue/resolveMovementCueDuration";
import { useRoomTransitionCueWorkflow } from "./useRoomTransitionCueWorkflow";

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
    roomObjects: [],
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
} = {}) {
  const catalog = overrides.catalog ?? null;
  return {
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

describe("useRoomTransitionCueWorkflow", () => {
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

    const { result, rerender } = renderHook((props: ReturnType<typeof buildOptions>) => useRoomTransitionCueWorkflow(props), {
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
      useRoomTransitionCueWorkflow(buildOptions({ catalog, scene: buildSceneSnapshot("Up") }))
    );

    act(() => {
      result.current.setSelectedRoomTransitionCueEffectKey("room.transition.manual");
    });

    const withDurations = result.current.applyMovementCueDurations(buildSceneSnapshot("Up"));
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
      useRoomTransitionCueWorkflow(
        buildOptions({
          catalog,
          scene: buildSceneSnapshot("East", "room.transition.authored.east")
        })
      )
    );

    const applied = result.current.applyMovementCueDurations(buildSceneSnapshot("East", "room.transition.authored.east"));
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
      useRoomTransitionCueWorkflow(
        buildOptions({
          catalog,
          scene: buildSceneSnapshot("East", "room.transition.fade.blackoutswap.medium")
        })
      )
    );

    const applied = result.current.applyMovementCueDurations(
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
      useRoomTransitionCueWorkflow(
        buildOptions({
          catalog,
          scene: buildSceneSnapshot("East", "room.transition.missing")
        })
      )
    );

    const applied = result.current.applyMovementCueDurations(buildSceneSnapshot("East", "room.transition.missing"));
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
      useRoomTransitionCueWorkflow(buildOptions({ catalog, scene: buildSceneSnapshot("East") }))
    );

    const applied = result.current.applyMovementCueDurations(buildSceneSnapshot("East"));
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
      useRoomTransitionCueWorkflow(buildOptions({
        catalog,
        enabled: false,
        scene: buildSceneSnapshot("East")
      }))
    );

    const applied = result.current.applyMovementCueDurations(buildSceneSnapshot("East"));
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

    const { result, rerender } = renderHook((props: ReturnType<typeof buildOptions>) => useRoomTransitionCueWorkflow(props), {
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