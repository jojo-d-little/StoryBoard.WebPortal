import type { HostCommandRenderableImage } from "../../../hostApi/HostContracts/HostCommandRenderableImage";

export interface GameRenderMovementSegment {
  objectId: string;
  coordinationId: string;
  segmentIndex: number;
  kind: "Turn" | "Translation" | "RoomTransfer";
  sourceRoomId: string;
  destinationRoomId: string;
  startOffsetMs: number;
  durationMs: number;
  fromRenderableImage: HostCommandRenderableImage;
  toRenderableImage: HostCommandRenderableImage;
  rotationDeltaDegrees?: number;
}
