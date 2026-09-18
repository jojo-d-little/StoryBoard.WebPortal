import { describe, expect, it } from "vitest";
import {
  resolveAppearanceSilhouetteStyle,
  resolveAppearanceOutlineStyle,
  resolveCatalogCueDurationMs,
  resolveCatalogStyledPointEffect,
  resolveCatalogTextPresentationCue,
  resolveHostTextPresentationCue,
  resolveCatalogRoomTransitionMode,
  resolveMovementCueDurationMs,
  type PresentationCueCatalogDocument
} from "./resolveMovementCueDuration";

describe("resolveMovementCueDurationMs", () => {
  const catalog: PresentationCueCatalogDocument = {
    effects: [
      {
        category: "Movement",
        effectKey: "movement.speed.quantum",
        movementInterpolation: {
          frameCount: 1,
          secondsPerFrame: 0
        }
      },
      {
        category: "Movement",
        effectKey: "movement.speed.fast",
        movementInterpolation: {
          frameCount: 12,
          secondsPerFrame: 0.1
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.slide.directional.medium",
        roomTransitionPresentation: {
          mode: "DirectionalSlide"
        },
        movementInterpolation: {
          frameCount: 14,
          secondsPerFrame: 0.06
        }
      },
      {
        category: "RoomTransition",
        effectKey: "room.transition.fade.cross.medium",
        roomTransitionPresentation: {
          mode: "CrossFade"
        },
        movementInterpolation: {
          frameCount: 14,
          secondsPerFrame: 0.06
        }
      },
      {
        category: "Text",
        effectKey: "text.overlay.page",
        textPresentation: {
          where: "HudEdgeCard",
          how: "FadeIn",
          dismissMode: "Manual",
          motionInMs: 350,
          motionOutMs: 220,
          displayDurationMs: 0
        }
      },
      {
        category: "Text",
        effectKey: "text.echo.chapter",
        textPresentation: {
          where: "Echo",
          how: "append"
        }
      },
      {
        category: "Appearance",
        effectKey: "appearance.selection.outline.cyan",
        appearanceOutlineStyle: {
          outlineColorHex: "#22D3EE",
          outlineThickness: 2,
          pulseMs: 350
        }
      },
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan",
        appearanceSilhouetteStyle: {
          sourceToSilhouette: {
            imageToSilhouetteMask: {
              policy: "soft",
              cutoff: 0
            }
          },
          animation: {
            pulseMs: 350
          },
          passes: [
            {
              name: "primary",
              blendMode: "normal",
              colorStops: ["#22D3EE", "#A5F3FC"],
              scaleStops: [1.04, 1.1]
            }
          ]
        }
      }
    ]
  };

  it("returns undefined when movement cue is absent", () => {
    const duration = resolveMovementCueDurationMs([
      {
        category: "Appearance",
        effectKey: "appearance.selection.outline.cyan"
      }
    ], catalog);

    expect(duration).toBeUndefined();
  });

  it("resolves appearance outline style from appearance cue and catalog effect", () => {
    const style = resolveAppearanceOutlineStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.outline.cyan"
      }
    ], catalog);

    expect(style).toEqual({
      outlineColorHex: "#22D3EE",
      outlineThickness: 2,
      pulseMs: 350
    });
  });

  it("returns undefined when appearance cue has no matching outline style", () => {
    const style = resolveAppearanceOutlineStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.outline.unknown"
      }
    ], catalog);

    expect(style).toBeUndefined();
  });

  it("resolves appearance silhouette style stop arrays from cue catalog", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], catalog);

    expect(style).toEqual({
      maskAlphaMode: "soft",
      maskAlphaCutoff: 0,
      pulseMs: 350,
      passes: [
        {
          name: "primary",
          enabled: true,
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC"],
          scaleMultiplierStops: [1.04, 1.1]
        }
      ]
    });
  });

  it("resolves explicit dual-pass silhouette style layout", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.explicit"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.explicit",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {
              imageToSilhouetteMask: {
                policy: "binary",
                cutoff: 0.24
              }
            },
            animation: {
              pulseMs: 900
            },
            passes: [
              {
                name: "core",
                blendMode: "normal",
                colorStops: ["#00FFFF"],
                scaleStops: [1.06],
                alphaStops: [0.9]
              },
              {
                name: "halo",
                blendMode: "neon",
                colorStops: ["#00FFFF", "#00FF52"],
                scaleStops: [1.15, 1.2],
                alphaStops: [1]
              }
            ]
          }
        }
      ]
    });

    expect(style).toEqual({
      maskAlphaMode: "binary",
      maskAlphaCutoff: 0.24,
      pulseMs: 900,
      passes: [
        {
          name: "core",
          enabled: true,
          blendMode: "normal",
          colorHexStops: ["#00FFFF"],
          scaleMultiplierStops: [1.06],
          alphaStops: [0.9]
        },
        {
          name: "halo",
          enabled: true,
          blendMode: "neon",
          colorHexStops: ["#00FFFF", "#00FF52"],
          scaleMultiplierStops: [1.15, 1.2],
          alphaStops: [1]
        }
      ]
    });
  });

  it("ignores legacy silhouette render mode and keeps solid-mask behavior", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.tinted"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.tinted",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {
              imageToSilhouetteMask: {
                policy: "soft",
                cutoff: 0
              }
            },
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                name: "tint",
                blendMode: "normal",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1]
              }
            ]
          }
        }
      ]
    });

    expect(style).toEqual({
      maskAlphaMode: "soft",
      maskAlphaCutoff: 0,
      pulseMs: 350,
      passes: [
        {
          name: "tint",
          enabled: true,
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC"],
          scaleMultiplierStops: [1.04, 1.1]
        }
      ]
    });
  });

  it("resolves optional silhouette alpha stops when provided by catalog", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.cyan",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {},
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                name: "main",
                blendMode: "normal",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1],
                alphaStops: [0.35, 0.95]
              }
            ]
          }
        }
      ]
    });

    expect(style).toEqual({
      maskAlphaMode: "soft",
      maskAlphaCutoff: 0,
      pulseMs: 350,
      passes: [
        {
          name: "main",
          enabled: true,
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC"],
          scaleMultiplierStops: [1.04, 1.1],
          alphaStops: [0.35, 0.95]
        }
      ]
    });
  });

  it("resolves silhouette blend mode when provided by catalog", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.cyan",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {},
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                name: "main",
                blendMode: "neon",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1]
              }
            ]
          }
        }
      ]
    });

    expect(style).toEqual({
      maskAlphaMode: "soft",
      maskAlphaCutoff: 0,
      pulseMs: 350,
      passes: [
        {
          name: "main",
          enabled: true,
          blendMode: "neon",
          colorHexStops: ["#22D3EE", "#A5F3FC"],
          scaleMultiplierStops: [1.04, 1.1]
        }
      ]
    });
  });

  it("resolves binary silhouette mask alpha policy when provided by catalog", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.cyan",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {
              imageToSilhouetteMask: {
                policy: "binary",
                cutoff: 0.2
              }
            },
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                name: "main",
                blendMode: "normal",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1]
              }
            ]
          }
        }
      ]
    });

    expect(style).toEqual({
      maskAlphaMode: "binary",
      maskAlphaCutoff: 0.2,
      pulseMs: 350,
      passes: [
        {
          name: "main",
          enabled: true,
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC"],
          scaleMultiplierStops: [1.04, 1.1]
        }
      ]
    });
  });

  it("falls back to normal blend when blend mode is invalid", () => {
    const addAlias = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.cyan",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {},
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                blendMode: "add",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1]
              }
            ]
          }
        }
      ]
    });

    const screenAlias = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.cyan",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {},
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                blendMode: "screen",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1]
              }
            ]
          }
        }
      ]
    });

    expect(addAlias?.passes[0]?.blendMode).toBe("normal");
    expect(screenAlias?.passes[0]?.blendMode).toBe("normal");
  });

  it("ignores invalid silhouette alpha stops and keeps legacy alpha behavior", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.cyan"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.cyan",
          appearanceSilhouetteStyle: {
            sourceToSilhouette: {},
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                name: "main",
                blendMode: "normal",
                colorStops: ["#22D3EE", "#A5F3FC"],
                scaleStops: [1.04, 1.1],
                alphaStops: [-0.2, 3]
              }
            ]
          }
        }
      ]
    });

    expect(style).toEqual({
      maskAlphaMode: "soft",
      maskAlphaCutoff: 0,
      pulseMs: 350,
      passes: [
        {
          name: "main",
          enabled: true,
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC"],
          scaleMultiplierStops: [1.04, 1.1]
        }
      ]
    });
  });

  it("returns undefined when silhouette style lacks valid stops", () => {
    const style = resolveAppearanceSilhouetteStyle([
      {
        category: "Appearance",
        effectKey: "appearance.selection.silhouette.invalid"
      }
    ], {
      effects: [
        {
          category: "Appearance",
          effectKey: "appearance.selection.silhouette.invalid",
          appearanceSilhouetteStyle: {
            animation: {
              pulseMs: 350
            },
            passes: [
              {
                blendMode: "normal",
                colorStops: ["not-a-color"],
                scaleStops: [1]
              }
            ]
          }
        }
      ]
    });

    expect(style).toBeUndefined();
  });

  it("resolves movement duration from cue catalog", () => {
    const duration = resolveMovementCueDurationMs([
      {
        category: "Movement",
        effectKey: "movement.speed.fast"
      }
    ], catalog);

    expect(duration).toBe(1200);
  });

  it("returns zero for quantum-style movement cues", () => {
    const duration = resolveMovementCueDurationMs([
      {
        category: "movement",
        effectKey: "movement.speed.quantum"
      }
    ], catalog);

    expect(duration).toBe(0);
  });

  it("returns undefined when catalog effect is missing interpolation fields", () => {
    const duration = resolveMovementCueDurationMs([
      {
        category: "Movement",
        effectKey: "movement.speed.fast"
      }
    ], {
      effects: [
        {
          category: "Movement",
          effectKey: "movement.speed.fast"
        }
      ]
    });

    expect(duration).toBeUndefined();
  });

  it("resolves explicit DirectionalSlide mode from room-transition catalog cue", () => {
    const mode = resolveCatalogRoomTransitionMode(
      catalog,
      "RoomTransition",
      "room.transition.slide.directional.medium"
    );

    expect(mode).toBe("slide");
  });

  it("resolves explicit CrossFade mode from room-transition catalog cue", () => {
    const mode = resolveCatalogRoomTransitionMode(
      catalog,
      "RoomTransition",
      "room.transition.fade.cross.medium"
    );

    expect(mode).toBe("fade");
  });

  it("resolves explicit BlackoutSwapFade mode from room-transition catalog cue", () => {
    const mode = resolveCatalogRoomTransitionMode(
      {
        effects: [
          {
            category: "RoomTransition",
            effectKey: "room.transition.fade.blackoutswap.medium",
            roomTransitionPresentation: {
              mode: "BlackoutSwapFade"
            }
          }
        ]
      },
      "RoomTransition",
      "room.transition.fade.blackoutswap.medium"
    );

    expect(mode).toBe("fade-blackout");
  });

  it("resolves duration for configured room-transition catalog cue", () => {
    const duration = resolveCatalogCueDurationMs(
      catalog,
      "RoomTransition",
      "room.transition.slide.directional.medium"
    );

    expect(duration).toBe(840);
  });

  it("returns undefined when configured cue category/effect are not present", () => {
    const duration = resolveCatalogCueDurationMs(
      catalog,
      "RoomTransition",
      "room.transition.slide.directional.fast"
    );

    expect(duration).toBeUndefined();
  });

  it("resolves text hud overlay cue target and duration", () => {
    const cue = resolveCatalogTextPresentationCue(catalog, "text.overlay.page");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: true,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "fade",
      motionInMs: 350,
      motionOutMs: 220,
      durationMs: 0
    });
  });

  it("resolves text echo cue target with default duration", () => {
    const cue = resolveCatalogTextPresentationCue(catalog, "text.echo.chapter");

    expect(cue).toEqual({
      target: "echo",
      isManualDismiss: false,
      transitionStyle: "none",
      motionInMs: undefined,
      motionOutMs: undefined,
      durationMs: undefined
    });
  });

  it("resolves text target from where field", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.from.where",
          textPresentation: {
            where: "HudFullscreen",
            panelOpacity: 0.25,
            panelBorderThicknessPx: 0,
            displayDurationMs: 1500
          }
        }
      ]
    }, "text.hud.from.where");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: false,
      layoutMode: "fullscreen",
      backdropMode: "dim",
      panelOpacity: 0.25,
      panelBorderThicknessPx: 0,
      transitionStyle: "none",
      motionInMs: undefined,
      motionOutMs: undefined,
      durationMs: 1500
    });
  });

  it("treats dismissMode Manual as manual even when duration is omitted", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.manual.omitted-duration",
          textPresentation: {
            where: "HudEdgeCard",
            dismissMode: "Manual"
          }
        }
      ]
    }, "text.hud.manual.omitted-duration");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: true,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "none",
      motionInMs: undefined,
      motionOutMs: undefined,
      durationMs: undefined
    });
  });

  it("falls back to legacy durationMs for cached catalog payloads", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.legacy.duration",
          textPresentation: {
            where: "HudEdgeCard",
            durationMs: 0
          }
        }
      ]
    }, "text.hud.legacy.duration");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: true,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "none",
      motionInMs: undefined,
      motionOutMs: undefined,
      durationMs: 0
    });
  });

  it("resolves fade transition from FadeOut how token", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.fadeout",
          textPresentation: {
            where: "HudEdgeCard",
            how: "FadeOut",
            dismissMode: "Auto",
            displayDurationMs: 1200,
            motionOutMs: 300
          }
        }
      ]
    }, "text.hud.fadeout");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: false,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "fade",
      motionInMs: undefined,
      motionOutMs: 300,
      durationMs: 1200
    });
  });

  it("applies default fade-in timing when FadeIn omits motionInMs", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.fadein.defaults",
          textPresentation: {
            where: "HudEdgeCard",
            how: "FadeIn",
            dismissMode: "Auto",
            displayDurationMs: 1800
          }
        }
      ]
    }, "text.hud.fadein.defaults");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: false,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "fade",
      motionInMs: 240,
      motionOutMs: undefined,
      durationMs: 1800
    });
  });

  it("applies default fade-out timing when FadeOut omits motionOutMs", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.fadeout.defaults",
          textPresentation: {
            where: "HudEdgeCard",
            how: "FadeOut",
            dismissMode: "Auto",
            displayDurationMs: 1800
          }
        }
      ]
    }, "text.hud.fadeout.defaults");

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: false,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "fade",
      motionInMs: undefined,
      motionOutMs: 220,
      durationMs: 1800
    });
  });

  it("returns null when where is missing", () => {
    const cue = resolveCatalogTextPresentationCue({
      effects: [
        {
          category: "Text",
          effectKey: "text.where.required",
          textPresentation: {
            displayDurationMs: 300
          }
        }
      ]
    }, "text.where.required");

    expect(cue).toBeNull();
  });

  it("prefers host step payload for fade-in metadata before catalog fallback", () => {
    const cue = resolveHostTextPresentationCue({
      category: "Text",
      effectKey: "text.hudoverlay.fadein.auto.2500",
      bodyText: "HUD text",
      where: "HudEdgeCard",
      how: "FadeIn",
      dismissMode: "Auto",
      displayDurationMs: 5000,
      motionInMs: 500,
      motionOutMs: 500
    }, {
      effects: []
    });

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: false,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "fade",
      motionInMs: 500,
      motionOutMs: 500,
      durationMs: 5000
    });
  });

  it("falls back to catalog lookup when host step omits where/how", () => {
    const cue = resolveHostTextPresentationCue({
      category: "Text",
      effectKey: "text.overlay.page",
      bodyText: "HUD text"
    }, catalog);

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: true,
      layoutMode: "edge-card",
      backdropMode: "dim",
      transitionStyle: "fade",
      motionInMs: 350,
      motionOutMs: 220,
      durationMs: 0
    });
  });

  it("merges catalog style metadata when host step omits optional panel fields", () => {
    const cue = resolveHostTextPresentationCue({
      category: "Text",
      effectKey: "text.hud.fullscreen.clean",
      bodyText: "HUD text",
      where: "HudFullscreen",
      how: "ManualScroll",
      dismissMode: "Manual",
      displayDurationMs: 0
    }, {
      effects: [
        {
          category: "Text",
          effectKey: "text.hud.fullscreen.clean",
          textPresentation: {
            where: "HudFullscreen",
            how: "ManualScroll",
            dismissMode: "Manual",
            displayDurationMs: 0,
            panelOpacity: 0,
            panelBorderThicknessPx: 0
          }
        }
      ]
    });

    expect(cue).toEqual({
      target: "hud-overlay",
      isManualDismiss: true,
      layoutMode: "fullscreen",
      backdropMode: "dim",
      panelOpacity: 0,
      panelBorderThicknessPx: 0,
      scrollMode: "manual",
      transitionStyle: "none",
      motionInMs: undefined,
      motionOutMs: undefined,
      durationMs: 0
    });
  });

  it("resolves styled point effect with spinner orbit style", () => {
    const cue = resolveCatalogStyledPointEffect({
      effects: [
        {
          category: "StyledPointEffect",
          effectKey: "waypoint.point.place.pulse.medium",
          styledPointEffect: {
            coreLayers: [
              {
                name: "outer-core",
                blendMode: "normal",
                colorStops: ["#22D3EE", "#A5F3FC", "#22D3EE"],
                alphaStops: [0.3, 0.18, 0.3],
                radiusStops: [10, 15, 10],
                radiusScale: 1
              },
              {
                name: "inner-core",
                blendMode: "normal",
                colorStops: ["#22D3EE", "#A5F3FC", "#22D3EE"],
                alphaStops: [0.95, 0.55, 0.95],
                radiusStops: [10, 15, 10],
                radiusScale: 0.55
              }
            ],
            orbitLayer: {
              enabled: true,
              style: "spinner",
              blendMode: "normal",
              spinner: {
                colorStops: ["#22D3EE", "#A5F3FC", "#22D3EE"],
                alphaStops: [0.75, 0.4, 0.75],
                densityStops: [5, 9, 5],
                radiusScaleBase: 1.35,
                radiusScaleStep: 0.2,
                radiusScaleBands: 3,
                sparkRadiusScale: 0.09,
                angularSpeedScale: 1,
                baseRadiusScale: 1,
                alphaScale: 1
              }
            },
            pulseMs: 900,
            lifecycle: {
              clearPolicy: "timebased",
              lifetimeMs: 1400,
              cooldownMs: 600
            }
          }
        }
      ]
    }, "waypoint.point.place.pulse.medium");

    expect(cue).toEqual({
      coreLayers: [
        {
          name: "outer-core",
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC", "#22D3EE"],
          alphaStops: [0.3, 0.18, 0.3],
          radiusStops: [10, 15, 10],
          radiusScale: 1
        },
        {
          name: "inner-core",
          blendMode: "normal",
          colorHexStops: ["#22D3EE", "#A5F3FC", "#22D3EE"],
          alphaStops: [0.95, 0.55, 0.95],
          radiusStops: [10, 15, 10],
          radiusScale: 0.55
        }
      ],
      orbitLayer: {
        enabled: true,
        style: "spinner",
        blendMode: "normal",
        spinner: {
          colorHexStops: ["#22D3EE", "#A5F3FC", "#22D3EE"],
          alphaStops: [0.75, 0.4, 0.75],
          densityStops: [5, 9, 5],
          radiusScaleBase: 1.35,
          radiusScaleStep: 0.2,
          radiusScaleBands: 3,
          sparkRadiusScale: 0.09,
          angularSpeedScale: 1,
          baseRadiusScale: 1,
          alphaScale: 1
        }
      },
      pulseMs: 900,
      clearPolicy: "timebased",
      lifetimeMs: 1400,
      cooldownMs: 600
    });
  });

  it("resolves styled point effect with ring-pulse orbit style", () => {
    const cue = resolveCatalogStyledPointEffect({
      effects: [
        {
          category: "styledpointeffect",
          effectKey: "waypoint.point.place.rings.medium",
          styledPointEffect: {
            coreLayers: [
              {
                blendMode: "normal",
                colorStops: ["#22D3EE"],
                alphaStops: [0.9],
                radiusStops: [10]
              }
            ],
            orbitLayer: {
              enabled: true,
              style: "ring-pulse",
              blendMode: "screen",
              ringPulse: {
                colorStops: ["#22D3EE", "#A5F3FC", "#FFFFFF"],
                alphaStops: [0.9, 0.5, 0.1],
                ringCount: 3,
                ringSpacingScale: 0.35,
                radialGrowthStops: [0.7, 1.2, 1.8],
                ringThicknessPx: 2,
                phaseOffsetStep: 0.2,
                baseRadiusScale: 1,
                alphaScale: 0.8
              }
            },
            pulseMs: 900,
            lifecycle: {
              clearPolicy: "manual-removal"
            }
          }
        }
      ]
    }, "waypoint.point.place.rings.medium");

    expect(cue).toEqual({
      coreLayers: [
        {
          name: undefined,
          blendMode: "normal",
          colorHexStops: ["#22D3EE"],
          alphaStops: [0.9],
          radiusStops: [10],
          radiusScale: 1
        }
      ],
      orbitLayer: {
        enabled: true,
        style: "ring-pulse",
        blendMode: "screen",
        ringPulse: {
          colorHexStops: ["#22D3EE", "#A5F3FC", "#FFFFFF"],
          alphaStops: [0.9, 0.5, 0.1],
          ringCount: 3,
          ringSpacingScale: 0.35,
          radialGrowthStops: [0.7, 1.2, 1.8],
          ringThicknessPx: 2,
          phaseOffsetStep: 0.2,
          baseRadiusScale: 1,
          alphaScale: 0.8
        }
      },
      pulseMs: 900,
      clearPolicy: "manual-removal",
      lifetimeMs: undefined
    });
  });

  it("returns null for styled point effect when all core layers are disabled", () => {
    const cue = resolveCatalogStyledPointEffect({
      effects: [
        {
          category: "StyledPointEffect",
          effectKey: "waypoint.point.place.invalid",
          styledPointEffect: {
            coreLayers: [
              {
                enabled: false,
                colorStops: ["#22D3EE"],
                alphaStops: [0.95],
                radiusStops: [10]
              }
            ],
            pulseMs: 900,
            lifecycle: {
              clearPolicy: "timebased",
              lifetimeMs: 1400
            }
          }
        }
      ]
    }, "waypoint.point.place.invalid");

    expect(cue).toBeNull();
  });

  it("returns null for styled point effect when orbit spinner settings are incomplete", () => {
    const cue = resolveCatalogStyledPointEffect({
      effects: [
        {
          category: "StyledPointEffect",
          effectKey: "waypoint.point.place.invalid.spinner",
          styledPointEffect: {
            coreLayers: [
              {
                colorStops: ["#22D3EE"],
                alphaStops: [0.95],
                radiusStops: [10]
              }
            ],
            orbitLayer: {
              enabled: true,
              style: "spinner",
              spinner: {
                colorStops: ["#22D3EE"],
                alphaStops: [0.75],
                densityStops: [5]
              }
            },
            pulseMs: 900,
            lifecycle: {
              clearPolicy: "timebased",
              lifetimeMs: 1400
            }
          }
        }
      ]
    }, "waypoint.point.place.invalid.spinner");

    expect(cue).toBeNull();
  });

  it("returns null for timebased styled point effect when lifetimeMs is missing", () => {
    const cue = resolveCatalogStyledPointEffect({
      effects: [
        {
          category: "StyledPointEffect",
          effectKey: "waypoint.point.place.timebased.invalid",
          styledPointEffect: {
            coreLayers: [
              {
                colorStops: ["#22D3EE"],
                alphaStops: [0.95],
                radiusStops: [10]
              }
            ],
            pulseMs: 900,
            lifecycle: {
              clearPolicy: "timebased"
            }
          }
        }
      ]
    }, "waypoint.point.place.timebased.invalid");

    expect(cue).toBeNull();
  });

  it("returns null for styled point effect when cooldownMs is invalid", () => {
    const cue = resolveCatalogStyledPointEffect({
      effects: [
        {
          category: "StyledPointEffect",
          effectKey: "waypoint.point.place.timebased.invalid.cooldown",
          styledPointEffect: {
            coreLayers: [
              {
                colorStops: ["#22D3EE"],
                alphaStops: [0.95],
                radiusStops: [10]
              }
            ],
            pulseMs: 900,
            lifecycle: {
              clearPolicy: "timebased",
              lifetimeMs: 1400,
              cooldownMs: 0
            }
          }
        }
      ]
    }, "waypoint.point.place.timebased.invalid.cooldown");

    expect(cue).toBeNull();
  });
});
