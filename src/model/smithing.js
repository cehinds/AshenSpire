// Smithing is a run-owned transaction over an armament, never a card copy.
// The caller supplies the balance block so this model does not become a second
// home for economy tuning. Equipment projection is resolved first; the generic
// card upgrade delta is then applied to that projection.

import { resolveCard } from './registries.js';
import { carriedIds, equipmentRoleSource } from './loadout.js';
import { normalizeSmithingRules } from './smithingRules.js';

export { normalizeSmithingRules };

export const SMITHING_ROLES = Object.freeze(['attack', 'guard', 'technique']);
export const SMITHING_SCHEMA_VERSION = 1;

function ownObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function integer(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
  return value;
}

function rulesFor(registries, explicit) {
  return normalizeSmithingRules(explicit || registries?.balance?.smithing);
}

function armamentById(registries, id) {
  return (registries?.equipment?.armaments || []).find((piece) => piece && piece.id === id) || null;
}

function instanceSourceId(registries, run, instance) {
  for (const key of ['sourceArmamentId', 'armamentId', 'weaponId']) {
    if (instance && instance[key] != null) {
      const id = String(instance[key]);
      if (!armamentById(registries, id)) throw new Error(`Unknown source armament '${id}'`);
      return id;
    }
  }
  if (!instance || !SMITHING_ROLES.includes(instance.equipmentRole)) return null;
  const row = equipmentRoleSource(registries, run.loadout, run.class, instance.equipmentRole);
  return row.piece ? row.piece.id : null;
}

/** Return the stable armament that owns an equipment-bound basic instance. */
export function sourceArmamentId(registries, run, instance) {
  const id = instanceSourceId(registries, run, instance);
  return id && armamentById(registries, id) ? id : null;
}

function sourceCards(registries, run, pieceId, cards = run.deck || []) {
  return cards.filter((instance) => sourceArmamentId(registries, run, instance) === pieceId);
}

function effectsReceipt(def) {
  return (def.effects || []).map((effect) => ({ ...effect }));
}

/** Resolve the actual before/after values for one sourced basic card. */
export function smithingCardReceipt(registries, run, instance, nextLevel = 0) {
  const pieceId = sourceArmamentId(registries, run, instance);
  if (!pieceId) return null;
  const before = resolveCard(registries, { ...instance, upgraded: false, smithingLevel: 0 });
  const after = resolveCard(registries, { ...instance, upgraded: false, smithingLevel: nextLevel });
  return Object.freeze({
    instanceId: instance.instanceId,
    cardId: instance.cardId,
    role: instance.equipmentRole,
    sourceArmamentId: pieceId,
    name: after.name,
    reference: Object.freeze({
      ...instance,
      ...(Array.isArray(instance.mods) ? { mods: Object.freeze([...instance.mods]) } : {}),
      upgraded: false,
      smithingLevel: nextLevel > 0 ? nextLevel - 1 : 0,
    }),
    before: effectsReceipt(before),
    after: effectsReceipt(after),
    changes: effectsReceipt(after).map((effect, index) => ({
      op: effect?.op,
      before: before.effects?.[index]?.amount ?? before.effects?.[index]?.stacks ?? null,
      after: effect?.amount ?? effect?.stacks ?? null,
    })),
  });
}

function stoneBalance(run) {
  const value = run?.smithingStones == null ? 0 : run.smithingStones;
  return integer(value, 'run.smithingStones');
}

function levels(run) {
  if (run?.armamentLevels == null) return {};
  const map = ownObject(run.armamentLevels, 'run.armamentLevels');
  for (const [id, level] of Object.entries(map)) integer(level, `run.armamentLevels.${id}`);
  return map;
}

