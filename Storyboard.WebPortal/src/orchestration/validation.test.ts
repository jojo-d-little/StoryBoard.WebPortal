import { describe, expect, it } from "vitest";
import type { OrchestrationContracts } from "./types";
import { validateOrchestrationContracts } from "./validation";

function createContracts(): OrchestrationContracts {
  return {
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
}

describe("validateOrchestrationContracts", () => {
  it("accepts valid contracts", () => {
    expect(() => validateOrchestrationContracts(createContracts())).not.toThrow();
  });

  it("rejects unknown composition feature", () => {
    const contracts = createContracts();
    contracts.stateCompositions.stateProfiles.SignedIn.profiles.standard.slotAssignments[1].featureKey = "unknownFeature";
    expect(() => validateOrchestrationContracts(contracts)).toThrow("unknown feature");
  });

  it("rejects missing stateProfiles mappings", () => {
    const contracts = createContracts();
    delete contracts.stateCompositions.stateProfiles.SessionActive;
    expect(() => validateOrchestrationContracts(contracts)).toThrow("has no stateProfiles composition mapping");
  });

  it("rejects unknown transition state", () => {
    const contracts = createContracts();
    contracts.featureMap.transitions.push({ from: "GhostState", event: "x", to: "SignedIn" });
    expect(() => validateOrchestrationContracts(contracts)).toThrow("unknown from state");
  });

  it("rejects missing form-factor implementation coverage", () => {
    const contracts = createContracts();
    delete contracts.implementations.formFactors.desktop.implementationByFeature.globalStatus;
    expect(() => validateOrchestrationContracts(contracts)).toThrow("missing implementation");
  });

  it("rejects overlay slot behavior hints missing presentation", () => {
    const contracts = createContracts();
    contracts.uiSlots.slots.statusStrip.kind = "overlay-modal";
    contracts.uiSlots.slots.statusStrip.behaviorHints = {
      role: "dialog-layer"
    };

    expect(() => validateOrchestrationContracts(contracts)).toThrow("must define behaviorHints.presentation");
  });

  it("rejects negative slot behavior stack order", () => {
    const contracts = createContracts();
    contracts.uiSlots.slots.statusStrip.behaviorHints = {
      presentation: "inline",
      stackOrder: -1
    };

    expect(() => validateOrchestrationContracts(contracts)).toThrow("stackOrder must be a non-negative integer");
  });

  it("rejects invalid implementation orientation for mapping objects", () => {
    const contracts = createContracts();
    contracts.implementations.formFactors.desktop.implementationByFeature.globalStatus = {
      implementationKey: "statusBarInfoV1",
      orientation: "diagonal" as unknown as "horizontal",
      density: "regular"
    };

    expect(() => validateOrchestrationContracts(contracts)).toThrow("invalid orientation");
  });

  it("accepts valid collapseToEdge on collapsible slots", () => {
    const contracts = createContracts();
    contracts.uiSlots.slots.statusStrip.behaviorHints = {
      collapseToEdge: "bottom"
    };

    expect(() => validateOrchestrationContracts(contracts)).not.toThrow();
  });

  it("rejects collapseToEdge on non-collapsible slots", () => {
    const contracts = createContracts();
    contracts.uiSlots.slots.primarySurface.behaviorHints = {
      collapseToEdge: "left"
    };

    expect(() => validateOrchestrationContracts(contracts)).toThrow("slot is not collapsible");
  });

  it("rejects preferredInputFocus with empty focused input id", () => {
    const contracts = createContracts();
    contracts.stateCompositions.stateProfiles.SessionActive.profiles.standard.preferredInputFocus = {
      featureKey: "sessionPlaySurface",
      focusedInputId: "   "
    };

    expect(() => validateOrchestrationContracts(contracts)).toThrow("preferredInputFocus.focusedInputId must be non-empty");
  });

  it("rejects preferredInputFocus when feature is not assigned to a non-hidden slot", () => {
    const contracts = createContracts();
    contracts.stateCompositions.stateProfiles.SessionActive.profiles.standard.preferredInputFocus = {
      featureKey: "gameDiscovery",
      focusedInputId: "command-handler-v1-input"
    };

    expect(() => validateOrchestrationContracts(contracts)).toThrow("must be assigned to a non-hidden slot");
  });
});
