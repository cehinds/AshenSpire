// The starting cards a Core player chooses at creation (owner, 2026-11-17,
// playtest item 19): how many of each card in `deckRules.creationPool` the
// opening deck holds. The class's other starting cards stay as authored, and
// the deck editor's minimum and maximum still apply to the whole deck.
// Pure model: a run and a { cardId: count } choice in, a refusal or a deck out.
import { deckRules } from '../content/deckRules.js';
import { gameContent, isCoreProfile } from './gameProfile.js';
import { deckEditRefusal } from './deckRules.js';
import { DeckMinDelta } from './deckMinimumRules.js';
import { recordCollectedCards } from './collectedCards.js';

const loose = (card) => !!card && !card.grantedBy && !card.equipmentRole;

/** The pool card ids this run may choose from (Core only; ids its cards define), in pool order; a caster's swaps applied. */
export function StartingPoolIds(run) {
  if (!isCoreProfile(run)) return [];
  const known = new Set((gameContent(run, 'cards') || []).map((card) => card.id));
  const swaps = deckRules.creationPoolSwaps[run.class] || {};
  return deckRules.creationPool.map((id) => swaps[id] || id).filter((id) => known.has(id));
}

/** StartingPoolCounts(run) → { cardId: copies } of each pool card loose in the run's deck now. */
export function StartingPoolCounts(run) {
  const pool = StartingPoolIds(run);
  return Object.fromEntries(pool.map((id) => [id, (run.deck || []).filter((card) => loose(card) && card.cardId === id).length]));
}

/** The deck size the choice would leave: the deck without its loose pool cards, plus the chosen copies. */
export function StartingDeckSize(run, counts) {
  const pool = new Set(StartingPoolIds(run));
  const kept = (run.deck || []).filter((card) => !(loose(card) && pool.has(card.cardId))).length;
  return kept + Object.values(counts || {}).reduce((sum, n) => sum + n, 0);
}

/** StartingDeckChoiceRefusal(run, counts, settings) → '' when the choice may start a run, else one sentence. */
export function StartingDeckChoiceRefusal(run, counts, settings = {}) {
  const pool = StartingPoolIds(run);
  for (const [id, n] of Object.entries(counts || {})) {
    if (!pool.includes(id)) return `${id} is not a starting card choice.`;
    if (!Number.isInteger(n) || n < 0) return `Starting copies must be a whole number of at least 0 (got ${JSON.stringify(n)}).`;
  }
  return deckEditRefusal(StartingDeckSize(run, counts), settings, DeckMinDelta(run));
}

/**
 * ApplyStartingDeckChoice(run, counts, settings) → the run, its deck rebuilt:
 * the chosen pool cards first (pool order), then every other starting card in
 * its authored order. Throws the refusal sentence when the choice is refused.
 */
export function ApplyStartingDeckChoice(run, counts, settings = {}) {
  const refusal = StartingDeckChoiceRefusal(run, counts, settings);
  if (refusal) throw new Error(refusal);
  const pool = StartingPoolIds(run);
  const rest = (run.deck || []).filter((card) => !(loose(card) && pool.includes(card.cardId)));
  const used = new Set([...(run.deck || []), ...(run.sideboard || [])].map((card) => card.instanceId));
  let next = 1;
  const mint = () => {
    while (used.has(`gp${next}`)) next += 1;
    used.add(`gp${next}`);
    return `gp${next}`;
  };
  const chosen = pool.flatMap((id) => Array.from({ length: counts?.[id] || 0 }, () => ({ instanceId: mint(), cardId: id, upgraded: false })));
  run.deck = [...chosen, ...rest];
  // The chosen opening cards are starters too (the deck editor tags only cards collected later REWARD).
  run.starterCardIds = [...new Set([...(run.starterCardIds || []), ...chosen.map((card) => card.cardId)])];
  recordCollectedCards(run);
  return run;
}