function validateLastReceipt(registries, run, rules) {
  if (run.lastSmithingReceipt == null) return;
  const receipt = ownObject(run.lastSmithingReceipt, 'run.lastSmithingReceipt');
  if (typeof receipt.armamentId !== 'string' || !armamentById(registries, receipt.armamentId)) {
    throw new Error(`run.lastSmithingReceipt.armamentId '${receipt.armamentId}' is unknown`);
  }
  for (const key of ['beforeLevel', 'afterLevel', 'cost', 'stoneBalanceBefore', 'stoneBalanceAfter']) {
    integer(receipt[key], `run.lastSmithingReceipt.${key}`);
  }
  if (receipt.afterLevel !== receipt.beforeLevel + 1 || receipt.afterLevel > rules.maxArmamentLevel) {
    throw new Error('run.lastSmithingReceipt levels do not describe one valid Smithing promotion');
  }
  if (typeof receipt.free !== 'boolean') throw new Error('run.lastSmithingReceipt.free must be boolean');
  const expectedCost = receipt.free ? 0 : rules.costByNextLevel[receipt.afterLevel];
  if (receipt.cost !== expectedCost
      || receipt.stoneBalanceBefore - receipt.stoneBalanceAfter !== receipt.cost) {
    throw new Error('run.lastSmithingReceipt cost/balance does not describe its Smithing transaction');
  }
  if (!Array.isArray(receipt.affectedCards) || !receipt.affectedCards.length) {
    throw new Error('run.lastSmithingReceipt.affectedCards must be a non-empty array');
  }
}

/** Stable, distinct armament choices with all affected card receipts. */
export function smithingPlan(registries, run, explicitRules = undefined) {
  const rules = rulesFor(registries, explicitRules);
  const levelMap = levels(run);
  for (const [pieceId, level] of Object.entries(levelMap)) {
    if (!armamentById(registries, pieceId)) throw new Error(`Unknown run.armamentLevels armament '${pieceId}'`);
    if (level > rules.maxArmamentLevel) throw new Error(`run.armamentLevels.${pieceId} exceeds max level ${rules.maxArmamentLevel}`);
  }
  const stones = stoneBalance(run);
  const inventory = carriedIds(run.loadout);
  const seen = new Set();
  const candidates = [];
  for (const instance of run.deck || []) {
    const pieceId = sourceArmamentId(registries, run, instance);
    if (!pieceId || seen.has(pieceId)) continue;
    seen.add(pieceId);
    const piece = armamentById(registries, pieceId);
    const currentLevel = levelMap[pieceId] || 0;
    if (currentLevel >= rules.maxArmamentLevel) continue;
    const nextLevel = currentLevel + 1;
    const cost = rules.costByNextLevel[nextLevel];
    const affectedCards = sourceCards(registries, run, pieceId)
      .map((card) => smithingCardReceipt(registries, run, card, nextLevel))
      .filter((card) => card.changes.some((change) => change.before !== change.after));
    if (!affectedCards.length) continue;
    const shortfall = Math.max(0, cost - stones);
    candidates.push(Object.freeze({
      armamentId: pieceId,
      armamentName: piece.name,
      currentLevel,
      nextLevel,
      cost,
      stones,
      shortfall,
      affordable: shortfall === 0,
      inventoryCount: inventory.filter((id) => id === pieceId).length,
      affectedCards: Object.freeze(affectedCards),
    }));
  }
  return Object.freeze({ schemaVersion: SMITHING_SCHEMA_VERSION, stones, candidates: Object.freeze(candidates) });
}

/** Add stable source/tier carriers to deck or hand instances after promotion. */
export function restampSmithingCards(registries, run, cards = run.deck || []) {
  for (const instance of cards) {
    const pieceId = sourceArmamentId(registries, run, instance);
    if (!pieceId) continue;
    instance.sourceArmamentId = pieceId;
    instance.smithingLevel = levels(run)[pieceId] || 0;
    instance.upgraded = false;
  }
  return cards;
}

/** Host-side, revalidated Smith commit. `free` is for event/keepsake grants. */
export function commitSmithing(registries, run, armamentId, explicitRules = undefined, { free = false, cards = undefined } = {}) {
  const plan = smithingPlan(registries, run, explicitRules);
  const candidate = plan.candidates.find((row) => row.armamentId === armamentId);
  if (!candidate) throw new Error(`Armament '${armamentId}' is not an eligible Smithing candidate`);
  if (!free && !candidate.affordable) throw new Error(`Insufficient Smithing Stones (shortfall ${candidate.shortfall})`);
  const beforeStones = plan.stones;
  run.smithingStones = free ? beforeStones : beforeStones - candidate.cost;
  run.armamentLevels = { ...levels(run), [armamentId]: candidate.nextLevel };
  restampSmithingCards(registries, run, cards || run.deck || []);
  const receipt = Object.freeze({
    schemaVersion: SMITHING_SCHEMA_VERSION,
    armamentId,
    armamentName: candidate.armamentName,
    beforeLevel: candidate.currentLevel,
    afterLevel: candidate.nextLevel,
    cost: free ? 0 : candidate.cost,
    stoneBalanceBefore: beforeStones,
    stoneBalanceAfter: run.smithingStones,
    free,
    affectedCards: candidate.affectedCards,
  });
  // The transaction's durable read-back. Solo Armoury/map and every co-op
  // snapshot project this same receipt; presentation never reconstructs what
  // was spent or which cards moved from current mutable state.
  run.lastSmithingReceipt = receipt;
  return receipt;
}

