// Wither N (SPEC §4.3): each copy of the card exhausts on its Nth play this fight.
// The count is the copy's own plays this combat (abilityRiders.instanceUsesCombat), so it resets each fight.
import { EffectiveWitherLimit } from './combatMechanics.js';

/** Plays of this copy left before Wither exhausts it, or null when the card has no Wither. */
export function WitherRemaining(entity, instance, def, ctx = null) {
  const limit = EffectiveWitherLimit(def, ctx);
  if (limit === null) return null;
  const plays = (instance?.instanceId && entity?.abilityRiders?.instanceUsesCombat?.[instance.instanceId]) || 0;
  return Math.max(0, limit - plays);
}
