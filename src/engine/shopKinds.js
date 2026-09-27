// src/engine/shopKinds.js — the shop visit's rolls (SPEC §14.2), headless.
//
// Every draw here is on the `shopOffers` stream, appended last to STREAM_NAMES,
// so no existing stream moves. The market's shelves still roll on `shop`
// exactly as buildShopStock always has; this file only decides which of them
// are out on the visit, and which kind a classic merchant turns out to be.
import { buildShopStock } from './encounters.js';
import { SHOP_KINDS, SHOP_KIND_SCREENS, MARKET_SHELVES } from '../model/shopKinds.js';

const STREAM = 'shopOffers';

/**
 * rollShopKind(shops, rng) → the kind a classic merchant node is, from
 * `shops.kindWeights`. Draws once on `shopOffers` — and only when more than
 * one kind has a weight above 0, so the shipped weights (market alone) draw
 * nothing.
 */
export function rollShopKind(shops, rng) {
  const weights = (shops && shops.kindWeights) || {};
  const rollable = SHOP_KINDS.filter((kind) => Number(weights[kind]) > 0);
  if (!rollable.length) throw new Error('rollShopKind: no shop kind has a weight above 0 (shops.kindWeights)');
  if (rollable.length === 1) return rollable[0];
  const total = rollable.reduce((sum, kind) => sum + Number(weights[kind]), 0);
  let roll = rng.float(STREAM) * total;
  for (const kind of rollable) {
    roll -= Number(weights[kind]);
    if (roll < 0) return kind;
  }
  return rollable[rollable.length - 1];
}

/**
 * rollShopOfferings(kindDef, rng) → the ids of the offerings a visit lays
 * out, in written order.
 *
 * Each ENABLED offering's `chance` is rolled once, in written order, on
 * `shopOffers`: 100 always comes up and 0 never does by the roll, and neither
 * draws a value. When fewer than `guaranteedMinimum` came up, the missing
 * enabled offerings with the highest `weight` are added (ties in written
 * order) until the minimum is met, with no further draw. A disabled offering
 * never appears.
 */
export function rollShopOfferings(kindDef, rng) {
  const offerings = (kindDef && kindDef.offerings) || [];
  const enabled = offerings.filter((row) => row && row.enabled === true);
  const up = new Set();
  for (const row of enabled) {
    if (row.chance >= 100) up.add(row.id);
    else if (row.chance > 0 && rng.float(STREAM) * 100 < row.chance) up.add(row.id);
  }
  const minimum = Number(kindDef && kindDef.guaranteedMinimum) || 0;
  if (up.size < minimum) {
    const missing = enabled
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !up.has(row.id))
      .sort((a, b) => (Number(b.row.weight) || 0) - (Number(a.row.weight) || 0) || a.index - b.index);
    for (const { row } of missing) {
      if (up.size >= minimum) break;
      up.add(row.id);
    }
  }
  return offerings.filter((row) => row && up.has(row.id)).map((row) => row.id);
}

/**
 * buildMarketStock(registries, rng, run) → today's merchant stock, as a
 * `market` visit: `{ ...shelves, removeCost, kind: 'market', offerings }`.
 *
 * Every shelf is rolled on `shop` exactly as buildShopStock always rolled it,
 * THEN the offerings are rolled on `shopOffers`, and a shelf that did not come
 * up is emptied. Rolling first keeps each shelf's values independent of which
 * others are out, so a shelf switched off moves nothing on the shelves beside
 * it. The atlas `shop` service is a market (§14.2).
 */
export function buildMarketStock(registries, rng, run) {
  const stock = buildShopStock(registries, rng, run);
  const offerings = rollShopOfferings(registries.shops.market, rng);
  for (const shelf of MARKET_SHELVES) if (!offerings.includes(shelf)) stock[shelf] = [];
  stock.kind = 'market';
  stock.offerings = offerings;
  return stock;
}

/**
 * buildMerchantStock(registries, rng, run) → a classic `merchant` node's
 * stock: its kind rolled from `shops.kindWeights`, then that kind's visit.
 * Only a kind whose screen has shipped can open; validateContent keeps every
 * other kind at weight 0, and a table that got past it is refused here by
 * name rather than laid out as a market under the wrong sign.
 */
export function buildMerchantStock(registries, rng, run) {
  const kind = rollShopKind(registries.shops, rng);
  if (!SHOP_KIND_SCREENS.includes(kind)) throw new Error(`buildMerchantStock: the ${kind} shop has no screen registered yet (SPEC §14.6)`);
  return buildMarketStock(registries, rng, run);
}
