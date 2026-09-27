import {
  Container,
  RenderTexture,
  Sprite,
  Texture,
  type Renderer,
  type RenderTexture as PixiRenderTexture
} from "pixi.js";
import { TopDownLightingPipeline } from "@jojo-d-little/storyboard-lighting";
import type { GameRendererDiagnosticsSink } from "../../diagnostics/RendererDiagnostics";
import type {
  GameRenderLightingFrameInput,
  GameRenderRoomGeometryInput,
  GameRenderSceneSnapshot
} from "../../contracts/sceneTypes";
import {
  DEFAULT_LIGHTING_MAX_BLOCKERS,
  DEFAULT_LIGHTING_MAX_LIGHTS,
  mapLightingFrameInput
} from "../../adapters/mapLightingFrameInput";

interface LightingPipeline {
  setRoomTexture: (setup: { texture: Texture; geometry: GameRenderRoomGeometryInput; ownership: "borrowed" }) => void;
  resize: (geometry: GameRenderRoomGeometryInput) => void;
  submitFrame: (frame: GameRenderLightingFrameInput) => void;
  renderFrame: (timeSeconds: number) => void;
  getOutputs: () => { composedTexture: Texture } | null;
  dispose: () => void;
}

export interface RoomLightingControllerDependencies {
  createSourceTexture?: (width: number, height: number) => PixiRenderTexture;
  createPipeline?: (renderer: Renderer) => LightingPipeline;
  renderSurface?: (renderer: Renderer, surface: Container, target: PixiRenderTexture) => void;
}

export interface RoomLightingControllerOptions {
  renderer: Renderer;
  presentationLayer: Container;
  diagnostics?: GameRendererDiagnosticsSink;
  dependencies?: RoomLightingControllerDependencies;
}

function createPipeline(renderer: Renderer): LightingPipeline {
  return new TopDownLightingPipeline({
    renderer,
    maxLights: DEFAULT_LIGHTING_MAX_LIGHTS,
    maxBlockers: DEFAULT_LIGHTING_MAX_BLOCKERS
  }) as unknown as LightingPipeline;
}

function renderSurfaceToTexture(renderer: Renderer, surface: Container, target: PixiRenderTexture): void {
  const previousVisible = surface.visible;
  const previousAlpha = surface.alpha;
  const previousMask = surface.mask;
  const previousX = surface.position.x;
  const previousY = surface.position.y;
  const previousIsRenderGroup = surface.isRenderGroup;

  surface.visible = true;
  surface.alpha = 1;
  surface.mask = null;
  surface.position.set(0, 0);
  try {
    renderer.render({ container: surface, target, clear: true });
  } finally {
    surface.position.set(previousX, previousY);
    if (!previousIsRenderGroup && surface.isRenderGroup) {
      surface.disableRenderGroup();
    }
    surface.mask = previousMask;
    surface.alpha = previousAlpha;
    surface.visible = previousVisible;
  }
}

export class RoomLightingController {
  readonly presentationSprite: Sprite;

  private readonly renderer: Renderer;
  private readonly pipeline: LightingPipeline;
  private readonly diagnostics?: GameRendererDiagnosticsSink;
  private readonly createSourceTexture: (width: number, height: number) => PixiRenderTexture;
  private readonly renderSurface: (renderer: Renderer, surface: Container, target: PixiRenderTexture) => void;
  private sourceTexture: PixiRenderTexture | null = null;
  private geometry: GameRenderRoomGeometryInput | null = null;
  private enabled = false;
  private disposed = false;
  private faulted = false;
  private lastDiagnosticKey = "";

  constructor(options: RoomLightingControllerOptions) {
    this.renderer = options.renderer;
    this.diagnostics = options.diagnostics;
    const dependencies = options.dependencies;
    this.createSourceTexture = dependencies?.createSourceTexture
      ?? ((width, height) => RenderTexture.create({ width, height, resolution: 1 }));
    this.renderSurface = dependencies?.renderSurface ?? renderSurfaceToTexture;
    this.pipeline = dependencies?.createPipeline?.(options.renderer) ?? createPipeline(options.renderer);

    this.presentationSprite = new Sprite(Texture.EMPTY);
    this.presentationSprite.visible = false;
    this.presentationSprite.eventMode = "none";
    this.presentationSprite.zIndex = 5;
    options.presentationLayer.sortableChildren = true;
    options.presentationLayer.addChild(this.presentationSprite);
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    if (enabled && !this.enabled) {
      this.faulted = false;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.presentationSprite.visible = false;
    }
  }

