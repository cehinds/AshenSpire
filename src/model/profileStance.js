// Leaf: the stance a carrier plays under a configured profile. smashClause.js and engine/gameProfileCombat.js both read it
// from here, so model text never imports the engine adapter (and its stanceRules -> combatCardProfile -> smashClause cycle).
import { cardPreparationCategory } from './cardClassification.js';
import { configuredModule } from './profileModule.js';

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
// A Spell that carries Counter coverage (frostCounter and its school siblings) is a Counter in Core (owner 2026-10-19):
// its effective maneuver is counter (profile or maneuver tag) and it authors counterCoverage. It keeps the prepared stance.
export function isSpellCounter(card) {
  const profile = card?.combatProfile || {};
  const tags = (card?.cardTags || card?.tags || []).map(tag => typeof tag === 'string' ? tag : tag?.id);
  const maneuver = card?.stanceTrigger?.stance || profile.maneuver || card?.maneuver || tags.find(tag => tag?.startsWith('maneuver:'))?.slice(9);
  const camp = profile.camp ?? (tags.includes('camp:spell') ? 'spell' : null);
  return maneuver === 'counter' && camp === 'spell' && !!(card?.counterCoverage || profile.counterCoverage);
}
// The ONE predicate for "this card arms as a Core Counter" (live preparedCounter, the preview, the card face and the
// inspector help): the run's stances module includes Counter and the card is a Counter by stance, or is a spell Counter
// with coverage. A spell Counter arms but stands in the prepared stance it enters today (owner 2026-10-19).
export function armsAsCoreCounter(subject, card) {
  const rule = configuredModule(subject, 'stances');
  return !!rule && !!rule.include?.includes('counter') && (configuredStance(card) === 'counter' || isSpellCounter(card));
}
