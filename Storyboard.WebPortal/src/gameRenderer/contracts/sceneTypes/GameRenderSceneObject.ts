import type { GameRenderPresentationCue } from "./GameRenderPresentationCue";
import type { GameRenderRoomObject } from "./GameRenderRoomObject";
import type { GameRenderObjectLighting } from "./GameRenderLightingState";
import type { GameRenderObjectStyledPointEffect } from "./GameRenderStyledPointEffect";

export type GameRenderSpriteComponent = Omit<
  GameRenderRoomObject,
  "objectId" | "objectName" | "presentationCues" | "movementDurationMs" | "movementFrames"
>;

export interface GameRenderSceneObject {
  objectId: string;
  objectName: string;
  sprite?: GameRenderSpriteComponent;
  lighting?: GameRenderObjectLighting;
  lightingTransitionFrom?: GameRenderObjectLighting;
  styledPointEffects?: GameRenderObjectStyledPointEffect[];
  presentationCues: GameRenderPresentationCue[];
  movementDurationMs?: number;
  movementFrames?: number;
}
