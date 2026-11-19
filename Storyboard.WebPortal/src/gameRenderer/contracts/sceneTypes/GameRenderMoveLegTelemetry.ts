import type { GameRenderMovementTravelVisualizationMode } from "./GameRenderMovementTravelVisualizationMode";
import type { GameRenderMovementSegment } from "./GameRenderMovementSegment";

export interface GameRenderMoveLegTelemetry {
  targetObjectId?: string;
  targetObjectName: string;
  legIndex: number;
  requestedDirection: string;
  requestedDistanceInCells: number;
  appliedDistanceInCells: number;
  success: boolean;
  resultCode: string;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  travelVisualizationMode: GameRenderMovementTravelVisualizationMode;
  movementSegments?: GameRenderMovementSegment[];
}
