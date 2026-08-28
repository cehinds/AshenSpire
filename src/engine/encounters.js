// src/engine/encounters.js — encounter + reward rolls, shop stock, unknown
// nodes, shrine math (SPEC §3.8, §6)
//
// Procedural systems: seeded algorithms whose every knob comes from content
// (balance.js, encounters/*.js). Pure functions of (registries, rng, args) —
// run mutation is limited to explicitly documented counters (flask pity,
// removal price). Stream usage: encounters → 'enemyAI', card rewards →
// 'cardRewards', relics → 'relicRewards', flasks → 'flaskRewards',
// unknown nodes + events → 'events', shop stock → 'shop', cinders → 'misc'.
//
// Headless: no document/window/localStorage/timers.

import { passiveMult, passiveFlag } from '../model/registries.js';

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

/**
 * rollEncounter(registries, rng, { pool, act, exclude }) → encounter id.
 * Weighted pick from the act's pool; `exclude` is the no-repeat window
 * (pass the last 1–2 fought encounter ids). Encounters default to act 1.
 */
export function rollEncounter(registries, rng, { pool, act = 1, exclude = [] } = {}) {
  const inActPool = (e) => e.pool === pool && (e.act || 1) === act;
  let candidates = registries.encounters.all().filter((e) => inActPool(e) && !exclude.includes(e.id));
  if (candidates.length === 0) {
    candidates = registries.encounters.all().filter(inActPool);
  }
  if (candidates.length === 0) throw new Error(`No encounters in pool '${pool}' for act ${act}`);
  const total = candidates.reduce((a, e) => a + e.weight, 0);
  let r = rng.float('enemyAI') * total;
  for (const e of candidates) {
    r -= e.weight;
    if (r < 0) return e.id;
  }
  return candidates[candidates.length - 1].id;
}

// ---------------------------------------------------------------------------
// Combat rewards (SPEC §6)
// ---------------------------------------------------------------------------

/** Cinder reward for a combat pool, scaled by runeGainMult passives (floored). */
export function rollRuneReward(registries, rng, pool, relicIds) {
  const range = registries.balance.rewards.cinders[pool];
  const base = rng.int('misc', range[0], range[1]);
  return Math.floor(base * passiveMult(registries, relicIds, 'runeGainMult'));
}

/**
 * rollCardRewardIds(registries, rng, { classId, pool, relicIds }) → distinct
 * card ids (rarity-weighted per pool; elites offer +1 with Feral Eye).
 */
export function rollCardRewardIds(registries, rng, { classId, pool, relicIds = [], flatRarity = false }) {
  const bal = registries.balance.rewards;
  let count = bal.cardChoices;
  if (pool === 'elite' && passiveFlag(registries, relicIds, 'eliteExtraCardReward')) count += 1;

  const cardPool = registries.classes.get(classId).cardPool;
  // flatRarity (Custom Climb "Chaos Rewards") ignores the pool weighting and
  // gives every rarity equal odds — far more rares than normal.
  const weights = flatRarity
    ? { common: 1, uncommon: 1, rare: 1 }
    : bal.rarityWeights[pool] || bal.rarityWeights.normal;
  const byRarity = {};
  for (const id of cardPool) {
    const def = registries.cards.get(id);
    (byRarity[def.rarity] = byRarity[def.rarity] || []).push(id);
  }
  const rarities = Object.keys(weights).filter((r) => byRarity[r] && byRarity[r].length);
  const total = rarities.reduce((a, r) => a + weights[r], 0);

  const picks = [];
  let guard = 0;
  while (picks.length < count && guard++ < 100) {
    let roll = rng.float('cardRewards') * total;
    let rarity = rarities[rarities.length - 1];
    for (const r of rarities) {
      roll -= weights[r];
      if (roll < 0) {
        rarity = r;
        break;
      }
    }
    const options = byRarity[rarity].filter((id) => !picks.includes(id));
    if (!options.length) continue;
    picks.push(rng.pick('cardRewards', options));
  }
  return picks;
}

/**
 * rollFlaskDrop(registries, rng, run) → flask id | null.
 * StS-style decaying chance: −step on a drop, +step on a miss (clamped),
 * persisted on run.flaskChancePct.
 */
export function rollFlaskDrop(registries, rng, run) {
  const bal = registries.balance.rewards;
  if (run.flaskChancePct == null) run.flaskChancePct = bal.flaskDropBasePct;
  const hit = rng.float('flaskRewards') * 100 < run.flaskChancePct;
  if (hit) {
    run.flaskChancePct = Math.max(0, run.flaskChancePct - bal.flaskDropStepPct);
    const pool = registries.flasks.ids();
    return pool.length ? rng.pick('flaskRewards', pool) : null;
  }
  run.flaskChancePct = Math.min(100, run.flaskChancePct + bal.flaskDropStepPct);
  return null;
}

/**
 * rollRelicReward(registries, rng, ownedIds, { rarities }) → relic id | null.
 * Excludes owned relics; default pool is common/uncommon/rare (elite drops);
 * pass ['boss'] for boss rewards.
 */
export function rollRelicReward(registries, rng, ownedIds, { rarities = ['common', 'uncommon', 'rare'] } = {}) {
  const pool = registries.relics
    .all()
    .filter((r) => rarities.includes(r.rarity) && !ownedIds.includes(r.id))
    .map((r) => r.id);
  return pool.length ? rng.pick('relicRewards', pool) : null;
}

