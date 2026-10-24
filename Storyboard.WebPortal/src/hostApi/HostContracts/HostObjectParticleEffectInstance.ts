import type { HostParticleEffectControlValue } from "./HostParticleEffectControlValue";

/** Generated-contract-aligned resolved particle effect attached to a room object. */
export interface HostObjectParticleEffectInstance {
  effectKey: string;
  x: number;
  y: number;
  isProducing: boolean;
  targetControls: Record<string, HostParticleEffectControlValue>;
}
