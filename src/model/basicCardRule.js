import { gameContent } from './gameProfile.js';

/**
 * basicCardKind(run, card) → 'Basic' | 'Cantrip' | null: whether a Core card
 * definition is a Basic card (a martial, non-spell card) or a cantrip (a rank
 * 0 spell). Shared by deck training (model/deckCopyLimit.js) and the card
 * upgrade free allowance (model/cardUpgradeLimits.js), so both ask one rule.
 * Ranked or graded cards, power/status/curse/consumable cards, extractable
 * cards, weapon arts and every class's special card are never Basic.
 */
export function basicCardKind(run, card) {
  if (!card || card.rank > 0 || card.abilityRank > 0 || ['power', 'status', 'curse', 'consumable'].includes(card.type)) return null;
  const tags = card.tags || [];
  if (tags.includes('extractable') || tags.includes('classification.weaponArt')) return null;
  // Exclude every class's special pool, including a foreign special whose
  // starter rarity would otherwise match the generic Basic training rule.
  const pools = gameContent(run, 'cardPools') || {};
  const ownedPools = run?.gameProfile?.modules?.['deck-training']?.owned?.pools || [];
  const excluded = ownedPools.flatMap(id => [...Object.values(pools[id]?.byTag || {}),
    ...Object.values(pools[id]?.byClass || {}).flatMap(row => Object.values(row))]);
  if (excluded.includes(card.id) || (gameContent(run, 'classes') || []).some(row => row.specialCardId === card.id)) return null;
  const spell = tags.includes('source:spell') || tags.includes('camp:spell');
  if (!spell) return 'Basic';
  return tags.includes('rank.cantrip') ? 'Cantrip' : null;
}
