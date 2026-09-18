/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

const pixiMocks = vi.hoisted(() => {
  const appInstances: MockApplication[] = [];

  class MockPoint {
    x = 0;
    y = 0;

    set(x: number, y?: number): void {
      this.x = x;
      this.y = y ?? x;
    }
  }

  class MockContainer {
    children: any[] = [];
    sortableChildren = false;
    visible = true;
    mask: unknown;
    position = new MockPoint();
    scale = new MockPoint();
    alpha = 1;
    zIndex = 0;
    parent: MockContainer | null = null;

    addChild<T extends any>(child: T): T {
      this.children.push(child);
      if (child && typeof child === "object") {
        (child as { parent?: MockContainer | null }).parent = this;
      }
      return child;
    }

    removeChild<T extends any>(child: T): T {
      this.children = this.children.filter((candidate) => candidate !== child);
      if (child && typeof child === "object") {
        (child as { parent?: MockContainer | null }).parent = null;
      }
      return child;
    }

    removeChildren(): any[] {
      const removed = [...this.children];
      this.children = [];
      for (const child of removed) {
        if (child && typeof child === "object") {
          (child as { parent?: MockContainer | null }).parent = null;
        }
      }

      return removed;
    }

    destroy(): void {
      this.removeChildren();
    }
  }

  class MockGraphics extends MockContainer {
    clear(): this {
      return this;
    }

    rect(): this {
      return this;
    }

    fill(): this {
      return this;
    }

    roundRect(): this {
      return this;
    }

    stroke(): this {
      return this;
    }
  }

  class MockSprite extends MockContainer {
    texture: { width: number; height: number };
    anchor = {
      x: 0,
      y: 0,
      set: (x: number, y?: number) => {
        this.anchor.x = x;
        this.anchor.y = y ?? x;
      }
    };
    rotation = 0;

    constructor(texture: { width: number; height: number }) {
      super();
      this.texture = texture;
      this.scale.set(1, 1);
    }

    getBounds(): { x: number; y: number; width: number; height: number } {
      return {
        x: this.position.x,
        y: this.position.y,
        width: this.texture.width * (this.scale.x || 1),
        height: this.texture.height * (this.scale.y || 1)
      };
    }
  }

  class MockText extends MockContainer {
    text = "";
    style: unknown;
    width = 120;
    height = 20;

    constructor(options?: { text?: string; style?: unknown }) {
      super();
      this.text = options?.text ?? "";
      this.style = options?.style;
      this.width = Math.max(60, this.text.length * 8);
    }
  }

  class MockTextStyle {
    constructor(_options?: unknown) {
      return;
    }
  }

  class MockTicker {
    deltaMS = 16;
    private readonly callbacks = new Set<(ticker: MockTicker) => void>();

    add(callback: (ticker: MockTicker) => void): void {
      this.callbacks.add(callback);
    }

    remove(callback: (ticker: MockTicker) => void): void {
      this.callbacks.delete(callback);
    }

    tick(deltaMs = 16): void {
      this.deltaMS = deltaMs;
      for (const callback of [...this.callbacks]) {
        callback(this);
      }
    }
  }

  class MockApplication {
    canvas = document.createElement("canvas");
    stage = new MockContainer();
    renderer = {
      resize: vi.fn()
    };
    ticker = new MockTicker();

    constructor() {
      appInstances.push(this);
    }

    async init(): Promise<void> {
      return Promise.resolve();
    }

    destroy(): void {
      return;
    }
  }

  return {
    __appInstances: appInstances,
    Application: MockApplication,
    Assets: {
      load: vi.fn(async () => ({ width: 64, height: 64 }))
    },
    defaultFilterVert: "void main(void) { gl_Position = vec4(0.0); }",
    Filter: {
      from: vi.fn(() => ({
        destroy: vi.fn()
      }))
    },
    Texture: {
      WHITE: { width: 1, height: 1 }
    },
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    Text: MockText,
    TextStyle: MockTextStyle
  };
});

