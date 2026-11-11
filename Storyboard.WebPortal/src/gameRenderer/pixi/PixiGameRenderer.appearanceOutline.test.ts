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
    pivot = new MockPoint();
    scale = new MockPoint();
    alpha = 1;
    zIndex = 0;
    rotation = 0;
    parent: MockContainer | null = null;
    worldTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

    constructor() {
      this.scale.set(1);
    }

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

    getBounds(): { x: number; y: number; width: number; height: number } {
      return { x: this.position.x, y: this.position.y, width: 0, height: 0 };
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
import type { PresentationCueCatalogDocument } from "../contracts/presentationEffects/PresentationCueCatalogEffect";
import { DEFAULT_PRESENTATION_ISOLATION_SETTINGS } from "../presentationIsolation";
import { createSceneObjectsFromRoomObjects } from "../scene/sceneObjects";
import { resolveObjectVisualEffects } from "../presentationCue/resolveObjectVisualEffects";

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
    objectsById: createSceneObjectsFromRoomObjects([
      {
        objectId: "selected-object",
        objectName: "Selected Object",
        asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
        x: 100,
        y: 140,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 100,
        activePresentationCues: [],
        movementDurationMs: 0,
        appearanceOutlineStyle: withOutline
          ? {
              outlineColorHex: "#22D3EE",
              outlineThickness: 2,
              pulseMs: 300
            }
          : undefined
      }
    ])
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
    objectsById: createSceneObjectsFromRoomObjects([
      {
        objectId: "selected-object",
        objectName: "Selected Object",
        asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Ccircle%20cx='32'%20cy='32'%20r='24'%20fill='%238B5CF6'/%3E%3C/svg%3E" },
        x: 140,
        y: 180,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 100,
        activePresentationCues: [],
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
    ])
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
  it("emits a bounded motion trace for moving objects only when verbose diagnostics are enabled", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const diagnostics: GameRendererDiagnosticsEvent[] = [];
    const renderer = createGameRenderer(mount, {
      verboseDiagnostics: true,
      diagnosticsSink: (event) => diagnostics.push(event)
    });
    const scene: GameRenderSceneSnapshot = {
      roomId: "motion-trace-room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: createSceneObjectsFromRoomObjects([{
        objectId: "elevator-car",
        objectName: "Elevator Car",
        asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'/%3E%3C/svg%3E" },
        x: 120,
        y: 240,
        rotationDegrees: 0,
        scale: 1,
        zOrder: 1,
        movementDurationMs: 900,
        activePresentationCues: [{ category: "Movement", effectKey: "movement.elevator" }]
      }])
    };

    try {
      renderer.updateScene(scene);
      await waitFor(() => diagnostics.some((event) => event.message === "Presentation motion trace."), 800);
      const trace = diagnostics.find((event) => event.message === "Presentation motion trace.");
      expect(trace?.category).toBe("frame");
      expect(trace?.details).toMatchObject({
        event: "scene-reconciliation",
        roomId: "motion-trace-room",
        objectId: "elevator-car",
        objectName: "Elevator Car",
        incomingScenePosition: { x: 120, y: 240 }
      });
    } finally {
      renderer.dispose();
      mount.remove();
    }
  });

  it("releases the room-transition callback when the destination transition finishes", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const transitionStates: string[] = [];
    const renderer = createGameRenderer(mount, {
      onRoomTransitionStateChanged: (state) => transitionStates.push(state)
    });
    const scene = (roomId: string): GameRenderSceneSnapshot => ({
      roomId,
      roomLabel: roomId,
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: {},
      roomTransition: { mode: "fade", durationMs: 100 }
    });

    try {
      renderer.updateScene(scene("transition-from"));
      await waitFor(() => transitionStates.includes("complete"), 1000);
      renderer.updateScene(scene("transition-to"));
      await waitFor(() => transitionStates.includes("running"), 1000);

      const app = pixiMocks.__appInstances[pixiMocks.__appInstances.length - 1];
      app?.ticker.tick(150);

      await waitFor(() => transitionStates[transitionStates.length - 1] === "complete", 1000);
      expect(transitionStates).toContain("preparing");
      expect(transitionStates).toContain("running");
      expect(transitionStates[transitionStates.length - 1]).toBe("complete");
    } finally {
      renderer.dispose();
      mount.remove();
    }
  });

  it("reports cancellation as a terminal room-transition state", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const transitionStates: string[] = [];
    const renderer = createGameRenderer(mount, {
      onRoomTransitionStateChanged: (state) => transitionStates.push(state)
    });
    const scene = (roomId: string, durationMs: number): GameRenderSceneSnapshot => ({
      roomId,
      roomLabel: roomId,
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: {},
      roomTransition: { mode: "fade", durationMs }
    });

    try {
      renderer.updateScene(scene("cancel-from", 100));
      await waitFor(() => transitionStates.includes("complete"), 1000);
      renderer.updateScene(scene("cancel-to", 1000));
      await waitFor(() => transitionStates.includes("running"), 1000);
      renderer.updateScene(scene("cancel-final", 0));

      await waitFor(() => transitionStates.includes("cancelled"), 1000);
      await waitFor(() => transitionStates[transitionStates.length - 1] === "complete", 1000);
      expect(transitionStates).toContain("cancelled");
      expect(transitionStates[transitionStates.length - 1]).toBe("complete");
    } finally {
      renderer.dispose();
      mount.remove();
    }
  });

  it("maps image transparency to base sprite alpha, defaulting missing values to opaque", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    renderer.resize(800, 600);
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async () => ({ width: 64, height: 64 }));

    const alphaFor = async (imageTransparency?: number): Promise<number> => {
      renderer.updateScene({
        roomId: "image-transparency-room",
        displayMode: "composed",
        bounds: { width: 800, height: 600 },
        directionalOverlays: [],
        objectsById: createSceneObjectsFromRoomObjects([{
          objectId: "pane-object",
          objectName: "Pane Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23FFFFFF'/%3E%3C/svg%3E" },
          x: 10,
          y: 20,
          rotationDegrees: 0,
          scale: 1,
          ...(imageTransparency === undefined ? {} : { imageTransparency }),
          zOrder: 1,
          activePresentationCues: []
        }])
      });

      const findSprite = (node: any): any => {
        if (node?.texture?.width === 64 && node?.texture?.height === 64 && typeof node.alpha === "number") return node;
        for (const child of node?.children ?? []) {
          const sprite = findSprite(child);
          if (sprite) return sprite;
        }
        return undefined;
      };
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
        const app = apps[apps.length - 1];
        return Boolean(findSprite(app?.stage));
      }, 1000);
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      return findSprite(app.stage).alpha;
    };

    try {
      expect(await alphaFor()).toBe(1);
      expect(await alphaFor(0)).toBe(1);
      expect(await alphaFor(0.5)).toBe(0.5);
      expect(await alphaFor(1)).toBe(0);
    } finally {
      renderer.dispose();
      mount.remove();
    }
  });

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
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
          x: 100,
          y: 100,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 100,
          activePresentationCues: [],
          movementDurationMs: 1000
        }
      ])
    });

    await waitFor(() => (pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>).length > 0, 600);
    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const activeSurfaceRoot = stageRoot?.children?.[0];
      const roomObjectLayer = activeSurfaceRoot?.children?.[0]?.children?.[1];
      return Array.isArray(roomObjectLayer?.children) && roomObjectLayer.children.length > 0;
    }, 1000);

    renderer.updateScene({
      roomId: "movement-scale-room",
      roomLabel: "Movement Scale Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
          x: 200,
          y: 100,
          rotationDegrees: 0,
          scale: 0.6,
          zOrder: 100,
          activePresentationCues: [
            {
              category: "Movement",
              effectKey: "movement.speed.medium",
              activationId: "move-1",
              activationStartAtMs: 10,
              movementDurationMs: 1000
            }
          ],
          movementDurationMs: 1000
        }
      ])
    });

    await waitFor(
      () => diagnostics.some((event) => event.message === "Animating room object movement from cue timing."),
      1000
    );

    const apps = pixiMocks.__appInstances as Array<{ ticker: { tick: (deltaMs?: number) => void }; stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app.stage.children[0];
    const activeSurfaceRoot = stageRoot.children[0];
    const roomObjectLayer = activeSurfaceRoot.children[0].children[1];
    const root = roomObjectLayer.children[0] as {
      position: { x: number };
      children: any[];
    };
    const baseScaleContainer = root.children[0].children[0].children[0] as { scale: { x: number } };

    expect(baseScaleContainer.scale.x).toBe(0.6);

    app.ticker.tick(500);
    expect(root.position.x).toBeGreaterThan(100);
    expect(root.position.x).toBeLessThan(200);
    expect(baseScaleContainer.scale.x).toBe(0.6);

    renderer.updateScene({
      roomId: "movement-scale-room",
      roomLabel: "Movement Scale Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
          x: 200,
          y: 100,
          rotationDegrees: 15,
          scale: 0.6,
          zOrder: 100,
          activePresentationCues: [{
            category: "Movement",
            effectKey: "movement.speed.medium",
            activationId: "move-1",
            activationStartAtMs: 10,
            movementDurationMs: 1000
          }],
          movementDurationMs: 1000
        }
      ])
    });
    await waitFor(() => root.position.x > 100, 500);
    app.ticker.tick(100);
    expect(root.position.x).toBeLessThan(200);

    renderer.updateScene({
      roomId: "movement-scale-room",
      roomLabel: "Movement Scale Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2322D3EE'/%3E%3C/svg%3E" },
          x: 300,
          y: 100,
          rotationDegrees: 15,
          scale: 0.6,
          zOrder: 100,
          activePresentationCues: [{
            category: "Movement",
            effectKey: "movement.speed.medium",
            activationId: "move-2",
            activationStartAtMs: 20,
            movementDurationMs: 1000
          }],
          movementDurationMs: 1000
        }
      ])
    });
    await waitFor(() => diagnostics.filter((event) => event.message === "Animating room object movement from cue timing.").length >= 2, 1000);
    app.ticker.tick(500);
    expect(root.position.x).toBeGreaterThan(100);
    expect(root.position.x).toBeLessThan(300);

    app.ticker.tick(600);
    expect(root.position.x).toBe(300);
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
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23F97316'/%3E%3C/svg%3E" },
          x: 100,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 220,
          activePresentationCues: [],
          movementDurationMs: 1000
        }
      ])
    });

    await waitFor(() => (pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>).length > 0, 600);
    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const activeSurfaceRoot = stageRoot?.children?.[0];
      const roomObjectLayer = activeSurfaceRoot?.children?.[0]?.children?.[1];
      return Array.isArray(roomObjectLayer?.children) && roomObjectLayer.children.length > 0;
    }, 1000);

    renderer.updateScene({
      roomId: "movement-z-room",
      roomLabel: "Movement Z Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23F97316'/%3E%3C/svg%3E" },
          x: 220,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 120,
          activePresentationCues: [
            {
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 1000
            }
          ],
          movementDurationMs: 1000
        }
      ])
    });

    await waitFor(
      () => diagnostics.some((event) => event.message === "Animating room object movement from cue timing."),
      1000
    );

    const apps = pixiMocks.__appInstances as Array<{ ticker: { tick: (deltaMs?: number) => void }; stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app.stage.children[0];
    const activeSurfaceRoot = stageRoot.children[0];
    const roomObjectLayer = activeSurfaceRoot.children[0].children[1];
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
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2310B981'/%3E%3C/svg%3E" },
          x: 100,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 120,
          activePresentationCues: [],
          movementDurationMs: 1000
        }
      ])
    });

    await waitFor(() => (pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>).length > 0, 600);
    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const activeSurfaceRoot = stageRoot?.children?.[0];
      const roomObjectLayer = activeSurfaceRoot?.children?.[0]?.children?.[1];
      return Array.isArray(roomObjectLayer?.children) && roomObjectLayer.children.length > 0;
    }, 1000);

    renderer.updateScene({
      roomId: "movement-z-up-room",
      roomLabel: "Movement Z Up Room",
      displayMode: "composed",
      bounds: { width: 800, height: 600 },
      directionalOverlays: [],
      objectsById: createSceneObjectsFromRoomObjects([
        {
          objectId: "moving-object",
          objectName: "Moving Object",
          asset: { assetPath: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%2310B981'/%3E%3C/svg%3E" },
          x: 220,
          y: 120,
          rotationDegrees: 0,
          scale: 1,
          zOrder: 220,
          activePresentationCues: [
            {
              category: "Movement",
              effectKey: "movement.speed.medium",
              movementDurationMs: 1000
            }
          ],
          movementDurationMs: 1000
        }
      ])
    });

    await waitFor(
      () => diagnostics.some((event) => event.message === "Animating room object movement from cue timing."),
      1000
    );

    const apps = pixiMocks.__appInstances as Array<{ ticker: { tick: (deltaMs?: number) => void }; stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app.stage.children[0];
    const activeSurfaceRoot = stageRoot.children[0];
    const roomObjectLayer = activeSurfaceRoot.children[0].children[1];
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
      const directionalLayer = activeSurfaceRoot?.children?.[0]?.children?.[0];
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
      objectsById: {}
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
      objectsById: {}
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
      objectsById: {}
    });

    await waitFor(() => {
      const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
      const app = apps[apps.length - 1];
      const stageRoot = app?.stage?.children?.[0];
      const surfaceRoots = [stageRoot?.children?.[0], stageRoot?.children?.[1]].filter(Boolean);
      const activeSurfaceRoot = surfaceRoots.find((surface) => surface.visible) ?? surfaceRoots[0];
      const directionalLayer = activeSurfaceRoot?.children?.[0]?.children?.[0];
      const overlays = directionalLayer?.children ?? [];
      return overlays.length === 1;
    }, 1200);

    const apps = pixiMocks.__appInstances as Array<{ stage: { children: any[] } }>;
    const app = apps[apps.length - 1];
    const stageRoot = app?.stage?.children?.[0];
    const surfaceRoots = [stageRoot?.children?.[0], stageRoot?.children?.[1]].filter(Boolean);
    const activeSurfaceRoot = surfaceRoots.find((surface) => surface.visible) ?? surfaceRoots[0];
    const directionalLayer = activeSurfaceRoot?.children?.[0]?.children?.[0];
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

