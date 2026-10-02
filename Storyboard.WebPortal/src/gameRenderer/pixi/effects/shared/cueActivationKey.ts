import type { GameRenderResolvedObjectEffectIdentity } from "../../../contracts/presentationEffects";

export function cueActivationKey(effect: GameRenderResolvedObjectEffectIdentity): string {
  return effect.activationId?.trim()
    ? `activation:${effect.activationId.trim()}`
    : `effect:${effect.effectKey.trim().toLowerCase()}`;
}
