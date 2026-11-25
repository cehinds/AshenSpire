// src/model/tierUnlocks.js — Data-driven rank & rarity tier unlock gates (owner, 2026-11-25).
//
// Pure and headless (no browser globals). Reads `scoring.tierUnlocks` (content/source/scoring.json)
// so upgrades, card generation, pool planning, and Score Studio all enforce the exact same progression ladder:
//   effectiveTier = max(0, floor(cardRank)) + (rarityBonus[rarity] ?? 0)
// Example: with rarityBonus = { common: 0, uncommon: 0, rare: 1 }, a minTier of 2 unlocks on
// Rank 2+ Common/Uncommon OR Rank 1+ Rare (so Rare previews 1 rank higher).
import { GetActiveScoring } from './activeScoring.js';

const DEFAULT_RARITY_BONUS = Object.freeze({ common: 0, uncommon: 0, rare: 1, starter: 0, special: 0 });
const catalogCache = new WeakMap();

/** Return the active tierUnlocks configuration object, or null when disabled/absent. */
export function TierUnlocksConfig(scoring = GetActiveScoring()) {
  const cfg = scoring?.tierUnlocks;
  if (!cfg || typeof cfg !== 'object' || cfg.enabled === false) return null;
  return cfg;
}

/**
 * Effective tier for a card's rank and rarity: `cardRank + rarityBonus[rarity]`.
 * A Rank 1 Rare with rarityBonus.rare = 1 has effectiveTier 2 (same unlock tier as Rank 2 Common).
 */
export function EffectiveTier(rank = 0, rarity = 'common', scoring = GetActiveScoring()) {
  const baseRank = Number.isFinite(rank) ? Math.max(0, Math.floor(rank)) : 0;
  const bonusMap = scoring?.tierUnlocks?.rarityBonus || DEFAULT_RARITY_BONUS;
  const key = typeof rarity === 'string' ? rarity.toLowerCase() : 'common';
  const bonus = Number.isFinite(bonusMap[key]) ? Math.max(0, bonusMap[key]) : 0;
  return baseRank + bonus;
}

/** Resolve a card definition + optional run instance to its effective unlock tier. */
export function CardEffectiveTier(card, instance = null, scoring = GetActiveScoring()) {
  const rawRank = Number.isFinite(instance?.rank)
    ? instance.rank
    : (Number.isFinite(card?.rank) ? card.rank : 0);
  const rarity = instance?.rarityOverride || card?.rarity || 'common';
  return EffectiveTier(rawRank, rarity, scoring);
}

/** Minimum effective tier required for an upgrade kind (0 when unlisted or gating disabled). */
export function UpgradeKindMinTier(kind, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg) return 0;
  const req = cfg.upgrades?.[kind];
  return Number.isFinite(req) ? Math.max(0, req) : 0;
}

/** Whether an upgrade kind is unlocked at `tier`. */
export function UpgradeKindUnlocked(kind, tier, scoring = GetActiveScoring()) {
  return tier >= UpgradeKindMinTier(kind, scoring);
}

/** Minimum effective tier required for an upgrade rarity size tier (0=common, 1=uncommon, 2=rare). */
export function UpgradeRarityMinTier(rarityIndex, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !Array.isArray(cfg.upgradeRarityMinTier)) return 0;
  const req = cfg.upgradeRarityMinTier[rarityIndex];
  return Number.isFinite(req) ? Math.max(0, req) : 0;
}

/** Whether an upgrade rarity size tier (0=common, 1=uncommon, 2=rare) is unlocked at `tier`. */
export function UpgradeRarityUnlocked(rarityIndex, tier, scoring = GetActiveScoring()) {
  return tier >= UpgradeRarityMinTier(rarityIndex, scoring);
}

/**
 * Minimum effective tier required to reach `targetStack` (1, 2, 3...) of a stacking upgrade tag
 * (improved, efficient, refined, tempered, purified).
 */
export function UpgradeTagStackMinTier(family, targetStack, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !family || !(targetStack >= 1)) return 0;
  const ladder = cfg.upgradeTagStacks?.[family];
  if (!Array.isArray(ladder) || !ladder.length) return 0;
  const idx = Math.min(ladder.length - 1, Math.max(0, Math.floor(targetStack) - 1));
  const req = ladder[idx];
  return Number.isFinite(req) ? Math.max(0, req) : 0;
}

/** Whether reaching `targetStack` of an upgrade tag family is unlocked at `tier`. */
export function UpgradeTagStackUnlocked(family, targetStack, tier, scoring = GetActiveScoring()) {
  return tier >= UpgradeTagStackMinTier(family, targetStack, scoring);
}

/** Whether dropping a card's SP or MP cost to 0 is unlocked at `tier`. */
export function ZeroCostUnlocked(tier, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !Number.isFinite(cfg.zeroCostMinTier)) return true;
  return tier >= cfg.zeroCostMinTier;
}

/** Whether combining magic + martial (hybrid / elemental packet on a physical card) is unlocked at `tier`. */
export function HybridUnlocked(tier, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !Number.isFinite(cfg.hybridMinTier)) return true;
  return tier >= cfg.hybridMinTier;
}

/** Minimum effective tier required for an element or school id (0 when unlisted). */
export function ElementMinTier(element, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !element) return 0;
  const key = String(element).replace(/^(?:school|damage):/, '').toLowerCase();
  const req = cfg.elements?.[key];
  return Number.isFinite(req) ? Math.max(0, req) : 0;
}

/** Whether an element or school is unlocked at `tier`. */
export function ElementUnlocked(element, tier, scoring = GetActiveScoring()) {
  return tier >= ElementMinTier(element, scoring);
}

