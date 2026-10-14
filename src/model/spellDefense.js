// Defensive Ward shares are independent of a school's damage routing.
// Split the already modified total once: Block rounds to nearest, Ward keeps
// the remainder, so upgrades, upcasting and rating bonuses retain their total.
import { combatProfileFor } from './combatCardProfile.js';
import { spellDefenseRules } from '../content/spellDefenseRules.js';

export function spellDefenseSplit(card, amount, rules = spellDefenseRules) {
  const profile = card?.combatProfile || combatProfileFor(card);
  if (profile.camp !== 'spell' || !(['defend', 'counter'].includes(profile.maneuver) || (!profile.maneuver && card?.type === 'skill'))
    || card?.evade || profile.evade || !Number.isFinite(amount)) return null;
  const wardShare = rules.schools[profile.school] ?? rules.defaultWardShare;
  const total = Math.max(0, Math.floor(amount));
  const block = Math.round(total * (1 - wardShare));
  return { block, ward: total - block };
}
