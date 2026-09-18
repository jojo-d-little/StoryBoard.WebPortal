import { describe, expect, it } from "vitest";
import { listEventsFromState, resolveShellPlan, tryTransition } from "./resolver";
import type { OrchestrationContracts } from "./types";

const contracts: OrchestrationContracts = {
  featureMap: {
    initialExperienceState: "SignedIn",
    experienceStates: {
      SignedIn: {},
      SessionActive: {}
    },
    transitions: [
      { from: "SignedIn", event: "StartSessionSucceeded", to: "SessionActive" },
      { from: "SessionActive", event: "LeaveSessionSucceeded", to: "SignedIn" }
    ],
    resolutionDefaults: {
      defaultSkeletonLayoutKey: "desktopStandard",
      defaultFormFactorKey: "desktop",
      defaultCompositionProfileKey: "standard"
    }
  },
  stateCompositions: {
    stateProfiles: {
      SignedIn: {
        defaultProfile: "standard",
        profiles: {
          standard: {
            slotAssignments: [
              { slotKey: "primarySurface", featureKey: "gameDiscovery", mode: "visible" },
              { slotKey: "statusStrip", featureKey: "globalStatus", mode: "visible" }
            ]
          }
        }
      },
      SessionActive: {
        defaultProfile: "standard",
        profiles: {
          standard: {
            slotAssignments: [
              { slotKey: "primarySurface", featureKey: "sessionPlaySurface", mode: "visible" },
              { slotKey: "statusStrip", featureKey: "globalStatus", mode: "collapsed" }
            ],
            preferredInputFocus: {
              featureKey: "sessionPlaySurface",
              focusedInputId: "command-handler-v1-input"
            }
          }
        }
      }
    }
  },
  skeletonLayouts: {
    skeletonLayouts: {
      desktopStandard: {
        family: "desktop",
        formFactorKey: "desktop",
        templatePath: "skeletons/desktop-standard.html",
        templateSlots: ["primarySurface", "statusStrip"]
      },
      mobilePortrait: {
        family: "mobile",
        formFactorKey: "mobilePortrait",
        templatePath: "skeletons/mobile-portrait.html",
        templateSlots: ["primarySurface", "statusStrip"]
      }
    }
  },
  implementations: {
    defaultFormFactorKey: "desktop",
    formFactors: {
      desktop: {
        implementationByFeature: {
          gameDiscovery: "gameDiscoveryDesktopV1",
          globalStatus: "statusBarInfoV1",
          sessionPlaySurface: "sessionPlaySurfaceDesktopV1"
        }
      },
      mobilePortrait: {
        implementationByFeature: {
          gameDiscovery: "gameDiscoveryMobileV1",
          globalStatus: "statusBarInfoV1",
          sessionPlaySurface: "sessionPlaySurfaceMobileV1"
        }
      }
    }
  },
  featureCatalog: {
    features: {
      gameDiscovery: { category: "discovery", description: "" },
      globalStatus: { category: "status", description: "" },
      sessionPlaySurface: { category: "session", description: "" }
    }
  },
  uiSlots: {
    slots: {
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    },
    allowedSlotModes: ["visible", "hidden", "collapsed", "disabled", "readonly"]
  }
};

describe("resolveShellPlan", () => {
  it("resolves deterministic default plan for a state", () => {
    const plan = resolveShellPlan(contracts, { experienceState: "SignedIn" });

    expect(plan.formFactorKey).toBe("desktop");
    expect(plan.skeletonLayoutKey).toBe("desktopStandard");
    expect(plan.slots).toHaveLength(2);
    expect(plan.slots.find((x) => x.slotKey === "primarySurface")?.implementationKey).toBe("gameDiscoveryDesktopV1");
  });

  it("applies form factor override", () => {
    const plan = resolveShellPlan(contracts, {
      experienceState: "SignedIn",
      formFactorOverride: "mobilePortrait"
    });

    expect(plan.formFactorKey).toBe("mobilePortrait");
    expect(plan.skeletonLayoutKey).toBe("mobilePortrait");
    expect(plan.slots.find((x) => x.slotKey === "primarySurface")?.implementationKey).toBe("gameDiscoveryMobileV1");
  });

  it("carries implementation orientation and density hints from mapping objects", () => {
    const withHints: OrchestrationContracts = {
      ...contracts,
      implementations: {
        ...contracts.implementations,
        formFactors: {
          ...contracts.implementations.formFactors,
          desktop: {
            implementationByFeature: {
              ...contracts.implementations.formFactors.desktop.implementationByFeature,
              gameDiscovery: {
                implementationKey: "gameDiscoveryDesktopV1",
                orientation: "horizontal",
                density: "compact"
              }
            }
          }
        }
      }
    };

    const plan = resolveShellPlan(withHints, { experienceState: "SignedIn" });
    const slot = plan.slots.find((x) => x.slotKey === "primarySurface");

    expect(slot?.implementationKey).toBe("gameDiscoveryDesktopV1");
    expect(slot?.implementationOrientation).toBe("horizontal");
    expect(slot?.implementationDensity).toBe("compact");
  });

  it("fails cleanly for unknown form factor", () => {
    expect(() =>
      resolveShellPlan(contracts, {
        experienceState: "SignedIn",
        formFactorOverride: "handheldX"
      })
    ).toThrow("Unknown form factor 'handheldX'.");
  });

  it("fails cleanly for unknown composition override", () => {
    expect(() =>
      resolveShellPlan(contracts, {
        experienceState: "SignedIn",
        compositionProfileOverride: "experimentalCompositionX"
      })
    ).toThrow("Unknown composition override 'experimentalCompositionX' for state 'SignedIn'.");
  });

  it("fails cleanly for unknown skeleton override", () => {
    expect(() =>
      resolveShellPlan(contracts, {
        experienceState: "SignedIn",
        skeletonLayoutOverride: "unknownLayoutX"
      })
    ).toThrow("Unknown skeleton layout 'unknownLayoutX'.");
  });

  it("supports transition-driven state updates", () => {
    const first = tryTransition(contracts, "SignedIn", "StartSessionSucceeded");
    expect(first).toBe("SessionActive");

    const second = tryTransition(contracts, "SessionActive", "LeaveSessionSucceeded");
    expect(second).toBe("SignedIn");

    expect(listEventsFromState(contracts, "SignedIn")).toEqual(["StartSessionSucceeded"]);
  });

  it("resolves preferred input focus from composition metadata", () => {
    const plan = resolveShellPlan(contracts, { experienceState: "SessionActive" });
    expect(plan.preferredInputFocus).toEqual({
      featureKey: "sessionPlaySurface",
      inputElementId: "command-handler-v1-input"
    });
  });
});
