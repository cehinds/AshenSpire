// src/engine/shopKinds.js — the shop visit's rolls (SPEC §14.2), headless.
//
// Every draw here is on the `shopOffers` stream, appended last to STREAM_NAMES,
// so no existing stream moves. The market's shelves still roll on `shop`
// exactly as buildShopStock always has; this file only decides which of them
// are out on the visit, and which kind a classic merchant turns out to be.
import { buildShopStock } from './encounters.js';
import { createRng } from './rng.js';
import { createLocationVisit, arriveAt, restAt, leaveLocation } from './locations.js';
import { SHOP_KINDS, SHOP_KIND_SCREENS, MARKET_SHELVES } from '../model/shopKinds.js';
import { ownership } from '../model/loadout.js';
import { INN_LOCATION } from '../model/locations.js';
import { innRestPlan, stale } from '../model/marketAdditions.js';
import { ownedSigilIds } from '../model/sigils.js';

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
 *
 * THE ADDITIONS (SPEC §14.3). A market in a town with an inn (`innInTown`)
 * always offers the inn rest while that offering is enabled. Then each
 * addition that is out rolls its stock on `shopOffers`, in written order,
 * after the offering roll — never on `shop`, so the shelves above are the
 * bytes they always were. `meta` is the profile, read only so the armour
 * shelf offers sets the run does not already own.
 */
export function buildMarketStock(registries, rng, run, { meta = {}, innInTown = false } = {}) {
  const stock = buildShopStock(registries, rng, run);
  const market = registries.shops.market;
  let offerings = rollShopOfferings(market, rng);
  const inn = (market.offerings || []).find((row) => row && row.id === 'innRest');
  if (innInTown && inn && inn.enabled === true && !offerings.includes('innRest')) {
    offerings = market.offerings.filter((row) => row && (offerings.includes(row.id) || row.id === 'innRest')).map((row) => row.id);
  }
  for (const shelf of MARKET_SHELVES) if (!offerings.includes(shelf)) stock[shelf] = [];
  stock.kind = 'market';
  stock.offerings = offerings;
  for (const row of market.offerings || []) {
    if (!row || !offerings.includes(row.id) || !ADDITION_STOCK[row.id]) continue;
    stock[row.id] = ADDITION_STOCK[row.id](registries, rng, run, row, meta);
  }
  return stock;
}

// Up to `count` distinct picks from `pool`, on `shopOffers`.
function pickSome(rng, pool, count) {
  const left = [...pool];
  const out = [];
  for (let i = 0; i < count && left.length; i++) {
    const at = rng.int(STREAM, 0, left.length - 1);
    out.push(left.splice(at, 1)[0]);
  }
  return out;
}

// Each addition's stock, rolled on `shopOffers` from its own offering's numbers.
const ADDITION_STOCK = Object.freeze({
  // Armour sets of the run's class it does not own, each priced in the
  // offering's cost range (SPEC §14.3: the worn slots, §13.4b).
  armour(registries, rng, run, row, meta) {
    const mine = ownership(registries, { meta, loadout: run.loadout });
    const pool = (registries.equipment.armour || []).filter((piece) => piece.classId === run.class && !mine.has(piece));
    const lo = Math.min(row.cost.min, row.cost.max);
    const hi = Math.max(row.cost.min, row.cost.max);
    return pickSome(rng, pool, row.stock).map((piece) => ({ id: piece.id, cost: rng.int(STREAM, lo, hi) }));
  },
  // Priced per stone, with a per-visit stock; no roll.
  smithStones(registries, rng, run, row) {
    return { price: row.price, left: row.perVisit };
  },
  // Sigils the run does not carry, never a legendary (SPEC §15.4), each at
  // `pricePct` percent of its own cost.
  sigils(registries, rng, run, row) {
    const owned = new Set(ownedSigilIds(run));
    const pool = registries.sigils.all().filter((def) => def.rarity !== 'legendary' && !owned.has(def.id));
    return pickSome(rng, pool, row.stock).map((def) => ({ id: def.id, cost: Math.max(1, Math.round((def.cost * row.pricePct) / 100)) }));
  },
  // One full rest, bought once per visit; no roll.
  innRest(registries, rng, run, row) {
    return { price: row.price, bought: false };
  },
});

/**
 * commitInnRest({ run, registries, rng }, quote, { healMult, refillCounts }) →
 * the rest receipt (SPEC §14.3). Runs the inn's own visit on the run's own
 * streams — createLocationVisit(ctx, 'inn') → arriveAt → restAt →
 * leaveLocation (§13.4j) — so the inn's `arrived` rules (the flask refill)
 * and `rested` rules (the heal) are what the rest does.
 *
 * ATOMIC. An arrival rule may hand the run a relic that denies this very rest
 * (restAt re-reads the denial). So the visit is first run on a copy of the run
 * with a copy of the streams: if that is refused, nothing is touched and the
 * refusal names the relic; otherwise the real visit, being the same rules on
 * the same values, does exactly what the copy did.
 */
export function commitInnRest({ run, registries, rng }, quote, { healMult = 1, refillCounts = null } = {}) {
  const plan = innRestPlan(registries, run);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const opts = { healMult, refillCounts };
  const dryRng = rng && typeof rng.getCounters === 'function' ? createRng(rng.seed, rng.getCounters()) : createRng((run.seed ?? 0) >>> 0);
  const dry = createLocationVisit({ run: structuredClone(run), registries, rng: dryRng }, INN_LOCATION, opts);
  try {
    arriveAt(dry);
    restAt(dry);
  } catch (error) {
    // Refused by a relic the arrival handed over: the plan's own sentence,
    // asked of the run as the arrival left it.
    if (dry.restDenied) throw new Error(innRestPlan(registries, { ...run, relics: [...dry.ctx.run.relics] }).reason);
    throw error;
  } finally {
    leaveLocation(dry);
  }
  const visit = createLocationVisit({ run, registries, rng }, INN_LOCATION, opts);
  arriveAt(visit);
  const rest = restAt(visit);
  leaveLocation(visit);
  run.cinders -= plan.cost;
  run.shopStock.innRest.bought = true;
  run.shopStock.tradeRevision = plan.revision + 1;
  return { ...rest, refill: visit.refill, spent: plan.cost };
}

/**
 * buildMerchantStock(registries, rng, run) → a classic `merchant` node's
 * stock: its kind rolled from `shops.kindWeights`, then that kind's visit.
 * Only a kind whose screen has shipped can open; validateContent keeps every
 * other kind at weight 0, and a table that got past it is refused here by
 * name rather than laid out as a market under the wrong sign.
 */
export function buildMerchantStock(registries, rng, run, opts = {}) {
  const kind = rollShopKind(registries.shops, rng);
  if (!SHOP_KIND_SCREENS.includes(kind)) throw new Error(`buildMerchantStock: the ${kind} shop has no screen registered yet (SPEC §14.6)`);
  return buildMarketStock(registries, rng, run, opts);
}
