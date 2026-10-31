// src/model/blacksmithStock.js — the Core Blacksmith's two shelves (owner ask 2026-10-31): a large armament rack, each
// piece rolled at a tier (usually above the default), and weapon arts. Headless. The numbers are the profile's
// `shops.blacksmith` block (blacksmithConfig.js); the pools are the Core reward pools (gameProfileRewards.js).
//
//   stock.armaments  [{ id, tier, cost }]   stock.weaponArts  [{ id, cost }]
//
// Every draw is on `shopOffers` (as the legacy Blacksmith's are), so no merchant shelf moves. A purchase is a plan and a
// commit pair: the plan is inert and names its refusal; the commit re-plans, refuses a quote whose revision, price or
// tier no longer matches, mutates, and bumps `shopStock.tradeRevision`.
import { gameContent, gameModule } from './gameProfile.js';
import { gameProfileRewardPools } from './gameProfileRewards.js';
import { itemUpgradeTiers } from './itemUpgrades.js';
import { blacksmithRules } from './blacksmithConfig.js';
import { carriedIds } from './loadout.js';
import { shopSentence } from './shopKinds.js';
import { CORE_BLACKSMITH_OFFERINGS } from './blacksmith.js';

const STREAM = 'shopOffers';
const say = (id, tokens = {}) => shopSentence(id, tokens);
const itemRefOf = (id) => `armament/${id}`;
const priceTable = (run) => gameModule(run, 'shops')?.priceTable ?? gameContent(run, 'shops')?.priceTable ?? null;

/** The tier an armament can be sold at at most: its authored ladder's top (0 when it has none). */
const tierCeiling = (registries, run, id) => itemUpgradeTiers(registries, itemRefOf(id), run).at(-1) || 0;

function pickSome(rng, ids, count) {
  const left = [...ids], out = [];
  for (let i = 0; i < count && left.length; i++) out.push(left.splice(rng.int(STREAM, 0, left.length - 1), 1)[0]);
  return out;
}

/** rollTier(weights, rng, ceiling) → 0..ceiling by the authored weights ({"0":20,"1":40,…}); tiers above the ceiling carry no weight. */
export function rollTier(weights, rng, ceiling) {
  const rows = Object.entries(weights || {}).map(([tier, weight]) => [Number(tier), Number(weight)])
    .filter(([tier, weight]) => Number.isInteger(tier) && tier >= 0 && tier <= ceiling && weight > 0);
  const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) return 0;
  let roll = rng.float(STREAM) * total;
  for (const [tier, weight] of rows) { roll -= weight; if (roll < 0) return tier; }
  return rows.at(-1)[0];
}

function rangeFor(table, kind, rarity) {
  const row = table?.[kind];
  const range = Array.isArray(row) ? row : row?.[rarity] ?? row?.common;
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) || range[0] < 0 || range[1] < range[0]) throw new Error(`No Blacksmith price for ${kind}`);
  return range;
}

/**
 * coreBlacksmithShelves(registries, rng, run) → { armaments, weaponArts } (either may be empty). Armaments: `armamentStock`
 * distinct pieces the run does not carry, each at a rolled tier, priced over its rarity's row times `tierPriceMult[tier]`.
 */
export function coreBlacksmithShelves(registries, rng, run) {
  const rules = blacksmithRules(run) || {};
  const table = priceTable(run);
  const pools = gameProfileRewardPools(registries, run);
  const defs = new Map((registries.equipment.armaments || []).map((piece) => [piece.id, piece]));
  const mult = Array.isArray(rules.tierPriceMult) ? rules.tierPriceMult : [];
  const armaments = pickSome(rng, pools.weapons.filter((id) => defs.has(id)), rules.armamentStock ?? 0).map((id) => {
    const tier = rollTier(rules.tierWeights, rng, tierCeiling(registries, run, id));
    const base = rng.int(STREAM, ...rangeFor(table, 'armament', defs.get(id).rarity));
    return { id, tier, cost: Math.max(1, Math.round(base * (Number.isFinite(mult[tier]) ? mult[tier] : 1))) };
  });
  const weaponArts = pools.weaponArts.map((id) => ({ id, cost: rng.int(STREAM, ...rangeFor(table, 'weaponArt', null)) }));
  return { armaments, weaponArts };
}

const revisionOf = (run) => run.shopStock?.tradeRevision || 0;
const sells = (run, shelf) => !!run.shopStock && run.shopStock.kind === 'blacksmith' && (run.shopStock.offerings || []).includes(shelf);