type TransformNode = {
  constructor?: { name?: string };
  children: TransformNode[];
  parent: TransformNode | null;
  alpha?: number;
  position: { x: number; y: number };
  pivot: { x: number; y: number };
  scale: { x: number; y: number };
  rotation: number;
};

function buildElevatorScaleScene(
  multiplier: number | null,
  elevatorRotation = 180,
  baseScale = 1,
  shakeElevator = false,
  scaleActivationId = "elevator-scale",
  shakeActivationId = "elevator-shake"
): GameRenderSceneSnapshot {
  const objectsById = createSceneObjectsFromRoomObjects([
    {
      objectId: "floor",
      objectName: "Elevator Floor",
      asset: { assetPath: "data:image/mock;floor" },
      x: 600,
      y: 80,
      rotationDegrees: 0,
      scale: baseScale,
      zOrder: 1,
      activePresentationCues: [],
      resolvedObjectEffects: multiplier === null ? [] : [{
        kind: "scaleStyle",
        effectKey: multiplier < 1 ? "scale.shrink.medium" : "scale.grow.medium",
        activationId: scaleActivationId,
        style: { targetScaleMultiplier: multiplier, transitionDurationMs: 300 }
      }]
    },
    {
      objectId: "elevator",
      objectName: "Elevator",
      asset: { assetPath: "data:image/mock;elevator" },
      x: 1000,
      y: 480,
      rotationDegrees: elevatorRotation,
      scale: baseScale,
      zOrder: 2,
      activePresentationCues: [],
      resolvedObjectEffects: [
        ...(multiplier === null ? [] : [{
          kind: "scaleStyle" as const,
          effectKey: multiplier < 1 ? "scale.shrink.medium" : "scale.grow.medium",
          activationId: scaleActivationId,
          style: { targetScaleMultiplier: multiplier, transitionDurationMs: 300 }
        }]),
        ...(shakeElevator ? [{
          kind: "shakeStyle" as const,
          effectKey: "shake.elevator",
          activationId: shakeActivationId,
          style: { horizontalDisplacementPx: 0, verticalDisplacementPx: 12, speedHz: 1 }
        }] : [])
      ]
    }
  ]);
  for (const object of Object.values(objectsById)) {
    object.lighting = {
      spatialFootprint: {
        cellX: 0,
        cellY: 0,
        footprintCenterXpx: 800,
        footprintCenterYpx: 280
      }
    };
  }
  return {
    roomId: "elevator-scale-room",
    roomLabel: "Elevator Scale Room",
    displayMode: "composed",
    bounds: { width: 1600, height: 800 },
    directionalOverlays: [],
    objectsById
  };
}

