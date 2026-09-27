import { Container, RenderTexture, Texture, type Renderer } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import type { GameRenderSceneSnapshot } from "../../contracts/sceneTypes";
import type { GameRendererDiagnosticsEvent } from "../../diagnostics/RendererDiagnostics";
import { RoomLightingController, type RoomLightingControllerDependencies } from "./RoomLightingController";

function scene(overrides: Partial<GameRenderSceneSnapshot> = {}): GameRenderSceneSnapshot {
  return {
    roomId: "room-1",
    displayMode: "composed",
    bounds: { width: 800, height: 600 },
    directionalOverlays: [],
    objectsById: {
      lamp: {
        objectId: "lamp",
        objectName: "Lamp",
        presentationCues: [],
        lighting: { pointLight: { x: 20, y: 30, intensityScale: 0 } }
      }
    },
    lighting: { cellSizePx: 40, ambientLighting: { ambient: 0 } },
    ...overrides
  };
}

function createTestController(
  overrides: Partial<RoomLightingControllerDependencies> = {},
  onDiagnostic = vi.fn<(event: GameRendererDiagnosticsEvent) => void>()
) {
  const renderer = { render: vi.fn() } as unknown as Renderer;
  const sourceTexture = RenderTexture.create({ width: 1, height: 1 });
  const pipeline = {
    setRoomTexture: vi.fn(),
    resize: vi.fn(),
    submitFrame: vi.fn(),
    renderFrame: vi.fn(),
    getOutputs: vi.fn(() => ({ composedTexture: Texture.EMPTY })),
    dispose: vi.fn()
  };
  const dependencies: RoomLightingControllerDependencies = {
    createSourceTexture: vi.fn(() => sourceTexture),
    createPipeline: vi.fn(() => pipeline),
    renderSurface: vi.fn(),
    ...overrides
  };
  const presentationLayer = new Container();
  const controller = new RoomLightingController({
    renderer,
    presentationLayer,
    diagnostics: onDiagnostic,
    dependencies
  });
  return { controller, pipeline, dependencies, presentationLayer, sourceTexture, renderer, onDiagnostic };
}

describe("RoomLightingController", () => {
  it("captures and submits a complete frame only when enabled, then exposes the composed texture", () => {
    const { controller, pipeline, dependencies, presentationLayer, sourceTexture } = createTestController();
    const surface = new Container();
    const sprite = controller.presentationSprite;

    expect(presentationLayer.children).toContain(sprite);
    expect(controller.render(surface, scene(), 12.5)).toBe(false);
    expect(dependencies.renderSurface).not.toHaveBeenCalled();
    expect(pipeline.submitFrame).not.toHaveBeenCalled();

    controller.setEnabled(true);
    expect(controller.render(surface, scene(), 12.5)).toBe(true);
    expect(dependencies.createSourceTexture).toHaveBeenCalledWith(800, 600);
    expect(pipeline.setRoomTexture).toHaveBeenCalledWith({
      texture: sourceTexture,
      geometry: { widthPx: 800, heightPx: 600, cellSizePx: 40 },
      ownership: "borrowed"
    });
    expect(dependencies.renderSurface).toHaveBeenCalledWith(expect.anything(), surface, sourceTexture);
    expect(pipeline.submitFrame).toHaveBeenCalledWith({
      roomLighting: { ambient: 0, ambientColor: "#FFFFFF" },
      pointLights: [{ x: 20, y: 30, intensityScale: 0 }],
      blockers: []
    });
    expect(pipeline.renderFrame).toHaveBeenCalledWith(12.5);
    expect(sprite.visible).toBe(true);

    controller.setEnabled(false);
    expect(sprite.visible).toBe(false);
    controller.dispose();
    expect(pipeline.dispose).toHaveBeenCalledOnce();
  });

  it("renders a temporary composed output for transition capture without changing the live enable state", () => {
    const { controller, pipeline, dependencies } = createTestController();
    const surface = new Container();

    expect(controller.renderForCapture(surface, scene(), 4)).toBe(Texture.EMPTY);
    expect(controller.presentationSprite.visible).toBe(false);
    expect(controller.render(surface, scene(), 5)).toBe(false);
    expect(dependencies.renderSurface).toHaveBeenCalledOnce();
    expect(pipeline.renderFrame).toHaveBeenCalledOnce();

    controller.setEnabled(true);
    expect(controller.renderForCapture(surface, scene(), 6)).toBe(Texture.EMPTY);
    expect(controller.presentationSprite.visible).toBe(true);
    expect(pipeline.renderFrame).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it("resizes package geometry only when room pixels or cell size change", () => {
    const { controller, pipeline } = createTestController();
    controller.setEnabled(true);

    controller.render(new Container(), scene(), 1);
    controller.render(new Container(), scene(), 2);
    expect(pipeline.resize).not.toHaveBeenCalled();

    controller.render(new Container(), scene({
      bounds: { width: 1024, height: 600 },
      lighting: { cellSizePx: 32 }
    }), 3);
    expect(pipeline.resize).toHaveBeenCalledWith({ widthPx: 1024, heightPx: 600, cellSizePx: 32 });
  });

  it("falls back to raw output after a package frame failure and reports once", () => {
    const onDiagnostic = vi.fn<(event: GameRendererDiagnosticsEvent) => void>();
    const { controller, pipeline } = createTestController({}, onDiagnostic);
    pipeline.renderFrame.mockImplementation(() => {
      throw new Error("shader failure");
    });
    controller.setEnabled(true);

    expect(controller.render(new Container(), scene(), 1)).toBe(false);
    expect(controller.presentationSprite.visible).toBe(false);
    expect(controller.render(new Container(), scene(), 2)).toBe(false);
    expect(pipeline.renderFrame).toHaveBeenCalledOnce();
    expect(onDiagnostic).toHaveBeenCalledOnce();
    expect(onDiagnostic.mock.calls[0]?.[0].message).toContain("fallen back to the raw room surface");
    controller.dispose();
  });
});