/**
 * rollArmamentDrop(registries, rng, { source, found, carried }) → id | null.
 *
 * Deterministic on stream 'armaments', like every other reward roll, so a seed
 * still replays exactly. `source` keys into balance.equipment.drops.chance and
 * .rarityWeights ('treasure' | 'elite' | 'boss').
 *
 * `found` is everything the profile has ever held and `carried` is what this
 * run already has; a piece in either is a non-event, so the roll prefers
 * something new and returns null when there is nothing left to give (the
 * caller pays consolation cinders instead).
 */
export function rollArmamentDrop(registries, rng, { source, found = [], carried = [] } = {}) {
  const cfg = (registries.balance.equipment || {}).drops || {};
  if (!cfg.enabled) return null;
  const chance = (cfg.chance || {})[source];
  if (!chance) return null;
  if (rng.int('armaments', 1, 100) > chance) return null;

  const weights = (cfg.rarityWeights || {})[source] || {};
  const seen = new Set([...found, ...carried]);
  let pool = (registries.equipment.armaments || []).filter((a) => a.unlock === '');
  if (cfg.preferUnfound) {
    const fresh = pool.filter((a) => !seen.has(a.id));
    if (!fresh.length) return null;
    pool = fresh;
  }

  // Rarity first (so a rare stays rare however many rares exist), then a piece
  // from within it. Rarities the pool can't fill are skipped rather than
  // rolling a null.
  const rarities = Object.keys(weights).filter((r) => pool.some((a) => a.rarity === r));
  if (!rarities.length) return null;
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  let roll = rng.float('armaments') * total;
  let rarity = rarities[rarities.length - 1];
  for (const r of rarities) {
    roll -= weights[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  return rng.pick('armaments', pool.filter((a) => a.rarity === rarity).map((a) => a.id));
}

// ---------------------------------------------------------------------------
// Shop (SPEC §6 prices — all from balance.shop)
// ---------------------------------------------------------------------------

/**
 * buildShopStock(registries, rng, run) → { cards, relics, flasks, removeCost }.
 * cards/relics/flasks: [{ id, cost }]. Deterministic on stream 'shop'.
 */
export function buildShopStock(registries, rng, run) {
  const bal = registries.balance.shop;
  const classId = run.class;

  const cardIds = rollShopCards(registries, rng, classId, bal.cardStock);
  const cards = cardIds.map((id) => ({
    id,
    cost: rng.int('shop', ...bal.cardCost[registries.cards.get(id).rarity]),
  }));

  const relicPool = registries.relics
    .all()
    .filter((r) => ['common', 'uncommon', 'rare'].includes(r.rarity) && !run.relics.includes(r.id))
    .map((r) => r.id);
  const relics = [];
  for (let i = 0; i < bal.relicStock && relicPool.length; i++) {
    const id = rng.pick('shop', relicPool);
    relicPool.splice(relicPool.indexOf(id), 1);
    relics.push({ id, cost: rng.int('shop', ...bal.relicCost[registries.relics.get(id).rarity]) });
  }

  const flaskIds = registries.flasks.ids();
  const flasks = [];
  for (let i = 0; i < bal.flaskStock && flaskIds.length; i++) {
    const id = rng.pick('shop', flaskIds);
    flasks.push({ id, cost: rng.int('shop', bal.flaskCost[0], bal.flaskCost[1]) });
  }

  const removeCost = bal.removeBase + bal.removeStep * (run.removesPurchased || 0);
  return { cards, relics, flasks, removeCost };
}

// Shop card pool = the class pool + neutral colorless cards (StS-faithful:
// colorless is sold at Merchants, not offered in standard combat rewards).
// The status/curse colorless are rarity 'special' and excluded here.
const SHOP_RARITIES = ['common', 'uncommon', 'rare'];
function rollShopCards(registries, rng, classId, count) {
  const colorless = registries.cards
    .all()
    .filter((c) => c.class === 'colorless' && SHOP_RARITIES.includes(c.rarity))
    .map((c) => c.id);
  const pool = [...registries.classes.get(classId).cardPool, ...colorless];
  const out = [];
  while (out.length < count && pool.length) {
    const id = rng.pick('shop', pool);
    pool.splice(pool.indexOf(id), 1);
    out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unknown nodes + shrine math
// ---------------------------------------------------------------------------

/**
 * resolveUnknownNode(registries, rng, { seenEvents }) →
 *   { kind: 'event', eventId } | { kind: 'fight'|'shrine'|'treasure' }
 * Odds from balance.unknownNode; events avoid repeats within a run while
 * unseen ones remain. Stream 'events' (SPEC §5.6).
 */
export function resolveUnknownNode(registries, rng, { seenEvents = [] } = {}) {
  const odds = registries.balance.unknownNode;
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = rng.float('events') * total;
  let kind = 'event';
  for (const [k, w] of Object.entries(odds)) {
    r -= w;
    if (r < 0) {
      kind = k;
      break;
    }
  }
  if (kind !== 'event') return { kind };
  let pool = registries.events.ids().filter((id) => !seenEvents.includes(id));
  if (!pool.length) pool = registries.events.ids();
  if (!pool.length) return { kind: 'fight' }; // no events shipped: fall back
  return { kind: 'event', eventId: rng.pick('events', pool) };
}

/** Shrine rest heal (SPEC shrine.healPct × shrineHealMult passives, floored). */
export function shrineHealAmount(registries, run) {
  const pct = registries.balance.shrine.healPct;
  const mult = passiveMult(registries, run.relics, 'shrineHealMult');
  return Math.min(run.maxHp - run.hp, Math.floor((run.maxHp * pct * mult) / 100));
}
