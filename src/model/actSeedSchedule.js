// src/model/actSeedSchedule.js — Deterministic hybrid Act/Node seed schedule for upgrades and rewards.
//
// Pure and headless (no browser globals, zero mutation of `run`).
// Algorithmically pre-defines from `(run.seed, actNumber, nodeId, vendor)` which specialty upgrades
// appear at each Blacksmith / Arcane Trader / Rest node and the deterministic reward slot blueprint
// for each Combat / Elite / Boss / Treasure / Shop node, eliminating exhaustive permutation work.
import { mulberry32 } from './rng.js';
import { GetActiveScoring } from './activeScoring.js';
import { CompileTierCatalog, UpgradeKindUnlocked } from './tierUnlocks.js';
import { UpgradeOfferKey } from './upgradeOffer.js';
import * as UpgradeSteps from './cardUpgradeSteps.js';

const MAX_CACHE_ENTRIES = 512;
const upgradeStockCache = new Map();
const rewardScheduleCache = new Map();

function putBounded(map, key, value) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
  map.set(key, value);
  return value;
}

// The static CP projection can reach this module while upgrade steps are
// initializing in the shipped classic bundle. Read their live vocabulary only
// when a stock is requested, after module initialization has completed.
let candidateKinds;
const allCandidateKinds = () => candidateKinds ||= Object.freeze(Object.keys(UpgradeSteps.UPGRADE_KIND_WEIGHTS).filter(kind => !UpgradeSteps.DUD_KINDS.includes(kind)));
const NEUTRAL_CARD_STUB = Object.freeze({ tags: Object.freeze([]) });

/**
 * Canonical node key for an upgrade or reward schedule lookup:
 * - explicit `nodeKey` when supplied by the caller
 * - `${actNumber}:${mapNodeId}` when the run is positioned on a map node
 * - `offer:${offerKey}` when an offer visit key is active without a map node
 * - `''` when stateless/synthetic (caller may skip node-specialty bias)
 */
export function NodeScheduleKey(run, explicitNodeKey = '') {
  if (typeof explicitNodeKey === 'string' && explicitNodeKey) return explicitNodeKey;
  if (!run || typeof run !== 'object') return '';
  if (run.mapNodeId) {
    const act = Number.isInteger(run.actNumber) && run.actNumber >= 1 ? run.actNumber : 1;
    return `${act}:${run.mapNodeId}`;
  }
  const offerKey = UpgradeOfferKey(run);
  return offerKey > 0 ? `offer:${offerKey}` : '';
}

function weightedPickIndex(weights, u) {
  let total = 0;
  for (let i = 0; i < weights.length; i += 1) total += weights[i];
  if (!(total > 0)) return 0;
  let roll = u * total;
  for (let i = 0; i < weights.length; i += 1) {
    if (roll < weights[i]) return i;
    roll -= weights[i];
  }
  return weights.length - 1;
}

function vendorWeightForKind(kind, vendorConfig) {
  const base = UpgradeSteps.UPGRADE_KIND_WEIGHTS[kind] || 1;
  if (!vendorConfig) return base;
  const cat = UpgradeSteps.UpgradeCategoryOf(kind, null, NEUTRAL_CARD_STUB);
  const mult = vendorConfig[cat] ?? 1;
  return base * mult;
}

/**
 * ActNodeUpgradeStock(runSeed, nodeKey, { vendor, scoring, slotsPerTier }) ->
 * Pre-determined deterministic specialty upgrade stock for a single map node (Blacksmith, Arcane Trader, or Rest).
 * Returns `{ runSeed, nodeKey, vendor, maxTier, byTier, forTier(tier), signatureKinds }`.
 *
 * Each tier `0..maxTier` gets up to `slotsPerTier` distinct-family upgrade kinds unlocked at that tier,
 * weighted by `UpgradeSteps.UPGRADE_KIND_WEIGHTS` and `UpgradeSteps.UPGRADE_VENDORS[vendor]`.
 */
