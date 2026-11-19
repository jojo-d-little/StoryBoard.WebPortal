import type { HostCommandRenderableImage } from "./HostCommandRenderableImage";

export interface HostMovementSegment {
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
