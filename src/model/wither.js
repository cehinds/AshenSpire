// Wither N (SPEC §4.3): each copy exhausts on its Nth play this fight.
import { EffectiveWitherLimit } from './combatMechanics.js';

/** Plays of this copy left before Wither exhausts it, or null if none. */
export function WitherRemaining(entity, instance, cardDef, context = null)
{
  const limit = EffectiveWitherLimit(cardDef, context);
  if (limit === null)
  {
    return null;
  }

  const instanceId = instance?.instanceId;
  const playsThisFight = (instanceId && entity?.abilityRiders?.instanceUsesCombat?.[instanceId]) || 0;

  return Math.max(0, limit - playsThisFight);
}