function toRoomPoint(node: TransformNode, point: { x: number; y: number }, roomLayer: TransformNode): { x: number; y: number } {
  let current: TransformNode | null = node;
  let result = point;
  while (current && current !== roomLayer) {
    const x = (result.x - current.pivot.x) * current.scale.x;
    const y = (result.y - current.pivot.y) * current.scale.y;
    const cos = Math.cos(current.rotation);
    const sin = Math.sin(current.rotation);
    result = {
      x: current.position.x + (x * cos) - (y * sin),
      y: current.position.y + (x * sin) + (y * cos)
    };
    current = current.parent;
  }
  if (current !== roomLayer) throw new Error("Object is not in the room layer.");
  return result;
}

function expectRoomPoint(point: { x: number; y: number }, x: number, y: number): void {
  expect(point.x).toBeCloseTo(x, 5);
  expect(point.y).toBeCloseTo(y, 5);
}

function buildSituationalPivotScene(scale: number, pivotOffset?: { x: number; y: number }): GameRenderSceneSnapshot {
  const roomObject = {
    objectId: "white-crate-child",
    objectName: "White Crate Child",
    asset: { assetPath: "data:image/mock;white-crate-child" },
    x: 250,
    y: 235,
    rotationDegrees: 0,
    scale: 0.5,
    additionalSituationalScale: scale,
    ...(pivotOffset ? {
      situationalScalePivotOffsetFromImageXPx: pivotOffset.x,
      situationalScalePivotOffsetFromImageYPx: pivotOffset.y
    } : {}),
    zOrder: 1,
    activePresentationCues: []
  };
  return {
    roomId: "situational-pivot-room",
    displayMode: "composed",
    bounds: { width: 640, height: 480 },
    directionalOverlays: [],
    objectsById: createSceneObjectsFromRoomObjects([roomObject])
  };
}

function buildSituationalOpacityScene(scale: number): GameRenderSceneSnapshot {
  const opacityCue = {
    category: "Disappearance",
    effectKey: "disappearance.fade.out",
    activationId: "held-zero-fade",
    activationStartAtMs: 100
  };
  const opacityCatalog: PresentationCueCatalogDocument = {
    effects: [{
      category: "Disappearance",
      effectKey: "disappearance.fade.out",
      opacityStyle: { initialAlpha: 1, steps: [{ alpha: 0, durationMs: 2000, transition: "linear" }] }
    }]
  };
  const scene = buildScene(false);
  const selected = scene.objectsById["selected-object"];
  if (!selected?.sprite) throw new Error("Expected the situational-scale test object to have a sprite.");
  selected.resolvedObjectEffects = resolveObjectVisualEffects([opacityCue], opacityCatalog);
  selected.sprite = {
    ...selected.sprite,
    x: 250,
    y: 235,
    scale: 0.5,
    imageTransparency: 0.25,
    additionalSituationalScale: scale,
    situationalScalePivotOffsetFromImageXPx: 30,
    situationalScalePivotOffsetFromImageYPx: 45
  };
  return scene;
}

function effectiveAlpha(node: TransformNode): number {
  let alpha = 1;
  let current: TransformNode | null = node;
  while (current) {
    alpha *= current.alpha ?? 1;
    current = current.parent;
  }
  return alpha;
}

