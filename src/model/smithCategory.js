// Changing a weapon's category at the Blacksmith (W25 step 5, owner 2026-11-14): 1 Smithing Stone and 75 cinders.
// The player keeps up to N of the old weapon's properties (N = its upgrade count, at least 1, and at least 1 always
// carries over when it has any); the others are replaced. 1 to 1 + upgrade count NEW properties are rolled from the
// new category's pool, lower counts likelier. The roll is seeded by the weapon, the new category and the visit's offer key, so
// the quote the player sees is exactly what the commit does. Save shape: `run.itemCategories[ref]` (new category), `run.itemProps[ref]` (the
// new and kept rolled properties), and the dropped picks become `{ k: 'spent' }` markers so the upgrade count stays.
import { mulberry32 } from './rng.js';
import { upgradeSeed } from './cardUpgradeSteps.js';
import { ItemCategory, ItemFamily, ItemPicks, ItemUpgradeCount, ItemPropertyIds } from './itemPicks.js';
import { PickText } from './smithUpgrade.js';
import { OfferSalted } from './upgradeOffer.js';
import { ITEM_PROPERTIES, ITEM_WEAPON_CATEGORIES, ITEM_CATEGORY_CHANGE } from '../content/itemProperties.js';

const ALL = [...ITEM_WEAPON_CATEGORIES.martial, ...ITEM_WEAPON_CATEGORIES.magic];
const familyOfCategory = (category) => (ITEM_WEAPON_CATEGORIES.magic.includes(category) ? 'magic' : 'martial');
const textOf = (id) => ITEM_PROPERTIES.find((row) => row.id === id)?.text || id;

/** The categories a weapon can change to: every other category. Empty for armour, shields and relics. */
export function CategoryChoices(run, itemRef) {
  const family = ItemFamily(run, itemRef);
  if (family !== 'martial' && family !== 'magic') return [];
  return ALL.filter((category) => category !== ItemCategory(run, itemRef));
}

/** What the weapon holds that the player may keep: { key, text } rows (a picked option or a rolled property). */
export function KeepableProperties(run, itemRef) {
  const rows = [];
  ItemPicks(run, itemRef).forEach((pick, index) => { if (pick.k !== 'spent') rows.push({ key: `pick:${index}`, text: PickText(pick) }); });
  const picked = new Set(ItemPicks(run, itemRef).filter((pick) => pick.k === 'prop').map((pick) => pick.prop));
  for (const id of ItemPropertyIds(run, itemRef)) if (!picked.has(id)) rows.push({ key: `prop:${id}`, text: textOf(id) });
  return rows;
}

/** How many of its old properties the player may keep: the weapon's upgrade count, at least 1. */
export const KeepLimit = (run, itemRef) => Math.max(1, ItemUpgradeCount(run, itemRef));

/** The most new properties a change can roll: 1 + the weapon's upgrade count. */
export const NewPropertyMax = (run, itemRef) => 1 + ItemUpgradeCount(run, itemRef);

function rollNewProperties(run, itemRef, category, heldIds) {
  const max = NewPropertyMax(run, itemRef);
  // Seeded by the weapon, the category and the visit's offer key, never by the keep boxes: ticking one only skips a
  // property the player keeps, so the roll the player sees stays put for the visit (owner, 2026-11-20).
  const rng = mulberry32(upgradeSeed(run.seed, OfferSalted(run, `category:${itemRef}:${category}`), ItemUpgradeCount(run, itemRef) * 100 + (run.itemProps?.[itemRef]?.length || 0)));
  // 1..max new properties, weighted to the lower numbers: k has weight (max + 1 - k)^2.
  const weights = Array.from({ length: max }, (_, i) => (max - i) ** 2);
  let roll = rng() * weights.reduce((sum, n) => sum + n, 0), count = 1;
  for (let i = 0; i < weights.length; i += 1) { roll -= weights[i]; if (roll < 0) { count = i + 1; break; } }
  const family = familyOfCategory(category);
  // The whole family pool in a seeded weighted order; the first `count` the weapon does not keep are the new ones.
  const pool = ITEM_PROPERTIES.filter((row) => row.weights[family] > 0).map((row) => ({ id: row.id, weight: row.weights[family] }));
  const order = [];
  while (pool.length) {
    let pick = rng() * pool.reduce((sum, row) => sum + row.weight, 0), index = 0;
    for (; index < pool.length - 1; index += 1) { pick -= pool[index].weight; if (pick < 0) break; }
    order.push(pool[index].id);
    pool.splice(index, 1);
  }
  return order.filter((id) => !heldIds.has(id)).slice(0, count);
}

/**
 * PlanCategoryChange(run, itemRef, category, keepKeys) -> inert quote: the price, what is kept, what is lost, the
 * new properties and the reason it cannot be done ('' when it can).
 */
export function PlanCategoryChange(run, itemRef, category, keepKeys = [], { priceMult = 1 } = {}) {
  const held = KeepableProperties(run, itemRef);
  const limit = KeepLimit(run, itemRef);
  const keys = [...new Set(keepKeys)];
  const cinders = priceMult === 1 ? ITEM_CATEGORY_CHANGE.cinders : Math.ceil(ITEM_CATEGORY_CHANGE.cinders * priceMult);
  const stones = ITEM_CATEGORY_CHANGE.stones;
  let code = '';
  if (!CategoryChoices(run, itemRef).includes(category)) code = 'category';
  else if (keys.some((key) => !held.some((row) => row.key === key))) code = 'keep';
  else if (keys.length > limit) code = 'keepMany';
  else if (held.length && !keys.length) code = 'keepOne';
  else if ((run.smithingStones || 0) < stones) code = 'stones';
  else if ((run.cinders || 0) < cinders) code = 'cinders';
  const keptIds = new Set(keys.filter((key) => key.startsWith('prop:')).map((key) => key.slice(5)));
  for (const key of keys) if (key.startsWith('pick:')) { const pick = ItemPicks(run, itemRef)[Number(key.slice(5))]; if (pick?.k === 'prop') keptIds.add(pick.prop); }
  const added = code === 'category' ? [] : rollNewProperties(run, itemRef, category, keptIds);
  return { ok: !code, code, itemRef, category, keep: keys, keepLimit: limit, held, stones, cinders, newProperties: added.map((id) => ({ id, text: textOf(id) })) };
}

/** Apply a quote: the category, the kept picks and properties, the new properties, and the price. */
export function ApplyCategoryChange(run, plan) {
  const { itemRef, category } = plan;
  const picks = ItemPicks(run, itemRef).map((pick, index) => (plan.keep.includes(`pick:${index}`) || pick.k === 'spent' ? pick : { id: 'spent', k: 'spent' }));
  const keptRolled = (run.itemProps?.[itemRef] || []).filter((id) => plan.keep.includes(`prop:${id}`));
  run.itemUpgradePicks = { ...(run.itemUpgradePicks || {}), [itemRef]: picks };
  run.itemProps = { ...(run.itemProps || {}), [itemRef]: [...keptRolled, ...plan.newProperties.map((row) => row.id)] };
  run.itemCategories = { ...(run.itemCategories || {}), [itemRef]: category };
  run.smithingStones = (run.smithingStones || 0) - plan.stones;
  run.cinders = (run.cinders || 0) - plan.cinders;
  return { itemRef, category, kept: plan.keep.length, added: plan.newProperties.map((row) => row.id), spentStones: plan.stones, spentCinders: plan.cinders };
}