  render(surface: Container, scene: GameRenderSceneSnapshot, timeSeconds: number): boolean {
    if (this.disposed || !this.enabled || this.faulted) {
      this.presentationSprite.visible = false;
      return false;
    }

    const mapped = mapLightingFrameInput(scene);
    if (!mapped.ok) {
      this.presentationSprite.visible = false;
      const diagnosticKey = `${mapped.reason}:${mapped.diagnostics.map((entry) => entry.reason).join("|")}`;
      this.reportOnce(diagnosticKey, "Room lighting is using the raw room surface because the lighting frame is not usable.", {
        reason: mapped.reason,
        diagnostics: mapped.diagnostics
      });
      return false;
    }
    if (mapped.diagnostics.length > 0) {
      this.reportOnce(
        `mapping:${JSON.stringify(mapped.diagnostics)}`,
        "Room lighting ignored one or more invalid Host lighting values.",
        { diagnostics: mapped.diagnostics }
      );
    }

    try {
      this.ensureRoomGeometry(mapped.geometry);
      const sourceTexture = this.sourceTexture;
      if (!sourceTexture) {
        throw new Error("Room lighting source texture was not initialized.");
      }

      this.renderSurface(this.renderer, surface, sourceTexture);
      this.pipeline.submitFrame(mapped.frame);
      this.pipeline.renderFrame(timeSeconds);
      const output = this.pipeline.getOutputs();
      if (!output) {
        this.presentationSprite.visible = false;
        this.reportOnce("missing-output", "Lighting package returned no composed room texture; using the raw room surface.");
        return false;
      }

      this.presentationSprite.texture = output.composedTexture;
      this.presentationSprite.position.set(0, 0);
      this.presentationSprite.visible = true;
      if (mapped.diagnostics.length === 0) {
        this.lastDiagnosticKey = "";
      }
      return true;
    } catch (error) {
      this.presentationSprite.visible = false;
      this.faulted = true;
      this.reportOnce("pipeline-failure", "Room lighting failed and has fallen back to the raw room surface.", {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  renderForCapture(surface: Container, scene: GameRenderSceneSnapshot, timeSeconds: number): Texture | null {
    if (this.disposed) return null;
    const wasEnabled = this.enabled;
    this.setEnabled(true);
    const rendered = this.render(surface, scene, timeSeconds);
    const texture = rendered ? this.presentationSprite.texture : null;
    this.setEnabled(wasEnabled);
    return texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.presentationSprite.visible = false;
    this.pipeline.dispose();
    this.sourceTexture?.destroy(true);
    this.sourceTexture = null;
    this.geometry = null;
    this.presentationSprite.texture = Texture.EMPTY;
    this.presentationSprite.removeFromParent();
    this.presentationSprite.destroy();
  }

  private ensureRoomGeometry(geometry: GameRenderRoomGeometryInput): void {
    if (!this.sourceTexture) {
      this.sourceTexture = this.createSourceTexture(geometry.widthPx, geometry.heightPx);
      this.pipeline.setRoomTexture({
        texture: this.sourceTexture,
        geometry,
        ownership: "borrowed"
      });
      this.geometry = { ...geometry };
      return;
    }

    if (!this.geometry
      || this.geometry.widthPx !== geometry.widthPx
      || this.geometry.heightPx !== geometry.heightPx
      || this.geometry.cellSizePx !== geometry.cellSizePx) {
      if (this.geometry?.widthPx !== geometry.widthPx || this.geometry?.heightPx !== geometry.heightPx) {
        this.sourceTexture.resize(geometry.widthPx, geometry.heightPx, 1);
      }
      this.pipeline.resize(geometry);
      this.geometry = { ...geometry };
    }
  }

  private reportOnce(key: string, message: string, details?: Record<string, unknown>): void {
    if (this.lastDiagnosticKey === key) return;
    this.lastDiagnosticKey = key;
    this.diagnostics?.({
      category: "lifecycle",
      level: "warning",
      message,
      ...(details ? { details } : {})
    });
  }
}
