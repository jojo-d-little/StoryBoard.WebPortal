import type { HostParticleEffectControlValue } from "./HostParticleEffectControlValue";

/** Generated-contract-aligned persistent environmental particle instance. */
export interface HostEnvironmentalParticleEffectInstance {
  instanceId: string;
  effectKey: string;
  isProducing: boolean;
  renderOrder: number;
  targetControls: Record<string, HostParticleEffectControlValue>;
}
