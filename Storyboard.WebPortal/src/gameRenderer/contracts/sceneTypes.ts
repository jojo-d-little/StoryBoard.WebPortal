export type { GameRenderDisplayMode } from "./sceneTypes/GameRenderDisplayMode";
export type { GameRenderTravelDirection } from "./sceneTypes/GameRenderTravelDirection";
export type { GameRenderMovementTravelVisualizationMode } from "./sceneTypes/GameRenderMovementTravelVisualizationMode";

export type { GameRenderRoomBounds } from "./sceneTypes/GameRenderRoomBounds";
export type { GameRenderAssetReference } from "./sceneTypes/GameRenderAssetReference";
export type { GameRenderDirectionalOverlay } from "./sceneTypes/GameRenderDirectionalOverlay";
// Preserve existing scene-type imports while the presentation effect DTOs live together.
export type {
  GameRenderCueReference,
  GameRenderPresentationCue,
  GameRenderMovementCueMetadata,
  GameRenderResolvedObjectEffect,
  GameRenderResolvedObjectEffectIdentity,
  GameRenderAppearanceOutlineEffect,
  GameRenderAppearanceSilhouetteEffect,
  GameRenderShakeEffect,
  GameRenderScaleEffect,
  GameRenderStyledPointEffect,
  GameRenderAppearanceOutlineStyle,
  GameRenderAppearanceSilhouettePass,
  GameRenderAppearanceSilhouetteStyle,
  GameRenderShakeStyle,
  GameRenderScaleStyle,
  GameRenderObjectStyledPointEffect,
  ResolvedStyledPointBlendMode,
  ResolvedStyledPointCoreLayer,
  ResolvedStyledPointEffect,
  ResolvedStyledPointOrbitLayer
} from "./presentationEffects";

export type { GameRenderRoomObject } from "./sceneTypes/GameRenderRoomObject";
export type { GameRenderSceneObject, GameRenderSpriteComponent } from "./sceneTypes/GameRenderSceneObject";
export type { GameRenderMoveLegTelemetry } from "./sceneTypes/GameRenderMoveLegTelemetry";
export type { GameRenderHudOverlayEntry } from "./sceneTypes/GameRenderHudOverlayEntry";
export type {
  GameRenderAmbientLighting,
  GameRenderLightingState,
  GameRenderLightOcclusion,
  GameRenderObjectLighting,
  GameRenderPointLight,
  GameRenderPointLightDefaults,
  GameRenderSpatialFootprint
} from "./sceneTypes/GameRenderLightingState";
export type {
  GameRenderLightingBlockerInput,
  GameRenderLightingFrameInput,
  GameRenderLightingPointLightInput,
  GameRenderRoomGeometryInput
} from "./sceneTypes/GameRenderLightingFrameInput";
export type { GameRenderRoomTransition } from "./sceneTypes/GameRenderRoomTransition";
export type { GameRenderSceneSnapshot } from "./sceneTypes/GameRenderSceneSnapshot";
