import type { HostEnvironmentalParticleEffectInstance } from "./HostEnvironmentalParticleEffectInstance";
import type { HostRoomAmbientLighting } from "./HostRoomAmbientLighting";
import type { HostParticleEffectImageMapping } from "./HostParticleEffectImageMapping";

/** Optional replacement values for the room that remains active. */
export interface HostCommandCurrentRoomUpdate {
  roomId: string;
  ambientLighting?: HostRoomAmbientLighting;
  environmentalParticleEffects?: HostEnvironmentalParticleEffectInstance[];
  particleEffectImageMappings?: HostParticleEffectImageMapping[];
}
