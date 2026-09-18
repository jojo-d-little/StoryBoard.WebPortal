import type { GameRenderDirectionalOverlay } from "./GameRenderDirectionalOverlay";
import type { GameRenderDisplayMode } from "./GameRenderDisplayMode";
import type { GameRenderHudOverlayEntry } from "./GameRenderHudOverlayEntry";
import type { GameRenderMoveLegTelemetry } from "./GameRenderMoveLegTelemetry";
import type { GameRenderRoomBounds } from "./GameRenderRoomBounds";
import type { GameRenderRoomObject } from "./GameRenderRoomObject";
import type { GameRenderRoomTransition } from "./GameRenderRoomTransition";

export interface GameRenderSceneSnapshot {
  roomId?: string;
  roomLabel?: string;
  displayMode: GameRenderDisplayMode;
  bounds: GameRenderRoomBounds;
  directionalOverlays: GameRenderDirectionalOverlay[];
  roomObjects: GameRenderRoomObject[];
  moveLegTelemetry?: GameRenderMoveLegTelemetry[];
  hudOverlayEntries?: GameRenderHudOverlayEntry[];
  roomTransition?: GameRenderRoomTransition;
}
