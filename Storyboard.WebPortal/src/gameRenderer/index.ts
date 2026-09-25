export type {
  GameRenderSceneSnapshot,
  GameRenderRoomBounds,
  GameRenderDirectionalOverlay,
  GameRenderDisplayMode,
  GameRenderAssetReference,
  GameRenderRoomObject,
  GameRenderPresentationCue,
  GameRenderHudOverlayEntry
} from "./contracts/sceneTypes";

export type {
  GameRendererPointerIntent,
  GameRendererCommandIntent,
  GameRendererIntent,
  GameRendererIntentSink
} from "./contracts/intents";

export type {
  GameRendererDiagnosticsEvent,
  GameRendererDiagnosticsSink
} from "./diagnostics/RendererDiagnostics";

export {
  DEFAULT_PRESENTATION_ISOLATION_SETTINGS,
  isPresentationCategoryEnabled,
  normalizePresentationCategory,
  resolvePresentationIsolationCategoryOptions
} from "./presentationIsolation";

export type {
  PresentationIsolationCategory,
  PresentationIsolationCategoryOption,
  PresentationIsolationSettings
} from "./presentationIsolation";

export type {
  CreateGameRendererOptions,
  GameRendererHandle,
  GameRendererInteractionMode,
  GameRendererRoomTransitionState,
  GameRendererRoomPoint,
  SetInteractionModeResult
} from "./pixi/PixiGameRenderer";

export { createGameRenderer } from "./pixi/PixiGameRenderer";