export function ActNodeUpgradeStock(runSeed, nodeKey, { vendor = '', scoring = GetActiveScoring(), slotsPerTier = 5 } = {}) {
  const seed = Number.isFinite(runSeed) ? runSeed : 0;
  const key = String(nodeKey || 'global');
  const vendorId = vendor && UpgradeSteps.UPGRADE_VENDORS[vendor] ? vendor : '';
  const slots = Math.max(1, Math.min(8, Math.floor(Number(slotsPerTier) || 5)));
  const cacheKey = `${seed}|${key}|${vendorId}|${slots}`;
  const cached = upgradeStockCache.get(cacheKey);
  if (cached && cached._scoring === scoring) return cached;

  const catalog = CompileTierCatalog(scoring);
  const vendorConfig = vendorId ? UpgradeSteps.UPGRADE_VENDORS[vendorId] : null;
  const byTier = [];

  for (let tier = 0; tier <= catalog.maxTier; tier += 1) {
    const unlocked = catalog.enabled ? catalog.kindsAtTier(tier) : null;
    const eligible = allCandidateKinds().filter((kind) => !unlocked || unlocked.has(kind) || UpgradeKindUnlocked(kind, tier, scoring));
    const rng = mulberry32(UpgradeSteps.upgradeSeed(seed, `nodeStock:${key}:${vendorId || 'rest'}`, tier));
    const pool = [...eligible];
    const takenFamilies = new Set();
    const picked = [];

    while (picked.length < slots && pool.length) {
      // Prefer distinct families first so a node's specialty shelf offers varied options
      let choices = pool.filter((k) => !takenFamilies.has(UpgradeSteps.UpgradeKindFamily(k)));
      if (!choices.length) choices = pool;
      const weights = choices.map((k) => vendorWeightForKind(k, vendorConfig));
      const idx = weightedPickIndex(weights, rng());
      const kind = choices[idx];
      const family = UpgradeSteps.UpgradeKindFamily(kind);
      picked.push(Object.freeze({ kind, family }));
      takenFamilies.add(family);
      const poolIdx = pool.indexOf(kind);
      if (poolIdx >= 0) pool.splice(poolIdx, 1);
    }
    byTier.push(Object.freeze(picked));
  }

  const maxTier = catalog.maxTier;
  const safeIdx = (tier) => (tier === Infinity ? maxTier : (Number.isFinite(tier) ? Math.min(maxTier, Math.max(0, Math.floor(tier))) : 0));
  const signatureKinds = Object.freeze(byTier[Math.min(2, maxTier)].map((entry) => entry.kind));
  const stock = Object.freeze({
    _scoring: scoring,
    runSeed: seed,
    nodeKey: key,
    vendor: vendorId,
    maxTier,
    byTier: Object.freeze(byTier),
    forTier: (tier) => byTier[safeIdx(tier)],
    signatureKinds,
  });
  return putBounded(upgradeStockCache, cacheKey, stock);
}

const NODE_TYPE_TO_VENDOR = Object.freeze({
  blacksmith: 'blacksmith',
  smith: 'blacksmith',
  shop: 'arcane',
  merchant: 'arcane',
  trader: 'arcane',
  shrine: '',
  rest: '',
});

/**
 * ActUpgradeSchedule(runSeed, mapGraph, { actNumber, scoring, slotsPerTier }) ->
 * Pre-computes the deterministic upgrade specialty stock for every upgrade-capable node in an Act map.
 */
export function ActUpgradeSchedule(runSeed, mapGraph, { actNumber = 1, scoring = GetActiveScoring(), slotsPerTier = 5 } = {}) {
  const act = Number.isInteger(actNumber) && actNumber >= 1 ? actNumber : 1;
  const nodes = {};
  const rawNodes = mapGraph?.nodes && typeof mapGraph.nodes === 'object' ? Object.values(mapGraph.nodes) : [];
  const sorted = sortedActNodes(rawNodes);
  for (const node of sorted) {
    if (!node || !node.id || !(node.type in NODE_TYPE_TO_VENDOR)) continue;
    const nodeKey = `${act}:${node.id}`;
    const vendor = NODE_TYPE_TO_VENDOR[node.type];
    nodes[nodeKey] = ActNodeUpgradeStock(runSeed, nodeKey, { vendor, scoring, slotsPerTier });
  }
  return Object.freeze({
    runSeed: Number.isFinite(runSeed) ? runSeed : 0,
    actNumber: act,
    nodes: Object.freeze(nodes),
    forNode: (nodeId) => nodes[`${act}:${nodeId}`] || null,
  });
}

// Generated node IDs have a host-independent machine order. Any other shape
// keeps the original whole-list comparator, without reading ID getters early.
function sortedActNodes(rawNodes) {
  const entries = [];
  for (const node of rawNodes) {
    const id = node && typeof node === 'object' && Object.getPrototypeOf(node) === Object.prototype
      ? Object.getOwnPropertyDescriptor(node, 'id') : null;
    if (!id || !Object.hasOwn(id, 'value') || typeof id.value !== 'string'
      || !/^(?:n[1-9][0-9]*_(?:0|[1-9][0-9]*)|boss(?:_(?:0|[1-9][0-9]*))?)(?![\s\S])/.test(id.value)) {
      return [...rawNodes].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
    }
    entries.push({ node, parts: id.value.split('_') });
  }
  return entries.sort((a, b) => {
    for (let i = 0; i < Math.min(a.parts.length, b.parts.length); i += 1) {
      if (a.parts[i] !== b.parts[i]) return a.parts[i] < b.parts[i] ? -1 : 1;
    }
    return a.parts.length - b.parts.length;
  }).map(entry => entry.node);
}

const DEFAULT_RARE_RANK_BOOST_CHANCE = 0.1;

/**
 * NodeRewardSchedule(runSeed, nodeKey, { source, pool, countRange, maxSlots, rareBoostChance }) ->
 * Pre-determines the seed-driven reward slot blueprint for a map node or offer key:
 * - `offerCount`: deterministic choice count when `countRange: { min, max }` is provided
 * - `rareBoostSlots`: per-slot rare rank-boost flags
 * - `draftBoostSlots`: per-slot draft rank-boost flags
 * - `slotSeeds`: independent 32-bit PRNG seeds per reward slot (O(1) deterministic lookup, independent of visit order)
 */
