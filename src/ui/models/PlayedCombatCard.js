import { resolveCombatCard } from '../../engine/combatExpansion.js';

// A paid play owns its instance and temporary tier. Neither a consumed hand
// card nor the UI's cleared tier picker is an authority after dispatch.
export function resolvePlayedCombatCard(context, receipt, capturedInstance) {
  const instance = receipt.cardInstance || capturedInstance || receipt;
  const definition = resolveCombatCard(context, instance, { upcastTier: receipt.upcastTier });
  return { ...definition,
    ...(instance.sourceArmamentId ? { sourceArmamentId: instance.sourceArmamentId } : {}),
    ...(Array.isArray(receipt.cardTags) ? { cardTags: receipt.cardTags } : {}) };
}
