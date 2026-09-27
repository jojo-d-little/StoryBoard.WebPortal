import type { HostCommandRenderableRoomObject } from "./HostCommandRenderableRoomObject";
import type { HostCommandRoomDirectionalImage } from "./HostCommandRoomDirectionalImage";
import type { HostRoomAmbientLighting } from "./HostRoomAmbientLighting";
import type { HostRoomDisplayMode } from "./HostRoomDisplayMode";

export interface HostCommandNewRoomSummary {
  roomId: string;
  name: string;
  description?: string;
  roomDisplayMode: HostRoomDisplayMode;
  roomImageCanvasWidth?: number;
  roomImageCanvasHeight?: number;
  ambientLighting?: HostRoomAmbientLighting | null;
  directionalRenderableImages: HostCommandRoomDirectionalImage[];
  renderableRoomObjects: HostCommandRenderableRoomObject[];
}