function getSingleRoomObjectNodes(): {
  roomLayer: TransformNode;
  root: TransformNode;
  scaleStyle: TransformNode;
  baseScale: TransformNode;
  opacity: TransformNode;
  situationalScale: TransformNode;
  image: TransformNode;
  outline?: TransformNode;
} {
  const apps = pixiMocks.__appInstances as Array<{ stage: { children: TransformNode[] } }>;
  const app = apps[apps.length - 1];
  const roomLayer = app.stage.children[0].children[0].children[0].children[1];
  const root = roomLayer.children[0];
  if (!root) throw new Error("Expected a room object to be rendered.");
  const scaleStyle = root.children[0].children[0];
  if (!scaleStyle) throw new Error("Expected the room object's scale style container.");
  const baseScale = scaleStyle.children[0];
  if (!baseScale) throw new Error("Expected the room object's artwork-fit container.");
  const opacity = baseScale.children[0];
  if (!opacity) throw new Error("Expected the room object's opacity layer.");
  const situationalScale = opacity.children[0];
  if (!situationalScale) throw new Error("Expected the room object's situational scale wrapper.");
  const image = situationalScale.children.find((child) => child !== undefined && child.constructor?.name !== "MockGraphics") ?? situationalScale.children[0];
  if (!image) throw new Error("Expected the room object's image.");
  const outline = situationalScale.children.find((child) => child.constructor?.name === "MockGraphics");
  return { roomLayer, root, scaleStyle, baseScale, opacity, situationalScale, image, outline };
}

function hasSingleRoomObject(): boolean {
  const apps = pixiMocks.__appInstances as Array<{ stage: { children: TransformNode[] } }>;
  const app = apps[apps.length - 1];
  return Boolean(app?.stage?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[1]?.children?.length);
}

function getElevatorNodes(): {
  app: { ticker: { tick: (deltaMs?: number) => void } };
  roomLayer: TransformNode;
  floor: TransformNode;
  elevator: TransformNode;
} {
  const apps = pixiMocks.__appInstances as Array<{
    ticker: { tick: (deltaMs?: number) => void };
    stage: { children: TransformNode[] };
  }>;
  const app = apps[apps.length - 1];
  const roomLayer = app.stage.children[0].children[0].children[0].children[1];
  return { app, roomLayer, floor: roomLayer.children[0], elevator: roomLayer.children[1] };
}

function getSurfaceRoomLayer(surfaceIndex: 0 | 1): TransformNode {
  const apps = pixiMocks.__appInstances as Array<{ stage: { children: TransformNode[] } }>;
  const app = apps[apps.length - 1];
  return app.stage.children[0].children[surfaceIndex].children[0].children[1];
}

function scaleContainer(root: TransformNode): TransformNode {
  return root.children[0].children[0];
}

function sprite(root: TransformNode): TransformNode {
  return scaleContainer(root).children[0].children[0].children[0].children[0];
}

function imageBounds(root: TransformNode, roomLayer: TransformNode): { left: number; top: number; right: number; bottom: number } {
  const image = sprite(root);
  const points = [
    { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }
  ].map((point) => toRoomPoint(image, point, roomLayer));
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y))
  };
}

