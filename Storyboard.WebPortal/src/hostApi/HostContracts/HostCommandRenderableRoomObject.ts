import type { HostCommandRenderableImage } from "./HostCommandRenderableImage";
import type { HostCommandActiveObjectPresentationCue } from "./HostCommandActiveObjectPresentationCue";
import type { HostObjectLightOcclusion } from "./HostObjectLightOcclusion";
import type { HostObjectPointLight } from "./HostObjectPointLight";
import type { HostObjectSpatialFootprint } from "./HostObjectSpatialFootprint";

export interface HostCommandRenderableRoomObject {
  objectId: string;
  name: string;
  renderableImage: HostCommandRenderableImage;
  renderZOrder: number;
  pointLight?: HostObjectPointLight | null;
  spatialFootprint?: HostObjectSpatialFootprint | null;
  lightOcclusion?: HostObjectLightOcclusion | null;
  activePresentationCues?: HostCommandActiveObjectPresentationCue[];
}
