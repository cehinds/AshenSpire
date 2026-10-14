import { subclassAbilityRole } from './subclasses.js';
import { deckCopyLimit } from './deckCopyLimit.js';
import { abilityOfferPool } from './abilityOffers.js';

// Owner decision 13: Psychic and Earth cards belong to no class, and an affinity
// class (balance.rewards.elementAffinity) may pick some as one of its starting
// spells. Qualifying cards are classless expanded-combat attacks of the
// configured source and rarities whose damage type is one of the class's
// elements. They have no ability grade, so they are dealt as plain cards.
function elementStartingCards(registries, run, config, settings) {
  const affinity = registries.balance.rewards?.elementAffinity;
  const rule = affinity?.startingChoice;
  const elements = affinity?.classes?.[run.class];
  if (!rule || !elements?.length || config.skillId !== 'item:magic-focus' || run.combatExpansionVersion !== 2) return [];
  return registries.cards.all().filter(card =>
    card.class === 'colorless' && card.minCombatExpansionVersion === 2 && card.type === 'attack'
    && card.attack?.source === rule.source && rule.rarities.includes(card.rarity)
    && elements.includes(card.attack.damageType)
    && (run.deck || []).filter(inst => inst.cardId === card.id).length < deckCopyLimit(registries, card.id, settings, run.class)
    && Object.entries(card.requirements?.attributes || {}).every(([attribute, minimum]) => (run.attributes?.[attribute] || 0) >= minimum));
}

export function startingAbilityPlan(registries, run, settings = {}) {
  const authored = registries.characterCreation.classes[run.class]?.startingAbility;
  const subclass = run.subclassId !== undefined ? registries.subclasses.get(run.subclassId) : null;
  const config = authored && { ...authored, ...(subclass?.startingAbility ? { count: subclass.startingAbility.count } : {}) };
  const candidate = subclass ? { ...run, deck: (run.deck || []).filter(card => card.openingSource !== 'subclass') } : run;
  if (!config) return null;
  const source = registries.masterySource || registries;
  const ids = abilityOfferPool(registries, candidate, config.skillId, config.rank).filter(id =>
    (candidate.deck || []).filter(inst => inst.cardId === id).length < deckCopyLimit(registries, id, settings, run.class));
  const eligibleIds = subclass && config.skillId === 'combatManeuvers' ? ids.filter(id => subclass.roles.some(slot => slot.role === subclassAbilityRole(registries, id))) : ids;
  const choices = [...new Map(eligibleIds.map(id => {
    const card = source.cards.get(id);
    return [card.abilityFamily || id, card];
  })).values()];
  const elementChoices = elementStartingCards(registries, candidate, config, settings);
  const maxElementPicks = elementChoices.length ? registries.balance.rewards.elementAffinity.startingChoice.maxPicks : 0;
  return { ...config, id: 'startingAbilities', kind: 'ability', choices: [...choices, ...elementChoices],
    elementIds: elementChoices.map(card => card.id), maxElementPicks };
}

export function startingAbilityProblem(registries, run, cardIds, settings = {}) {
  const plan = startingAbilityPlan(registries, run, settings);
  if (!plan) return cardIds?.length ? 'This class has no starting ability choices.' : null;
  if (!Array.isArray(cardIds) || cardIds.length !== plan.count) return `Choose ${plan.count} Rank ${plan.rank} ${plan.skillId === 'combatManeuvers' ? 'combat maneuver' : 'spells'}.`;
  const choices = new Map(plan.choices.map(card => [card.id, card]));
  if (cardIds.some(id => !choices.has(id))) return 'Choose abilities available for your class, attributes and armaments.';
  if (new Set(cardIds.map(id => choices.get(id).abilityFamily || id)).size !== plan.count) return 'Choose distinct starting abilities.';
  if (cardIds.filter(id => plan.elementIds.includes(id)).length > plan.maxElementPicks) return `Choose at most ${plan.maxElementPicks} element spell.`;
  return null;
}

// A starting spell's card reference: element spells are plain cards with no
// ability grade; every other starting spell carries the plan's rank.
export function startingAbilityRef(plan, cardId) {
  return plan.elementIds.includes(cardId) ? { cardId } : { cardId, abilityRank: plan.rank };
}

export function startingAbilityRefs(registries, run, cardIds, settings = {}) {
  // Omitted for existing quick-start, fixtures and co-op birth callers.
  if (cardIds === undefined) return [];
  const problem = startingAbilityProblem(registries, run, cardIds, settings);
  if (problem) throw new Error(problem);
  const plan = startingAbilityPlan(registries, run, settings);
  return cardIds.map(cardId => startingAbilityRef(plan, cardId));
}
