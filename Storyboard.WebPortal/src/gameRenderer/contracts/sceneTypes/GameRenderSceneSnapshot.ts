import type { GameRenderDirectionalOverlay } from "./GameRenderDirectionalOverlay";
import type { GameRenderDisplayMode } from "./GameRenderDisplayMode";
import type { GameRenderHudOverlayEntry } from "./GameRenderHudOverlayEntry";
import type { GameRenderLightingState } from "./GameRenderLightingState";
import type { GameRenderMoveLegTelemetry } from "./GameRenderMoveLegTelemetry";
import type { GameRenderRoomBounds } from "./GameRenderRoomBounds";
import type { GameRenderSceneObject } from "./GameRenderSceneObject";
import type { GameRenderRoomTransition } from "./GameRenderRoomTransition";

export interface GameRenderSceneSnapshot {
  roomId?: string;
  roomLabel?: string;
  displayMode: GameRenderDisplayMode;
  bounds: GameRenderRoomBounds;
  directionalOverlays: GameRenderDirectionalOverlay[];
  objectsById: Record<string, GameRenderSceneObject>;
  lighting?: GameRenderLightingState;
  moveLegTelemetry?: GameRenderMoveLegTelemetry[];
  hudOverlayEntries?: GameRenderHudOverlayEntry[];
  roomTransition?: GameRenderRoomTransition;
}
