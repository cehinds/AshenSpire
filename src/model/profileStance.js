// Leaf: the stance a carrier plays under a configured profile. smashClause.js and engine/gameProfileCombat.js both read it
// from here, so model text never imports the engine adapter (and its stanceRules -> combatCardProfile -> smashClause cycle).
import { cardPreparationCategory } from './cardClassification.js';

export const MIRRORED_TYPES = new Set(['attack', 'smash', 'sweep', 'defend', 'counter']);
// A Spell that mirrors a basic card (owner 2026-10-18) takes that basic's maneuver; it stays a Spell. Only Core 2 content sets `mirrors`.
export function mirroredManeuver(carrier) {
  const mirrors = carrier?.combatProfile?.mirrors ?? carrier?.mirrors;
  return MIRRORED_TYPES.has(mirrors) && (carrier?.combatProfile?.camp ?? 'spell') === 'spell' ? mirrors : null;
}
// A Spell that mirrors a basic card (owner 2026-10-18) keeps that basic's stance; it is still a Spell.
export const mirroredStance = mirroredManeuver;
export function configuredStance(carrier) {
  if (mirroredStance(carrier)) return mirroredStance(carrier);
  if (cardPreparationCategory(carrier)) return 'prepared';
  const raw = carrier?.stanceTrigger?.stance || carrier?.combatProfile?.maneuver || carrier?.maneuver
    || (carrier?.cardTags || carrier?.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id).find(tag => tag.startsWith('maneuver:'))?.slice(9);
  return ({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack' })[raw] || raw || 'neutral';
}
