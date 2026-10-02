import type { GameRenderPresentationCue } from "../presentationEffects/GameRenderPresentationCue";
import type { GameRenderRoomObject } from "./GameRenderRoomObject";
import type { GameRenderObjectLighting } from "./GameRenderLightingState";
import type { GameRenderObjectStyledPointEffect } from "../presentationEffects/GameRenderStyledPointEffect";
import type { GameRenderResolvedObjectEffect } from "../presentationEffects/GameRenderResolvedObjectEffect";

export type GameRenderSpriteComponent = Omit<
  GameRenderRoomObject,
  "objectId" | "objectName" | "presentationCues" | "resolvedObjectEffects" | "movementDurationMs" | "movementFrames"
>;

export interface GameRenderSceneObject {
  objectId: string;
  objectName: string;
  sprite?: GameRenderSpriteComponent;
  lighting?: GameRenderObjectLighting;
  lightingTransitionFrom?: GameRenderObjectLighting;
  /** @deprecated Direct scene callers only. Host cues resolve into resolvedObjectEffects. */
  styledPointEffects?: GameRenderObjectStyledPointEffect[];
  resolvedObjectEffects?: GameRenderResolvedObjectEffect[];
  presentationCues: GameRenderPresentationCue[];
  movementDurationMs?: number;
  movementFrames?: number;
}
