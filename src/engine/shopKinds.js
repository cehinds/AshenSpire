// src/engine/shopKinds.js — the shop visit's rolls (SPEC §14.2), headless.
//
// Every draw here is on the `shopOffers` stream, appended last to STREAM_NAMES,
// so no existing stream moves. The market's shelves still roll on `shop`
// exactly as buildShopStock always has; this file only decides which of them
// are out on the visit, and which kind a classic merchant turns out to be.
import { buildShopStock, eligibleEventIds, rollSkillDraftIds } from './encounters.js';
import { createRng } from './rng.js';
import { createLocationVisit, arriveAt, restAt, leaveLocation } from './locations.js';
import { SHOP_KINDS, SHOP_KIND_SCREENS, MARKET_SHELVES } from '../model/shopKinds.js';
import { ownership } from '../model/loadout.js';
import { INN_LOCATION, innInTown } from '../model/locations.js';
import { applyShopPriceMult } from '../model/marketStock.js';
import { innRestPlan, stale } from '../model/marketAdditions.js';
import { ownedSigilIds } from '../model/sigils.js';
import { hasRemovableCard } from '../model/cardRemoval.js';
import { carriedIds } from '../model/loadout.js';
import { BLACKSMITH_SERVICES, serviceCandidates } from '../model/blacksmith.js';
import {
  MASTER_SERVICES, MASTER_SHELVES, masterOf, masterOffers, masterBookPool, masterArtPool, masterArmamentPool,
  masterServiceCandidates, masterSchools, lessonLevel, trackLabel,
} from '../model/master.js';
import { shopSentence } from '../model/shopKinds.js';

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
  const written = (market.offerings || []).filter(Boolean);
  const up = new Set(rollShopOfferings(market, rng));
  const inn = written.find((row) => row.id === 'innRest');
  if (innInTown && inn && inn.enabled === true) up.add('innRest');
  // AN EMPTY SHELF IS NOT LAID OUT (SPEC §14.2). An offering whose shelf
  // holds nothing on this visit — every relic held, every armament carried,
  // every sigil owned, no armour set left to buy, a stock of 0 — yields its
  // place, and the guarantee refills from the other enabled offerings by
  // weight, drawing nothing. That is expected of a `conditional` offering;
  // for any other it is the backstop, so an empty rail item never appears.
  // Today's shelves are judged by what `shop` already rolled for them; the
  // additions by their pools, before any stock draw, so the shelves that stay
  // roll as they would.
  const pools = Object.fromEntries(written.filter((row) => ADDITION_POOLS[row.id]).map((row) => [row.id, ADDITION_POOLS[row.id](registries, run, row, meta)]));
  const shelfEmpty = (row) => {
    // The quest event lays out one offer and has no stock count.
    if (row.id === 'questEvent') return !pools.questEvent || pools.questEvent.length === 0;
    if (pools[row.id]) return pools[row.id].length === 0 || !(row.stock > 0);
    if (MARKET_SHELVES.includes(row.id)) return !(Array.isArray(stock[row.id]) && stock[row.id].length > 0);
    if (row.id === 'smithStones') return !(row.perVisit > 0);
    // A service with nothing to act on is empty too: Remove with no card it
    // could take (a deck of one, or of granted cards only).
    if (row.id === 'remove') return !hasRemovableCard(run);
    return false;
  };
  const empty = shelfEmpty;
  for (const row of written) if (up.has(row.id) && empty(row)) up.delete(row.id);
  const minimum = Number(market.guaranteedMinimum) || 0;
  if (up.size < minimum) {
    const missing = written
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.enabled === true && !up.has(row.id) && !empty(row))
      .sort((a, b) => (Number(b.row.weight) || 0) - (Number(a.row.weight) || 0) || a.index - b.index);
    for (const { row } of missing) {
      if (up.size >= minimum) break;
      up.add(row.id);
    }
  }
  const offerings = written.filter((row) => up.has(row.id)).map((row) => row.id);
  for (const shelf of MARKET_SHELVES) if (!offerings.includes(shelf)) stock[shelf] = [];
  stock.kind = 'market';
  stock.offerings = offerings;
  for (const row of written) {
    if (!offerings.includes(row.id) || !ADDITION_STOCK[row.id]) continue;
    stock[row.id] = ADDITION_STOCK[row.id](registries, rng, run, row, pools[row.id]);
  }
  return stock;
}

