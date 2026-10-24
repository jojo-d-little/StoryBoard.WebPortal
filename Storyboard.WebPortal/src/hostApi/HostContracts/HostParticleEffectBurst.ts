import type { HostParticleEffectControlValue } from "./HostParticleEffectControlValue";

/** Generated-contract-aligned transient particle burst event. */
export interface HostParticleEffectBurst {
  burstId: string;
  sourceObjectId: string;
  roomId: string;
  effectKey: string;
  x: number;
  y: number;
  targetControls: Record<string, HostParticleEffectControlValue>;
}
