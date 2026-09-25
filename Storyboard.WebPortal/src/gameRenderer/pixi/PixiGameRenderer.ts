import type { GameRendererDiagnosticsSink } from "../diagnostics/RendererDiagnostics";
import type { GameRendererIntentSink } from "../contracts/intents";
import type { GameRenderSceneSnapshot } from "../contracts/sceneTypes";
import { computeContainTransform } from "../scaling/containScaling";
import { planMovementRetarget } from "./reconciliation/movementRetargetPlanner";
import { buildLegByLegSegments, type MovementTweenSegment } from "./reconciliation/legByLegPathBuilder";
import { areHudOverlayEntriesEquivalent, createHudOverlayController } from "./hud/HudOverlayController";
import { createAppearanceOutlineEffectController, type AppearanceOutlineEffectController } from "./effects/appearanceOutline/AppearanceOutlineEffectController";
import { createAppearanceSilhouetteEffectController, type AppearanceSilhouetteEffectController } from "./effects/appearanceSilhouette/AppearanceSilhouetteEffectController";
import { captureRoomTexture, type CapturedRoomTexture } from "./RoomSnapshotRenderer";
import {
  createStyledPointEffectController,
  type StyledPointEffectController,
  type StyledPointEffectIntent
} from "./effects/styledPoint/StyledPointEffectController";
import {
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  isPresentationCategoryEnabled,
  type PresentationIsolationSettings
} from "../presentationIsolation";
import type { Ticker } from "pixi.js";
import { Application, Assets, Container, Graphics, Sprite } from "pixi.js";

export type GameRendererRoomTransitionState = "preparing" | "running" | "complete" | "failed";

export interface CreateGameRendererOptions {
  diagnosticsSink?: GameRendererDiagnosticsSink;
  intentSink?: GameRendererIntentSink;
  onRoomTransitionStateChanged?: (state: GameRendererRoomTransitionState) => void;
  presentationIsolationSettings?: PresentationIsolationSettings;
}

export type GameRendererInteractionMode = "CommandClick" | "WaypointMoveSetup";

export interface GameRendererRoomPoint {
  x: number;
  y: number;
}

export type SetInteractionModeResult = "changed" | "unchanged";

export interface GameRendererHandle {
  updateScene: (scene: GameRenderSceneSnapshot) => void;
  prepareRoomTransitionSnapshot: (requestedMode?: "slide" | "fade" | "fade-blackout") => void;
  resize: (width: number, height: number) => void;
  setInteractionMode: (mode: GameRendererInteractionMode) => SetInteractionModeResult;
  getInteractionMode: () => GameRendererInteractionMode;
  appendWaypointDraft: (point: GameRendererRoomPoint) => number;
  getWaypointsSnapshot: () => readonly GameRendererRoomPoint[];
  clearWaypoints: () => void;
  removeLastWaypoint: () => boolean;
  applyStyledPointEffectIntent: (input: StyledPointEffectIntent) => void;
  setPresentationIsolationSettings: (settings: PresentationIsolationSettings) => void;
  dispose: () => void;
}

interface MovementTween {
  objectId: string;
  state: RoomObjectSpriteState;
  segments: MovementTweenSegment[];
  segmentIndex: number;
  elapsedMs: number;
  totalDurationMs: number;
  totalElapsedMs: number;
  baseScale: number;
  fromSituationalScale: number;
  toSituationalScale: number;
  toZOrder: number;
}

interface RoomObjectSpriteState {
  root: Container;
  baseScaleContainer: Container;
  situationalScaleContainer: Container | null;
  sprite: Sprite;
  effectTransformHost: Container;
  assetPath: string;
}

interface RoomSurfaceState {
  label: "active" | "staging";
  root: Container;
  clipMask: Graphics;
  directionalOverlayLayer: Container;
  roomObjectLayer: Container;
  styledPointLayer: Container;
  activeMovementTweensByObjectId: Map<string, MovementTween>;
  roomObjectSpritesById: Map<string, RoomObjectSpriteState>;
  appearanceOutlineEffectController: AppearanceOutlineEffectController;
  appearanceSilhouetteEffectController: AppearanceSilhouetteEffectController;
  styledPointEffectController: StyledPointEffectController;
}

interface RoomSwapTween {
  generation: number;
  mode: "slide" | "fade" | "fade-blackout";
  cueEffectKey: string;
  durationMs: number;
  elapsedMs: number;
  outgoingEndX: number;
  outgoingEndY: number;
  incomingStartX: number;
  incomingStartY: number;
  direction: string;
  pendingBoundsWidth?: number;
  pendingBoundsHeight?: number;
  hasAppliedBoundsSwap?: boolean;
  usesSnapshotFrames?: boolean;
}

interface SnapshotTransitionState {
  outgoing: CapturedRoomTexture;
  incoming: CapturedRoomTexture;
  outgoingFrame: Container;
  incomingFrame: Container;
}

function areSilhouettePassesEquivalent(
  leftStyle: GameRenderSceneSnapshot["roomObjects"][number]["appearanceSilhouetteStyle"] | undefined,
  rightStyle: GameRenderSceneSnapshot["roomObjects"][number]["appearanceSilhouetteStyle"] | undefined
): boolean {
  const leftPasses = leftStyle?.passes ?? [];
  const rightPasses = rightStyle?.passes ?? [];

  if (leftPasses.length !== rightPasses.length) {
    return false;
  }

  for (let index = 0; index < leftPasses.length; index += 1) {
    const leftPass = leftPasses[index];
    const rightPass = rightPasses[index];
    if (!leftPass || !rightPass) {
      return false;
    }

    if ((leftPass.name ?? "") !== (rightPass.name ?? "")
      || (leftPass.enabled ?? true) !== (rightPass.enabled ?? true)
      || (leftPass.blendMode ?? "normal") !== (rightPass.blendMode ?? "normal")
      || leftPass.colorHexStops.length !== rightPass.colorHexStops.length
      || leftPass.scaleMultiplierStops.length !== rightPass.scaleMultiplierStops.length
      || (leftPass.alphaStops ?? []).length !== (rightPass.alphaStops ?? []).length) {
      return false;
    }

    for (let passIndex = 0; passIndex < leftPass.colorHexStops.length; passIndex += 1) {
      if (leftPass.colorHexStops[passIndex] !== rightPass.colorHexStops[passIndex]) {
        return false;
      }
    }

    for (let passIndex = 0; passIndex < leftPass.scaleMultiplierStops.length; passIndex += 1) {
      if (leftPass.scaleMultiplierStops[passIndex] !== rightPass.scaleMultiplierStops[passIndex]) {
        return false;
      }
    }

    const leftAlphaStops = leftPass.alphaStops ?? [];
    const rightAlphaStops = rightPass.alphaStops ?? [];
    for (let passIndex = 0; passIndex < leftAlphaStops.length; passIndex += 1) {
      if (leftAlphaStops[passIndex] !== rightAlphaStops[passIndex]) {
        return false;
      }
    }

    if (leftPass.enabled === false && rightPass.enabled === false) {
      continue;
    }

    if ((leftPass.enabled ?? true) !== (rightPass.enabled ?? true)) {
      return false;
    }
  }

  return true;
}