vi.mock("pixi.js", () => pixiMocks);

import { createGameRenderer, type GameRenderSceneSnapshot, type GameRendererDiagnosticsEvent } from "../index";

function buildScene(withOutline: boolean): GameRenderSceneSnapshot {
  return {
    roomId: "appearance-outline-room",
    roomLabel: "Appearance Outline Room",
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [],
    roomObjects: [
      {
        objectId: "selected-object",
        objectName: "Selected Object",
        asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
        x: 100,
        y: 140,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 100,
        presentationCues: [],
        movementDurationMs: 0,
        appearanceOutlineStyle: withOutline
          ? {
              outlineColorHex: "#22D3EE",
              outlineThickness: 2,
              pulseMs: 300
            }
          : undefined
      }
    ]
  };
}

function buildSilhouetteScene(withSilhouette: boolean): GameRenderSceneSnapshot {
  return {
    roomId: "appearance-silhouette-room",
    roomLabel: "Appearance Silhouette Room",
    displayMode: "composed",
    bounds: {
      width: 800,
      height: 600
    },
    directionalOverlays: [],
    roomObjects: [
      {
        objectId: "selected-object",
        objectName: "Selected Object",
        asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Ccircle%20cx='32'%20cy='32'%20r='24'%20fill='%238B5CF6'/%3E%3C/svg%3E" },
        x: 140,
        y: 180,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 100,
        presentationCues: [],
        movementDurationMs: 0,
        appearanceSilhouetteStyle: withSilhouette
          ? {
              maskAlphaMode: "soft",
              maskAlphaCutoff: 0,
              pulseMs: 300,
              passes: [
                {
                  name: "primary",
                  blendMode: "normal",
                  colorHexStops: ["#22D3EE", "#A5F3FC"],
                  scaleMultiplierStops: [1.04, 1.1]
                }
              ]
            }
          : undefined
      }
    ]
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for predicate.");
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("PixiGameRenderer appearance outline cues", () => {
  it("applies and removes appearance outline when scene style toggles", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const diagnostics: GameRendererDiagnosticsEvent[] = [];
    const renderer = createGameRenderer(mount, {
      diagnosticsSink: (event) => diagnostics.push(event)
    });
    renderer.resize(800, 600);

    renderer.updateScene(buildScene(true));
    await waitFor(() => diagnostics.some((event) => event.message === "Applied appearance outline cue to room object."), 800);
    expect(diagnostics.some((event) => event.message === "Applied appearance outline cue to room object.")).toBe(true);

    renderer.updateScene(buildScene(false));
    await waitFor(() => diagnostics.some((event) => event.message === "Removed appearance outline cue from room object."), 800);
    expect(diagnostics.some((event) => event.message === "Removed appearance outline cue from room object.")).toBe(true);

    renderer.dispose();
    mount.remove();
  });

  it("applies and removes appearance silhouette when scene style toggles", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const diagnostics: GameRendererDiagnosticsEvent[] = [];
    const renderer = createGameRenderer(mount, {
      diagnosticsSink: (event) => diagnostics.push(event)
    });
    renderer.resize(800, 600);

    renderer.updateScene(buildSilhouetteScene(true));
    await waitFor(() => diagnostics.length > 0, 1500);
    expect(diagnostics.map((event) => event.message)).toContain("Applied appearance silhouette cue to room object.");

    renderer.updateScene(buildSilhouetteScene(false));
    await waitFor(() => diagnostics.some((event) => event.message === "Removed appearance silhouette cue from room object."), 1500);
    expect(diagnostics.map((event) => event.message)).toContain("Removed appearance silhouette cue from room object.");

    renderer.dispose();
    mount.remove();
  });

  it("applies base scale immediately for movement updates", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const diagnostics: GameRendererDiagnosticsEvent[] = [];
    const renderer = createGameRenderer(mount, {
      diagnosticsSink: (event) => diagnostics.push(event)
    });
    renderer.resize(800, 600);

    renderer.updateScene({
      roomId: "movement-scale-room",
      roomLabel: "Movement Scale Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      roomObjects: [
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
          x: 100,
          y: 100,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 100,
          presentationCues: [],
          movementDurationMs: 1000
        }
      ]
    });

    await waitFor(() => (pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>).length > 0, 600);
    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const activeSurfaceRoot = stageRoot?.children?.[0];
      const roomObjectLayer = activeSurfaceRoot?.children?.[1];
      return Array.isArray(roomObjectLayer?.children) && roomObjectLayer.children.length > 0;
    }, 1000);

    renderer.updateScene({
      roomId: "movement-scale-room",
      roomLabel: "Movement Scale Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      roomObjects: [
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
          x: 200,
          y: 100,
          rotationDegrees: 0,
          scale: 0.6,
          zOrder: 100,
          presentationCues: [
            {
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 1000
            }
          ],
          movementDurationMs: 1000
        }
      ]
    });

    await waitFor(
      () => diagnostics.some((event) => event.message === "Animating room object movement from cue timing."),
      1000
    );

    const apps = pixiMocks.__appInstances as Array<{ ticker: { tick: (deltaMs?: number) => void }; stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app.stage.children[0];
    const activeSurfaceRoot = stageRoot.children[0];
    const roomObjectLayer = activeSurfaceRoot.children[1];
    const root = roomObjectLayer.children[0] as {
      position: { x: number };
      children: Array<{ scale: { x: number } }>;
    };
    const baseScaleContainer = root.children[0] as { scale: { x: number } };

    expect(baseScaleContainer.scale.x).toBe(0.6);

    app.ticker.tick(500);
    expect(root.position.x).toBeGreaterThan(100);
    expect(root.position.x).toBeLessThan(200);
    expect(baseScaleContainer.scale.x).toBe(0.6);

    app.ticker.tick(600);
    expect(root.position.x).toBe(200);
    expect(baseScaleContainer.scale.x).toBe(0.6);

    renderer.dispose();
    mount.remove();
  });

  it("defers z-order updates when movement lowers z-order", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const diagnostics: GameRendererDiagnosticsEvent[] = [];
    const renderer = createGameRenderer(mount, {
      diagnosticsSink: (event) => diagnostics.push(event)
    });
    renderer.resize(800, 600);

    renderer.updateScene({
      roomId: "movement-z-room",
      roomLabel: "Movement Z Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      roomObjects: [
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23F97316'/%3E%3C/svg%3E" },
          x: 100,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 220,
          presentationCues: [],
          movementDurationMs: 1000
        }
      ]
    });

    await waitFor(() => (pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>).length > 0, 600);
    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const activeSurfaceRoot = stageRoot?.children?.[0];
      const roomObjectLayer = activeSurfaceRoot?.children?.[1];
      return Array.isArray(roomObjectLayer?.children) && roomObjectLayer.children.length > 0;
    }, 1000);

    renderer.updateScene({
      roomId: "movement-z-room",
      roomLabel: "Movement Z Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      roomObjects: [
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23F97316'/%3E%3C/svg%3E" },
          x: 220,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 120,
          presentationCues: [
            {
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 1000
            }
          ],
          movementDurationMs: 1000
        }
      ]
    });

    await waitFor(
      () => diagnostics.some((event) => event.message === "Animating room object movement from cue timing."),
      1000
    );

    const apps = pixiMocks.__appInstances as Array<{ ticker: { tick: (deltaMs?: number) => void }; stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app.stage.children[0];
    const activeSurfaceRoot = stageRoot.children[0];
    const roomObjectLayer = activeSurfaceRoot.children[1];
    const root = roomObjectLayer.children[0] as { zIndex: number };

    expect(root.zIndex).toBe(220);

    app.ticker.tick(500);
    expect(root.zIndex).toBe(220);

    app.ticker.tick(600);
    expect(root.zIndex).toBe(120);

    renderer.dispose();
    mount.remove();
  });

  it("applies z-order updates immediately when movement raises z-order", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const diagnostics: GameRendererDiagnosticsEvent[] = [];
    const renderer = createGameRenderer(mount, {
      diagnosticsSink: (event) => diagnostics.push(event)
    });
    renderer.resize(800, 600);

    renderer.updateScene({
      roomId: "movement-z-up-room",
      roomLabel: "Movement Z Up Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      roomObjects: [
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2310B981'/%3E%3C/svg%3E" },
          x: 100,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 120,
          presentationCues: [],
          movementDurationMs: 1000
        }
      ]
    });

    await waitFor(() => (pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>).length > 0, 600);
    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const activeSurfaceRoot = stageRoot?.children?.[0];
      const roomObjectLayer = activeSurfaceRoot?.children?.[1];
      return Array.isArray(roomObjectLayer?.children) && roomObjectLayer.children.length > 0;
    }, 1000);

    renderer.updateScene({
      roomId: "movement-z-up-room",
      roomLabel: "Movement Z Up Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      roomObjects: [
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2310B981'/%3E%3C/svg%3E" },
          x: 220,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 220,
          presentationCues: [
            {
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 1000
            }
          ],
          movementDurationMs: 1000
        }
      ]
    });

    await waitFor(
      () => diagnostics.some((event) => event.message === "Animating room object movement from cue timing."),
      1000
    );

    const apps = pixiMocks.__appInstances as Array<{ ticker: { tick: (deltaMs?: number) => void }; stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app.stage.children[0];
    const activeSurfaceRoot = stageRoot.children[0];
    const roomObjectLayer = activeSurfaceRoot.children[1];
    const root = roomObjectLayer.children[0] as { zIndex: number };

    expect(root.zIndex).toBe(220);

    app.ticker.tick(500);
    expect(root.zIndex).toBe(220);

    renderer.dispose();
    mount.remove();
  });

  it("resolves cardinal anchors for opposite rotation conventions in TheDocks and Workshop", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const renderer = createGameRenderer(mount);
    renderer.resize(800, 600);

    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async (assetPath: string) => {
      if (assetPath.includes("north") || assetPath.includes("south")) {
        return { width: 560, height: 120 };
      }

      if (assetPath.includes("east") || assetPath.includes("west")) {
        return { width: 120, height: 420 };
      }

      return { width: 64, height: 64 };
    });

    function getDirectionalSprites(): Array<{
      zIndex: number;
      anchor: { x: number; y: number };
      position: { x: number; y: number };
    }> {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const surfaceRoots = [stageRoot?.children?.[0], stageRoot?.children?.[1]].filter(Boolean);
      const activeSurfaceRoot = surfaceRoots.find((surface) => surface.visible) ?? surfaceRoots[0];
      const directionalLayer = activeSurfaceRoot?.children?.[0];
      return (directionalLayer?.children ?? []) as Array<{
        zIndex: number;
        anchor: { x: number; y: number };
        position: { x: number; y: number };
      }>;
    }

    renderer.updateScene({
      roomId: "thedocks-directional-room",
      roomLabel: "TheDocks Directional Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [
        {
          id: "north-wall",
          slot: "North",
          asset: { assetPath: "data:image/mock;north" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 10
        },
        {
          id: "east-wall",
          slot: "East",
          asset: { assetPath: "data:image/mock;east" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 11
        },
        {
          id: "south-wall",
          slot: "South",
          asset: { assetPath: "data:image/mock;south" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 180,
          scale: 1,
          zOrder: 12
        },
        {
          id: "west-wall",
          slot: "West",
          asset: { assetPath: "data:image/mock;west" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 180,
          scale: 1,
          zOrder: 13
        }
      ],
      roomObjects: []
    });

    await waitFor(() => getDirectionalSprites().length === 4, 1200);

    const docksByZOrder = new Map(getDirectionalSprites().map((sprite) => [sprite.zIndex, sprite]));
    expect(docksByZOrder.get(10)?.anchor.y).toBe(0);
    expect(docksByZOrder.get(11)?.anchor.x).toBe(1);
    expect(docksByZOrder.get(12)?.anchor.y).toBe(0);
    expect(docksByZOrder.get(13)?.anchor.x).toBe(1);
    expect(docksByZOrder.get(10)?.position.y).toBe(0);
    expect(docksByZOrder.get(11)?.position.x).toBe(800);
    expect(docksByZOrder.get(12)?.position.y).toBe(600);
    expect(docksByZOrder.get(13)?.position.x).toBe(0);

    renderer.updateScene({
      roomId: "workshop-directional-room",
      roomLabel: "Workshop Directional Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [
        {
          id: "north-wall",
          slot: "North",
          asset: { assetPath: "data:image/mock;north-workshop" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 180,
          scale: 1,
          zOrder: 20
        },
        {
          id: "east-wall",
          slot: "East",
          asset: { assetPath: "data:image/mock;east-workshop" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 180,
          scale: 1,
          zOrder: 21
        },
        {
          id: "south-wall",
          slot: "South",
          asset: { assetPath: "data:image/mock;south-workshop" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 22
        },
        {
          id: "west-wall",
          slot: "West",
          asset: { assetPath: "data:image/mock;west-workshop" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 23
        }
      ],
      roomObjects: []
    });

    await waitFor(() => {
      const sprites = getDirectionalSprites();
      const zOrderSet = new Set(sprites.map((sprite) => sprite.zIndex));
      return zOrderSet.has(20) && zOrderSet.has(21) && zOrderSet.has(22) && zOrderSet.has(23);
    }, 1200);

    const workshopByZOrder = new Map(getDirectionalSprites().map((sprite) => [sprite.zIndex, sprite]));
    expect(workshopByZOrder.get(20)?.anchor.y).toBe(1);
    expect(workshopByZOrder.get(21)?.anchor.x).toBe(0);
    expect(workshopByZOrder.get(22)?.anchor.y).toBe(1);
    expect(workshopByZOrder.get(23)?.anchor.x).toBe(0);
    expect(workshopByZOrder.get(20)?.position.y).toBe(0);
    expect(workshopByZOrder.get(21)?.position.x).toBe(800);
    expect(workshopByZOrder.get(22)?.position.y).toBe(600);
    expect(workshopByZOrder.get(23)?.position.x).toBe(0);

    renderer.dispose();
    mount.remove();
  });

  it("anchors Down slot to top-left at origin", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const renderer = createGameRenderer(mount);
    renderer.resize(800, 600);

    renderer.updateScene({
      roomId: "down-slot-room",
      roomLabel: "Down Slot Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [
        {
          id: "down-overlay",
          slot: "Down",
          asset: { assetPath: "data:image/mock;down" },
          offsetX: 0,
          offsetY: 0,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 30
        }
      ],
      roomObjects: []
    });

    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const surfaceRoots = [stageRoot?.children?.[0], stageRoot?.children?.[1]].filter(Boolean);
      const activeSurfaceRoot = surfaceRoots.find((surface) => surface.visible) ?? surfaceRoots[0];
      const directionalLayer = activeSurfaceRoot?.children?.[0];
      const overlays = directionalLayer?.children ?? [];
      return overlays.length === 1;
    }, 1200);

    const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app?.stage?.children?.[0];
    const surfaceRoots = [stageRoot?.children?.[0], stageRoot?.children?.[1]].filter(Boolean);
    const activeSurfaceRoot = surfaceRoots.find((surface) => surface.visible) ?? surfaceRoots[0];
    const directionalLayer = activeSurfaceRoot?.children?.[0];
    const overlay = directionalLayer?.children?.[0] as {
      anchor: { x: number; y: number };
      position: { x: number; y: number };
    };

    expect(overlay.anchor.x).toBe(0);
    expect(overlay.anchor.y).toBe(0);
    expect(overlay.position.x).toBe(0);
    expect(overlay.position.y).toBe(0);

    renderer.dispose();
    mount.remove();
  });
});
