/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { OrchestrationContracts } from "./orchestration/types";

const { contracts, authenticateMock, currentPrincipalMock, discoverGamesMock, getGameDetailsMock, getAssetPreviewDataUrlMock, startSessionMock, listSessionsMock, joinSessionMock, leaveSessionMock } = vi.hoisted(() => ({
  contracts: {
  featureMap: {
    initialExperienceState: "SignedIn",
    experienceStates: {
      SignedIn: {},
      SessionActive: {}
    },
    transitions: [],
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
              { slotKey: "primarySurface", featureKey: "gameDiscovery", mode: "visible" },
              { slotKey: "statusStrip", featureKey: "globalStatus", mode: "visible" }
            ]
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
      mobileStandard: {
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
          globalStatus: "statusBarInfoV1"
        }
      },
      mobilePortrait: {
        implementationByFeature: {
          gameDiscovery: "gameDiscoveryMobileV1",
          globalStatus: "statusBarInfoV1"
        }
      }
    }
  },
  featureCatalog: {
    features: {
      gameDiscovery: { category: "discovery", description: "" },
      globalStatus: { category: "status", description: "" }
    }
  },
  uiSlots: {
    slots: {
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    },
    allowedSlotModes: ["visible", "hidden", "collapsed", "disabled", "readonly"]
  },
  portalModes: {
    defaultModeKey: "normal",
    modes: {
      normal: {
        formFactorKey: "desktop",
        skeletonLayoutKey: "desktopStandard",
        compositionProfileKey: "standard"
      },
      devsimulator: {
        formFactorKey: "desktop",
        skeletonLayoutKey: "desktopStandard",
        compositionProfileKey: "standard"
      }
    }
  }
} satisfies OrchestrationContracts,
  authenticateMock: vi.fn(),
  currentPrincipalMock: vi.fn(),
  discoverGamesMock: vi.fn(),
  getGameDetailsMock: vi.fn(),
  getAssetPreviewDataUrlMock: vi.fn(),
  startSessionMock: vi.fn(),
  listSessionsMock: vi.fn(),
  joinSessionMock: vi.fn(),
  leaveSessionMock: vi.fn()
}));

vi.mock("./orchestration/loader", () => {
  return {
    loadOrchestrationContracts: vi.fn().mockResolvedValue(contracts)
  };
});

vi.mock("./hostApi/client", () => {
  return {
    HostApiClient: class {
      authenticate = authenticateMock;
      getCurrentPrincipal = currentPrincipalMock;
      discoverGames = discoverGamesMock;
      getGameDetails = getGameDetailsMock;
      getAssetPreviewDataUrl = getAssetPreviewDataUrlMock;
      startSession = startSessionMock;
      listSessions = listSessionsMock;
      joinSession = joinSessionMock;
      leaveSession = leaveSessionMock;
    }
  };
});

