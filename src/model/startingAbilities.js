import { deckCopyLimit } from './deckCopyLimit.js';
import { abilityOfferPool } from './abilityOffers.js';

export function startingAbilityPlan(registries, run) {
  const config = registries.characterCreation.classes[run.class]?.startingAbility;
  if (!config) return null;
  const source = registries.masterySource || registries;
  const ids = abilityOfferPool(registries, run, config.skillId, config.rank).filter(id =>
    (run.deck || []).filter(inst => inst.cardId === id).length < deckCopyLimit(registries, id, run.advancedConfigSnapshot, run.class));
  const choices = [...new Map(ids.map(id => {
    const card = source.cards.get(id);
    return [card.abilityFamily || id, card];
  })).values()];
  return { ...config, id: 'startingAbilities', kind: 'ability', choices };
}

export function startingAbilityProblem(registries, run, cardIds) {
  const plan = startingAbilityPlan(registries, run);
  if (!plan) return cardIds?.length ? 'This class has no starting ability choices.' : null;
  if (!Array.isArray(cardIds) || cardIds.length !== plan.count) return `Choose ${plan.count} Rank ${plan.rank} ${plan.skillId === 'combatManeuvers' ? 'combat maneuver' : 'spells'}.`;
  const choices = new Map(plan.choices.map(card => [card.id, card]));
  if (cardIds.some(id => !choices.has(id))) return 'Choose abilities available for your class, attributes and armaments.';
  if (new Set(cardIds.map(id => choices.get(id).abilityFamily || id)).size !== plan.count) return 'Choose distinct starting abilities.';
  return null;
}

export function startingAbilityRefs(registries, run, cardIds) {
  // Omitted for existing quick-start, fixtures and co-op birth callers.
  if (cardIds === undefined) return [];
  const problem = startingAbilityProblem(registries, run, cardIds);
  if (problem) throw new Error(problem);
  const plan = startingAbilityPlan(registries, run);
  return cardIds.map(cardId => ({ cardId, abilityRank: plan.rank }));
}
