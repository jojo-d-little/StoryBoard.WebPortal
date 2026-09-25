import type { HostCommandRenderableRoomObject } from "./HostCommandRenderableRoomObject";
import type { HostCommandRoomDirectionalImage } from "./HostCommandRoomDirectionalImage";
import type { HostRoomDisplayMode } from "./HostRoomDisplayMode";

export interface HostCommandNewRoomSummary {
  roomId: string;
  name: string;
  roomDisplayMode: HostRoomDisplayMode;
  roomImageCanvasWidth?: number;
  roomImageCanvasHeight?: number;
  directionalRenderableImages: HostCommandRoomDirectionalImage[];
  renderableRoomObjects: HostCommandRenderableRoomObject[];
}