vi.mock("./hooks/usePortalStartupAudioGate", () => ({
  usePortalStartupAudioGate: () => ({
    status: "enabled",
    startupAudioReady: true,
    enableAudio: vi.fn().mockResolvedValue(undefined),
    retryAudio: vi.fn().mockResolvedValue(undefined),
    continueMuted: vi.fn()
  })
}));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  authenticateMock.mockReset();
  currentPrincipalMock.mockReset();
  discoverGamesMock.mockReset();
  getGameDetailsMock.mockReset();
  getAssetPreviewDataUrlMock.mockReset();
  startSessionMock.mockReset();
  listSessionsMock.mockReset();
  joinSessionMock.mockReset();
  leaveSessionMock.mockReset();

  authenticateMock.mockResolvedValue({
    result: { success: true, code: "Identity.Authenticate.Success", diagnosticsMessages: [] },
    principalName: "admin",
    credentialHandle: "cred-123"
  });
  currentPrincipalMock.mockResolvedValue({
    result: { success: true, code: "Identity.CurrentPrincipal.Success", diagnosticsMessages: [] },
    principalName: "admin"
  });
  discoverGamesMock.mockResolvedValue({
    result: { success: true, code: "Discovery.Success", diagnosticsMessages: [] },
    totalAvailableCount: 1,
    games: [
      {
        gameId: "g-1",
        gameKey: "sample.game",
        displayName: "Sample Game",
        description: "desc"
      }
    ]
  });
  getGameDetailsMock.mockResolvedValue({
    result: { success: true, code: "GameDetails.Success", diagnosticsMessages: [] },
    game: {
      gameId: "g-1",
      gameKey: "sample.game",
      displayName: "Sample Game",
      summary: "A sample game.",
      access: {
        canView: true,
        canStartSession: true,
        denialCode: "",
        denialMessage: ""
      },
      previewImages: []
    }
  });
  getAssetPreviewDataUrlMock.mockResolvedValue(null);
  startSessionMock.mockResolvedValue({
    result: { success: true, code: "Session.Start.Success", diagnosticsMessages: [] },
    created: true,
    session: {
      sessionId: "s-1",
      gameId: "g-1",
      gameKey: "sample.game",
      sessionName: "Session One",
      sessionState: "active",
      ownerPrincipalId: "admin",
      joinPolicy: "ownerOnly",
      canJoin: true,
      canLeave: true,
      isJoined: true,
      isOwner: true
    }
  });
  listSessionsMock.mockResolvedValue({
    result: { success: true, code: "Session.List.Success", diagnosticsMessages: [] },
    totalAvailableCount: 1,
    sessions: [
      {
        sessionId: "s-1",
        gameId: "g-1",
        gameKey: "sample.game",
        sessionName: "Session One",
        sessionState: "active",
        ownerPrincipalId: "admin",
        joinPolicy: "ownerOnly",
        canJoin: true,
        canLeave: true,
        isJoined: false,
        isOwner: false
      }
    ]
  });
  joinSessionMock.mockResolvedValue({
    result: { success: true, code: "Session.Join.Success", diagnosticsMessages: [] },
    joined: true,
    session: {
      sessionId: "s-1",
      gameId: "g-1",
      gameKey: "sample.game",
      sessionName: "Session One",
      sessionState: "active",
      ownerPrincipalId: "admin",
      joinPolicy: "ownerOnly",
      canJoin: true,
      canLeave: true,
      isJoined: true,
      isOwner: false
    }
  });
  leaveSessionMock.mockResolvedValue({
    result: { success: true, code: "Session.Leave.Success", diagnosticsMessages: [] },
    sessionId: "s-1",
    left: true
  });
});

afterEach(() => {
  cleanup();
});

