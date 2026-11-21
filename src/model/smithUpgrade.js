// The Blacksmith's item upgrades (W25 step 4, owner 2026-11-14): every upgrade is a CHOICE of two or three rolled
// options, priced by how many upgrades the item already has. Pure and stateless like the card-upgrade generator:
// the roll is mulberry32(hash(run.seed, itemRef + the visit's offer key, upgrade number)), so the options a quote shows are the options a
// commit applies and a re-quote never changes them. Nothing here touches the combat engine; the chosen option is
// stored in `run.itemUpgradePicks[itemRef]` and read by the gear receipt (gameProfileGear.js) and the item-property
// summary (itemProperties.js).
//
//   cost       cinders 50, 85, 120, 155, then +35 each, +25 per item rank (owner 2026-11-17); Smithing Stones 1 for upgrades 1-3, 2 for 4-6, 3 for 7-9, ...
//   slots      an item takes `baseSlots` upgrades (6) plus one per rank it was raised, at most `maxSlots` (12)
//   options    stat picks follow the run's gear rules; any item can roll a property (itemProperties.json)
import { mulberry32 } from './rng.js';
import { upgradeSeed } from './cardUpgradeSteps.js';
import { itemRefIdentity } from './itemUpgrades.js';
import { ItemCategory, ItemFamily, ItemPicks, ItemUpgradeCount, ItemRank, ItemPropertyIds } from './itemPicks.js';
import { ITEM_SMITH, ITEM_STAT_OPTIONS, ITEM_SMITH_BEFORE_STAT_POINTS, ITEM_STAT_OPTIONS_BEFORE_STAT_POINTS, ITEM_PROPERTIES } from '../content/itemProperties.js';
import { gameModule } from './gameProfile.js';
import { OfferSalted } from './upgradeOffer.js';

const STAT_LABELS = {
  ar: 'STR', dr: 'DEX', pr: 'INT', poise: 'Poise', ward: 'Ward', mp: 'Mana',
  strength: 'STR', dexterity: 'DEX', constitution: 'CON', wisdom: 'WIS', intelligence: 'INT',
};

/**
 * The price of upgrade number `n` (1-based) of an item raised `rank` times: { cinders, stones }. Owner, 2026-11-17: the
 * least is about 50 cinders, rising with the earlier upgrades (the table, then cinderStep) and with rank (cinderPerRank).
 */
export function SmithUpgradeCost(n, rank = 0, subject = null) {
  const upgrade = Math.max(1, Math.floor(n) || 1);
  const prices = gameModule(subject, 'gear')?.statPoints ? ITEM_SMITH : ITEM_SMITH_BEFORE_STAT_POINTS;
  const table = prices.cinders;
  const ranks = Number.isSafeInteger(rank) && rank > 0 ? rank : 0;
  const cinders = (upgrade <= table.length ? table[upgrade - 1] : table[table.length - 1] + prices.cinderStep * (upgrade - table.length))
    + (prices.cinderPerRank || 0) * ranks;
  return { cinders, stones: Math.ceil(upgrade / ITEM_SMITH.stonesPerBand) };
}

/** How many upgrades the item can take: the base slots plus one per rank, never past the ceiling. */
export const SmithUpgradeSlots = (run, itemRef) => Math.min(ITEM_SMITH.maxSlots, ITEM_SMITH.baseSlots + ItemRank(run, itemRef));

/** The sentence an option reads as ("+1 DEX", "Retain 1 card at turn end"). */
export function PickText(pick) {
  if (!pick) return '';
  if (pick.k === 'spent') return '(reworked)';
  if (pick.k === 'prop') return ITEM_PROPERTIES.find((row) => row.id === pick.prop)?.text || pick.prop;
  if (pick.k === 'effect') return pick.effect === 'poiseDamagePct' ? `+${pick.n}% Poise damage` : `${pick.effect} ${pick.n}`;
  return `+${pick.n} ${STAT_LABELS[pick.stat] || pick.stat}`;
}

