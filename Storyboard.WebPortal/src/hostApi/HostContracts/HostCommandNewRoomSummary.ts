import type { HostCommandRenderableRoomObject } from "./HostCommandRenderableRoomObject";
import type { HostCommandRoomDirectionalImage } from "./HostCommandRoomDirectionalImage";
import type { HostRoomAmbientLighting } from "./HostRoomAmbientLighting";
import type { HostRoomDisplayMode } from "./HostRoomDisplayMode";
import type { HostEnvironmentalParticleEffectInstance } from "./HostEnvironmentalParticleEffectInstance";
import type { HostParticleEffectImageMapping } from "./HostParticleEffectImageMapping";

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
  environmentalParticleEffects?: HostEnvironmentalParticleEffectInstance[];
  particleEffectImageMappings?: HostParticleEffectImageMapping[];
}