export function createGameRenderer(mountElement: HTMLElement, options: CreateGameRendererOptions = {}): GameRendererHandle {
  const diagnostics = options.diagnosticsSink;
  void options.intentSink;

  let presentationIsolationSettings: PresentationIsolationSettings = options.presentationIsolationSettings
    ? {
        enabled: options.presentationIsolationSettings.enabled,
        categories: { ...options.presentationIsolationSettings.categories }
      }
    : {
        enabled: DEFAULT_PRESENTATION_ISOLATION_SETTINGS.enabled,
        categories: { ...DEFAULT_PRESENTATION_ISOLATION_SETTINGS.categories }
      };

  const app = new Application();
  const stageRoot = new Container();
  stageRoot.sortableChildren = true;

  const blackoutOverlay = new Graphics();
  const snapshotTransitionLayer = new Container();
  const snapshotTransitionMask = new Graphics();
  snapshotTransitionLayer.visible = false;
  snapshotTransitionLayer.mask = snapshotTransitionMask;

  function createRoomSurface(label: "active" | "staging"): RoomSurfaceState {
    const root = new Container();
    root.sortableChildren = true;

    const content = new Container();
    const surfaceClipMask = new Graphics();
    content.mask = surfaceClipMask;

    const directionalOverlayLayer = new Container();
    directionalOverlayLayer.sortableChildren = true;

    const roomObjectLayer = new Container();
    roomObjectLayer.sortableChildren = true;

    const styledPointLayer = new Container();
    styledPointLayer.sortableChildren = true;

    content.addChild(directionalOverlayLayer);
    content.addChild(roomObjectLayer);
    content.addChild(styledPointLayer);
    root.addChild(content);
    root.addChild(surfaceClipMask);

    return {
      label,
      root,
      clipMask: surfaceClipMask,
      directionalOverlayLayer,
      roomObjectLayer,
      styledPointLayer,
      activeMovementTweensByObjectId: new Map<string, MovementTween>(),
      roomObjectSpritesById: new Map<string, RoomObjectSpriteState>(),
      appearanceOutlineEffectController: createAppearanceOutlineEffectController({
        roomObjectLayer,
        diagnostics
      }),
      appearanceSilhouetteEffectController: createAppearanceSilhouetteEffectController({
        roomObjectLayer,
        diagnostics
      }),
      styledPointEffectController: createStyledPointEffectController({
        layer: styledPointLayer,
        diagnostics
      })
    };
  }

  let activeRoomSurface = createRoomSurface("active");
  let stagingRoomSurface = createRoomSurface("staging");
  activeRoomSurface.root.visible = true;
  stagingRoomSurface.root.visible = false;

  stageRoot.addChild(activeRoomSurface.root);
  stageRoot.addChild(stagingRoomSurface.root);
  stageRoot.addChild(blackoutOverlay);

  blackoutOverlay.zIndex = 10_000;
  blackoutOverlay.alpha = 0;
  blackoutOverlay.visible = false;

  let isReady = false;
  let isDisposed = false;
  let currentScene: GameRenderSceneSnapshot | null = null;
  let renderGeneration = 0;
  let viewportWidth = 800;
  let viewportHeight = 600;
  let activeRoomSwapTween: RoomSwapTween | null = null;
  let snapshotTransitionState: SnapshotTransitionState | null = null;
  let preparedOutgoingSnapshot: CapturedRoomTexture | null = null;
  let preparedOutgoingFrame: Container | null = null;
  let activeSurfaceScene: GameRenderSceneSnapshot | null = null;
  let interactionMode: GameRendererInteractionMode = "CommandClick";
  const waypointDraft: GameRendererRoomPoint[] = [];
  const hudOverlayController = createHudOverlayController(() => isDisposed);

  function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  function normalizeSituationalScale(value: number | undefined): number {
    if (!Number.isFinite(value) || !value || value <= 0) {
      return 1;
    }

    const normalized = Number(value);
    return Math.abs(normalized - 1) <= 0.0001 ? 1 : normalized;
  }

  function resolveCurrentSituationalScale(state: RoomObjectSpriteState): number {
    if (!state.situationalScaleContainer) {
      return 1;
    }

    const current = state.situationalScaleContainer.scale.x;
    return normalizeSituationalScale(current);
  }

  function applyScaleLayers(
    state: RoomObjectSpriteState,
    baseScale: number,
    situationalScaleRaw: number | undefined
  ): void {
    const situationalScale = normalizeSituationalScale(situationalScaleRaw);
    const clampedBaseScale = Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1;
    const textureWidth = Math.max(1, state.sprite.texture.width);
    const textureHeight = Math.max(1, state.sprite.texture.height);

    state.baseScaleContainer.scale.set(clampedBaseScale);

    if (situationalScale === 1) {
      if (state.situationalScaleContainer) {
        const wrapper = state.situationalScaleContainer;
        if (state.sprite.parent === wrapper) {
          wrapper.removeChild(state.sprite);
        }

        state.baseScaleContainer.addChild(state.sprite);
        state.sprite.position.set(0, 0);
        state.sprite.anchor.set(0, 0);
        state.situationalScaleContainer = null;
        state.effectTransformHost = state.baseScaleContainer;
        wrapper.destroy({ children: false });
      } else {
        state.effectTransformHost = state.baseScaleContainer;
      }

      return;
    }

    let wrapper = state.situationalScaleContainer;
    if (!wrapper) {
      wrapper = new Container();
      state.baseScaleContainer.addChild(wrapper);
      state.situationalScaleContainer = wrapper;
    }

    if (state.sprite.parent !== wrapper) {
      if (state.sprite.parent) {
        state.sprite.parent.removeChild(state.sprite);
      }

      wrapper.addChild(state.sprite);
      state.sprite.position.set(0, 0);
      state.sprite.anchor.set(0, 0);
    }

    wrapper.pivot.set(textureWidth * 0.5, textureHeight * 0.5);
    wrapper.position.set(textureWidth * 0.5, textureHeight * 0.5);
    wrapper.scale.set(situationalScale);
    state.effectTransformHost = wrapper;
  }

  function emit(level: "debug" | "info" | "warning" | "error", message: string, details?: unknown): void {
    diagnostics?.({
      category: "scene",
      level,
      message,
      details
    });
  }

  function reportRoomTransitionState(state: GameRendererRoomTransitionState): void {
    options.onRoomTransitionStateChanged?.(state);
  }

  function clearSnapshotTransition(): void {
    snapshotTransitionLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    snapshotTransitionLayer.visible = false;
    const state = snapshotTransitionState;
    snapshotTransitionState = null;
    state?.outgoing.dispose();
    state?.incoming.dispose();
  }

  function clearPreparedOutgoingSnapshot(): void {
    if (preparedOutgoingFrame) {
      if (preparedOutgoingFrame.parent) {
        preparedOutgoingFrame.parent.removeChild(preparedOutgoingFrame);
      }
      preparedOutgoingFrame.destroy({ children: true });
      preparedOutgoingFrame = null;
    }
    preparedOutgoingSnapshot?.dispose();
    preparedOutgoingSnapshot = null;
    if (!activeRoomSwapTween) {
      snapshotTransitionLayer.visible = false;
      activeRoomSurface.root.visible = true;
    }
  }

  function createViewportSnapshotFrame(snapshot: CapturedRoomTexture): Container {
    const frame = new Container();
    const background = new Graphics()
      .rect(0, 0, viewportWidth, viewportHeight)
      .fill(0x0f172a);
    const sprite = new Sprite(snapshot.texture);
    const transform = computeContainTransform(
      snapshot.width,
      snapshot.height,
      viewportWidth,
      viewportHeight
    );
    sprite.position.set(transform.offsetX, transform.offsetY);
    sprite.scale.set(transform.scale);
    frame.addChild(background);
    frame.addChild(sprite);
    return frame;
  }

  function captureSurfaceSnapshot(
    surface: RoomSurfaceState,
    scene: GameRenderSceneSnapshot
  ): CapturedRoomTexture {
    const captureStartedAt = performance.now();
    const roomId = scene.roomId ?? "";
    emit("debug", "Started room snapshot capture.", {
      roomId: roomId || "(unknown)",
      surface: surface.label,
      width: scene.bounds.width,
      height: scene.bounds.height,
      viewportWidth,
      viewportHeight
    });

    const transform = computeContainTransform(
      scene.bounds.width,
      scene.bounds.height,
      viewportWidth,
      viewportHeight
    );
    try {
      const captured = captureRoomTexture(app.renderer, surface.root, {
        roomId,
        width: scene.bounds.width,
        height: scene.bounds.height,
        resolutionScale: transform.scale * app.renderer.resolution
      });
      emit("info", "Completed room snapshot capture.", {
        roomId: roomId || "(unknown)",
        surface: surface.label,
        width: captured.width,
        height: captured.height,
        resolution: captured.resolution,
        durationMs: performance.now() - captureStartedAt
      });
      return captured;
    } catch (error) {
      emit("warning", "Room snapshot capture failed.", {
        roomId: roomId || "(unknown)",
        surface: surface.label,
        width: scene.bounds.width,
        height: scene.bounds.height,
        durationMs: performance.now() - captureStartedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  function prepareSnapshotTransition(
    outgoingScene: GameRenderSceneSnapshot,
    incomingScene: GameRenderSceneSnapshot,
    preCapturedOutgoing?: CapturedRoomTexture
  ): boolean {
    clearSnapshotTransition();

    try {
      const outgoing = preCapturedOutgoing ?? captureSurfaceSnapshot(activeRoomSurface, outgoingScene);

      let incoming: CapturedRoomTexture;
      try {
        incoming = captureSurfaceSnapshot(stagingRoomSurface, incomingScene);
      } catch (error) {
        outgoing.dispose();
        throw error;
      }

      const outgoingFrame = createViewportSnapshotFrame(outgoing);
      const incomingFrame = createViewportSnapshotFrame(incoming);
      snapshotTransitionLayer.addChild(outgoingFrame);
      snapshotTransitionLayer.addChild(incomingFrame);
      snapshotTransitionLayer.visible = true;
      snapshotTransitionState = {
        outgoing,
        incoming,
        outgoingFrame,
        incomingFrame
      };

      emit("info", "Prepared bounded room snapshots for slide transition.", {
        outgoingRoomId: outgoing.roomId || "(unknown)",
        incomingRoomId: incoming.roomId || "(unknown)",
        outgoingWidth: outgoing.width,
        outgoingHeight: outgoing.height,
        incomingWidth: incoming.width,
        incomingHeight: incoming.height,
        outgoingResolution: outgoing.resolution,
        incomingResolution: incoming.resolution,
        viewportWidth,
        viewportHeight
      });
      return true;
    } catch (error) {
      clearSnapshotTransition();
      emit("warning", "Failed to prepare bounded room snapshots; falling back to fade-blackout.", {
        outgoingRoomId: outgoingScene.roomId || "(unknown)",
        incomingRoomId: incomingScene.roomId || "(unknown)",
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  function syncRoomObjectAppearanceEffects(surface: RoomSurfaceState, objectId: string): void {
    const roomObjectSpriteState = surface.roomObjectSpritesById.get(objectId);
    if (!roomObjectSpriteState) {
      return;
    }

    surface.appearanceOutlineEffectController.syncObjectTransform(
      objectId,
      roomObjectSpriteState.effectTransformHost,
      roomObjectSpriteState.sprite);
    surface.appearanceSilhouetteEffectController.syncObjectTransform(
      objectId,
      roomObjectSpriteState.effectTransformHost,
      roomObjectSpriteState.sprite);
  }

  function clearDirectionalOverlaySprites(surface: RoomSurfaceState): void {
    surface.directionalOverlayLayer.removeChildren().forEach((child) => {
      child.destroy();
    });
  }

  function clearRoomObjectSprites(surface: RoomSurfaceState): void {
    surface.activeMovementTweensByObjectId.clear();
    surface.appearanceOutlineEffectController.clear();
    surface.appearanceSilhouetteEffectController.clear();
    surface.roomObjectSpritesById.clear();

    surface.roomObjectLayer.removeChildren().forEach((child) => {
      child.destroy();
    });
  }

  function completeMovementTweens(surface: RoomSurfaceState, reason: string): void {
    if (surface.activeMovementTweensByObjectId.size === 0) {
      return;
    }

    for (const [objectId, tween] of surface.activeMovementTweensByObjectId) {
      const finalSegment = tween.segments[tween.segments.length - 1];
      if (!finalSegment) {
        surface.activeMovementTweensByObjectId.delete(objectId);
        continue;
      }

      tween.state.root.position.set(finalSegment.toX, finalSegment.toY);
      tween.state.root.zIndex = tween.toZOrder;
      applyScaleLayers(tween.state, tween.baseScale, tween.toSituationalScale);
      syncRoomObjectAppearanceEffects(surface, objectId);
      surface.activeMovementTweensByObjectId.delete(objectId);
    }

    diagnostics?.({
      category: "scene",
      level: "info",
      message: "Completed active movement effects after presentation isolation changed.",
      details: {
        surface: surface.label,
        reason
      }
    });
  }

  function clearSurfaceSprites(surface: RoomSurfaceState): void {
    clearDirectionalOverlaySprites(surface);
    clearRoomObjectSprites(surface);
    surface.styledPointEffectController.clear();
  }

  function clearAllSceneSprites(): void {
    clearSurfaceSprites(activeRoomSurface);
    clearSurfaceSprites(stagingRoomSurface);
    hudOverlayController.clear();
  }

  function removeRoomObjectSprite(surface: RoomSurfaceState, objectId: string): void {
    surface.activeMovementTweensByObjectId.delete(objectId);
    const existing = surface.roomObjectSpritesById.get(objectId);
    if (!existing) {
      return;
    }

    surface.appearanceOutlineEffectController.removeObject(objectId);
    surface.appearanceSilhouetteEffectController.removeObject(objectId);
    surface.roomObjectSpritesById.delete(objectId);
    if (existing.root.parent) {
      existing.root.parent.removeChild(existing.root);
    }
    existing.root.destroy({ children: true });
  }

  function finalizeRoomSwap(previousActiveSurface: RoomSurfaceState): void {
    previousActiveSurface.root.visible = false;
    clearSurfaceSprites(previousActiveSurface);
  }

  function activateStagedSurface(): void {
    const previousActiveSurface = activeRoomSurface;
    activeRoomSurface = stagingRoomSurface;
    stagingRoomSurface = previousActiveSurface;

    activeRoomSurface.root.position.set(0, 0);
    activeRoomSurface.root.alpha = 1;
    stagingRoomSurface.root.position.set(0, 0);
    stagingRoomSurface.root.alpha = 1;
    activeRoomSurface.root.visible = true;
    stagingRoomSurface.root.visible = false;
    finalizeRoomSwap(stagingRoomSurface);
  }

  function resolveTravelUnitVector(direction: string | undefined): { x: number; y: number } | null {
    switch ((direction ?? "").trim().toLowerCase()) {
      case "north":
        return { x: 0, y: -1 };
      case "northeast":
        return { x: 1, y: -1 };
      case "east":
        return { x: 1, y: 0 };
      case "southeast":
        return { x: 1, y: 1 };
      case "south":
        return { x: 0, y: 1 };
      case "southwest":
        return { x: -1, y: 1 };
      case "west":
        return { x: -1, y: 0 };
      case "northwest":
        return { x: -1, y: -1 };
      default:
        return null;
    }
  }

  function cancelRoomSwapTween(
    clearStaging: boolean,
    reason = "cancelled"
  ): void {
    if (!activeRoomSwapTween) {
      return;
    }

    emit("warning", "Cancelled room transition.", {
      mode: activeRoomSwapTween.mode,
      generation: activeRoomSwapTween.generation,
      reason
    });
    activeRoomSwapTween = null;
    blackoutOverlay.alpha = 0;
    blackoutOverlay.visible = false;
    activeRoomSurface.root.position.set(0, 0);
    activeRoomSurface.root.alpha = 1;
    stagingRoomSurface.root.position.set(0, 0);
    stagingRoomSurface.root.alpha = 1;
    stagingRoomSurface.root.visible = false;
    clearSnapshotTransition();

    if (clearStaging) {
      clearSurfaceSprites(stagingRoomSurface);
    }
  }

  function beginRoomSwapTween(
    scene: GameRenderSceneSnapshot,
    generation: number,
    modeOverride?: RoomSwapTween["mode"]
  ): boolean {
    if (!isPresentationCategoryEnabled(presentationIsolationSettings, "roomTransition")) {
      emit("info", "Suppressed room-transition presentation effect.", {
        roomId: scene.roomId || "(unknown)",
        cueCategory: scene.roomTransition?.cueCategory || "(none)",
        cueEffectKey: scene.roomTransition?.cueEffectKey || "(none)"
      });
      return false;
    }

    const durationMs = Math.max(0, Math.round(scene.roomTransition?.durationMs ?? 0));
    if (durationMs <= 0) {
      return false;
    }

    const cueEffectKey = scene.roomTransition?.cueEffectKey ?? "";
    const mode = modeOverride ?? scene.roomTransition?.mode ?? "slide";

    if (mode === "fade-blackout") {
      activeRoomSwapTween = {
        generation,
        mode,
        cueEffectKey,
        durationMs,
        elapsedMs: 0,
        outgoingEndX: 0,
        outgoingEndY: 0,
        incomingStartX: 0,
        incomingStartY: 0,
        direction: scene.roomTransition?.travelDirection ?? "(not-required)",
        pendingBoundsWidth: scene.bounds.width,
        pendingBoundsHeight: scene.bounds.height,
        hasAppliedBoundsSwap: false
      };

      activeRoomSurface.root.position.set(0, 0);
      activeRoomSurface.root.alpha = 1;
      activeRoomSurface.root.visible = true;
      stagingRoomSurface.root.position.set(0, 0);
      stagingRoomSurface.root.alpha = 0;
      stagingRoomSurface.root.visible = false;
      blackoutOverlay.alpha = 0;
      blackoutOverlay.visible = true;

      emit("debug", "Started room-transition tween.", {
        roomId: scene.roomId || "(unknown)",
        mode,
        travelDirection: scene.roomTransition?.travelDirection || "(none)",
        durationMs,
        cueCategory: scene.roomTransition?.cueCategory || "(none)",
        cueEffectKey: scene.roomTransition?.cueEffectKey || "(none)"
      });

      reportRoomTransitionState("running");

      return true;
    }

    if (mode === "fade") {
      activeRoomSwapTween = {
        generation,
        mode,
        cueEffectKey,
        durationMs,
        elapsedMs: 0,
        outgoingEndX: 0,
        outgoingEndY: 0,
        incomingStartX: 0,
        incomingStartY: 0,
        direction: scene.roomTransition?.travelDirection ?? "(not-required)"
      };

      activeRoomSurface.root.position.set(0, 0);
      activeRoomSurface.root.alpha = 1;
      stagingRoomSurface.root.position.set(0, 0);
      stagingRoomSurface.root.alpha = 0;
      stagingRoomSurface.root.visible = true;

      emit("debug", "Started room-transition tween.", {
        roomId: scene.roomId || "(unknown)",
        mode,
        travelDirection: scene.roomTransition?.travelDirection || "(none)",
        durationMs,
        cueCategory: scene.roomTransition?.cueCategory || "(none)",
        cueEffectKey: scene.roomTransition?.cueEffectKey || "(none)"
      });

      reportRoomTransitionState("running");

      return true;
    }

    const unitVector = resolveTravelUnitVector(scene.roomTransition?.travelDirection);
    if (!unitVector) {
      emit("debug", "Skipped room-transition tween because travel direction is unavailable.", {
        roomId: scene.roomId || "(unknown)",
        mode,
        cueCategory: scene.roomTransition?.cueCategory || "(none)",
        cueEffectKey: scene.roomTransition?.cueEffectKey || "(none)"
      });
      return false;
    }

    const snapshotState = snapshotTransitionState;
    if (!snapshotState) {
      emit("warning", "Skipped snapshot slide because transition frames are unavailable.", {
        roomId: scene.roomId || "(unknown)"
      });
      return false;
    }

    const incomingStartX = unitVector.x * viewportWidth;
    const incomingStartY = unitVector.y * viewportHeight;

    activeRoomSwapTween = {
      generation,
      mode,
      cueEffectKey,
      durationMs,
      elapsedMs: 0,
      outgoingEndX: -incomingStartX,
      outgoingEndY: -incomingStartY,
      incomingStartX,
      incomingStartY,
      direction: scene.roomTransition?.travelDirection ?? "(unknown)",
      usesSnapshotFrames: true
    };

    activeRoomSurface.root.visible = false;
    stagingRoomSurface.root.visible = false;
    snapshotState.outgoingFrame.position.set(0, 0);
    snapshotState.incomingFrame.position.set(incomingStartX, incomingStartY);
    snapshotTransitionLayer.visible = true;

    emit("debug", "Started room-transition tween.", {
      roomId: scene.roomId || "(unknown)",
      mode,
      travelDirection: scene.roomTransition?.travelDirection || "(none)",
      durationMs,
      incomingStartX,
      incomingStartY,
      cueCategory: scene.roomTransition?.cueCategory || "(none)",
      cueEffectKey: scene.roomTransition?.cueEffectKey || "(none)"
    });

    reportRoomTransitionState("running");

    return true;
  }

  function updateMovementTweens(ticker: Ticker): void {
    if (isDisposed) {
      return;
    }

    const deltaMs = Math.max(0, ticker.deltaMS);
    for (const [objectId, tween] of activeRoomSurface.activeMovementTweensByObjectId) {
      const activeSegment = tween.segments[tween.segmentIndex];
      if (!activeSegment) {
        activeRoomSurface.activeMovementTweensByObjectId.delete(objectId);
        continue;
      }

      tween.elapsedMs += deltaMs;
      tween.totalElapsedMs += deltaMs;

      const progress = activeSegment.durationMs <= 0
        ? 1
        : Math.min(1, tween.elapsedMs / activeSegment.durationMs);
      const easedProgress = progress * (2 - progress);
      const nextX = activeSegment.fromX + ((activeSegment.toX - activeSegment.fromX) * easedProgress);
      const nextY = activeSegment.fromY + ((activeSegment.toY - activeSegment.fromY) * easedProgress);
      tween.state.root.position.set(nextX, nextY);
      const scaleProgress = tween.totalDurationMs <= 0
        ? 1
        : Math.min(1, tween.totalElapsedMs / tween.totalDurationMs);
      const easedScaleProgress = scaleProgress * (2 - scaleProgress);
      const nextBaseScale = tween.baseScale;
      const nextSituationalScale = tween.fromSituationalScale + ((tween.toSituationalScale - tween.fromSituationalScale) * easedScaleProgress);
      applyScaleLayers(tween.state, nextBaseScale, nextSituationalScale);
      syncRoomObjectAppearanceEffects(activeRoomSurface, objectId);

      if (progress >= 1) {
        tween.state.root.position.set(activeSegment.toX, activeSegment.toY);
        applyScaleLayers(tween.state, tween.baseScale, tween.toSituationalScale);
        syncRoomObjectAppearanceEffects(activeRoomSurface, objectId);
        const hasNextSegment = tween.segmentIndex + 1 < tween.segments.length;
        if (hasNextSegment) {
          tween.segmentIndex += 1;
          tween.elapsedMs = 0;
          continue;
        }

        diagnostics?.({
          category: "scene",
          level: "debug",
          message: "Room object movement animation completed.",
          details: {
            objectId,
            fromX: tween.segments[0]?.fromX,
            fromY: tween.segments[0]?.fromY,
            toX: activeSegment.toX,
            toY: activeSegment.toY,
            durationMs: tween.segments.reduce((sum, segment) => sum + segment.durationMs, 0),
            elapsedMs: tween.elapsedMs,
            segmentCount: tween.segments.length
          }
        });
        tween.state.root.zIndex = tween.toZOrder;
        activeRoomSurface.activeMovementTweensByObjectId.delete(objectId);
      }
    }

    activeRoomSurface.appearanceOutlineEffectController.tick(performance.now());
    activeRoomSurface.appearanceSilhouetteEffectController.tick(performance.now());
    activeRoomSurface.styledPointEffectController.tick(performance.now());
  }

  function updateRoomSwapTween(ticker: Ticker): void {
    const tween = activeRoomSwapTween;
    if (!tween || isDisposed) {
      return;
    }

    if (tween.generation !== renderGeneration) {
      cancelRoomSwapTween(true, "render-generation-changed");
      return;
    }

    const deltaMs = Math.max(0, ticker.deltaMS);
    tween.elapsedMs += deltaMs;
    const progress = tween.durationMs <= 0
      ? 1
      : Math.min(1, tween.elapsedMs / tween.durationMs);
    const eased = progress * (2 - progress);

    if (tween.mode === "fade-blackout") {
      const firstHalf = Math.min(1, eased * 2);
      const secondHalf = Math.max(0, (eased - 0.5) * 2);

      activeRoomSurface.root.position.set(0, 0);
      stagingRoomSurface.root.position.set(0, 0);

      if (eased < 0.5) {
        activeRoomSurface.root.alpha = 1 - firstHalf;
        stagingRoomSurface.root.alpha = 0;
        blackoutOverlay.alpha = firstHalf;
      } else {
        if (!tween.hasAppliedBoundsSwap) {
          updateClipMask(
            tween.pendingBoundsWidth ?? currentScene?.bounds.width ?? 1,
            tween.pendingBoundsHeight ?? currentScene?.bounds.height ?? 1
          );
          applyViewportTransform();
          tween.hasAppliedBoundsSwap = true;
        }

        activeRoomSurface.root.alpha = 0;
        activeRoomSurface.root.visible = false;
        stagingRoomSurface.root.visible = true;
        stagingRoomSurface.root.alpha = secondHalf;
        blackoutOverlay.alpha = 1 - secondHalf;
      }
    } else if (tween.mode === "fade") {
      activeRoomSurface.root.position.set(0, 0);
      stagingRoomSurface.root.position.set(0, 0);
      activeRoomSurface.root.alpha = 1 - eased;
      stagingRoomSurface.root.alpha = eased;
    } else if (tween.usesSnapshotFrames && snapshotTransitionState) {
      snapshotTransitionState.outgoingFrame.position.set(
        tween.outgoingEndX * eased,
        tween.outgoingEndY * eased
      );
      snapshotTransitionState.incomingFrame.position.set(
        tween.incomingStartX * (1 - eased),
        tween.incomingStartY * (1 - eased)
      );
    } else {
      activeRoomSurface.root.position.set(
        tween.outgoingEndX * eased,
        tween.outgoingEndY * eased
      );

      stagingRoomSurface.root.position.set(
        tween.incomingStartX * (1 - eased),
        tween.incomingStartY * (1 - eased)
      );
      activeRoomSurface.root.alpha = 1;
      stagingRoomSurface.root.alpha = 1;
    }

    if (progress < 1) {
      return;
    }

    activeRoomSurface.root.position.set(0, 0);
    activeRoomSurface.root.alpha = 1;
    stagingRoomSurface.root.position.set(0, 0);
    stagingRoomSurface.root.alpha = 1;
    blackoutOverlay.alpha = 0;
    blackoutOverlay.visible = false;
    activateStagedSurface();
    activeSurfaceScene = currentScene;
    if (currentScene) {
      hudOverlayController.reconcile(currentScene, viewportWidth, viewportHeight);
    }
    clearSnapshotTransition();
    activeRoomSwapTween = null;
    reportRoomTransitionState("complete");

    emit("debug", "Completed room-transition tween and committed staged surface.", {
      mode: tween.mode,
      cueEffectKey: tween.cueEffectKey,
      durationMs: tween.durationMs,
      elapsedMs: tween.elapsedMs,
      direction: tween.direction
    });
  }

  function resolveSlotPlacement(slot: string): { x: number; y: number; inwardX: number; inwardY: number } {
    const bounds = currentScene?.bounds ?? { width: 800, height: 600 };
    const key = slot.trim().toLowerCase();

    switch (key) {
      case "down":
        return { x: 0, y: 0, inwardX: 1, inwardY: 1 };
      case "north":
        return { x: bounds.width / 2, y: 0, inwardX: 0, inwardY: 1 };
      case "northeast":
        return { x: bounds.width, y: 0, inwardX: -1, inwardY: 1 };
      case "east":
        return { x: bounds.width, y: bounds.height / 2, inwardX: -1, inwardY: 0 };
      case "southeast":
        return { x: bounds.width, y: bounds.height, inwardX: -1, inwardY: -1 };
      case "south":
        return { x: bounds.width / 2, y: bounds.height, inwardX: 0, inwardY: -1 };
      case "southwest":
        return { x: 0, y: bounds.height, inwardX: 1, inwardY: -1 };
      case "west":
        return { x: 0, y: bounds.height / 2, inwardX: 1, inwardY: 0 };
      case "northwest":
        return { x: 0, y: 0, inwardX: 1, inwardY: 1 };
      default:
        return { x: bounds.width / 2, y: bounds.height / 2, inwardX: 0, inwardY: 0 };
    }
  }

  function resolveDirectionalAnchor(
    inwardX: number,
    inwardY: number,
    rotationRadians: number
  ): { anchorX: number; anchorY: number } {
    const cos = Math.cos(rotationRadians);
    const sin = Math.sin(rotationRadians);
    const localInwardX = (inwardX * cos) + (inwardY * sin);
    const localInwardY = (-inwardX * sin) + (inwardY * cos);

    function resolveAxisAnchor(component: number): number {
      if (Math.abs(component) <= 0.0001) {
        return 0.5;
      }

      return component > 0 ? 0 : 1;
    }

    return {
      anchorX: resolveAxisAnchor(localInwardX),
      anchorY: resolveAxisAnchor(localInwardY)
    };
  }

  function computeIntersectionArea(
    bounds: { x: number; y: number; width: number; height: number },
    roomWidth: number,
    roomHeight: number
  ): number {
    const left = Math.max(0, bounds.x);
    const top = Math.max(0, bounds.y);
    const right = Math.min(roomWidth, bounds.x + bounds.width);
    const bottom = Math.min(roomHeight, bounds.y + bounds.height);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    return width * height;
  }

  function updateClipMask(width: number, height: number): void {
    const normalizedWidth = Math.max(1, width);
    const normalizedHeight = Math.max(1, height);
    for (const surface of [activeRoomSurface, stagingRoomSurface]) {
      surface.clipMask
        .clear()
        .rect(0, 0, normalizedWidth, normalizedHeight)
        .fill(0xffffff);
    }

    blackoutOverlay
      .clear()
      .rect(0, 0, normalizedWidth, normalizedHeight)
      .fill(0x000000);
  }

  function freezeStagedSurfaceForSnapshotHandoff(): void {
    // A room-boundary scene is rendered into a fresh staging surface at its authoritative
    // coordinates. Move-leg telemetry belongs to the delta that led to that room and must not
    // replay after the already-correct incoming snapshot hands off to the live surface.
    stagingRoomSurface.activeMovementTweensByObjectId.clear();
    for (const objectId of stagingRoomSurface.roomObjectSpritesById.keys()) {
      syncRoomObjectAppearanceEffects(stagingRoomSurface, objectId);
    }
  }

  function completeRoomSwapImmediately(reason: string): void {
    if (!activeRoomSwapTween) {
      return;
    }

    const completedTween = activeRoomSwapTween;
    activeRoomSurface.root.position.set(0, 0);
    activeRoomSurface.root.alpha = 1;
    stagingRoomSurface.root.position.set(0, 0);
    stagingRoomSurface.root.alpha = 1;
    blackoutOverlay.alpha = 0;
    blackoutOverlay.visible = false;
    activateStagedSurface();
    activeSurfaceScene = currentScene;
    if (currentScene) {
      hudOverlayController.reconcile(currentScene, viewportWidth, viewportHeight);
    }
    clearSnapshotTransition();
    activeRoomSwapTween = null;
    reportRoomTransitionState("complete");

    emit("info", "Completed room transition after presentation isolation changed.", {
      mode: completedTween.mode,
      cueEffectKey: completedTween.cueEffectKey,
      reason
    });
  }

  function applyPresentationIsolationSettings(settings: PresentationIsolationSettings): void {
    const previousSettings = presentationIsolationSettings;
    presentationIsolationSettings = {
      enabled: settings.enabled,
      categories: { ...settings.categories }
    };

    const movementDisabled = previousSettings.enabled
      && !isPresentationCategoryEnabled(presentationIsolationSettings, "movement");
    const roomTransitionDisabled = previousSettings.enabled
      && !isPresentationCategoryEnabled(presentationIsolationSettings, "roomTransition");
    const appearanceDisabled = previousSettings.enabled
      && !isPresentationCategoryEnabled(presentationIsolationSettings, "appearance");
    const styledPointDisabled = previousSettings.enabled
      && !isPresentationCategoryEnabled(presentationIsolationSettings, "styledPointEffect");

    if (movementDisabled || !presentationIsolationSettings.enabled) {
      completeMovementTweens(activeRoomSurface, "movement-category-disabled");
      completeMovementTweens(stagingRoomSurface, "movement-category-disabled");
    }

    if (roomTransitionDisabled || !presentationIsolationSettings.enabled) {
      completeRoomSwapImmediately("room-transition-category-disabled");
      clearPreparedOutgoingSnapshot();
    }

    if (appearanceDisabled || !presentationIsolationSettings.enabled) {
      activeRoomSurface.appearanceOutlineEffectController.clear();
      activeRoomSurface.appearanceSilhouetteEffectController.clear();
      stagingRoomSurface.appearanceOutlineEffectController.clear();
      stagingRoomSurface.appearanceSilhouetteEffectController.clear();
    }

    if (styledPointDisabled || !presentationIsolationSettings.enabled) {
      activeRoomSurface.styledPointEffectController.clear();
      stagingRoomSurface.styledPointEffectController.clear();
    }

    emit("info", "Updated Portal presentation isolation settings.", {
      enabled: presentationIsolationSettings.enabled,
      categories: presentationIsolationSettings.categories,
      movementEffectsCompleted: movementDisabled || !presentationIsolationSettings.enabled,
      roomTransitionCompleted: roomTransitionDisabled || !presentationIsolationSettings.enabled,
      appearanceEffectsCleared: appearanceDisabled || !presentationIsolationSettings.enabled,
      styledPointEffectsCleared: styledPointDisabled || !presentationIsolationSettings.enabled
    });
  }

  function updateSnapshotTransitionMask(): void {
    snapshotTransitionMask
      .clear()
      .rect(0, 0, viewportWidth, viewportHeight)
      .fill(0xffffff);
  }

  function applyViewportTransform(): void {
    if (!currentScene) {
      stageRoot.scale.set(1);
      stageRoot.position.set(0, 0);
      return;
    }

    const transform = computeContainTransform(
      currentScene.bounds.width,
      currentScene.bounds.height,
      viewportWidth,
      viewportHeight
    );

    stageRoot.scale.set(transform.scale);
    stageRoot.position.set(transform.offsetX, transform.offsetY);
  }

  function areScenesRenderEquivalent(left: GameRenderSceneSnapshot, right: GameRenderSceneSnapshot): boolean {
    if (left.roomId !== right.roomId
      || left.roomLabel !== right.roomLabel
      || left.displayMode !== right.displayMode
      || left.roomTransition?.travelDirection !== right.roomTransition?.travelDirection
      || left.roomTransition?.durationMs !== right.roomTransition?.durationMs
      || left.roomTransition?.cueCategory !== right.roomTransition?.cueCategory
      || left.roomTransition?.cueEffectKey !== right.roomTransition?.cueEffectKey
      || left.bounds.width !== right.bounds.width
      || left.bounds.height !== right.bounds.height
      || left.directionalOverlays.length !== right.directionalOverlays.length
      || left.roomObjects.length !== right.roomObjects.length
      || (left.hudOverlayEntries?.length ?? 0) !== (right.hudOverlayEntries?.length ?? 0)) {
      return false;
    }

    for (let index = 0; index < left.directionalOverlays.length; index += 1) {
      const leftOverlay = left.directionalOverlays[index];
      const rightOverlay = right.directionalOverlays[index];
      if (leftOverlay.id !== rightOverlay.id
        || leftOverlay.slot !== rightOverlay.slot
        || leftOverlay.asset.assetPath !== rightOverlay.asset.assetPath
        || leftOverlay.offsetX !== rightOverlay.offsetX
        || leftOverlay.offsetY !== rightOverlay.offsetY
        || leftOverlay.rotationDegrees !== rightOverlay.rotationDegrees
        || leftOverlay.scale !== rightOverlay.scale
        || leftOverlay.zOrder !== rightOverlay.zOrder) {
        return false;
      }
    }

    for (let index = 0; index < left.roomObjects.length; index += 1) {
      const leftObject = left.roomObjects[index];
      const rightObject = right.roomObjects[index];
      if (leftObject.objectId !== rightObject.objectId
        || leftObject.objectName !== rightObject.objectName
        || leftObject.asset.assetPath !== rightObject.asset.assetPath
        || leftObject.x !== rightObject.x
        || leftObject.y !== rightObject.y
        || leftObject.rotationDegrees !== rightObject.rotationDegrees
        || leftObject.scale !== rightObject.scale
        || normalizeSituationalScale(leftObject.additionalSituationalScale) !== normalizeSituationalScale(rightObject.additionalSituationalScale)
        || leftObject.zOrder !== rightObject.zOrder
        || leftObject.movementDurationMs !== rightObject.movementDurationMs
        || leftObject.appearanceOutlineStyle?.outlineColorHex !== rightObject.appearanceOutlineStyle?.outlineColorHex
        || leftObject.appearanceOutlineStyle?.outlineThickness !== rightObject.appearanceOutlineStyle?.outlineThickness
        || leftObject.appearanceOutlineStyle?.pulseMs !== rightObject.appearanceOutlineStyle?.pulseMs
        || leftObject.appearanceSilhouetteStyle?.maskAlphaMode !== rightObject.appearanceSilhouetteStyle?.maskAlphaMode
        || leftObject.appearanceSilhouetteStyle?.maskAlphaCutoff !== rightObject.appearanceSilhouetteStyle?.maskAlphaCutoff
        || !areSilhouettePassesEquivalent(leftObject.appearanceSilhouetteStyle, rightObject.appearanceSilhouetteStyle)
        || leftObject.appearanceSilhouetteStyle?.pulseMs !== rightObject.appearanceSilhouetteStyle?.pulseMs) {
        return false;
      }
    }

    return areHudOverlayEntriesEquivalent(left.hudOverlayEntries, right.hudOverlayEntries);
  }

  async function reconcileDirectionalOverlays(
    scene: GameRenderSceneSnapshot,
    generation: number,
    surface: RoomSurfaceState
  ): Promise<void> {
    clearDirectionalOverlaySprites(surface);

    for (const overlay of scene.directionalOverlays) {
      const assetUrl = overlay.asset.assetPath.trim();
      if (!assetUrl) {
        diagnostics?.({
          category: "asset",
          level: "warning",
          message: "Directional overlay skipped because image path is empty.",
          details: { overlayId: overlay.id, slot: overlay.slot }
        });
        continue;
      }

      if (!/^(?:https?:|data:|blob:)/i.test(assetUrl)) {
        diagnostics?.({
          category: "asset",
          level: "warning",
          message: "Directional overlay received a non-loadable asset URL.",
          details: {
            overlayId: overlay.id,
            slot: overlay.slot,
            assetPath: overlay.asset.assetPath
          }
        });
        continue;
      }

      try {
        const texture = await Assets.load(assetUrl);
        if (isDisposed || generation !== renderGeneration) {
          return;
        }

        const sprite = new Sprite(texture);
        const slotPlacement = resolveSlotPlacement(overlay.slot);
        const rotationRadians = toRadians(overlay.rotationDegrees);
        const resolvedAnchor = resolveDirectionalAnchor(
          slotPlacement.inwardX,
          slotPlacement.inwardY,
          rotationRadians
        );

        const targetX = slotPlacement.x + overlay.offsetX;
        const targetY = slotPlacement.y + overlay.offsetY;
        const positionX = targetX;
        const positionY = targetY;

        sprite.anchor.set(resolvedAnchor.anchorX, resolvedAnchor.anchorY);
        sprite.position.set(positionX, positionY);
        sprite.scale.set(overlay.scale);
        sprite.rotation = rotationRadians;
        sprite.zIndex = overlay.zOrder;
        surface.directionalOverlayLayer.addChild(sprite);

        const bounds = sprite.getBounds();
        const roomWidth = scene.bounds.width;
        const roomHeight = scene.bounds.height;
        const intersectionArea = computeIntersectionArea(bounds, roomWidth, roomHeight);
        const spriteArea = Math.max(1, bounds.width * bounds.height);
        const intersectionRatio = intersectionArea / spriteArea;

        diagnostics?.({
          category: "scene",
          level: "debug",
          message: `Directional overlay laid out: slot=${overlay.slot}, intersection=${(intersectionRatio * 100).toFixed(1)}%.`,
          details: {
            overlayId: overlay.id,
            slot: overlay.slot,
            rotationDegrees: overlay.rotationDegrees,
            scale: overlay.scale,
            anchorX: resolvedAnchor.anchorX,
            anchorY: resolvedAnchor.anchorY,
            targetX,
            targetY,
            positionX,
            positionY,
            textureWidth: texture.width,
            textureHeight: texture.height,
            boundsX: bounds.x,
            boundsY: bounds.y,
            boundsWidth: bounds.width,
            boundsHeight: bounds.height,
            intersectionRatio
          }
        });
      } catch (error) {
        diagnostics?.({
          category: "asset",
          level: "warning",
          message: "Directional overlay asset failed to load.",
          details: {
            overlayId: overlay.id,
            slot: overlay.slot,
            assetPath: overlay.asset.assetPath,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  }

  async function reconcileRoomObjects(
    scene: GameRenderSceneSnapshot,
    generation: number,
    previousScene: GameRenderSceneSnapshot | null,
    surface: RoomSurfaceState
  ): Promise<void> {
    const appearanceEffectsEnabled = isPresentationCategoryEnabled(presentationIsolationSettings, "appearance");
    const movementEffectsEnabled = isPresentationCategoryEnabled(presentationIsolationSettings, "movement");
    const previousRoomObjectsById = new Map(
      (previousScene?.roomObjects ?? []).map((roomObject) => [roomObject.objectId, roomObject])
    );

    const nextRoomObjectIds = new Set(scene.roomObjects.map((roomObject) => roomObject.objectId));
    for (const objectId of surface.roomObjectSpritesById.keys()) {
      if (!nextRoomObjectIds.has(objectId)) {
        removeRoomObjectSprite(surface, objectId);
      }
    }

    const silhouetteCueEffectKeys = new Set<string>();
    let objectsWithAppearanceCues = 0;
    let objectsWithSilhouetteCueEffectKeys = 0;
    let objectsWithSilhouetteStyle = 0;
    for (const roomObject of scene.roomObjects) {
      const appearanceCues = roomObject.presentationCues.filter((cue) => cue.category.toLowerCase() === "appearance");
      if (appearanceCues.length > 0) {
        objectsWithAppearanceCues += 1;
      }

      let hasSilhouetteCue = false;
      for (const cue of appearanceCues) {
        const effectKey = cue.effectKey.trim();
        if (effectKey.toLowerCase().indexOf("silhouette") >= 0) {
          hasSilhouetteCue = true;
          silhouetteCueEffectKeys.add(effectKey);
        }
      }

      if (hasSilhouetteCue) {
        objectsWithSilhouetteCueEffectKeys += 1;
      }

      if (roomObject.appearanceSilhouetteStyle) {
        objectsWithSilhouetteStyle += 1;
      }
    }

    diagnostics?.({
      category: "scene",
      level: "info",
      message: "Appearance silhouette summary for scene update.",
      details: {
        roomId: scene.roomId ?? "(unknown)",
        roomObjectCount: scene.roomObjects.length,
        objectsWithAppearanceCues,
        objectsWithSilhouetteCueEffectKeys,
        objectsWithSilhouetteStyle,
        silhouetteCueEffectKeys: [...silhouetteCueEffectKeys].slice(0, 8)
      }
    });

    for (const roomObject of scene.roomObjects) {
      const assetUrl = roomObject.asset.assetPath.trim();
      if (!assetUrl) {
        removeRoomObjectSprite(surface, roomObject.objectId);
        diagnostics?.({
          category: "asset",
          level: "warning",
          message: "Room object skipped because image path is empty.",
          details: {
            objectId: roomObject.objectId,
            objectName: roomObject.objectName
          }
        });
        continue;
      }

      if (!/^(?:https?:|data:|blob:)/i.test(assetUrl)) {
        removeRoomObjectSprite(surface, roomObject.objectId);
        diagnostics?.({
          category: "asset",
          level: "warning",
          message: "Room object received a non-loadable asset URL.",
          details: {
            objectId: roomObject.objectId,
            objectName: roomObject.objectName,
            assetPath: roomObject.asset.assetPath
          }
        });
        continue;
      }

      try {
        const movementDurationMs = movementEffectsEnabled
          ? Math.max(0, Math.round(roomObject.movementDurationMs ?? 0))
          : 0;
        let roomObjectSpriteState = surface.roomObjectSpritesById.get(roomObject.objectId);
        let sprite = roomObjectSpriteState?.sprite;

        if (!roomObjectSpriteState || roomObjectSpriteState.assetPath !== assetUrl || !sprite) {
          const previousX = roomObjectSpriteState?.root.position.x;
          const previousY = roomObjectSpriteState?.root.position.y;
          removeRoomObjectSprite(surface, roomObject.objectId);

          const texture = await Assets.load(assetUrl);
          if (isDisposed || generation !== renderGeneration) {
            return;
          }

          const root = new Container();
          root.sortableChildren = true;
          const baseScaleContainer = new Container();
          baseScaleContainer.sortableChildren = true;
          root.addChild(baseScaleContainer);

          sprite = new Sprite(texture);
          sprite.anchor.set(0, 0);
          sprite.position.set(0, 0);
          baseScaleContainer.addChild(sprite);

          const fallbackX = Number.isFinite(previousX) ? previousX : roomObject.x;
          const fallbackY = Number.isFinite(previousY) ? previousY : roomObject.y;
          root.position.set(fallbackX, fallbackY);
          surface.roomObjectLayer.addChild(root);

          roomObjectSpriteState = {
            root,
            baseScaleContainer,
            situationalScaleContainer: null,
            sprite,
            effectTransformHost: baseScaleContainer,
            assetPath: assetUrl
          };
          surface.roomObjectSpritesById.set(roomObject.objectId, roomObjectSpriteState);

          diagnostics?.({
            category: "scene",
            level: "debug",
            message: "Room object sprite prepared.",
            details: {
              objectId: roomObject.objectId,
              objectName: roomObject.objectName,
              x: root.position.x,
              y: root.position.y
            }
          });
        }

        sprite = roomObjectSpriteState.sprite;
        if (roomObjectSpriteState.root.parent !== surface.roomObjectLayer) {
          surface.roomObjectLayer.addChild(roomObjectSpriteState.root);
        }

        const currentBaseScale = Number.isFinite(roomObjectSpriteState.baseScaleContainer.scale.x)
          && roomObjectSpriteState.baseScaleContainer.scale.x > 0
          ? roomObjectSpriteState.baseScaleContainer.scale.x
          : roomObject.scale;
        const currentSituationalScale = resolveCurrentSituationalScale(roomObjectSpriteState);
        const targetBaseScale = Number.isFinite(roomObject.scale) && roomObject.scale > 0 ? roomObject.scale : 1;
        const targetSituationalScale = normalizeSituationalScale(roomObject.additionalSituationalScale);
        const targetZOrder = roomObject.zOrder;
        const currentZOrder = Number.isFinite(roomObjectSpriteState.root.zIndex)
          ? roomObjectSpriteState.root.zIndex
          : targetZOrder;
        const previousRoomObject = previousRoomObjectsById.get(roomObject.objectId);

        roomObjectSpriteState.root.rotation = toRadians(roomObject.rotationDegrees);
        roomObjectSpriteState.root.zIndex = currentZOrder;
        applyScaleLayers(roomObjectSpriteState, currentBaseScale, currentSituationalScale);

        if (appearanceEffectsEnabled) {
          surface.appearanceOutlineEffectController.applyForObject(
            roomObject.objectId,
            roomObject.objectName,
            roomObjectSpriteState.effectTransformHost,
            roomObjectSpriteState.sprite,
            roomObject.appearanceOutlineStyle);
          surface.appearanceSilhouetteEffectController.applyForObject(
            roomObject.objectId,
            roomObject.objectName,
            roomObjectSpriteState.effectTransformHost,
            roomObjectSpriteState.sprite,
            roomObject.appearanceSilhouetteStyle);
        } else {
          surface.appearanceOutlineEffectController.removeObject(roomObject.objectId);
          surface.appearanceSilhouetteEffectController.removeObject(roomObject.objectId);
        }

        const currentX = roomObjectSpriteState.root.position.x;
        const currentY = roomObjectSpriteState.root.position.y;
        const targetX = roomObject.x;
        const targetY = roomObject.y;
        const hasPositionDelta = currentX !== targetX || currentY !== targetY;
        const existingTween = surface.activeMovementTweensByObjectId.get(roomObject.objectId);
        const existingTweenFinalSegment = existingTween && existingTween.segments.length > 0
          ? existingTween.segments[existingTween.segments.length - 1]
          : undefined;
        const existingTweenTotalDurationMs = existingTween
          ? existingTween.segments.reduce((sum, segment) => sum + segment.durationMs, 0)
          : undefined;
        const movementPlan = planMovementRetarget({
          currentX,
          currentY,
          targetX,
          targetY,
          durationMs: movementDurationMs,
          previousAuthoritativeX: previousRoomObject?.x,
          previousAuthoritativeY: previousRoomObject?.y,
          existingTween: existingTween
            ? {
                toX: existingTweenFinalSegment?.toX ?? targetX,
                toY: existingTweenFinalSegment?.toY ?? targetY,
                durationMs: existingTweenTotalDurationMs ?? movementDurationMs
              }
            : undefined
        });

        const legByLegSegments = buildLegByLegSegments({
          objectId: roomObject.objectId,
          objectName: roomObject.objectName,
          moveLegTelemetry: scene.moveLegTelemetry,
          currentX,
          currentY,
          fallbackTargetX: targetX,
          fallbackTargetY: targetY,
          movementDurationMs
        });

        if (legByLegSegments.length > 0) {
          if (targetZOrder > currentZOrder) {
            roomObjectSpriteState.root.zIndex = targetZOrder;
          }

          applyScaleLayers(roomObjectSpriteState, targetBaseScale, currentSituationalScale);
          const firstSegment = legByLegSegments[0];
          roomObjectSpriteState.root.position.set(firstSegment.fromX, firstSegment.fromY);
          syncRoomObjectAppearanceEffects(surface, roomObject.objectId);
          const totalDurationMs = legByLegSegments.reduce((sum, segment) => sum + segment.durationMs, 0);
          surface.activeMovementTweensByObjectId.set(roomObject.objectId, {
            objectId: roomObject.objectId,
            state: roomObjectSpriteState,
            segments: legByLegSegments,
            segmentIndex: 0,
            elapsedMs: 0,
            totalDurationMs,
            totalElapsedMs: 0,
            baseScale: targetBaseScale,
            fromSituationalScale: currentSituationalScale,
            toSituationalScale: targetSituationalScale,
            toZOrder: targetZOrder
          });

          diagnostics?.({
            category: "scene",
            level: "debug",
            message: "Animating room object movement as leg-by-leg sequence.",
            details: {
              objectId: roomObject.objectId,
              objectName: roomObject.objectName,
              segmentCount: legByLegSegments.length,
              movementDurationMs,
              fromX: firstSegment.fromX,
              fromY: firstSegment.fromY,
              toX: legByLegSegments[legByLegSegments.length - 1].toX,
              toY: legByLegSegments[legByLegSegments.length - 1].toY,
              fromScale: currentBaseScale,
              toScale: targetBaseScale,
              fromSituationalScale: currentSituationalScale,
              toSituationalScale: targetSituationalScale
            }
          });

          continue;
        }

        if (movementPlan.kind === "noop") {
          const activeTween = surface.activeMovementTweensByObjectId.get(roomObject.objectId);
          if (activeTween) {
            activeTween.baseScale = targetBaseScale;
            activeTween.toSituationalScale = targetSituationalScale;
            activeTween.toZOrder = targetZOrder;
            activeTween.totalDurationMs = Math.max(activeTween.totalDurationMs, 1);
          } else {
            roomObjectSpriteState.root.zIndex = targetZOrder;
            applyScaleLayers(roomObjectSpriteState, targetBaseScale, targetSituationalScale);
            syncRoomObjectAppearanceEffects(surface, roomObject.objectId);
          }
          continue;
        }

        if (movementPlan.kind === "snap") {
          surface.activeMovementTweensByObjectId.delete(roomObject.objectId);
          roomObjectSpriteState.root.position.set(movementPlan.x, movementPlan.y);
          roomObjectSpriteState.root.zIndex = targetZOrder;
          applyScaleLayers(roomObjectSpriteState, targetBaseScale, targetSituationalScale);
          syncRoomObjectAppearanceEffects(surface, roomObject.objectId);

          if (hasPositionDelta) {
            diagnostics?.({
              category: "scene",
              level: "warning",
              message: "Room object movement snapped instead of tweening.",
              details: {
                objectId: roomObject.objectId,
                objectName: roomObject.objectName,
                fromX: currentX,
                fromY: currentY,
                toX: movementPlan.x,
                toY: movementPlan.y,
                movementDurationMs: movementDurationMs,
                fromScale: currentBaseScale,
                toScale: targetBaseScale,
                fromSituationalScale: currentSituationalScale,
                toSituationalScale: targetSituationalScale,
                movementCueEffectKeys: roomObject.presentationCues
                  .filter((cue) => cue.category.trim().toLowerCase() === "movement")
                  .map((cue) => cue.effectKey)
              }
            });
          }

          continue;
        }

        roomObjectSpriteState.root.position.set(movementPlan.fromX, movementPlan.fromY);
        if (targetZOrder > currentZOrder) {
          roomObjectSpriteState.root.zIndex = targetZOrder;
        }
        applyScaleLayers(roomObjectSpriteState, targetBaseScale, currentSituationalScale);
        syncRoomObjectAppearanceEffects(surface, roomObject.objectId);
        surface.activeMovementTweensByObjectId.set(roomObject.objectId, {
          objectId: roomObject.objectId,
          state: roomObjectSpriteState,
          segments: [
            {
              fromX: movementPlan.fromX,
              fromY: movementPlan.fromY,
              toX: movementPlan.toX,
              toY: movementPlan.toY,
              durationMs: movementPlan.durationMs
            }
          ],
          segmentIndex: 0,
          elapsedMs: 0,
          totalDurationMs: movementPlan.durationMs,
          totalElapsedMs: 0,
          baseScale: targetBaseScale,
          fromSituationalScale: currentSituationalScale,
          toSituationalScale: targetSituationalScale,
          toZOrder: targetZOrder
        });

        diagnostics?.({
          category: "scene",
          level: "debug",
          message: "Animating room object movement from cue timing.",
          details: {
            objectId: roomObject.objectId,
            objectName: roomObject.objectName,
            fromX: movementPlan.fromX,
            fromY: movementPlan.fromY,
            toX: movementPlan.toX,
            toY: movementPlan.toY,
            movementDurationMs: movementPlan.durationMs,
            fromScale: currentBaseScale,
            toScale: targetBaseScale,
            fromSituationalScale: currentSituationalScale,
            toSituationalScale: targetSituationalScale
          }
        });

        if (movementPlan.fromX === movementPlan.toX && movementPlan.fromY === movementPlan.toY) {
          diagnostics?.({
            category: "scene",
            level: "warning",
            message: "Movement tween resolved with identical start and end positions.",
            details: {
              objectId: roomObject.objectId,
              objectName: roomObject.objectName,
              fromX: movementPlan.fromX,
              fromY: movementPlan.fromY,
              toX: movementPlan.toX,
              toY: movementPlan.toY,
              movementDurationMs: movementPlan.durationMs,
              previousAuthoritativeX: previousRoomObject?.x,
              previousAuthoritativeY: previousRoomObject?.y,
              currentSpriteX: currentX,
              currentSpriteY: currentY
            }
          });
        }
      } catch (error) {
        removeRoomObjectSprite(surface, roomObject.objectId);
        diagnostics?.({
          category: "asset",
          level: "warning",
          message: "Room object asset failed to load.",
          details: {
            objectId: roomObject.objectId,
            objectName: roomObject.objectName,
            assetPath: roomObject.asset.assetPath,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  }

  async function renderScene(
    scene: GameRenderSceneSnapshot,
    generation: number,
    previousScene: GameRenderSceneSnapshot | null,
    surface: RoomSurfaceState,
    reconcileHud = true
  ): Promise<void> {
    await reconcileDirectionalOverlays(scene, generation, surface);
    if (isDisposed || generation !== renderGeneration) {
      return;
    }

    await reconcileRoomObjects(scene, generation, previousScene, surface);
    if (isDisposed || generation !== renderGeneration) {
      return;
    }

    if (reconcileHud) {
      hudOverlayController.reconcile(scene, viewportWidth, viewportHeight);
    }
  }

  async function initialize(): Promise<void> {
    await app.init({
      backgroundColor: 0x0f172a,
      backgroundAlpha: 1,
      antialias: true,
      width: viewportWidth,
      height: viewportHeight
    });

    if (isDisposed) {
      app.destroy(true, { children: true });
      return;
    }

    mountElement.appendChild(app.canvas);
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    app.stage.addChild(stageRoot);
    app.stage.addChild(snapshotTransitionLayer);
    app.stage.addChild(snapshotTransitionMask);
    app.stage.addChild(hudOverlayController.layer);
    app.ticker.add(updateMovementTweens);
    app.ticker.add(updateRoomSwapTween);
    app.ticker.add(hudOverlayController.update);
    isReady = true;
    updateSnapshotTransitionMask();

    if (currentScene) {
      const generation = ++renderGeneration;
      updateClipMask(currentScene.bounds.width, currentScene.bounds.height);
      app.renderer.resize(viewportWidth, viewportHeight);
      updateSnapshotTransitionMask();
      applyViewportTransform();
      if (currentScene) {
        hudOverlayController.reconcile(currentScene, viewportWidth, viewportHeight);
      }
      await renderScene(currentScene, generation, null, activeRoomSurface);
      activeSurfaceScene = currentScene;
      reportRoomTransitionState("complete");
    }
  }

  void initialize().catch((error) => {
    diagnostics?.({
      category: "lifecycle",
      level: "error",
      message: "Failed to initialize Pixi renderer.",
      details: error instanceof Error ? error.message : String(error)
    });
  });

  return {
    prepareRoomTransitionSnapshot: (requestedMode) => {
      // This pre-render boundary exists only to freeze the outgoing image for snapshot slides.
      // A late preparation during a live fade-blackout would put a snapshot layer above the
      // blackout overlay and make the transition look like an abrupt swap.
      if (requestedMode !== "slide"
        || !isPresentationCategoryEnabled(presentationIsolationSettings, "roomTransition")) {
        return;
      }

      if (!isReady || isDisposed || !activeSurfaceScene) {
        return;
      }

      clearPreparedOutgoingSnapshot();
      reportRoomTransitionState("preparing");
      try {
        preparedOutgoingSnapshot = captureSurfaceSnapshot(activeRoomSurface, activeSurfaceScene);
        preparedOutgoingFrame = createViewportSnapshotFrame(preparedOutgoingSnapshot);
        snapshotTransitionLayer.addChild(preparedOutgoingFrame);
        snapshotTransitionLayer.visible = true;
        activeRoomSurface.root.visible = false;
        emit("debug", "Captured outgoing room at transition preparation boundary.", {
          roomId: activeSurfaceScene.roomId || "(unknown)",
          width: preparedOutgoingSnapshot.width,
          height: preparedOutgoingSnapshot.height,
          resolution: preparedOutgoingSnapshot.resolution
        });
      } catch (error) {
        emit("warning", "Failed to capture outgoing room at transition preparation boundary.", {
          roomId: activeSurfaceScene.roomId || "(unknown)",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },
    updateScene: (scene) => {
      if (currentScene && areScenesRenderEquivalent(currentScene, scene)) {
        currentScene = scene;
        return;
      }

      const previousScene = currentScene;
      currentScene = scene;
      if (!isReady || isDisposed) {
        return;
      }

      const generation = ++renderGeneration;
      const isRoomChanged = previousScene !== null && previousScene.roomId !== scene.roomId;
      const transitionDurationMs = Math.max(0, Math.round(scene.roomTransition?.durationMs ?? 0));
      const requestedTransitionMode = scene.roomTransition?.mode ?? "slide";
      const roomTransitionEffectsEnabled = isPresentationCategoryEnabled(
        presentationIsolationSettings,
        "roomTransition"
      );
      const shouldDelayBoundsSwap = isRoomChanged
        && roomTransitionEffectsEnabled
        && (requestedTransitionMode === "fade-blackout" || requestedTransitionMode === "slide")
        && transitionDurationMs > 0;

      let outgoingSnapshot: CapturedRoomTexture | undefined;
      if (isRoomChanged) {
        emit("info", "Resolved room transition.", {
          outgoingRoomId: previousScene?.roomId || "(unknown)",
          incomingRoomId: scene.roomId || "(unknown)",
          mode: requestedTransitionMode,
          durationMs: transitionDurationMs,
          cueEffectKey: scene.roomTransition?.cueEffectKey || "(none)",
          travelDirection: scene.roomTransition?.travelDirection || "(none)",
          boundsWidth: scene.bounds.width,
          boundsHeight: scene.bounds.height
        });
        reportRoomTransitionState("preparing");
      }

      if (isRoomChanged
        && roomTransitionEffectsEnabled
        && requestedTransitionMode === "slide"
        && transitionDurationMs > 0
        && previousScene) {
        if (preparedOutgoingSnapshot
          && preparedOutgoingSnapshot.roomId === (activeSurfaceScene?.roomId ?? previousScene.roomId ?? "")) {
          outgoingSnapshot = preparedOutgoingSnapshot;
          preparedOutgoingSnapshot = null;
          preparedOutgoingFrame = null;
        } else {
          clearPreparedOutgoingSnapshot();
          try {
            outgoingSnapshot = captureSurfaceSnapshot(activeRoomSurface, activeSurfaceScene ?? previousScene);
          } catch (error) {
            emit("warning", "Failed to capture outgoing room snapshot; slide will use fade-blackout fallback.", {
              roomId: previousScene.roomId || "(unknown)",
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      } else if (isRoomChanged) {
        clearPreparedOutgoingSnapshot();
      }

      if (!shouldDelayBoundsSwap) {
        updateClipMask(scene.bounds.width, scene.bounds.height);
        applyViewportTransform();
      }
      cancelRoomSwapTween(false, "superseded-by-new-scene");

      if (isRoomChanged) {
        clearSurfaceSprites(stagingRoomSurface);
        stagingRoomSurface.root.visible = false;

        void renderScene(scene, generation, previousScene, stagingRoomSurface, false).then(() => {
          if (isDisposed || generation !== renderGeneration) {
            outgoingSnapshot?.dispose();
            return;
          }

          let transitionStarted = false;
          if (requestedTransitionMode === "slide" && transitionDurationMs > 0 && previousScene) {
            freezeStagedSurfaceForSnapshotHandoff();
            const snapshotsPrepared = outgoingSnapshot
              ? prepareSnapshotTransition(previousScene, scene, outgoingSnapshot)
              : false;
            outgoingSnapshot = undefined;

            if (snapshotsPrepared) {
              updateClipMask(scene.bounds.width, scene.bounds.height);
              applyViewportTransform();
              transitionStarted = beginRoomSwapTween(scene, generation);
            } else {
              emit("warning", "Falling back from snapshot slide to fade-blackout.", {
                outgoingRoomId: previousScene.roomId || "(unknown)",
                incomingRoomId: scene.roomId || "(unknown)",
                fallbackReason: "snapshot-preparation-failed-or-unavailable",
                durationMs: transitionDurationMs
              });
              transitionStarted = beginRoomSwapTween(scene, generation, "fade-blackout");
            }
          } else {
            transitionStarted = beginRoomSwapTween(scene, generation);
          }

          if (!transitionStarted) {
            emit("info", "Committed room without an animated transition.", {
              outgoingRoomId: previousScene?.roomId || "(unknown)",
              incomingRoomId: scene.roomId || "(unknown)",
              requestedMode: requestedTransitionMode,
              durationMs: transitionDurationMs,
              reason: transitionDurationMs <= 0 ? "duration-zero" : "transition-not-started"
            });
            clearSnapshotTransition();
            if (shouldDelayBoundsSwap) {
              updateClipMask(scene.bounds.width, scene.bounds.height);
              applyViewportTransform();
            }
            activateStagedSurface();
            activeSurfaceScene = scene;
            hudOverlayController.reconcile(scene, viewportWidth, viewportHeight);
            reportRoomTransitionState("complete");
            emit("debug", "Committed staged room surface after room-boundary render.", {
              roomId: scene.roomId || "(unknown)",
              previousRoomId: previousScene?.roomId || "(unknown)"
            });
          }
        }).catch((error) => {
          outgoingSnapshot?.dispose();
          clearSnapshotTransition();
          if (isDisposed || generation !== renderGeneration) {
            return;
          }

          emit("error", "Failed to render staged room surface.", {
            roomId: scene.roomId || "(unknown)",
            error: error instanceof Error ? error.message : String(error)
          });
          reportRoomTransitionState("failed");
        });
      } else {
        void renderScene(scene, generation, previousScene, activeRoomSurface).then(() => {
          if (!isDisposed && generation === renderGeneration) {
            activeSurfaceScene = scene;
          }
        });
      }

      emit("debug", "Applied scene update.", {
        roomId: scene.roomId || "(unknown)",
        overlayCount: scene.directionalOverlays.length,
        roomObjectCount: scene.roomObjects.length,
        roomWidth: scene.bounds.width,
        roomHeight: scene.bounds.height,
        viewportWidth,
        viewportHeight
      });
    },
    resize: (width, height) => {
      const nextViewportWidth = Math.max(1, Math.floor(width));
      const nextViewportHeight = Math.max(1, Math.floor(height));

      if (nextViewportWidth === viewportWidth && nextViewportHeight === viewportHeight) {
        return;
      }

      viewportWidth = nextViewportWidth;
      viewportHeight = nextViewportHeight;

      if (!isReady || isDisposed) {
        return;
      }

      app.renderer.resize(viewportWidth, viewportHeight);
      updateSnapshotTransitionMask();
      applyViewportTransform();
      if (currentScene) {
        hudOverlayController.reconcile(currentScene, viewportWidth, viewportHeight);
      }

      emit("debug", "Resized renderer viewport.", {
        viewportWidth,
        viewportHeight,
        roomWidth: currentScene?.bounds.width ?? 0,
        roomHeight: currentScene?.bounds.height ?? 0
      });
    },
    setInteractionMode: (mode) => {
      if (interactionMode === mode) {
        return "unchanged";
      }

      const previousMode = interactionMode;
      interactionMode = mode;
      emit("debug", "Updated renderer interaction mode.", {
        previousMode,
        interactionMode
      });
      return "changed";
    },
    getInteractionMode: () => {
      return interactionMode;
    },
    appendWaypointDraft: (point) => {
      const roomX = Number(point.x);
      const roomY = Number(point.y);
      if (!Number.isFinite(roomX) || !Number.isFinite(roomY)) {
        return waypointDraft.length;
      }

      waypointDraft.push({ x: roomX, y: roomY });
      emit("debug", "Appended renderer waypoint draft point.", {
        roomX,
        roomY,
        count: waypointDraft.length,
        interactionMode
      });
      return waypointDraft.length;
    },
    getWaypointsSnapshot: () => {
      return waypointDraft.map((point) => ({ x: point.x, y: point.y }));
    },
    clearWaypoints: () => {
      if (waypointDraft.length === 0) {
        return;
      }

      waypointDraft.length = 0;
      emit("debug", "Cleared renderer waypoint draft.", {
        interactionMode
      });
    },
    removeLastWaypoint: () => {
      if (waypointDraft.length === 0) {
        return false;
      }

      waypointDraft.pop();
      emit("debug", "Removed last renderer waypoint.", {
        remainingCount: waypointDraft.length,
        interactionMode
      });
      return true;
    },
    applyStyledPointEffectIntent: (input) => {
      if (isDisposed || !isReady) {
        return;
      }

      if (!isPresentationCategoryEnabled(presentationIsolationSettings, "styledPointEffect")
        && input.intent === "show") {
        emit("info", "Suppressed styled-point presentation effect.", {
          handleKey: input.handleKey
        });
        return;
      }

      activeRoomSurface.styledPointEffectController.applyIntent(input);
    },
    setPresentationIsolationSettings: (settings) => {
      if (isDisposed) {
        return;
      }

      applyPresentationIsolationSettings(settings);
    },
    dispose: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      isReady = false;
      const canvas = app.canvas;

      try {
        clearAllSceneSprites();
        cancelRoomSwapTween(false, "renderer-disposed");
        clearPreparedOutgoingSnapshot();
        clearSnapshotTransition();
        reportRoomTransitionState("failed");
        activeRoomSurface.styledPointEffectController.dispose();
        stagingRoomSurface.styledPointEffectController.dispose();
        if (canvas && canvas.parentElement === mountElement) {
          mountElement.removeChild(canvas);
        }

        app.ticker.remove(updateMovementTweens);
        app.ticker.remove(updateRoomSwapTween);
        app.ticker.remove(hudOverlayController.update);
        app.destroy(true, { children: true });
      } catch (error) {
        diagnostics?.({
          category: "lifecycle",
          level: "warning",
          message: "Renderer dispose encountered a non-fatal teardown error.",
          details: error instanceof Error ? error.message : String(error)
        });
      }

      diagnostics?.({
        category: "lifecycle",
        level: "info",
        message: "Disposed Pixi renderer handle."
      });
    }
  };
}