function statCandidates(run, itemRef, family) {
  const out = [];
  const category = ItemCategory(run, itemRef);
  const options = gameModule(run, 'gear')?.statPoints ? ITEM_STAT_OPTIONS : ITEM_STAT_OPTIONS_BEFORE_STAT_POINTS;
  for (const row of options[family] || []) {
    if (row.stat) out.push({ weight: row.weight, pick: { id: row.id, k: 'stat', stat: row.stat, n: row.n } });
    else if (row.effect) out.push({ weight: row.weight, pick: { id: row.id, k: 'effect', effect: row.effect, n: row.n } });
    else {
      const attrs = row.attrs || row.byCategory?.[category] || row.fallback || [];
      for (const attr of attrs) out.push({ weight: row.weight / attrs.length, pick: { id: `attr:${attr}`, k: 'stat', stat: attr, n: row.n } });
    }
  }
  return out;
}

function propertyCandidates(run, itemRef, family) {
  const held = new Set(ItemPropertyIds(run, itemRef));
  const out = [];
  for (const row of ITEM_PROPERTIES) {
    const weight = row.weights?.[family];
    if (!(weight > 0) || held.has(row.id)) continue;
    if (row.categories && !row.categories.includes(ItemCategory(run, itemRef))) continue;
    out.push({ weight, pick: { id: `prop:${row.id}`, k: 'prop', prop: row.id } });
  }
  return out;
}

/** Every option an item can roll now (with weights), for tests and for the roll. */
export function SmithOptionPool(run, itemRef) {
  const family = ItemFamily(run, itemRef);
  if (!family) return [];
  return [...statCandidates(run, itemRef, family), ...propertyCandidates(run, itemRef, family)];
}

/** Upgrade number `n` of an item: two or three distinct options, the same every time it is asked. */
export function RollSmithOptions(run, itemRef, n = ItemUpgradeCount(run, itemRef) + 1) {
  const pool = SmithOptionPool(run, itemRef);
  if (!pool.length) return [];
  const rng = mulberry32(upgradeSeed(run.seed, OfferSalted(run, `smith:${itemRef}`), n));
  const counts = ITEM_SMITH.optionCounts;
  const count = Math.min(pool.length, counts[Math.min(counts.length - 1, Math.floor(rng() * counts.length))]);
  const left = [...pool];
  const options = [];
  while (options.length < count && left.length) {
    const total = left.reduce((sum, row) => sum + row.weight, 0);
    let roll = rng() * total, index = 0;
    for (; index < left.length - 1; index += 1) { roll -= left[index].weight; if (roll < 0) break; }
    options.push({ ...left[index].pick, text: PickText(left[index].pick) });
    left.splice(index, 1);
  }
  return options;
}

/**
 * What upgrading `itemRef` would be now, inert: its number, price, rolled options and the reason it cannot be done.
 * `purse` is the run's stones and cinders as the caller reads them (the Blacksmith passes its price multiplier).
 */
export function PlanSmithUpgrade(run, itemRef, { priceMult = 1 } = {}) {
  const identity = itemRefIdentity(itemRef);
  const count = ItemUpgradeCount(run, itemRef);
  const n = count + 1;
  const base = SmithUpgradeCost(n, ItemRank(run, itemRef), run);
  const cinders = priceMult === 1 ? base.cinders : Math.ceil(base.cinders * priceMult);
  const slots = SmithUpgradeSlots(run, itemRef);
  const options = identity ? RollSmithOptions(run, itemRef, n) : [];
  let code = '';
  if (!identity || !options.length) code = 'none';
  else if (count >= slots) code = 'slots';
  else if ((run.smithingStones || 0) < base.stones) code = 'stones';
  else if ((run.cinders || 0) < cinders) code = 'cinders';
  return { ok: !code, code, itemRef, n, stones: base.stones, cinders, slots, used: count, options };
}

/** Apply option `optionId` of the plan: the pick is stored, the purse pays. Throws a plain Error naming the refusal. */
export function ApplySmithUpgrade(run, plan, optionId) {
  const option = plan.options.find((row) => row.id === optionId) || null;
  if (!option) throw new Error(`Smith upgrade: '${optionId}' is not one of the options offered`);
  const { text, ...pick } = option;
  run.itemUpgradePicks = { ...(run.itemUpgradePicks || {}), [plan.itemRef]: [...ItemPicks(run, plan.itemRef), pick] };
  run.smithingStones = (run.smithingStones || 0) - plan.stones;
  run.cinders = (run.cinders || 0) - plan.cinders;
  return { itemRef: plan.itemRef, n: plan.n, pick, spentStones: plan.stones, spentCinders: plan.cinders };
}
