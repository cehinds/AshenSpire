// src/model/levelLists.js — level lists: which cards and items a tier may offer (owner, 2026-11-21).
//
// Pure and headless. A tier (scoring.levelLists.tiers: act1, act2, act3) is a rank band; a card or item belongs to a tier's level list
// when its combat-power rank (src/model/combatPower.js, table src/content/generated/combatPower.js) is inside the band. The scoring is
// used ONLY to build these lists, to draw rewards from them and to generate cards: never live in combat.
//
//   tierFor(run)                      -> tier id for the run's act (acts beyond the last tier use the last tier)
//   levelList(kind, tierId, opts)     -> ids of `kind` ('cards' | 'weapon' | 'armour' | 'relic') whose rank is inside the band;
//                                        every id of the kind when the band would be empty (the scoring.json rule)
//   buildLevelLists(opts)             -> the whole generated structure {cards: {tier: ids}, items: {tier: {kind: ids}}}
//   filterToBand(kind, tierId, ids)   -> ids narrowed to the tier's band via the generated lists; unchanged when that would leave none
import { scoring as shippedScoring } from '../content/generated/scoring.js';
import { cardCombatPower, itemCombatPower } from '../content/generated/combatPower.js';
import { levelLists as generatedLists } from '../content/generated/levelLists.js';

export const ITEM_KINDS = ['weapon', 'armour', 'relic'];
export const LEVEL_KINDS = ['cards', ...ITEM_KINDS];
const shippedTable = { cardCombatPower, itemCombatPower };

/** The tier row for an id, or undefined. */
export const tierRow = (tierId, scoring = shippedScoring) => scoring.levelLists.tiers.find((t) => t.id === tierId);

/** Tier id for a run: act N -> the Nth tier, clamped to the last (Endless acts past the table stay in the top band). */
export function tierFor(run, scoring = shippedScoring) {
  const tiers = scoring.levelLists.tiers;
  const act = Math.max(1, Math.trunc(Number(run && run.actNumber) || 1));
  return tiers[Math.min(act, tiers.length) - 1].id;
}

function entriesOf(kind, table) {
  if (kind === 'cards') return Object.entries(table.cardCombatPower).map(([id, row]) => [id, row]);
  if (!ITEM_KINDS.includes(kind)) throw new Error(`levelLists: unknown kind '${kind}'`);
  const prefix = kind + ':';
  return Object.entries(table.itemCombatPower).filter(([key]) => key.startsWith(prefix)).map(([key, row]) => [key.slice(prefix.length), row]);
}

/** Ids of `kind` whose rank is inside the tier band; all ids of the kind when the band is empty. */
export function levelList(kind, tierId, { scoring = shippedScoring, table = shippedTable } = {}) {
  const tier = tierRow(tierId, scoring);
  if (!tier) throw new Error(`levelLists: unknown tier '${tierId}'`);
  const all = entriesOf(kind, table);
  const inBand = all.filter(([, row]) => row.rank >= tier.minRank && row.rank <= tier.maxRank).map(([id]) => id);
  return inBand.length ? inBand : all.map(([id]) => id);
}

/** The full generated structure: every tier's cards and each item kind. */
export function buildLevelLists({ scoring = shippedScoring, table = shippedTable } = {}) {
  const cards = {}, items = {};
  for (const { id } of scoring.levelLists.tiers) {
    cards[id] = levelList('cards', id, { scoring, table });
    items[id] = Object.fromEntries(ITEM_KINDS.map((kind) => [kind, levelList(kind, id, { scoring, table })]));
  }
  return { cards, items };
}

/**
 * Narrow candidate ids to a tier's band using the generated lists. `keyOf` maps a candidate to the list's id (armour is listed
 * as "<class>.<id>"). Falls back to the unfiltered candidates when none is inside the band, so a draw never empties.
 */
export function filterToBand(kind, tierId, ids, { lists = generatedLists, keyOf = (id) => id } = {}) {
  const list = kind === 'cards' ? lists.cards && lists.cards[tierId] : lists.items && lists.items[tierId] && lists.items[tierId][kind];
  if (!list) return ids;
  const allowed = new Set(list);
  const kept = ids.filter((id) => allowed.has(keyOf(id)));
  return kept.length ? kept : ids;
}
