import { combatProfileFor } from './combatCardProfile.js';

/** Target planning considers support that resolves now, not a deferred reply. */
export function immediateCardEffects(def) {
  const effects = def?.effects || [];
  return combatProfileFor(def).maneuver === 'counter'
    ? effects.filter(effect => !['damage', 'poiseDamage'].includes(effect.op)) : effects;
}
