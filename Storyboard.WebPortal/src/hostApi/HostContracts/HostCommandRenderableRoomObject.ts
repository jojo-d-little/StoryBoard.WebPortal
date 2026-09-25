import type { HostCommandRenderableImage } from "./HostCommandRenderableImage";

export interface HostCommandRenderableRoomObject {
  objectId: string;
  name: string;
  renderableImage: HostCommandRenderableImage;
  renderZOrder: number;
}