/** coreArmamentPlan(registries, run, id) → the quote for buying the rack's piece `id`. */
export function coreArmamentPlan(registries, run, id) {
  const item = (run.shopStock?.armaments || []).find((row) => row.id === id) || null;
  const def = item && (registries.equipment.armaments || []).find((piece) => piece.id === id);
  // The shelf cost is already scaled by the run's price multiplier (blacksmithVisitStock, applyShopPriceMult): read it as is.
  const price = item ? (item.cost ?? 0) : 0;
  let reason = '';
  if (!sells(run, 'armaments')) reason = say('blacksmith.refuse.notOffered');
  else if (!item || !def) reason = say('shop.refuse.gone');
  // A rack rolled earlier can offer a piece the run has since found elsewhere; buying it would only duplicate an id.
  else if (carriedIds(run.loadout).includes(id)) reason = say('shop.refuse.armourOwned', { name: def.name });
  else if ((run.loadout.storage || []).length >= (registries.balance.equipment.storageSlots ?? 8)) reason = say('blacksmith.refuse.storageFull');
  else if (!Number.isSafeInteger(run.cinders) || run.cinders < price) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, id, name: def?.name || id, tier: item?.tier ?? 0, cost: price, stones: 0, revision: revisionOf(run), def };
}

/**
 * commitCoreArmament(registries, run, quote) → { id, tier, spent }. The piece lands in storage; its tier is
 * written to `run.itemUpgradeLevels` and NEVER lowers a tier the run already holds for that item.
 */
export function commitCoreArmament(registries, run, quote) {
  const plan = coreArmamentPlan(registries, run, quote.id);
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.cost !== plan.cost || quote.revision !== plan.revision || quote.tier !== plan.tier) throw new Error(say('shop.refuse.stale'));
  const itemRef = itemRefOf(plan.id);
  run.loadout.storage = [...(run.loadout.storage || []), plan.id];
  if (plan.tier > 0) {
    const levels = run.itemUpgradeLevels && typeof run.itemUpgradeLevels === 'object' ? run.itemUpgradeLevels : {};
    run.itemUpgradeLevels = { ...levels, [itemRef]: Math.max(levels[itemRef] || 0, plan.tier) };
  }
  run.cinders -= plan.cost;
  const rack = run.shopStock.armaments;
  rack.splice(rack.findIndex((row) => row.id === plan.id), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.id, tier: plan.tier, spent: plan.cost };
}

/** coreWeaponArtPlan(registries, run, id) → the quote for the shelf's weapon art `id`. */
export function coreWeaponArtPlan(registries, run, id) {
  const item = (run.shopStock?.weaponArts || []).find((row) => row.id === id) || null;
  const def = item && registries.cards.has(id) ? registries.cards.get(id) : null;
  const price = item ? item.cost : 0;
  let reason = '';
  if (!sells(run, 'weaponArts')) reason = say('blacksmith.refuse.notOffered');
  else if (!item || !def) reason = say('shop.refuse.gone');
  else if (!Number.isSafeInteger(run.cinders) || run.cinders < price) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, id, name: def?.name || id, cost: price, stones: 0, revision: revisionOf(run) };
}

/** The art joins the sideboard as `shop-art:<n>:<cardId>`, like any bought card; the shelf is not restocked. */
export function commitCoreWeaponArt(registries, run, quote) {
  const plan = coreWeaponArtPlan(registries, run, quote.id);
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.cost !== plan.cost || quote.revision !== plan.revision) throw new Error(say('shop.refuse.stale'));
  const taken = new Set([...(run.deck || []), ...(run.sideboard || [])].map((card) => card.instanceId));
  let n = 1;
  while (taken.has(`shop-art:${n}:${plan.id}`)) n++;
  const instance = { instanceId: `shop-art:${n}:${plan.id}`, cardId: plan.id, upgraded: false };
  run.sideboard = [...(Array.isArray(run.sideboard) ? run.sideboard : []), instance];
  run.cinders -= plan.cost;
  const shelf = run.shopStock.weaponArts;
  shelf.splice(shelf.findIndex((row) => row.id === plan.id), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.id, spent: plan.cost, instance };
}

/**
 * coreBlacksmithStock(registries, rng, run) → a Core Blacksmith visit: every Core offering laid out (no roll decides it, the
 * Blacksmith is a fixed workshop), a shelf only when its pool is not empty. `{ kind: 'blacksmith', offerings, armaments?, weaponArts? }`.
 */
export function coreBlacksmithStock(registries, rng, run) {
  const { armaments, weaponArts } = coreBlacksmithShelves(registries, rng, run);
  const stock = { kind: 'blacksmith', offerings: CORE_BLACKSMITH_OFFERINGS.filter((id) => (id === 'armaments' ? armaments.length : id === 'weaponArts' ? weaponArts.length : true)) };
  if (armaments.length) stock.armaments = armaments;
  if (weaponArts.length) stock.weaponArts = weaponArts;
  return stock;
}