/** Grant the balance-owned faucet exactly once for a resolved reward. */
export function grantSmithingReward(registries, run, pool, rewardId) {
  const rules = rulesFor(registries);
  if (!Object.hasOwn(rules.rewardByPool, pool)) throw new Error(`Unknown Smithing reward pool '${pool}'`);
  if (typeof rewardId !== 'string' || !rewardId) throw new Error('Smithing reward id must be a non-empty string');
  const claimed = Array.isArray(run.smithingRewardClaims) ? run.smithingRewardClaims : [];
  if (claimed.includes(rewardId)) {
    return Object.freeze({ pool, rewardId, amount: 0, duplicate: true, stoneBalanceAfter: stoneBalance(run) });
  }
  const amount = rules.rewardByPool[pool];
  run.smithingStones = stoneBalance(run) + amount;
  run.smithingRewardClaims = [...claimed, rewardId];
  return Object.freeze({ pool, rewardId, amount, duplicate: false, stoneBalanceAfter: run.smithingStones });
}

/** Initialize or migrate one run in place, returning an explicit receipt. */
export function initializeRunSmithing(registries, run, explicitRules = undefined) {
  const rules = rulesFor(registries, explicitRules);
  validateLastReceipt(registries, run, rules);
  const wasMissing = run.smithingStones == null || run.armamentLevels == null || run.smithingRewardClaims == null;
  const priorLevels = levels(run);
  for (const [pieceId, level] of Object.entries(priorLevels)) {
    if (!armamentById(registries, pieceId) || level > rules.maxArmamentLevel) throw new Error(`Invalid legacy armament level '${pieceId}=${level}'`);
  }
  const armamentLevels = { ...priorLevels };
  const promotedArmaments = new Set();
  for (const instance of run.deck || []) {
    const pieceId = sourceArmamentId(registries, run, instance);
    if (!pieceId || !instance.upgraded) continue;
    const beforeLevel = armamentLevels[pieceId] || 0;
    armamentLevels[pieceId] = Math.max(beforeLevel, 1);
    if (armamentLevels[pieceId] !== beforeLevel) promotedArmaments.add(pieceId);
    instance.upgraded = false;
  }
  run.smithingStones = run.smithingStones == null ? 0 : stoneBalance(run);
  run.armamentLevels = armamentLevels;
  run.smithingRewardClaims = Array.isArray(run.smithingRewardClaims) ? [...new Set(run.smithingRewardClaims)] : [];
  restampSmithingCards(registries, run);
  return Object.freeze({
    fromSchemaVersion: run.schemaVersion ?? null,
    toSchemaVersion: SMITHING_SCHEMA_VERSION,
    initialized: wasMissing,
    promotedArmaments: Object.freeze([...promotedArmaments]),
    preservedOrdinaryUpgrades: Object.freeze((run.deck || [])
      .filter((card) => card.upgraded && !sourceArmamentId(registries, run, card))
      .map((card) => card.instanceId)),
  });
}

/** Pure migration helper for tools and tests that must preserve source bytes. */
export function migrateLegacySmithing(registries, legacyRun, explicitRules = undefined) {
  const run = structuredClone(legacyRun);
  return Object.freeze({ run, receipt: initializeRunSmithing(registries, run, explicitRules) });
}

export function ownedSmithingArmaments(registries, run) {
  return Object.freeze([...new Set((run.deck || []).map((card) => sourceArmamentId(registries, run, card)).filter(Boolean))]
    .map((id) => armamentById(registries, id)));
}
