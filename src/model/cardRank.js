// Card ranks (SPEC 13.4o), pure and dependency-free so both registries.js (Legacy faces) and
// gameProfile.js (Core faces) read one rule. registries.js re-exports these names.

/**
 * cardRank(instance) → the instance's rank (SPEC §13.4o), 1 when absent. A
 * rank is a whole number from 1 up; validateRunShape refuses anything else.
 */
export function cardRank(instance) {
  const rank = instance && instance.rank;
  return Number.isInteger(rank) && rank >= 1 ? rank : 1;
}

/**
 * The ops a rank may move, best first (SPEC §13.4o): a card's PRIMARY NUMBER is
 * what it is for — damage, then Block, then healing, then a status it applies,
 * then poise damage. Costs (loseHp) and tempo (draw, energy, mana, discard)
 * are never primary, so a rank cannot raise a price or snowball a turn.
 */
const RANKED_OPS = ['damage', 'block', 'heal', 'applyStatus', 'poiseDamage'];
// An X-hit card (hits = energy spent) splits its rank as if it hit this often.
const RANK_FORMULA_HITS = 3;

/**
 * primaryEffectIndex(card) → the index of the card's PRIMARY NUMBER: its first
 * unconditional effect of the best RANKED_OPS op present, with a numeric
 * amount (stacks for a status); -1 when it has none (the rank moves nothing).
 */
export function primaryEffectIndex(card) {
  const effects = (card && card.effects) || [];
  const numeric = (effect) => (effect.op === 'applyStatus' ? typeof effect.stacks === 'number' : typeof effect.amount === 'number');
  for (const op of RANKED_OPS) {
    const index = effects.findIndex((effect) => effect && !effect.if && effect.op === op && numeric(effect));
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * rankBonus(effect, steps) → what `steps` rank steps add to the primary number.
 * One per step; a multi-hit effect splits that across its hits, rounded up, so
 * the total stays near one per step and a step never passes without a gain.
 */
export function rankBonus(effect, steps) {
  if (!steps) return 0;
  const hits = typeof effect.hits === 'number' ? effect.hits : effect.hits != null ? RANK_FORMULA_HITS : 1;
  return Math.ceil(steps / Math.max(1, hits));
}

/** rankedEffects(card, steps) → the card's effects with `steps` rank steps added to its primary number. */
export function rankedEffects(card, steps) {
  const index = primaryEffectIndex(card);
  return (card.effects || []).map((effect, i) => {
    if (i !== index || !steps) return effect;
    const bonus = rankBonus(effect, steps);
    return effect.op === 'applyStatus' ? { ...effect, stacks: effect.stacks + bonus } : { ...effect, amount: effect.amount + bonus };
  });
}