/**
 * marketVisitStock(registries, rng, run, { meta, door, ownerId, priceMult }) →
 * the stock a market visit opens with, through either door main.js has: a
 * classic `merchant` node (its kind rolled first) or an `atlas` shop point
 * (a market, always offering the rest when its town keeps an inn). Either way
 * a custom run's price multiplier (Greedy Merchants, Hoarder) is applied to
 * every price the visit laid out, the additions included.
 */
export function marketVisitStock(registries, rng, run, { meta = {}, door = 'merchant', ownerId = null, priceMult = 1, flatRarity = false } = {}) {
  const stock = door === 'atlas'
    ? buildMarketStock(registries, rng, run, { meta, innInTown: innInTown(registries, ownerId) })
    : buildMerchantStock(registries, rng, run, { meta, flatRarity });
  return applyShopPriceMult(stock, priceMult);
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

// What each conditional addition could sell on this visit, before any draw.
// An empty pool means the offering is not laid out (buildMarketStock).
const ADDITION_POOLS = Object.freeze({
  // Armour sets of the run's own class — a filter of its own, since
  // ownership() takes no class — that carry a profile unlock, and that the
  // run does not own: ownership() excludes a set whose unlock the profile has
  // met, the creation grant, and a set bought this run (`loadout.boughtArmour`).
  // These locked sets are sold for this run only; `includeLocked` off closes
  // them, so the shelf has nothing to sell and is not laid out.
  armour(registries, run, row, meta) {
    if (row.includeLocked !== true) return [];
    const mine = ownership(registries, { meta, loadout: run.loadout });
    return (registries.equipment.armour || [])
      .filter((piece) => piece.classId === run.class)
      .filter((piece) => piece.unlock !== '' && piece.unlock != null)
      .filter((piece) => !mine.has(piece));
  },
  // Sigils the run does not hold, carried or slotted, never a legendary (§15.4).
  sigils(registries, run) {
    const owned = new Set(ownedSigilIds(run));
    return registries.sigils.all().filter((def) => def.rarity !== 'legendary' && !owned.has(def.id));
  },
  // Every skill book, and every revive token (SPEC §14.3): owning one never
  // takes it off the shelf, so these run dry only at a stock of 0.
  skillBooks: (registries) => registries.consumables.all().filter((def) => def.kind === 'skillBook'),
  reviveTokens: (registries) => registries.consumables.all().filter((def) => def.kind === 'revive'),
  // Companions not already travelling: one of each at a time.
  companions(registries, run) {
    const with_ = new Set((run.companions || []).map((row) => row.id));
    return registries.companions.all().filter((def) => !with_.has(def.id));
  },
  // The events an Unknown node could offer now, minus what the run has seen;
  // never the reset to the full pool resolveUnknownNode falls back on.
  // Nor an event already waiting on an Unknown node of the current map that
  // the run has not visited: the quest never pre-empts a node's event (review
  // of #1377).
  questEvent(registries, run) {
    const visited = new Set(run.path || []);
    const waiting = Object.entries((run.mapGraph && run.mapGraph.nodes) || {})
      .filter(([id, node]) => node && node.resolved && node.resolved.kind === 'event' && !visited.has(id))
      .map(([, node]) => node.resolved.eventId);
    const seen = new Set([...(run.seenEvents || []), ...waiting]);
    return eligibleEventIds(registries, { history: run.history || [] }).filter((id) => !seen.has(id));
  },
});

// Each addition's stock, rolled on `shopOffers` from its own offering's
// numbers (and its pool, for the conditional ones).
const ADDITION_STOCK = Object.freeze({
  // Each set priced in the offering's cost range (validateContent and Settings
  // keep min ≤ max), and never below 1.
  // Each offer names its class (SPEC §14.3): armour ids repeat across
  // classes, and a run's class can change while a saved stock keeps it.
  armour(registries, rng, run, row, pool) {
    return pickSome(rng, pool, row.stock).map((piece) => ({ classId: piece.classId, id: piece.id, cost: Math.max(1, rng.int(STREAM, row.cost.min, row.cost.max)) }));
  },
  // Priced per stone, with a per-visit stock; no roll.
  smithStones(registries, rng, run, row) {
    return { price: row.price, left: row.perVisit };
  },
  // Each sigil at `pricePct` percent of its own cost.
  sigils(registries, rng, run, row, pool) {
    return pickSome(rng, pool, row.stock).map((def) => ({ id: def.id, cost: Math.max(1, Math.round((def.cost * row.pricePct) / 100)) }));
  },
  // One full rest, bought once per visit; no roll.
  innRest(registries, rng, run, row) {
    return { price: row.price, bought: false };
  },
  // Up to `stock` distinct books, tokens or companions, each at its own cost.
  skillBooks: (registries, rng, run, row, pool) => pickSome(rng, pool, row.stock).map((def) => ({ id: def.id, cost: def.cost })),
  reviveTokens: (registries, rng, run, row, pool) => pickSome(rng, pool, row.stock).map((def) => ({ id: def.id, cost: def.cost })),
  companions: (registries, rng, run, row, pool) => pickSome(rng, pool, row.stock).map((def) => ({ id: def.id, cost: def.cost })),
  // One unseen event, drawn from the pool, at the offering's price.
  questEvent(registries, rng, run, row, pool) {
    const [eventId] = pickSome(rng, pool, 1);
    return { eventId, price: row.price, taken: false };
  },
});

/**
 * commitInnRest({ run, registries, rng }, quote, { healMult, refillCounts, restBonus }) →
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
export function commitInnRest({ run, registries, rng }, quote, { healMult = 1, refillCounts = null, restBonus = null } = {}) {
  const plan = innRestPlan(registries, run);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  // restBonus: Settings → Advanced → Recovery's at-Rest percents, as every Rest.
  const opts = { healMult, refillCounts, restBonus };
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
  // A merchant that rolls `blacksmith` (weight 0 shipped) offers that kind's
  // offerings only, not market shelves (SPEC §14.2).
  if (kind === 'blacksmith') return buildBlacksmithStock(registries, rng, run);
  // …and one that rolls `master` (weight 0 shipped) opens a master visit
  // (SPEC §14.5): his offerings only, no market shelf.
  if (kind === 'master') return buildMasterStock(registries, rng, run, { flatRarity: opts.flatRarity === true });
  return buildMarketStock(registries, rng, run, opts);
}

// ---------------------------------------------------------------------------
// The blacksmith (SPEC §14.4, §14.6 step 6)
// ---------------------------------------------------------------------------

// The armaments the blacksmith's rack can draw from: every armament the run
// does not carry that has a `balance.shop.armamentCost` row, the market's pool.
function blacksmithArmamentPool(registries, run) {
  const carried = new Set(carriedIds(run.loadout));
  const costs = registries.balance.shop.armamentCost || {};
  return (registries.equipment.armaments || []).filter((piece) => !carried.has(piece.id) && Array.isArray(costs[piece.rarity]));
}

/**
 * buildBlacksmithStock(registries, rng, run) → a blacksmith visit:
 * `{ kind: 'blacksmith', offerings, armaments?, smithStones? }` (SPEC §14.4).
 *
 * Every draw is on `shopOffers`, never `shop`, so no market shelf moves. The
 * offerings roll as every kind's do (rollShopOfferings); then:
 *   · a STOCKED shelf that comes up empty — no armament left to draw, a rack
 *     or stone stock of 0 — is omitted, as §14.2's backstop omits one;
 *   · a SERVICE with nothing to act on now STAYS laid out (coordinator ruling
 *     on #1378): it is judged live on the screen and when quoted, so it can
 *     become usable on this visit. It does not count toward the guarantee, so
 *     the missing enabled offerings that have something now are added by
 *     weight, with no further draw, until enough usable ones are out.
 * Then the rack draws `armaments.stock` pieces and prices each over its
 * rarity's `armamentCost` row, and the stone shelf is `{ price, left }`.
 * Service prices are never stored: model/blacksmith.js reads them when quoted.
 */
export function buildBlacksmithStock(registries, rng, run) {
  const kindDef = registries.shops.blacksmith;
  const written = (kindDef.offerings || []).filter(Boolean);
  const row = (id) => written.find((offering) => offering.id === id);
  const pool = blacksmithArmamentPool(registries, run);
  const up = new Set(rollShopOfferings(kindDef, rng));
  const stockEmpty = (offering) => {
    if (offering.id === 'armaments') return !pool.length || !(offering.stock > 0);
    if (offering.id === 'smithStones') return !(offering.perVisit > 0);
    return false;
  };
  const idle = (offering) => BLACKSMITH_SERVICES.includes(offering.id) && serviceCandidates(registries, run, offering.id).length === 0;
  for (const offering of written) if (up.has(offering.id) && stockEmpty(offering)) up.delete(offering.id);
  const minimum = Number(kindDef.guaranteedMinimum) || 0;
  const usable = () => written.filter((offering) => up.has(offering.id) && !idle(offering)).length;
  if (usable() < minimum) {
    const missing = written
      .map((offering, index) => ({ offering, index }))
      .filter(({ offering }) => offering.enabled === true && !up.has(offering.id) && !stockEmpty(offering) && !idle(offering))
      .sort((a, b) => (Number(b.offering.weight) || 0) - (Number(a.offering.weight) || 0) || a.index - b.index);
    for (const { offering } of missing) {
      if (usable() >= minimum) break;
      up.add(offering.id);
    }
  }
  const stock = { kind: 'blacksmith', offerings: written.filter((offering) => up.has(offering.id)).map((offering) => offering.id) };
  if (up.has('armaments')) {
    const costs = registries.balance.shop.armamentCost;
    stock.armaments = pickSome(rng, pool, row('armaments').stock).map((piece) => ({ id: piece.id, cost: Math.max(1, rng.int(STREAM, ...costs[piece.rarity])) }));
  }
  if (up.has('smithStones')) stock.smithStones = { price: row('smithStones').price, left: row('smithStones').perVisit };
  return stock;
}

/**
 * blacksmithVisitStock(registries, rng, run, { priceMult }) → the stock an
 * atlas smith point opens with (SPEC §14.2, §14.4), rolled on first entry and
 * kept on the point; a custom run's price multiplier scales its stone price,
 * rounding up, as it scales the market's.
 */
export function blacksmithVisitStock(registries, rng, run, { priceMult = 1 } = {}) {
  return applyShopPriceMult(buildBlacksmithStock(registries, rng, run), priceMult);
}

// ---------------------------------------------------------------------------
// The wise master (SPEC §14.5, §14.6 step 7)
// ---------------------------------------------------------------------------

/**
 * buildMasterStock(registries, rng, run) → a master visit:
 * `{ kind: 'master', masterId, offerings, skillBooks?, weaponArts?,
 * armaments?, training? }` (SPEC §14.5).
 *
 * THE DRAWS, IN ORDER. The master is picked first, on the `shop` stream —
 * `rng.int('shop', 0, n − 1)` over `shops.masters` in written order, drawn
 * even when n is 1. Then the offerings roll on `shopOffers` (§14.2), and then
 * each stocked shelf that is laid out rolls on `shopOffers`, in written
 * order. A market or blacksmith visit draws none of this, so their shelves
 * stay byte-identical.
 *
 * As the blacksmith's (§14.4): a STOCKED shelf whose pool is empty or whose
 * stock is 0 is omitted; a SERVICE with nothing to act on now STAYS laid out
 * (it is judged live), but does not count toward the guarantee, which adds
 * the missing enabled offerings that have something now, by weight, with no
 * further draw. Service prices are never stored: model/master.js reads them
 * when quoted. `lessons` is absent until the first lesson roll. `flatRarity`
 * is Chaos Rewards, so the live lesson check judges the roll it would make.
 */
export function buildMasterStock(registries, rng, run, { flatRarity = false } = {}) {
  const kindDef = registries.shops.master;
  const masters = registries.shops.masters || [];
  if (!masters.length) throw new Error('buildMasterStock: shops.masters lists no master (SPEC §14.5)');
  const master = masters[rng.int('shop', 0, masters.length - 1)];
  const written = (kindDef.offerings || []).filter(Boolean);
  const row = (id) => written.find((offering) => offering.id === id);
  const pools = {
    skillBooks: masterBookPool(registries, master),
    weaponArts: masterArtPool(registries, master),
    armaments: masterArmamentPool(registries, run, master),
  };
  const up = new Set(rollShopOfferings(kindDef, rng));
  const stockEmpty = (offering) => MASTER_SHELVES.includes(offering.id) && (!pools[offering.id].length || !(offering.stock > 0));
  // The services are judged against the visit being built.
  const draft = { kind: 'master', masterId: master.id, training: { left: row('training')?.training?.perVisit ?? 0 } };
  const idle = (offering) => MASTER_SERVICES.includes(offering.id) && masterServiceCandidates(registries, run, offering.id, { master, stock: draft, flatRarity }).length === 0;
  for (const offering of written) if (up.has(offering.id) && stockEmpty(offering)) up.delete(offering.id);
  const minimum = Number(kindDef.guaranteedMinimum) || 0;
  const usable = () => written.filter((offering) => up.has(offering.id) && !idle(offering)).length;
  if (usable() < minimum) {
    const missing = written
      .map((offering, index) => ({ offering, index }))
      .filter(({ offering }) => offering.enabled === true && !up.has(offering.id) && !stockEmpty(offering) && !idle(offering))
      .sort((a, b) => (Number(b.offering.weight) || 0) - (Number(a.offering.weight) || 0) || a.index - b.index);
    for (const { offering } of missing) {
      if (usable() >= minimum) break;
      up.add(offering.id);
    }
  }
  const stock = { kind: 'master', masterId: master.id, offerings: written.filter((offering) => up.has(offering.id)).map((offering) => offering.id) };
  const costs = registries.balance.shop;
  for (const offering of written) {
    if (!up.has(offering.id)) continue;
    if (offering.id === 'skillBooks') stock.skillBooks = pickSome(rng, pools.skillBooks, offering.stock).map((def) => ({ id: def.id, cost: def.cost }));
    else if (offering.id === 'weaponArts') stock.weaponArts = pickSome(rng, pools.weaponArts, offering.stock).map((id) => ({ id, cost: Math.max(1, rng.int(STREAM, ...costs.weaponArtCost)) }));
    else if (offering.id === 'armaments') stock.armaments = pickSome(rng, pools.armaments, offering.stock).map((piece) => ({ id: piece.id, cost: Math.max(1, rng.int(STREAM, ...costs.armamentCost[piece.rarity])) }));
  }
  if (up.has('training')) stock.training = { left: row('training').training.perVisit };
  return stock;
}

/**
 * masterVisitStock(registries, rng, run, { priceMult }) → the stock an atlas
 * master point opens with (SPEC §14.5), rolled on first entry and kept on the
 * point. A custom run's price multiplier scales every stocked cost once,
 * rounding up, through applyShopPriceMult, as it scales the market's.
 * `flatRarity` is Chaos Rewards, read by the live lesson check.
 */
export function masterVisitStock(registries, rng, run, { priceMult = 1, flatRarity = false } = {}) {
  return applyShopPriceMult(buildMasterStock(registries, rng, run, { flatRarity }), priceMult);
}

/**
 * rollMasterLesson(registries, rng, run, skillId, { flatRarity }) → the
 * track's `{ cardIds, taken }` (SPEC §14.5). Its own step, because a plan is
 * inert: asked for a master track with no `lessons` entry, it calls
 * rollSkillDraftIds with the track's loadout-independent schools, the level
 * `max(track level, 1)`, the normal door's odds (equal under Chaos Rewards,
 * `flatRarity`), `balance.skill.draftSize` and the `shopOffers` stream, and
 * writes `{ cardIds, taken: false }` on the stock. It never rolls that track
 * again on the visit: an entry already there is returned as it is.
 */
export function rollMasterLesson(registries, rng, run, skillId, { flatRarity = false } = {}) {
  const master = masterOf(registries, run);
  if (!master || !masterOffers(run, 'lesson')) throw new Error(shopSentence('master.refuse.notOffered'));
  if (!master.skills.includes(skillId)) throw new Error(shopSentence('master.refuse.untaught', { master: master.name, skill: trackLabel(registries, skillId) }));
  const kept = run.shopStock.lessons?.[skillId];
  if (kept) return kept;
  const cardIds = rollSkillDraftIds(registries, rng, {
    classId: run.class, loadout: run.loadout, skillId, level: lessonLevel(run, skillId),
    pool: 'normal', flatRarity, size: registries.balance.skill.draftSize,
    schools: masterSchools(registries, skillId), stream: STREAM,
  });
  const entry = { cardIds, taken: false };
  run.shopStock.lessons = { ...(run.shopStock.lessons || {}), [skillId]: entry };
  return entry;
}