/** Minimum effective tier required for a status id (0 when unlisted). */
export function StatusMinTier(statusId, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !statusId) return 0;
  const entry = cfg.statuses?.[statusId];
  const req = typeof entry === 'number' ? entry : entry?.minTier;
  return Number.isFinite(req) ? Math.max(0, req) : 0;
}

/** Whether a status is unlocked at `tier`. */
export function StatusUnlocked(statusId, tier, scoring = GetActiveScoring()) {
  return tier >= StatusMinTier(statusId, scoring);
}

/**
 * Maximum status stack count allowed at `tier`, or `Infinity` when uncapped / gating disabled.
 * Returns `0` when the status itself is locked below its `minTier`.
 */
export function StatusStackCapAtTier(statusId, tier, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  if (!cfg || !statusId) return Infinity;
  if (Number.isNaN(tier) || tier === undefined || tier === null) return 0;
  const entry = cfg.statuses?.[statusId];
  if (entry === undefined || entry === null) return Infinity;
  if (typeof entry === 'number') {
    const minTier = Number.isFinite(entry) ? Math.max(0, entry) : 0;
    return tier < minTier ? 0 : Infinity;
  }
  if (typeof entry !== 'object') return Infinity;
  const minTier = Number.isFinite(entry.minTier) ? Math.max(0, entry.minTier) : 0;
  if (tier < minTier) return 0;
  if (!Number.isFinite(entry.maxStacksBase)) return Infinity;
  if (!Number.isFinite(tier)) return Infinity;
  const perTier = Number.isFinite(entry.stacksPerExtraTier) ? Math.max(0, entry.stacksPerExtraTier) : 1;
  return Math.max(1, Math.floor(entry.maxStacksBase + Math.max(0, tier - minTier) * perTier));
}

/**
 * Total authored damage or block ceiling allowed by upgrades at `tier`, or `Infinity` when uncapped.
 * `kind` is `'damage'` or `'block'`.
 */
export function NumericCeilingAtTier(kind, tier, scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  const list = cfg?.ceilings?.[kind];
  if (!Array.isArray(list) || !list.length) return Infinity;
  if (tier === Infinity) {
    const last = list[list.length - 1];
    return Number.isFinite(last) ? last : Infinity;
  }
  const idx = Number.isFinite(tier) ? Math.min(list.length - 1, Math.max(0, Math.floor(tier))) : 0;
  const cap = list[idx];
  return Number.isFinite(cap) ? cap : Infinity;
}

/**
 * Pre-compiled O(1) lookup index over `scoring.tierUnlocks`, cached per scoring.tierUnlocks object reference.
 * Used by upgrade step filtering and the hybrid node-seed upgrade schedule so no per-card scan
 * repeats tier table walks.
 */
export function CompileTierCatalog(scoring = GetActiveScoring()) {
  const cfg = TierUnlocksConfig(scoring);
  const cacheKey = cfg && typeof cfg === 'object' ? cfg : (scoring && typeof scoring === 'object' ? scoring : null);
  if (cacheKey && catalogCache.has(cacheKey)) {
    const cached = catalogCache.get(cacheKey);
    if (cached._scoring === scoring) return cached;
  }
  const allKinds = Object.keys(cfg?.upgrades || {});
  const allStatuses = [...new Set([...Object.keys(cfg?.statuses || {}), ...Object.keys(scoring?.statuses || {})])];
  const allElements = Object.keys(cfg?.elements || {});
  let maxTier = Math.max(5, Number.isFinite(scoring?.rank?.maxRank) ? Math.floor(scoring.rank.maxRank) : 5);
  for (const k of allKinds) maxTier = Math.max(maxTier, Math.ceil(UpgradeKindMinTier(k, scoring)));
  for (const s of allStatuses) maxTier = Math.max(maxTier, Math.ceil(StatusMinTier(s, scoring)));
  for (const e of allElements) maxTier = Math.max(maxTier, Math.ceil(ElementMinTier(e, scoring)));
  const unlockedKindsByTier = [];
  const unlockedStatusesByTier = [];
  const unlockedElementsByTier = [];
  for (let t = 0; t <= maxTier; t += 1) {
    unlockedKindsByTier.push(Object.freeze(new Set(allKinds.filter((k) => UpgradeKindUnlocked(k, t, scoring)))));
    unlockedStatusesByTier.push(Object.freeze(new Set(allStatuses.filter((s) => StatusUnlocked(s, t, scoring)))));
    unlockedElementsByTier.push(Object.freeze(new Set(allElements.filter((e) => ElementUnlocked(e, t, scoring)))));
  }
  const safeTierIdx = (tier) => (tier === Infinity ? maxTier : (Number.isFinite(tier) ? Math.min(maxTier, Math.max(0, Math.floor(tier))) : 0));
  const catalog = Object.freeze({
    _scoring: scoring,
    enabled: !!cfg,
    maxTier,
    unlockedKindsByTier: Object.freeze(unlockedKindsByTier),
    unlockedStatusesByTier: Object.freeze(unlockedStatusesByTier),
    unlockedElementsByTier: Object.freeze(unlockedElementsByTier),
    kindsAtTier: (tier) => unlockedKindsByTier[safeTierIdx(tier)],
    statusesAtTier: (tier) => unlockedStatusesByTier[safeTierIdx(tier)],
    elementsAtTier: (tier) => unlockedElementsByTier[safeTierIdx(tier)],
  });
  if (cacheKey) catalogCache.set(cacheKey, catalog);
  return catalog;
}