export function NodeRewardSchedule(
  runSeed,
  nodeKey,
  { source = 'combat', pool = 'normal', countRange = null, maxSlots = 6, rareBoostChance = DEFAULT_RARE_RANK_BOOST_CHANCE } = {},
) {
  const seed = Number.isFinite(runSeed) ? runSeed : 0;
  const key = String(nodeKey || 'global');
  const slots = Math.max(1, Math.min(16, Math.floor(Number(maxSlots) || 6)));
  const minCount = Number.isInteger(countRange?.min) ? countRange.min : 0;
  const maxCount = Number.isInteger(countRange?.max) && countRange.max >= minCount ? countRange.max : 0;
  const boostChance = Number.isFinite(rareBoostChance) ? Math.max(0, Math.min(1, rareBoostChance)) : DEFAULT_RARE_RANK_BOOST_CHANCE;
  const cacheKey = `${seed}|${key}|${source}|${pool}|${minCount}:${maxCount}|${slots}|${boostChance}`;
  const cached = rewardScheduleCache.get(cacheKey);
  if (cached) return cached;

  const baseRng = mulberry32(UpgradeSteps.upgradeSeed(seed, `rewardNode:${key}:${source}:${pool}`, 0));
  const offerCount = minCount > 0 && maxCount >= minCount
    ? minCount + Math.floor(baseRng() * (maxCount - minCount + 1))
    : null;

  const rareBoostSlots = [];
  const draftBoostSlots = [];
  const slotSeeds = [];
  for (let i = 0; i < slots; i += 1) {
    rareBoostSlots.push(mulberry32(UpgradeSteps.upgradeSeed(seed, `rankBoost:${key}:${i}`, 0))() < boostChance);
    draftBoostSlots.push(mulberry32(UpgradeSteps.upgradeSeed(seed, `rankBoost:${key}:draft:${i}`, 0))() < boostChance);
    slotSeeds.push(UpgradeSteps.upgradeSeed(seed, `rewardSlot:${key}:${source}:${pool}`, i));
  }

  const schedule = Object.freeze({
    runSeed: seed,
    nodeKey: key,
    source,
    pool,
    offerCount,
    rareBoostSlots: Object.freeze(rareBoostSlots),
    draftBoostSlots: Object.freeze(draftBoostSlots),
    slotSeeds: Object.freeze(slotSeeds),
    slotRng: (slotIndex) => {
      const idx = Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : 0;
      const s = idx < slotSeeds.length ? slotSeeds[idx] : UpgradeSteps.upgradeSeed(seed, `rewardSlot:${key}:${source}:${pool}`, idx);
      return mulberry32(s);
    },
  });
  return putBounded(rewardScheduleCache, cacheKey, schedule);
}

const REWARD_NODE_META = Object.freeze({
  combat: Object.freeze({ source: 'combat', pool: 'normal' }),
  battle: Object.freeze({ source: 'combat', pool: 'normal' }),
  elite: Object.freeze({ source: 'combat', pool: 'elite' }),
  boss: Object.freeze({ source: 'combat', pool: 'boss' }),
  treasure: Object.freeze({ source: 'treasure', pool: 'normal' }),
  chest: Object.freeze({ source: 'treasure', pool: 'normal' }),
  shop: Object.freeze({ source: 'shop', pool: 'normal' }),
  blacksmith: Object.freeze({ source: 'blacksmith', pool: 'normal' }),
});

/**
 * ActRewardSchedule(runSeed, mapGraph, { actNumber, countRange, maxSlots }) ->
 * Pre-computes deterministic reward slot blueprints for every reward-bearing node in an Act map.
 */
export function ActRewardSchedule(runSeed, mapGraph, { actNumber = 1, countRange = null, maxSlots = 6 } = {}) {
  const act = Number.isInteger(actNumber) && actNumber >= 1 ? actNumber : 1;
  const nodes = {};
  const rawNodes = mapGraph?.nodes && typeof mapGraph.nodes === 'object' ? Object.values(mapGraph.nodes) : [];
  const sorted = sortedActNodes(rawNodes);
  for (const node of sorted) {
    if (!node || !node.id || !(node.type in REWARD_NODE_META)) continue;
    const nodeKey = `${act}:${node.id}`;
    const meta = REWARD_NODE_META[node.type];
    nodes[nodeKey] = NodeRewardSchedule(runSeed, nodeKey, {
      source: meta.source,
      pool: meta.pool,
      countRange: meta.source === 'combat' ? countRange : null,
      maxSlots,
    });
  }
  return Object.freeze({
    runSeed: Number.isFinite(runSeed) ? runSeed : 0,
    actNumber: act,
    nodes: Object.freeze(nodes),
    forNode: (nodeId) => nodes[`${act}:${nodeId}`] || null,
  });
}

/** Clear internal in-memory schedule caches (useful in tests and Score Studio config reloads). */
export function ClearScheduleCaches() {
  upgradeStockCache.clear();
  rewardScheduleCache.clear();
}