describe("PixiGameRenderer situational scale pivots", () => {
  it("preserves the legacy self-center pivot when Host offsets are absent", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    (pixiMocks.Assets.load as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ width: 120, height: 80 }));
    try {
      renderer.resize(640, 480);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildSituationalPivotScene(2));
      await waitFor(() => hasSingleRoomObject() && getSingleRoomObjectNodes().baseScale.children[0]?.children?.length === 1, 1000);

      const { roomLayer, root, baseScale, situationalScale: wrapper, image } = getSingleRoomObjectNodes();
      expect(root.position).toMatchObject({ x: 250, y: 235 });
      expect(baseScale.scale.x).toBe(0.5);
      expect(wrapper.pivot).toMatchObject({ x: 60, y: 40 });
      expect(wrapper.position).toMatchObject({ x: 60, y: 40 });
      expectRoomPoint(toRoomPoint(wrapper, wrapper.position, roomLayer), 280, 255);
      // The loaded texture rectangle includes transparent padding; the complete rectangle
      // remains in the legacy self-centered transform.
      expectRoomPoint(toRoomPoint(image, { x: 0, y: 0 }, roomLayer), 220, 215);
      expectRoomPoint(toRoomPoint(image, { x: 120, y: 80 }, roomLayer), 340, 295);
      // Its non-transparent artwork is inset 20px horizontally and 10px vertically.
      expectRoomPoint(toRoomPoint(image, { x: 20, y: 10 }, roomLayer), 240, 225);
      expectRoomPoint(toRoomPoint(image, { x: 100, y: 70 }, roomLayer), 320, 285);
    } finally {
      renderer.dispose();
      mount.remove();
    }
  });

  it("scales the padded image and icon offset around the parent footprint pivot without changing artwork fit", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    (pixiMocks.Assets.load as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ width: 120, height: 80 }));
    try {
      renderer.resize(640, 480);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildSituationalPivotScene(1, { x: 30, y: 45 }));
      await waitFor(() => hasSingleRoomObject() && getSingleRoomObjectNodes().baseScale.children.length === 1, 1000);
      const initial = getSingleRoomObjectNodes();
      expect(initial.root.position).toMatchObject({ x: 250, y: 235 });
      expect(initial.baseScale.scale.x).toBe(0.5);
      expectRoomPoint(toRoomPoint(initial.image, { x: 0, y: 0 }, initial.roomLayer), 250, 235);
      expectRoomPoint(toRoomPoint(initial.image, { x: 120, y: 80 }, initial.roomLayer), 310, 275);

      renderer.updateScene(buildSituationalPivotScene(2, { x: 30, y: 45 }));
      await waitFor(() => hasSingleRoomObject() && getSingleRoomObjectNodes().baseScale.children[0]?.children?.length === 1, 1000);
      const doubled = getSingleRoomObjectNodes();
      const wrapper = doubled.situationalScale;
      expect(doubled.root.position).toMatchObject({ x: 250, y: 235 });
      expect(doubled.baseScale.scale.x).toBe(0.5);
      expect(wrapper.pivot).toMatchObject({ x: 60, y: 90 });
      expect(wrapper.position).toMatchObject({ x: 60, y: 90 });
      expectRoomPoint(toRoomPoint(wrapper, wrapper.position, doubled.roomLayer), 280, 280);
      expectRoomPoint(toRoomPoint(doubled.image, { x: 0, y: 0 }, doubled.roomLayer), 220, 190);
      expectRoomPoint(toRoomPoint(doubled.image, { x: 120, y: 80 }, doubled.roomLayer), 340, 270);
      expectRoomPoint(toRoomPoint(doubled.image, { x: 20, y: 10 }, doubled.roomLayer), 240, 200);
      expectRoomPoint(toRoomPoint(doubled.image, { x: 100, y: 70 }, doubled.roomLayer), 320, 260);

      renderer.updateScene(buildSituationalPivotScene(1.5, { x: 30, y: 45 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const scaled = getSingleRoomObjectNodes();
      const scaledWrapper = scaled.situationalScale;
      expect(scaled.baseScale.scale.x).toBe(0.5);
      expect(scaledWrapper.pivot).toMatchObject({ x: 60, y: 90 });
      expectRoomPoint(toRoomPoint(scaledWrapper, scaledWrapper.position, scaled.roomLayer), 280, 280);
      expectRoomPoint(toRoomPoint(scaled.image, { x: 0, y: 0 }, scaled.roomLayer), 235, 212.5);
      expectRoomPoint(toRoomPoint(scaled.image, { x: 120, y: 80 }, scaled.roomLayer), 325, 272.5);

      renderer.updateScene(buildSituationalPivotScene(1.5, { x: 20, y: 30 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const movedPivot = getSingleRoomObjectNodes();
      const movedPivotWrapper = movedPivot.situationalScale;
      expect(movedPivot.baseScale.scale.x).toBe(0.5);
      expect(movedPivotWrapper.pivot).toMatchObject({ x: 40, y: 60 });
      expectRoomPoint(toRoomPoint(movedPivotWrapper, movedPivotWrapper.position, movedPivot.roomLayer), 270, 265);
      expectRoomPoint(toRoomPoint(movedPivot.image, { x: 0, y: 0 }, movedPivot.roomLayer), 240, 220);
      expectRoomPoint(toRoomPoint(movedPivot.image, { x: 120, y: 80 }, movedPivot.roomLayer), 330, 280);
    } finally {
      renderer.dispose();
      mount.remove();
    }
  });

  it("keeps faded artwork and its attached overlay inside opacity at situational scales 0.5, 1, and 2", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    (pixiMocks.Assets.load as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ width: 120, height: 80 }));
    const now = vi.spyOn(performance, "now").mockReturnValue(3000);
    try {
      renderer.resize(640, 480);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      let attachedOverlay: TransformNode | undefined;
      for (const situationalScale of [0.5, 2, 0.5, 1]) {
        renderer.updateScene(buildSituationalOpacityScene(situationalScale));
        await waitFor(() => hasSingleRoomObject(), 1000);

        const { roomLayer, root, baseScale, opacity, situationalScale: wrapper, image } = getSingleRoomObjectNodes();
        if (!attachedOverlay) {
          attachedOverlay = new pixiMocks.Graphics();
          (wrapper as TransformNode & { addChild: (child: TransformNode) => void }).addChild(attachedOverlay);
        }
        expect(opacity.alpha).toBe(0);
        expect(baseScale.scale.x).toBe(0.5);
        expect(wrapper.scale.x).toBeCloseTo(situationalScale, 6);
        expect(wrapper.parent).toBe(opacity);
        expect(image.parent).toBe(wrapper);
        expect(attachedOverlay.parent).toBe(wrapper);
        expect(effectiveAlpha(opacity)).toBe(0);
        expect(effectiveAlpha(image)).toBe(0);
        expect(effectiveAlpha(attachedOverlay)).toBe(0);
        expect((image as typeof image & { alpha: number }).alpha).toBeCloseTo(0.75);
        expect(root.position).toMatchObject({ x: 250, y: 235 });

        if (situationalScale === 0.5) {
          expectRoomPoint(toRoomPoint(image, { x: 0, y: 0 }, roomLayer), 265, 257.5);
        } else if (situationalScale === 2) {
          expectRoomPoint(toRoomPoint(image, { x: 0, y: 0 }, roomLayer), 220, 190);
        } else {
          expectRoomPoint(toRoomPoint(image, { x: 0, y: 0 }, roomLayer), 250, 235);
        }
      }
    } finally {
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });
});

