import { mirroredManeuver } from './stanceRules.js';
import { cardPreparationCategory } from './cardClassification.js';
import { gameModule } from './gameProfile.js';

// A Spell that mirrors a basic card (owner 2026-10-18) keeps that basic's stance; it is still a Spell.
export const mirroredStance = mirroredManeuver;
const configuredModule = (subject, id) => { const rule = gameModule(subject, id); return rule?.mode === 'configured' ? rule : null; };
export function configuredStance(carrier) {
  if (mirroredStance(carrier)) return mirroredStance(carrier);
  if (cardPreparationCategory(carrier)) return 'prepared';
  const raw = carrier?.stanceTrigger?.stance || carrier?.combatProfile?.maneuver || carrier?.maneuver
    || (carrier?.cardTags || carrier?.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id).find(tag => tag.startsWith('maneuver:'))?.slice(9);
  return ({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack' })[raw] || raw || 'neutral';
}
// The ONE predicate for "this card arms as a Core Counter" (live preparedCounter, the preview and the inspector help):
// the run's stances module includes Counter and the card's configured stance is Counter. A spell Counter stands in
// the 'prepared' stance and never arms.
export function armsAsCoreCounter(subject, card) {
  const rule = configuredModule(subject, 'stances');
  return !!rule && !!rule.include?.includes('counter') && configuredStance(card) === 'counter';
}
