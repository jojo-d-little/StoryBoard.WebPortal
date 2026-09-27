import type { HostCommandMoveLegTelemetry } from "./HostCommandMoveLegTelemetry";
import type { HostCommandPresentationCue } from "./HostCommandPresentationCue";
import type { HostCommandRenderableRoomObject } from "./HostCommandRenderableRoomObject";
import type { HostRoomObjectChangeKind } from "./HostRoomObjectChangeKind";

export interface HostCommandRoomObjectChange {
  changeKind: HostRoomObjectChangeKind;
  objectId: string;
  objectName: string;
  renderableRoomObject?: HostCommandRenderableRoomObject | null;
  fromRenderableObject?: HostCommandRenderableRoomObject | null;
  presentationCues: HostCommandPresentationCue[];
  moveLegTelemetry?: HostCommandMoveLegTelemetry[];
}