describe("PixiGameRenderer scale cue pivots", () => {
  it("prepares an immediate Scale and opacity on the hidden destination surface before exposure", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const prepared: Array<{ visible: boolean; scale: number; base: number; situational: number; alpha: number; imageAlpha: number }> = [];
    const renderer = createGameRenderer(mount, {
      onRoomTransitionStateChanged: (state) => {
        if (state !== "running") return;
        const app = pixiMocks.__appInstances[pixiMocks.__appInstances.length - 1] as { stage: TransformNode };
        const staging = app.stage.children[0].children[1];
        const root = staging.children[0].children[1].children[0];
        const scaleStyle = root.children[0].children[0];
        const base = scaleStyle.children[0];
        const opacity = base.children[0];
        const situational = opacity.children[0];
        const image = situational.children[0];
        prepared.push({
          visible: (staging as typeof staging & { visible: boolean }).visible,
          scale: scaleStyle.scale.x,
          base: base.scale.x,
          situational: situational.scale.x,
          alpha: opacity.alpha ?? 1,
          imageAlpha: image.alpha ?? 1
        });
      }
    });
    (pixiMocks.Assets.load as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ width: 64, height: 64 }));
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      renderer.resize(800, 600);
      await waitFor(() => pixiMocks.__appInstances[pixiMocks.__appInstances.length - 1]?.stage.children.length > 0, 1000);
      renderer.updateScene({
        roomId: "source", displayMode: "composed", bounds: { width: 800, height: 600 },
        directionalOverlays: [], objectsById: {}
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const resolvedObjectEffects = resolveObjectVisualEffects([
        { category: "Scale", effectKey: "scale.double.synthetic", activationId: "scale-on", activationStartAtMs: 1000 },
        { category: "Appearance", effectKey: "appearance.synthetic", activationId: "opacity-on", activationStartAtMs: 1000 }
      ], { effects: [
        { category: "Scale", effectKey: "scale.double.synthetic", scaleStyle: { targetScaleMultiplier: 2, transitionDurationMs: 0 } },
        { category: "Appearance", effectKey: "appearance.synthetic", opacityStyle: {
          initialAlpha: 1, steps: [{ alpha: 0.4, durationMs: 0, transition: "immediate" }]
        } }
      ] });
      renderer.updateScene({
        roomId: "destination", displayMode: "composed", bounds: { width: 800, height: 600 },
        directionalOverlays: [], roomTransition: { mode: "fade-blackout", durationMs: 1000 },
        objectsById: createSceneObjectsFromRoomObjects([{
          objectId: "rider", objectName: "Rider", asset: { assetPath: "data:image/mock;rider" },
          x: 100, y: 120, rotationDegrees: 0, scale: 0.75, additionalSituationalScale: 0.8,
          imageTransparency: 0.25, zOrder: 1, activePresentationCues: [], resolvedObjectEffects
        }])
      });
      await waitFor(() => prepared.length === 1, 1000);
      expect(prepared).toEqual([{
        visible: false, scale: 2, base: 0.75, situational: 0.8, alpha: 0.4, imageAlpha: 0.75
      }]);
      expect(prepared[0].scale * prepared[0].base * prepared[0].situational).toBeCloseTo(1.2);
    } finally {
      clock.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });

  it("holds staged scale, opacity, and movement until first visibility, then starts both arrival directions together", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const transitionStates: string[] = [];
    const renderer = createGameRenderer(mount, {
      onRoomTransitionStateChanged: (state) => transitionStates.push(state)
    });
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    let releaseBlocker: ((texture: { width: number; height: number }) => void) | undefined;
    let blockerRequested = false;
    const blockedTexture = new Promise<{ width: number; height: number }>((resolve) => { releaseBlocker = resolve; });
    loadMock.mockImplementation(async (assetPath: string) => {
      if (assetPath.includes("blocked-arrival")) {
        blockerRequested = true;
        return blockedTexture;
      }
      return { width: 64, height: 64 };
    });
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const arrivalObject = (id: "below" | "above", x: number) => {
      const isBelow = id === "below";
      const immediateId = `${id}-immediate`;
      const timedId = `${id}-timed`;
      const fadeId = `${id}-fade`;
      const moveId = `${id}-move`;
      const shakeId = `${id}-shake`;
      const immediateMultiplier = isBelow ? 0.5 : 2;
      const timedMultiplier = isBelow ? 2 : 0.5;
      const immediateKey = isBelow ? "scale.half.immediate" : "scale.double.immediate";
      const timedKey = isBelow ? "scale.grow.slow.deep" : "scale.shrink.slow.deep";
      const cues = [
        { category: "Scale", effectKey: immediateKey, activationId: immediateId, activationStartAtMs: 100 },
        { category: "Scale", effectKey: timedKey, activationId: timedId, activationStartAtMs: 100 },
        { category: "Appearance", effectKey: "appearance.fade.synthetic", activationId: fadeId, activationStartAtMs: 100 },
        { category: "Movement", effectKey: "movement.arrival.synthetic", activationId: moveId, activationStartAtMs: 100 },
        { category: "Shake", effectKey: "shake.arrival.synthetic", activationId: shakeId, activationStartAtMs: 100 }
      ];
      return {
        objectId: id,
        objectName: id,
        asset: { assetPath: `data:image/mock;arrival-${id}` },
        x, y: 100, rotationDegrees: 0, scale: 0.8, additionalSituationalScale: 0.75, zOrder: 1,
        activePresentationCues: cues,
        movementDurationMs: 1000,
        resolvedObjectEffects: [
          { kind: "scaleStyle" as const, effectKey: immediateKey, activationId: immediateId, activationStartAtMs: 100,
            style: { targetScaleMultiplier: immediateMultiplier, transitionDurationMs: 0 } },
          { kind: "scaleStyle" as const, effectKey: timedKey, activationId: timedId, activationStartAtMs: 100,
            style: { targetScaleMultiplier: timedMultiplier, transitionDurationMs: 5000 } },
          { kind: "opacityStyle" as const, category: "appearance" as const, effectKey: "appearance.fade.synthetic",
            activationId: fadeId, activationStartAtMs: 100,
            style: { initialAlpha: 0, steps: [{ alpha: 1, durationMs: 2000, transition: "linear" as const }] } },
          { kind: "shakeStyle" as const, effectKey: "shake.arrival.synthetic", activationId: shakeId, activationStartAtMs: 100,
            style: { horizontalDisplacementPx: 0, verticalDisplacementPx: 12, speedHz: 1 } }
        ]
      };
    };
    const destinationScene = (includeOrdinary = false): GameRenderSceneSnapshot => ({
      roomId: "arrival-destination", displayMode: "composed", bounds: { width: 800, height: 600 },
      directionalOverlays: [], roomTransition: { mode: "slide", travelDirection: "East", durationMs: 1000 },
      objectsById: createSceneObjectsFromRoomObjects([
        arrivalObject("below", 110), arrivalObject("above", 130),
        {
          objectId: "blocker", objectName: "Blocker", asset: { assetPath: "data:image/mock;blocked-arrival" },
          x: 200, y: 100, rotationDegrees: 0, scale: 1, zOrder: 2, activePresentationCues: []
        },
        ...(includeOrdinary ? [{
          objectId: "ordinary", objectName: "Ordinary", asset: { assetPath: "data:image/mock;ordinary-visible" },
          x: 300, y: 100, rotationDegrees: 0, scale: 1, zOrder: 3,
          activePresentationCues: [{ category: "Appearance", effectKey: "appearance.fade.synthetic", activationId: "ordinary-fade", activationStartAtMs: 6500 }],
          resolvedObjectEffects: [{ kind: "opacityStyle" as const, category: "appearance" as const,
            effectKey: "appearance.fade.synthetic", activationId: "ordinary-fade", activationStartAtMs: 6500,
            style: { initialAlpha: 0, steps: [{ alpha: 1, durationMs: 2000, transition: "linear" as const }] } }]
        }] : [])
      ])
    });

    try {
      renderer.resize(800, 600);
      await waitFor(() => pixiMocks.__appInstances[pixiMocks.__appInstances.length - 1]?.stage.children.length > 0, 1000);
      renderer.updateScene({
        roomId: "arrival-source", displayMode: "composed", bounds: { width: 800, height: 600 },
        directionalOverlays: [],
        objectsById: createSceneObjectsFromRoomObjects([
          { objectId: "below", objectName: "below", asset: { assetPath: "data:image/mock;source-below" }, x: 10, y: 100, rotationDegrees: 0, scale: 0.8, zOrder: 1, activePresentationCues: [] },
          { objectId: "above", objectName: "above", asset: { assetPath: "data:image/mock;source-above" }, x: 30, y: 100, rotationDegrees: 0, scale: 0.8, zOrder: 2, activePresentationCues: [] }
        ])
      });
      await waitFor(() => getSurfaceRoomLayer(0).children.length === 2, 1000);

      renderer.updateScene(destinationScene());
      await waitFor(() => blockerRequested && getSurfaceRoomLayer(1).children.length === 2, 1000);
      const stagedLayer = getSurfaceRoomLayer(1);
      const stagedBelow = stagedLayer.children.find((node) => scaleContainer(node).scale.x === 0.5)!;
      const stagedAbove = stagedLayer.children.find((node) => scaleContainer(node).scale.x === 2)!;
      const belowStartX = stagedBelow.position.x;
      const aboveStartX = stagedAbove.position.x;
      const opacityLayer = (root: TransformNode) => root.children[0].children[0].children[0].children[0];
      now.mockReturnValue(6000);
      const app = pixiMocks.__appInstances[pixiMocks.__appInstances.length - 1];
      app?.ticker.tick(3000);
      app?.ticker.tick(2000);
      expect(scaleContainer(stagedBelow).scale.x).toBe(0.5);
      expect(scaleContainer(stagedAbove).scale.x).toBe(2);
      expect(opacityLayer(stagedBelow).alpha).toBe(0);
      expect(opacityLayer(stagedAbove).alpha).toBe(0);
      expect(stagedBelow.children[0].position.y).toBe(12);
      expect(stagedAbove.children[0].position.y).toBe(12);
      expect(stagedBelow.position.x).toBe(belowStartX);
      expect(stagedAbove.position.x).toBe(aboveStartX);

      releaseBlocker?.({ width: 64, height: 64 });
      await waitFor(() => transitionStates.includes("running"), 1000);
      app?.ticker.tick(500);
      expect(scaleContainer(stagedBelow).scale.x).toBe(0.5);
      expect(scaleContainer(stagedAbove).scale.x).toBe(2);
      expect(opacityLayer(stagedBelow).alpha).toBe(0);
      expect(opacityLayer(stagedAbove).alpha).toBe(0);
      expect(stagedBelow.children[0].position.y).toBe(12);
      expect(stagedAbove.children[0].position.y).toBe(12);
      expect(stagedBelow.position.x).toBe(belowStartX);
      expect(stagedAbove.position.x).toBe(aboveStartX);

      now.mockReturnValue(6500);
      app?.ticker.tick(500);
      const activeBelow = stagedBelow;
      const activeAbove = stagedAbove;
      expect(scaleContainer(activeBelow).scale.x).toBeGreaterThan(0.5);
      expect(scaleContainer(activeBelow).scale.x).toBeLessThan(1);
      expect(scaleContainer(activeAbove).scale.x).toBeGreaterThan(1);
      expect(scaleContainer(activeAbove).scale.x).toBeLessThan(2);
      expect(activeBelow.position.x).toBeGreaterThan(belowStartX);
      expect(activeBelow.position.x).toBeLessThan(110);
      expect(activeAbove.position.x).toBeGreaterThan(aboveStartX);
      expect(activeAbove.position.x).toBeLessThan(130);
      expect(opacityLayer(activeBelow).alpha).toBeGreaterThan(0);
      expect(opacityLayer(activeBelow).alpha).toBeLessThan(1);
      expect(activeBelow.children[0].position.y).toBe(-12);
      expect(activeAbove.children[0].position.y).toBe(-12);

      renderer.updateScene(destinationScene(true));
      await waitFor(() => getSurfaceRoomLayer(1).children.length === 4, 1000);
      const ordinary = getSurfaceRoomLayer(1).children.find((node) => node.position.x === 300)!;
      expect(opacityLayer(ordinary).alpha).toBe(0);
    } finally {
      releaseBlocker?.({ width: 64, height: 64 });
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });

  it("keeps the floor and rotated elevator aligned through shrink, hold, shake, and cue removal", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async () => ({ width: 400, height: 400 }));
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      renderer.resize(1600, 800);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildElevatorScaleScene(null));
      await waitFor(() => getElevatorNodes().roomLayer?.children?.length === 2, 1000);
      const { app, roomLayer, floor, elevator } = getElevatorNodes();

      renderer.updateScene(buildElevatorScaleScene(0.5));
      await new Promise((resolve) => setTimeout(resolve, 0));
      for (const root of [floor, elevator]) {
        const scale = scaleContainer(root);
        expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280);
      }

      now.mockReturnValue(1150);
      app.ticker.tick();
      for (const root of [floor, elevator]) {
        const scale = scaleContainer(root);
        expect(scale.scale.x).toBeCloseTo(0.625, 5);
        expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280);
        const bounds = imageBounds(root, roomLayer);
        expectRoomPoint({ x: bounds.left, y: bounds.top }, 675, 155);
        expectRoomPoint({ x: bounds.right, y: bounds.bottom }, 925, 405);
      }

      now.mockReturnValue(1300);
      app.ticker.tick();
      for (const root of [floor, elevator]) {
        const scale = scaleContainer(root);
        expect(scale.scale.x).toBeCloseTo(0.5, 5);
        expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280);
        const bounds = imageBounds(root, roomLayer);
        expectRoomPoint({ x: bounds.left, y: bounds.top }, 700, 180);
        expectRoomPoint({ x: bounds.right, y: bounds.bottom }, 900, 380);
      }

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, true));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      const elevatorScale = scaleContainer(elevator);
      expect(elevator.children[0].position.y).toBeCloseTo(12, 5);
      expectRoomPoint(toRoomPoint(elevatorScale.parent!, elevatorScale.position, roomLayer), 800, 268);

      renderer.updateScene(buildElevatorScaleScene(null));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      for (const root of [floor, elevator]) {
        expect(scaleContainer(root).scale.x).toBe(1);
        const bounds = imageBounds(root, roomLayer);
        expectRoomPoint({ x: bounds.left, y: bounds.top }, 600, 80);
        expectRoomPoint({ x: bounds.right, y: bounds.bottom }, 1000, 480);
      }
    } finally {
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });

  it("anchors grow at the host center with an arbitrary rotation and non-unit authored scale", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async () => ({ width: 400, height: 400 }));
    const now = vi.spyOn(performance, "now").mockReturnValue(2000);
    try {
      renderer.resize(1600, 800);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildElevatorScaleScene(null, 37, 1.5));
      await waitFor(() => getElevatorNodes().roomLayer?.children?.length === 2, 1000);
      const { app, roomLayer, floor, elevator } = getElevatorNodes();

      renderer.updateScene(buildElevatorScaleScene(1.5, 37, 1.5));
      await new Promise((resolve) => setTimeout(resolve, 0));
      for (const root of [floor, elevator]) {
        const scale = scaleContainer(root);
        expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280);
        expectRoomPoint(toRoomPoint(sprite(root), {
          x: scale.pivot.x / 1.5,
          y: scale.pivot.y / 1.5
        }, roomLayer), 800, 280);
      }

      now.mockReturnValue(2150);
      app.ticker.tick();
      for (const root of [floor, elevator]) {
        expect(scaleContainer(root).scale.x).toBeCloseTo(1.375, 5);
        const scale = scaleContainer(root);
        expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280);
      }

      now.mockReturnValue(2300);
      app.ticker.tick();
      for (const root of [floor, elevator]) expect(scaleContainer(root).scale.x).toBeCloseTo(1.5, 5);

      renderer.updateScene(buildElevatorScaleScene(null, 37, 1.5));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      for (const root of [floor, elevator]) {
        expect(scaleContainer(root).scale.x).toBe(1);
        expectRoomPoint(toRoomPoint(scaleContainer(root).parent!, scaleContainer(root).position, roomLayer), 800, 280);
      }
    } finally {
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });

  it("preserves scale and shake phase across repeated deltas, then resets only the removed cue", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async () => ({ width: 400, height: 400 }));
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      renderer.resize(1600, 800);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildElevatorScaleScene(null));
      await waitFor(() => getElevatorNodes().roomLayer?.children?.length === 2, 1000);
      const { app, roomLayer, elevator } = getElevatorNodes();

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, true));
      await new Promise((resolve) => setTimeout(resolve, 0));
      now.mockReturnValue(1125);
      app.ticker.tick();
      const scale = scaleContainer(elevator);
      const shake = elevator.children[0];
      const scaleAt125Ms = scale.scale.x;
      const shakeAt125Ms = shake.position.y;
      expect(scaleAt125Ms).toBeGreaterThan(0.5);
      expect(scaleAt125Ms).toBeLessThan(1);
      expect(shakeAt125Ms).toBeCloseTo(12 * Math.SQRT1_2, 5);

      for (const label of ["delta-one", "delta-two"]) {
        const repeated = buildElevatorScaleScene(0.5, 180, 1, true);
        repeated.roomLabel = label;
        renderer.updateScene(repeated);
        await new Promise((resolve) => setTimeout(resolve, 0));
        app.ticker.tick();
        expect(scale.scale.x).toBeCloseTo(scaleAt125Ms, 5);
        expect(shake.position.y).toBeCloseTo(shakeAt125Ms, 5);
        expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280 - shakeAt125Ms);
      }

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, true, "elevator-scale", "new-shake"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      expect(scale.scale.x).toBeCloseTo(scaleAt125Ms, 5);
      expect(shake.position.y).toBeCloseTo(12, 5);

      renderer.updateScene(buildElevatorScaleScene(null, 180, 1, true, "elevator-scale", "new-shake"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      expect(scale.scale.x).toBe(1);
      expect(shake.position.y).toBeCloseTo(12, 5);

      renderer.updateScene(buildElevatorScaleScene(null));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      expect(shake.position.x).toBe(0);
      expect(shake.position.y).toBe(0);
      expectRoomPoint(toRoomPoint(scale.parent!, scale.position, roomLayer), 800, 280);
    } finally {
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });

  it("starts a new activation and clears object state when the object is removed", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async () => ({ width: 400, height: 400 }));
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      renderer.resize(1600, 800);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildElevatorScaleScene(null));
      await waitFor(() => getElevatorNodes().roomLayer?.children?.length === 2, 1000);
      const { app, roomLayer, elevator } = getElevatorNodes();

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, false, "first"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      now.mockReturnValue(1150);
      app.ticker.tick();
      expect(scaleContainer(elevator).scale.x).toBeCloseTo(0.625, 5);

      const repeated = buildElevatorScaleScene(0.5, 180, 1, false, "first");
      repeated.roomLabel = "same-activation-delta";
      renderer.updateScene(repeated);
      await new Promise((resolve) => setTimeout(resolve, 0));
      now.mockReturnValue(1200);
      app.ticker.tick();
      expect(scaleContainer(elevator).scale.x).toBeCloseTo(5 / 9, 5);

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, false, "second"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.ticker.tick();
      expect(scaleContainer(elevator).scale.x).toBe(1);
      now.mockReturnValue(1350);
      app.ticker.tick();
      expect(scaleContainer(elevator).scale.x).toBeCloseTo(0.625, 5);

      const withoutElevator = buildElevatorScaleScene(null);
      delete withoutElevator.objectsById.elevator;
      renderer.updateScene(withoutElevator);
      await waitFor(() => roomLayer.children.length === 1, 1000);
      expect(elevator.parent).toBeNull();

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, false, "second"));
      await waitFor(() => roomLayer.children.length === 2, 1000);
      const replacement = roomLayer.children[1];
      expect(replacement).not.toBe(elevator);
      expect(scaleContainer(replacement).scale.x).toBe(1);
      now.mockReturnValue(1500);
      app.ticker.tick();
      expect(scaleContainer(replacement).scale.x).toBeCloseTo(0.625, 5);
    } finally {
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });

  it("neutralizes transient effects when presentation is disabled and clears the old room", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const renderer = createGameRenderer(mount);
    const loadMock = pixiMocks.Assets.load as ReturnType<typeof vi.fn>;
    loadMock.mockImplementation(async () => ({ width: 400, height: 400 }));
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    try {
      renderer.resize(1600, 800);
      await waitFor(() => {
        const apps = pixiMocks.__appInstances as Array<{ stage: { children: unknown[] } }>;
        return apps[apps.length - 1]?.stage.children.length > 0;
      }, 1000);
      renderer.updateScene(buildElevatorScaleScene(null));
      await waitFor(() => getElevatorNodes().roomLayer?.children?.length === 2, 1000);
      const { app, roomLayer, elevator } = getElevatorNodes();

      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, true));
      await new Promise((resolve) => setTimeout(resolve, 0));
      now.mockReturnValue(1125);
      app.ticker.tick();
      const scale = scaleContainer(elevator);
      const shake = elevator.children[0];
      expect(scale.scale.x).toBeLessThan(1);
      expect(shake.position.y).not.toBe(0);

      renderer.setPresentationIsolationSettings({ ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS, enabled: false });
      app.ticker.tick();
      expect(scale.scale.x).toBe(1);
      expect(shake.position.x).toBe(0);
      expect(shake.position.y).toBe(0);

      renderer.updateScene(buildElevatorScaleScene(null));
      await new Promise((resolve) => setTimeout(resolve, 0));
      renderer.setPresentationIsolationSettings(DEFAULT_PRESENTATION_ISOLATION_SETTINGS);
      app.ticker.tick();
      expect(scale.scale.x).toBe(1);
      expect(shake.position.y).toBe(0);

      now.mockReturnValue(1200);
      renderer.updateScene(buildElevatorScaleScene(0.5, 180, 1, true, "room-exit"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      now.mockReturnValue(1325);
      app.ticker.tick();
      expect(scale.scale.x).toBeLessThan(1);
      expect(shake.position.y).not.toBe(0);

      const nextRoom: GameRenderSceneSnapshot = {
        ...buildElevatorScaleScene(null),
        roomId: "after-elevator-room",
        objectsById: {}
      };
      renderer.updateScene(nextRoom);
      await waitFor(() => roomLayer.children.length === 0, 1000);
      expect(elevator.parent).toBeNull();
      app.ticker.tick();
      expect(roomLayer.children).toHaveLength(0);
    } finally {
      now.mockRestore();
      renderer.dispose();
      mount.remove();
    }
  });
});