describe("App override behavior", () => {
  it("always renders the configuration-driven Portal layout", async () => {
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(await screen.findByRole("main")).toHaveClass("mode-config");
    expect(document.querySelector("[data-skeleton-layout]")).not.toBeNull();
    expect(screen.queryByText("Resolved Plan")).not.toBeInTheDocument();
  });

  it("applies slot-key query mode overrides using hidden/visible values", async () => {
    window.history.replaceState({}, "", "/?statusStrip=hidden");

    render(<App />);

    expect(screen.queryByRole("region", { name: "Application status bar" })).not.toBeInTheDocument();
  });

  it("ignores feature-key query mode overrides and applies slot-key-only visibility control", async () => {
    window.history.replaceState({}, "", "/?globalStatus=hidden");

    render(<App />);

    await screen.findByRole("main");
    expect(screen.getByRole("region", { name: "Application status bar" })).toBeInTheDocument();
  });

  it("uses query override as highest precedence over saved selection", async () => {
    window.localStorage.setItem("shellLab.formFactorOverride", "desktop");
    window.history.replaceState({}, "", "/?ff=mobilePortrait");

    render(<App />);

    expect(await screen.findByText("source.formFactor=query")).toBeInTheDocument();
    expect(screen.getByText("effective.formFactor=mobilePortrait")).toBeInTheDocument();
  });

  it("clears query override and falls back to selected override", async () => {
    window.localStorage.setItem("shellLab.formFactorOverride", "desktop");
    window.history.replaceState({}, "", "/?ff=mobilePortrait");

    render(<App />);

    expect(await screen.findByRole("button", { name: "Clear URL Overrides" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear URL Overrides" }));

    expect(window.location.search).toBe("");
    expect(screen.getByText("URL query overrides cleared.")).toBeInTheDocument();
    expect(screen.getByText("source.formFactor=selection")).toBeInTheDocument();
    expect(screen.getByText("effective.formFactor=desktop")).toBeInTheDocument();
  });

  it("copies share URL with effective overrides", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    window.localStorage.setItem("shellLab.formFactorOverride", "mobilePortrait");

    render(<App />);

    expect(await screen.findByText("source.formFactor=selection")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy Share URL" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("ff=mobilePortrait");
    expect(await screen.findByText("Share URL copied.")).toBeInTheDocument();
  });

  it("runs host sign-in discovery and start-session flow", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Sign In" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(authenticateMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(discoverGamesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("activeSessionId=s-1")).toBeInTheDocument();
    expect(screen.getAllByText("Start session succeeded: Session.Start.Success").length).toBeGreaterThan(0);
  });

  it("automatically bootstraps from the devsimulator launch URL", async () => {
    window.history.replaceState({}, "", "/client/?mode=devsimulator&username=dev&autoStartSession=true");

    render(<App />);

    await waitFor(() => {
      expect(authenticateMock).toHaveBeenCalledWith("dev", "");
      expect(discoverGamesMock).toHaveBeenCalledTimes(1);
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(window.location.search).toBe("?mode=devsimulator&username=dev&autoStartSession=true");
    expect(document.querySelector('main[data-launch-mode="devsimulator"]')).toHaveAttribute("data-portal-mode", "devsimulator");
    expect(screen.queryByText("Storyboard Shell Lab")).not.toBeInTheDocument();
    expect(document.querySelector("[data-skeleton-layout]")).not.toBeNull();
    expect(screen.getByText("session=s-1")).toBeInTheDocument();
    expect(screen.getByText("Start session succeeded: Session.Start.Success")).toBeInTheDocument();
  });

  it("authenticates from a username without starting a session unless requested", async () => {
    window.history.replaceState({}, "", "/client/?mode=devsimulator&username=dev");

    render(<App />);

    await waitFor(() => {
      expect(authenticateMock).toHaveBeenCalledWith("dev", "");
    });

    expect(discoverGamesMock).not.toHaveBeenCalled();
    expect(startSessionMock).not.toHaveBeenCalled();
  });

  it("attaches to the existing owner session during automatic bootstrap", async () => {
    startSessionMock.mockResolvedValueOnce({
      result: { success: false, code: "Session.Start.AlreadyExists", diagnosticsMessages: [] },
      created: false,
      session: {
        sessionId: "s-existing",
        gameId: "g-1",
        gameKey: "sample.game",
        sessionName: "Designer Session",
        sessionState: "active",
        ownerPrincipalId: "dev",
        joinPolicy: "ownerOnly",
        canJoin: true,
        canLeave: true,
        isJoined: true,
        isOwner: true
      }
    });
    window.history.replaceState({}, "", "/client/?mode=devsimulator&username=dev&autoStartSession=true");

    render(<App />);

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("session=s-existing")).toBeInTheDocument();
    expect(screen.getByText("Attached to existing session: Session.Start.AlreadyExists")).toBeInTheDocument();
  });

  it("shows failed phase and diagnostics when sign-in fails", async () => {
    authenticateMock.mockResolvedValueOnce({
      result: { success: false, code: "Identity.Authenticate.InvalidCredentials", diagnosticsMessages: ["bad credentials"] },
      principalName: "",
      credentialHandle: ""
    });

    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign In" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(authenticateMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText("phase=Failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("operation=auth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sign-in failed: Identity.Authenticate.InvalidCredentials (bad credentials)").length).toBeGreaterThan(0);
  });

  it("runs list join and leave session lifecycle", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign In" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() => {
      expect(authenticateMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "List Sessions" })[0]);
    await waitFor(() => {
      expect(listSessionsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Join Session" }));
    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("activeSessionId=s-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leave Session" }));
    await waitFor(() => {
      expect(leaveSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("activeSessionId=(none)")).toBeInTheDocument();
    expect(screen.getAllByText("Leave session succeeded: Session.Leave.Success").length).toBeGreaterThan(0);
  });
});
