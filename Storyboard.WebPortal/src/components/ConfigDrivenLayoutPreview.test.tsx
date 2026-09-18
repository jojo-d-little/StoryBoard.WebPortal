/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfigDrivenLayoutPreview } from "./ConfigDrivenLayoutPreview";
import type { ResolvedPlan, TemplateSlotGridPlacement, UiSlotDefinition } from "../orchestration/types";

describe("ConfigDrivenLayoutPreview grid reflow", () => {
  it("expands primarySurface leftward from its starting placement when neighboring side slots are hidden", () => {
    const plan: ResolvedPlan = {
      experienceState: "SessionActive",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "visible", featureKey: "topBar", implementationKey: "topBarV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "secondaryPanel", mode: "hidden", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "hidden", featureKey: "devTools", implementationKey: "devToolsV1" },
        { slotKey: "statusStrip", mode: "visible", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 2 },
      utilityPanel: { rowStart: 2, colStart: 4, rowSpan: 2, colSpan: 1 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "chrome", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: { kind: "content-secondary", infrastructure: false, collapsible: true, hideable: true },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      utilityPanel: { kind: "utility", infrastructure: false, collapsible: true, hideable: true },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const primarySurfaceCell = container.querySelector('[data-slot-key="primarySurface"]') as HTMLElement | null;

    expect(primarySurfaceCell).not.toBeNull();
    expect(primarySurfaceCell?.style.gridColumn).toBe("1 / span 4");
    expect(primarySurfaceCell?.style.gridRow).toBe("2 / span 2");
  });

  it("does not expand primarySurface leftward when the secondary side slot remains visible", () => {
    const plan: ResolvedPlan = {
      experienceState: "SessionActive",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "visible", featureKey: "topBar", implementationKey: "topBarV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "secondaryPanel", mode: "visible", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "hidden", featureKey: "devTools", implementationKey: "devToolsV1" },
        { slotKey: "statusStrip", mode: "visible", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 2 },
      utilityPanel: { rowStart: 2, colStart: 4, rowSpan: 2, colSpan: 1 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "chrome", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: { kind: "content-secondary", infrastructure: false, collapsible: true, hideable: true },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      utilityPanel: { kind: "utility", infrastructure: false, collapsible: true, hideable: true },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const primarySurfaceCell = container.querySelector('[data-slot-key="primarySurface"]') as HTMLElement | null;

    expect(primarySurfaceCell).not.toBeNull();
    expect(primarySurfaceCell?.style.gridColumn).toBe("2 / span 3");
    expect(primarySurfaceCell?.style.gridRow).toBe("2 / span 2");
  });

  it("uses collapseToEdge behavior hints for collapsed side panels", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "visible", featureKey: "topBar", implementationKey: "topBarV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "statusStrip", mode: "visible", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      primarySurface: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 3 },
      secondaryPanel: { rowStart: 2, colStart: 4, rowSpan: 2, colSpan: 1 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "chrome", infrastructure: false, collapsible: true, hideable: true },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: {
        kind: "content-secondary",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: {
          collapseToEdge: "left"
        }
      },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const collapsedSlot = container.querySelector('[data-slot-key="secondaryPanel"] .storyboard-ui-component-slot') as HTMLElement | null;
    const collapsedIndicator = container.querySelector('[data-slot-key="secondaryPanel"] .storyboard-collapsed-indicator') as HTMLElement | null;

    expect(collapsedSlot).not.toBeNull();
    expect(collapsedSlot?.getAttribute("data-collapse-edge")).toBe("left");
    expect(collapsedSlot?.getAttribute("data-collapse-axis")).toBe("vertical");
    expect(collapsedIndicator).not.toBeNull();
    expect(collapsedIndicator?.className).toContain("axis-vertical");
    expect(collapsedIndicator?.className).toContain("edge-left");
  });

  it("treats collapsed adjacent slots as edge reservations for layout reflow", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "visible", featureKey: "topBar", implementationKey: "topBarV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "collapsed", featureKey: "devTools", implementationKey: "devToolsV1" },
        { slotKey: "statusStrip", mode: "visible", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 2 },
      utilityPanel: { rowStart: 2, colStart: 4, rowSpan: 2, colSpan: 1 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "chrome", infrastructure: false, collapsible: true, hideable: true },
      secondaryPanel: {
        kind: "content-secondary",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "left" }
      },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      utilityPanel: {
        kind: "utility",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "left" }
      },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const primarySurfaceCell = container.querySelector('[data-slot-key="primarySurface"]') as HTMLElement | null;

    expect(primarySurfaceCell).not.toBeNull();
    expect(primarySurfaceCell?.style.gridColumn).toBe("2 / span 2");
  });

  it("reserves collapsed thickness by shrinking collapsed-only edge tracks", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "collapsed", featureKey: "topBar", implementationKey: "topBarV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "collapsed", featureKey: "devTools", implementationKey: "devToolsV1" },
        { slotKey: "statusStrip", mode: "collapsed", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 2 },
      utilityPanel: { rowStart: 2, colStart: 4, rowSpan: 2, colSpan: 1 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: {
        kind: "chrome",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "top" }
      },
      secondaryPanel: {
        kind: "content-secondary",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "left" }
      },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      utilityPanel: {
        kind: "utility",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "left" }
      },
      statusStrip: {
        kind: "status",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "bottom" }
      }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const layoutStage = container.querySelector(".storyboard-ui-layout-stage") as HTMLElement | null;

    expect(layoutStage).not.toBeNull();
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-col-1")).toBe("var(--theme-size-collapsed-component-thickness)");
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-col-4")).toBe("var(--theme-size-collapsed-component-thickness)");
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-row-1")).toBe("var(--theme-size-collapsed-component-thickness)");
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-row-4")).toBe("var(--theme-size-collapsed-component-thickness)");
  });

  it("expands collapsed top bar into the main grid and releases collapsed track shrink", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "collapsed", featureKey: "topBar", implementationKey: "topBarV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "statusStrip", mode: "visible", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      primarySurface: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 4 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: {
        kind: "shell-chrome",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "top" }
      },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const layoutStage = container.querySelector(".storyboard-ui-layout-stage") as HTMLElement | null;
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-row-1")).toBe("var(--theme-size-collapsed-component-thickness)");
    const collapsedTopBarCell = container.querySelector(
      '.storyboard-ui-layout-grid [data-slot-key="topBar"][data-slot-kind="shell-chrome"]'
    ) as HTMLElement | null;
    expect(collapsedTopBarCell).not.toBeNull();
    expect(collapsedTopBarCell?.style.gridRow).toBe("1 / span 1");

    const topBarExpandButton = container.querySelector('[data-slot-key="topBar"] .storyboard-collapsed-indicator') as HTMLButtonElement | null;
    expect(topBarExpandButton).not.toBeNull();
    fireEvent.click(topBarExpandButton as HTMLButtonElement);

    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-row-1")).toBe("");
    expect(container.querySelector(".storyboard-ui-layout-grid [data-slot-key=\"topBar\"]")).not.toBeNull();
  });

  it("does not let non-templated visible slots block collapsed left rail shrink", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "diagnosticsDrawer", mode: "visible", featureKey: "diagnosticsConsole", implementationKey: "DiagnosticsConsole" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "gameDiscovery", implementationKey: "gameDiscoveryDesktopV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsDesktopV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 3 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 2, colSpan: 1 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      diagnosticsDrawer: { kind: "diagnostics", infrastructure: true, collapsible: true, hideable: false },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: {
        kind: "content-secondary",
        infrastructure: false,
        collapsible: true,
        hideable: true,
        behaviorHints: { collapseToEdge: "left" }
      }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const layoutStage = container.querySelector(".storyboard-ui-layout-stage") as HTMLElement | null;

    expect(layoutStage).not.toBeNull();
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-col-1")).toBe("var(--theme-size-collapsed-component-thickness)");
  });

  it("expands collapsed secondaryPanel strip vertically into utilityPanel space when utilityPanel is hidden", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "collapsed", featureKey: "topBarMenu", implementationKey: "topBarDesktopV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "gameDiscovery", implementationKey: "gameDiscoveryV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "hidden", featureKey: "devToolsPanel", implementationKey: "devToolsPanelV1" },
        { slotKey: "statusStrip", mode: "collapsed", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
      utilityPanel: { rowStart: 3, colStart: 1, rowSpan: 1, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 3 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "shell-chrome", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "top" } },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: { kind: "content-secondary", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "left" } },
      utilityPanel: { kind: "content-utility", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "left" } },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "bottom" } }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const secondaryCollapsedOverlayCell = container.querySelector(
      '.storyboard-ui-layout-grid [data-slot-key="secondaryPanel"]'
    ) as HTMLElement | null;

    expect(secondaryCollapsedOverlayCell).not.toBeNull();
    expect(secondaryCollapsedOverlayCell?.style.gridColumn).toBe("1 / span 1");
    expect(secondaryCollapsedOverlayCell?.style.gridRow).toBe("2 / span 2");
  });

  it("keeps collapsed left rail reservation when topBar expands", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "collapsed", featureKey: "topBarMenu", implementationKey: "topBarDesktopV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "gameDiscovery", implementationKey: "gameDiscoveryV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "hidden", featureKey: "devToolsPanel", implementationKey: "devToolsPanelV1" },
        { slotKey: "statusStrip", mode: "collapsed", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
      utilityPanel: { rowStart: 3, colStart: 1, rowSpan: 1, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 3 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "shell-chrome", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "top" } },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: { kind: "content-secondary", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "left" } },
      utilityPanel: { kind: "content-utility", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "left" } },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "bottom" } }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const layoutStage = container.querySelector(".storyboard-ui-layout-stage") as HTMLElement | null;
    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-col-1")).toBe("var(--theme-size-collapsed-component-thickness)");

    const topBarExpandButton = container.querySelector('.storyboard-ui-layout-grid [data-slot-key="topBar"] .storyboard-collapsed-indicator') as HTMLButtonElement | null;
    expect(topBarExpandButton).not.toBeNull();
    fireEvent.click(topBarExpandButton as HTMLButtonElement);

    expect(layoutStage?.style.getPropertyValue("--storyboard-ui-grid-col-1")).toBe("var(--theme-size-collapsed-component-thickness)");
  });

  it("does not grow collapsed secondaryPanel upward above its starting row", () => {
    const plan: ResolvedPlan = {
      experienceState: "SignedIn",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "topBar", mode: "hidden", featureKey: "topBarMenu", implementationKey: "topBarDesktopV1" },
        { slotKey: "primarySurface", mode: "visible", featureKey: "gameDiscovery", implementationKey: "gameDiscoveryV1" },
        { slotKey: "secondaryPanel", mode: "collapsed", featureKey: "gameDetails", implementationKey: "gameDetailsV1" },
        { slotKey: "utilityPanel", mode: "hidden", featureKey: "devToolsPanel", implementationKey: "devToolsPanelV1" },
        { slotKey: "statusStrip", mode: "collapsed", featureKey: "globalStatus", implementationKey: "statusBarInfoV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      topBar: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 4 },
      secondaryPanel: { rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
      utilityPanel: { rowStart: 3, colStart: 1, rowSpan: 1, colSpan: 1 },
      primarySurface: { rowStart: 2, colStart: 2, rowSpan: 2, colSpan: 3 },
      statusStrip: { rowStart: 4, colStart: 1, rowSpan: 1, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      topBar: { kind: "shell-chrome", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "top" } },
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      secondaryPanel: { kind: "content-secondary", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "left" } },
      utilityPanel: { kind: "content-utility", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "left" } },
      statusStrip: { kind: "status", infrastructure: false, collapsible: true, hideable: true, behaviorHints: { collapseToEdge: "bottom" } }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const secondaryCollapsedCell = container.querySelector('.storyboard-ui-layout-grid [data-slot-key="secondaryPanel"]') as HTMLElement | null;

    expect(secondaryCollapsedCell).not.toBeNull();
    expect(secondaryCollapsedCell?.style.gridRow).toBe("2 / span 2");
  });

  it("treats all overlay-nonmodal slots as popup overlays outside the grid", () => {
    const plan: ResolvedPlan = {
      experienceState: "SessionActive",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "nonModalLayer", mode: "visible", featureKey: "devToolsPanel", implementationKey: "devToolsPanelV1" },
        { slotKey: "diagnosticsDrawer", mode: "visible", featureKey: "diagnosticsConsole", implementationKey: "diagnosticsConsoleV1" }
      ]
    };

    const templateSlotGridPlacements: Record<string, TemplateSlotGridPlacement> = {
      primarySurface: { rowStart: 1, colStart: 1, rowSpan: 4, colSpan: 4 }
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      nonModalLayer: {
        kind: "overlay-nonmodal",
        infrastructure: true,
        collapsible: false,
        hideable: false,
        behaviorHints: {
          role: "nonmodal-layer",
          presentation: "overlay-nonmodal",
          backdrop: "none",
          dismissOnEscape: false,
          dismissOnBackdropClick: false,
          stackOrder: 880
        }
      },
      diagnosticsDrawer: {
        kind: "overlay-nonmodal",
        infrastructure: true,
        collapsible: false,
        hideable: true,
        behaviorHints: {
          role: "nonmodal-layer",
          presentation: "overlay-nonmodal",
          backdrop: "none",
          dismissOnEscape: false,
          dismissOnBackdropClick: false,
          stackOrder: 870
        }
      }
    };

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={templateSlotGridPlacements}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const nonModalInGrid = container.querySelector('.storyboard-ui-layout-grid [data-slot-key="nonModalLayer"]');
    const diagnosticsInGrid = container.querySelector('.storyboard-ui-layout-grid [data-slot-key="diagnosticsDrawer"]');
    const nonModalOverlay = container.querySelector('.config-overlay-layer.nonmodal-layer[data-slot-key="nonModalLayer"]');
    const diagnosticsOverlay = container.querySelector('.config-overlay-layer.nonmodal-layer[data-slot-key="diagnosticsDrawer"]');

    expect(nonModalInGrid).toBeNull();
    expect(diagnosticsInGrid).toBeNull();
    expect(nonModalOverlay).not.toBeNull();
    expect(diagnosticsOverlay).not.toBeNull();
  });

  it("centers a newly shown docked non-modal overlay", async () => {
    const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function mockGetBoundingClientRect(this: HTMLElement): DOMRect {
      if (this.classList.contains("config-overlay-stage")) {
        return new DOMRect(0, 0, 1200, 800);
      }

      if (this.classList.contains("nonmodal-layer")) {
        return new DOMRect(0, 0, 400, 300);
      }

      return new DOMRect(0, 0, 0, 0);
    });

    const plan: ResolvedPlan = {
      experienceState: "SessionActive",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "devToolsDrawer", mode: "visible", featureKey: "devToolsPanel", implementationKey: "devToolsPanelV1" },
        { slotKey: "diagnosticsDrawer", mode: "hidden", featureKey: "diagnosticsConsole", implementationKey: "diagnosticsConsoleV1" }
      ]
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      devToolsDrawer: {
        kind: "overlay-nonmodal",
        infrastructure: true,
        collapsible: false,
        hideable: true,
        behaviorHints: {
          role: "nonmodal-layer",
          presentation: "overlay-nonmodal",
          backdrop: "none",
          dismissOnEscape: false,
          dismissOnBackdropClick: false,
          stackOrder: 875
        }
      },
      diagnosticsDrawer: {
        kind: "overlay-nonmodal",
        infrastructure: true,
        collapsible: false,
        hideable: true,
        behaviorHints: {
          role: "nonmodal-layer",
          presentation: "overlay-nonmodal",
          backdrop: "none",
          dismissOnEscape: false,
          dismissOnBackdropClick: false,
          stackOrder: 870
        }
      }
    };

    const { container, rerender } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={{ primarySurface: { rowStart: 1, colStart: 1, rowSpan: 4, colSpan: 4 } }}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    rerender(
      <ConfigDrivenLayoutPreview
        plan={{
          ...plan,
          slots: [
            plan.slots[0],
            plan.slots[1],
            { slotKey: "diagnosticsDrawer", mode: "visible", featureKey: "diagnosticsConsole", implementationKey: "diagnosticsConsoleV1" }
          ]
        }}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={{ primarySurface: { rowStart: 1, colStart: 1, rowSpan: 4, colSpan: 4 } }}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    await waitFor(() => {
      const diagnosticsOverlay = container.querySelector('.config-overlay-layer.nonmodal-layer[data-slot-key="diagnosticsDrawer"]') as HTMLElement | null;
      expect(diagnosticsOverlay).not.toBeNull();
      expect(diagnosticsOverlay?.style.transform).toBe("translate(-384px, 234px)");
    });

    getBoundingClientRectSpy.mockRestore();
  });

  it("renders close controls for modal and non-modal overlays and requests hidden mode", () => {
    const plan: ResolvedPlan = {
      experienceState: "SessionActive",
      formFactorKey: "desktop",
      compositionProfileKey: "standard",
      compositionProfileName: "standard",
      skeletonLayoutKey: "desktopStandard",
      slots: [
        { slotKey: "primarySurface", mode: "visible", featureKey: "sessionPlaySurface", implementationKey: "sessionPlaySurfaceV1" },
        { slotKey: "modalLayer", mode: "visible", featureKey: "authSignIn", implementationKey: "authSignInV1" },
        { slotKey: "devToolsDrawer", mode: "visible", featureKey: "devToolsPanel", implementationKey: "devToolsPanelV1" }
      ]
    };

    const slotDefinitions: Record<string, UiSlotDefinition> = {
      primarySurface: { kind: "content-primary", infrastructure: false, collapsible: false, hideable: false },
      modalLayer: {
        kind: "overlay-modal",
        infrastructure: true,
        collapsible: false,
        hideable: true,
        behaviorHints: {
          role: "dialog-layer",
          presentation: "overlay-modal",
          backdrop: "dim",
          dismissOnEscape: true,
          dismissOnBackdropClick: true,
          stackOrder: 900
        }
      },
      devToolsDrawer: {
        kind: "overlay-nonmodal",
        infrastructure: true,
        collapsible: false,
        hideable: true,
        behaviorHints: {
          role: "nonmodal-layer",
          presentation: "overlay-nonmodal",
          backdrop: "none",
          dismissOnEscape: false,
          dismissOnBackdropClick: false,
          stackOrder: 875
        }
      }
    };

    const onRequestSlotModeChange = vi.fn<(slotKey: string, mode: ResolvedPlan["slots"][number]["mode"]) => void>();

    const { container } = render(
      <ConfigDrivenLayoutPreview
        plan={plan}
        slotDefinitions={slotDefinitions}
        templateSlotGridPlacements={{ primarySurface: { rowStart: 1, colStart: 1, rowSpan: 4, colSpan: 4 } }}
        templateSlotClassNames={{}}
        showSlotTechnicalDetailsDefault={false}
        slotTechnicalDetailsOverrides={{}}
        onRequestSlotModeChange={onRequestSlotModeChange}
        renderFeature={(slot) => <div>{slot.slotKey}</div>}
      />
    );

    const modalCloseButton = container.querySelector('.config-overlay-layer.modal-layer[data-slot-key="modalLayer"] button[aria-label="Close Modal Layer"]') as HTMLButtonElement | null;
    const nonModalCloseButton = container.querySelector('.config-overlay-layer.nonmodal-layer[data-slot-key="devToolsDrawer"] button[aria-label="Close Dev Tools Drawer"]') as HTMLButtonElement | null;

    expect(modalCloseButton).not.toBeNull();
    expect(nonModalCloseButton).not.toBeNull();

    fireEvent.click(modalCloseButton as HTMLButtonElement);
    fireEvent.click(nonModalCloseButton as HTMLButtonElement);

    expect(onRequestSlotModeChange).toHaveBeenCalledWith("modalLayer", "hidden");
    expect(onRequestSlotModeChange).toHaveBeenCalledWith("devToolsDrawer", "hidden");
  });
});
