// What the Blacksmith has done to one item, read from the run (W25 step 4). A leaf over the run's own fields:
//   run.itemUpgradePicks[itemRef]  the options the player chose, oldest first ({ id, k:'stat'|'effect'|'prop', ... })
//   run.itemCategories[itemRef]    a weapon's category after a category change (absent: its own)
//   run.itemRanks[itemRef]         how many times the item was ranked up (each adds one upgrade slot)
//   run.itemProps[itemRef]         the property ids a category change rolled onto the item (step 5)
// Every field is optional: a save written before them reads as nothing done, and an old weapon loads unchanged.
// `run.itemUpgradeLevels[itemRef]` stays the old fixed Smith tier (its AR / DR ladder, the rest-site Smith); the
// Blacksmith's picks are counted beside it, and an item's upgrade count is the two together (ItemUpgradeCount).
import { gameContent } from './gameProfile.js';
import { itemRefIdentity } from './itemUpgrades.js';
import { ITEM_WEAPON_CATEGORIES, ITEM_PROPERTIES } from '../content/itemProperties.js';
import { ChannelAttribute } from './damageChannels.js';
import { relics as RELICS } from '../content/relics.js';

const own = (map, itemRef) => (map && typeof map === 'object' && Array.isArray(map[itemRef]) ? map[itemRef] : []);

/** The options chosen for an item, oldest first. */
export const ItemPicks = (run, itemRef) => own(run?.itemUpgradePicks, itemRef);

/** The fixed Smith tier (the AR / DR ladder of the rest-site Smith) the item holds. */
export const LegacyTier = (run, itemRef) => {
  const level = run?.itemUpgradeLevels?.[itemRef];
  return Number.isInteger(level) && level > 0 ? level : 0;
};

/** The item's upgrade count: every upgrade it has, fixed tiers and Blacksmith picks together. */
export const ItemUpgradeCount = (run, itemRef) => LegacyTier(run, itemRef) + ItemPicks(run, itemRef).length;

/** Ranks the item has been raised (each is one more upgrade slot). */
export const ItemRank = (run, itemRef) => {
  const rank = run?.itemRanks?.[itemRef];
  return Number.isInteger(rank) && rank > 0 ? rank : 0;
};

/** The gear row of an owned weapon, shield or armour (the Core gear content), or null (a relic has none). */
export function GearRowOf(run, itemRef) {
  const identity = itemRefIdentity(itemRef);
  if (!identity || identity.itemKind === 'relic') return null;
  const armor = identity.itemKind === 'armor';
  return (gameContent(run, 'gear') || []).find((item) => (item.source?.id || item.id) === identity.itemId
    && (item.kind === 'armor') === armor && (!item.classes || !run?.class || item.classes.includes(run.class))) || null;
}

const ALL_CATEGORIES = [...ITEM_WEAPON_CATEGORIES.martial, ...ITEM_WEAPON_CATEGORIES.magic];

/** A weapon's category: the one a category change set, else the first category tag its gear row carries. */
export function ItemCategory(run, itemRef) {
  const set = run?.itemCategories?.[itemRef];
  if (typeof set === 'string' && ALL_CATEGORIES.includes(set)) return set;
  const row = GearRowOf(run, itemRef);
  if (!row || row.kind === 'armor' || row.kind === 'shield') return null;
  return (row.tags || []).find((tag) => ALL_CATEGORIES.includes(tag)) || null;
}

/** 'martial' | 'magic' for a weapon, 'armor' for armour and shields, 'relic' for a relic, null for anything else. */
export function ItemFamily(run, itemRef) {
  const identity = itemRefIdentity(itemRef);
  if (!identity) return null;
  if (identity.itemKind === 'relic') return 'relic';
  if (identity.itemKind === 'armor') return 'armor';
  const row = GearRowOf(run, itemRef);
  if (!row) return null;
  if (row.kind === 'shield') return 'armor';
  const category = ItemCategory(run, itemRef);
  if (category) return ITEM_WEAPON_CATEGORIES.magic.includes(category) ? 'magic' : 'martial';
  return row.kind === 'staff' ? 'magic' : 'martial';
}

/** Every ref the run keeps picks for that is worn or held now is the caller's filter; this lists the stored ones. */
export const PickedItemRefs = (run) => Object.keys(run?.itemUpgradePicks || {}).filter((ref) => ItemPicks(run, ref).length);

/** The property ids a relic is authored with (its `properties` row field); [] for any other ref. */
export function AuthoredPropertyIds(itemRef) {
  const identity = itemRefIdentity(itemRef);
  if (!identity || identity.itemKind !== 'relic') return [];
  return RELICS.find((row) => row.id === identity.itemId)?.properties || [];
}

/** The property ids an item holds: a relic's authored ones, those its picks chose, then those a category change rolled onto it. */
export function ItemPropertyIds(run, itemRef) {
  const ids = [...AuthoredPropertyIds(itemRef), ...ItemPicks(run, itemRef).filter((pick) => pick.k === 'prop').map((pick) => pick.prop)];
  for (const id of own(run?.itemProps, itemRef)) if (typeof id === 'string') ids.push(id);
  return ids.filter((id, index) => ids.indexOf(id) === index && ITEM_PROPERTIES.some((row) => row.id === id));
}

/** The stat points an item's picks and properties add ({ ar, dr, pr, poise, ward, mp, strength... }), whoever wears it. */
export function ItemStatBonus(run, itemRef) {
  const out = {};
  // A pick or property from before the 2026-11-18 ruling may still name `ar`, `dr` or `pr`: it is the attribute now (ChannelAttribute).
  const add = (stat, n) => { if (stat && Number.isFinite(n) && n) { const key = ChannelAttribute(stat); out[key] = (out[key] || 0) + n; } };
  for (const pick of ItemPicks(run, itemRef)) if (pick.k === 'stat') add(pick.stat, pick.n);
  for (const id of ItemPropertyIds(run, itemRef)) {
    const row = ITEM_PROPERTIES.find((entry) => entry.id === id);
    for (const [stat, n] of Object.entries(row?.stats || {})) add(stat, n);
  }
  return out;
}
