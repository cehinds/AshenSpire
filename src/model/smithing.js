// Smithing is a run-owned transaction over a namespaced item, never a card copy.
// The caller supplies the balance block so this model does not become a second
// home for economy tuning. Exact item/tier tags own every cost and change.

import { resolveCard } from './registries.js';
import { carriedIds, equipmentRoleSource } from './loadout.js';
import { normalizeSmithingRules } from './smithingRules.js';
import {
  cumulativeRequirementDelta,
  itemRefIdentity,
  itemUpgradeCost,
  itemUpgradeRows,
  itemUpgradeTiers,
  itemUpgradeValueReceipts,
  parseItemUpgradeTag,
  resolveUpgradedItem,
} from './itemUpgrades.js';

export { normalizeSmithingRules };

export const SMITHING_ROLES = Object.freeze(['attack', 'guard', 'technique']);
export const SMITHING_SCHEMA_VERSION = 3;

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

function itemByRef(registries, itemRef) {
  const identity = itemRefIdentity(itemRef);
  if (!identity) return null;
  try {
    return resolveUpgradedItem(registries, itemRef, 0);
  } catch {
    return null;
  }
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

function rolePreviewInstance(registries, piece, role) {
  const profileId = piece?.[`${role}Profile`];
  if (!profileId) return null;
  const profile = (registries.equipment.basicCardProfiles || []).find((row) => row.id === profileId);
  if (!profile) throw new Error(`${piece.id}: unknown ${role} profile '${profileId}'`);
  return Object.freeze({
    instanceId: `smith-preview:${piece.id}:${role}`,
    cardId: profile.baseCardId,
    equipmentRole: role,
    profileId,
    sourceArmamentId: piece.id,
    upgraded: false,
  });
}

/**
 * Present every authored basic role for an armament, including a role that is
 * currently displaced by the other hand. Live deck ownership stays separate:
 * inactive rows are previews of what this item supplies when that hand becomes
 * authoritative, not claims that another card copy is currently in the deck.
 */
function armamentRolePreviews(registries, run, piece, nextLevel) {
  const live = sourceCards(registries, run, piece.id);
  const rows = [];
  for (const role of SMITHING_ROLES) {
    const active = live.filter((instance) => instance.equipmentRole === role);
    const carriers = active.length ? active : [rolePreviewInstance(registries, piece, role)].filter(Boolean);
    for (const carrier of carriers) {
      const receipt = smithingCardReceipt(registries, run, carrier, nextLevel);
      if (!receipt || !receipt.changes.some((change) => change.before !== change.after)) continue;
      rows.push(Object.freeze({
        ...receipt,
        used: active.length > 0,
        activeCopies: active.length,
      }));
    }
  }
  return Object.freeze(rows);
}

function effectsReceipt(def) {
  return (def.effects || []).map((effect) => ({ ...effect }));
}

function numericEffect(def, op) {
  const effect = (def.effects || []).find((row) => row.op === op);
  if (!effect) return null;
  return effect.amount ?? effect.stacks ?? effect.hits ?? null;
}

function cardChangesForTier(registries, instance, before, after, pieceId, nextLevel) {
  const rows = itemUpgradeRows(registries, `armament/${pieceId}`, nextLevel);
  const attributeIds = registries.attributes.ids();
  const changes = [];
  for (const row of rows) {
    const descriptor = parseItemUpgradeTag(row.tag, attributeIds);
    if (!descriptor || descriptor.role !== instance.equipmentRole) continue;
    if (descriptor.kind === 'cardEffect') {
      const beforeValue = numericEffect(before, descriptor.op);
      const afterValue = numericEffect(after, descriptor.op);
      if (beforeValue == null || afterValue == null || beforeValue === afterValue) continue;
      changes.push(Object.freeze({ kind: 'effect', tag: row.tag, op: descriptor.op, before: beforeValue, after: afterValue }));
    } else if (descriptor.kind === 'cardCost') {
      const field = descriptor.resource === 'action' ? 'cost' : `${descriptor.resource}Cost`;
      const beforeValue = typeof before[field] === 'number' ? before[field] : 0;
      const afterValue = typeof after[field] === 'number' ? after[field] : 0;
      if (beforeValue === afterValue) continue;
      changes.push(Object.freeze({ kind: 'cost', tag: row.tag, op: `cost:${descriptor.resource}`, resource: descriptor.resource, before: beforeValue, after: afterValue }));
    }
  }
  return Object.freeze(changes);
}

/** Resolve the actual before/after values for one sourced basic card. */
export function smithingCardReceipt(registries, run, instance, nextLevel = 0) {
  const pieceId = sourceArmamentId(registries, run, instance);
  if (!pieceId) return null;
  const currentLevel = Math.max(0, nextLevel - 1);
  const before = resolveCard(registries, { ...instance, upgraded: false, smithingLevel: currentLevel });
  const after = resolveCard(registries, { ...instance, upgraded: false, smithingLevel: nextLevel });
  const liveProfile = (registries.equipment.basicCardProfiles || []).find((row) => row.id === instance.profileId);
  const profile = run.equipmentProfileRuleSnapshot?.profiles?.[instance.profileId] || liveProfile || null;
  const scaling = profile ? Object.freeze({
    attributeId: profile.scalingStat,
    label: registries.attributes.get(profile.scalingStat).shortLabel,
    actual: Number.isFinite(run.attributes?.[profile.scalingStat]) ? run.attributes[profile.scalingStat] : null,
    pointsPerTier: profile.pointsPerTier,
    gainPerTier: profile.gainPerTier,
  }) : null;
  return Object.freeze({
    instanceId: instance.instanceId,
    cardId: instance.cardId,
    role: instance.equipmentRole,
    sourceArmamentId: pieceId,
    name: after.name,
    scaling,
    reference: Object.freeze({
      ...instance,
      ...(Array.isArray(instance.mods) ? { mods: Object.freeze([...instance.mods]) } : {}),
      upgraded: false,
      smithingLevel: currentLevel,
    }),
    before: effectsReceipt(before),
    after: effectsReceipt(after),
    changes: cardChangesForTier(registries, instance, before, after, pieceId, nextLevel),
  });
}

function requirementAtLevel(registries, itemRef, attributeId, authored, level) {
  const delta = cumulativeRequirementDelta(registries, itemRef, attributeId, level);
  return { required: Math.max(0, authored + delta), delta };
}

function requirementPreview(registries, run, piece, currentLevel, nextLevel) {
  const authored = piece.requirements?.attributes || {};
  const itemRef = `armament/${piece.id}`;
  return Object.freeze(Object.entries(authored).map(([attributeId, baseRequired]) => {
    const current = requirementAtLevel(registries, itemRef, attributeId, baseRequired, currentLevel);
    const next = requirementAtLevel(registries, itemRef, attributeId, baseRequired, nextLevel);
    const actual = Number.isFinite(run.attributes?.[attributeId]) ? run.attributes[attributeId] : null;
    return Object.freeze({
      attributeId,
      label: registries.attributes.get(attributeId).shortLabel,
      actual,
      baseRequired,
      currentRequired: current.required,
      nextRequired: next.required,
      change: next.delta - current.delta,
      metAfter: actual != null && actual >= next.required,
    });
  }));
}

function stoneBalance(run) {
  const value = run?.smithingStones == null ? 0 : run.smithingStones;
  return integer(value, 'run.smithingStones');
}

function levels(run) {
  const current = run?.itemUpgradeLevels == null
    ? null
    : ownObject(run.itemUpgradeLevels, 'run.itemUpgradeLevels');
  const legacy = run?.armamentLevels == null
    ? null
    : ownObject(run.armamentLevels, 'run.armamentLevels');
  const result = current ? { ...current } : {};
  for (const [itemRef, level] of Object.entries(result)) {
    if (!itemRefIdentity(itemRef)) throw new Error(`run.itemUpgradeLevels key '${itemRef}' is not a namespaced item ref`);
    integer(level, `run.itemUpgradeLevels.${itemRef}`);
  }
  for (const [id, level] of Object.entries(legacy || {})) {
    integer(level, `run.armamentLevels.${id}`);
    const itemRef = `armament/${id}`;
    if (Object.hasOwn(result, itemRef) && result[itemRef] !== level) {
      throw new Error(`Smithing level conflict: run.armamentLevels.${id}=${level} but run.itemUpgradeLevels.${itemRef}=${result[itemRef]}`);
    }
    result[itemRef] = level;
  }
  return result;
}

function receiptForCurrentSchema(registries, receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return receipt;
  if (receipt.itemRef) return receipt;
  if (typeof receipt.armamentId !== 'string') return receipt;
  const itemRef = `armament/${receipt.armamentId}`;
  const authoredCost = itemUpgradeCost(itemUpgradeRows(registries, itemRef, receipt.afterLevel));
  const migratedChanges = Array.isArray(receipt.changes) && receipt.changes.length
    ? receipt.changes
    : (receipt.affectedCards || []).flatMap((card) => (card.changes || []).map((change) => ({
      ...change,
      label: `${card.name || card.cardId || 'Card'} ${change.op || change.tag}`,
      cardId: card.cardId,
      role: card.role,
    })));
  return {
    ...receipt,
    schemaVersion: SMITHING_SCHEMA_VERSION,
    itemRef,
    itemKind: 'armament',
    itemId: receipt.armamentId,
    itemName: receipt.armamentName,
    authoredCost,
    spent: receipt.cost,
    changes: migratedChanges,
  };
}

function validateLastReceipt(registries, run) {
  if (run.lastSmithingReceipt == null) return;
  const receipt = ownObject(run.lastSmithingReceipt, 'run.lastSmithingReceipt');
  const identity = itemRefIdentity(receipt.itemRef);
  if (!identity || !itemByRef(registries, receipt.itemRef)) throw new Error(`run.lastSmithingReceipt.itemRef '${receipt.itemRef}' is unknown`);
  if (receipt.itemKind !== identity.itemKind || receipt.itemId !== identity.itemId) throw new Error('run.lastSmithingReceipt identity fields disagree');
  for (const key of ['beforeLevel', 'afterLevel', 'authoredCost', 'spent', 'cost', 'stoneBalanceBefore', 'stoneBalanceAfter']) {
    integer(receipt[key], `run.lastSmithingReceipt.${key}`);
  }
  if (receipt.afterLevel !== receipt.beforeLevel + 1 || !itemUpgradeTiers(registries, receipt.itemRef).includes(receipt.afterLevel)) {
    throw new Error('run.lastSmithingReceipt levels do not describe one valid Smithing promotion');
  }
  if (typeof receipt.free !== 'boolean') throw new Error('run.lastSmithingReceipt.free must be boolean');
  const authoredCost = itemUpgradeCost(itemUpgradeRows(registries, receipt.itemRef, receipt.afterLevel));
  const expectedSpend = receipt.free ? 0 : authoredCost;
  if (receipt.authoredCost !== authoredCost || receipt.spent !== expectedSpend || receipt.cost !== receipt.spent
      || receipt.stoneBalanceBefore - receipt.stoneBalanceAfter !== receipt.spent) {
    throw new Error('run.lastSmithingReceipt cost/balance does not describe its Smithing transaction');
  }
  if (!Array.isArray(receipt.affectedCards)) throw new Error('run.lastSmithingReceipt.affectedCards must be an array');
  if (!Array.isArray(receipt.changes) || !receipt.changes.length) throw new Error('run.lastSmithingReceipt.changes must be a non-empty array');
}

function activeArmourRef(registries, run) {
  const slot = (registries?.equipment?.slots || []).find((row) => (row.kinds || []).includes('armor'));
  if (!slot) return null;
  const ids = run?.loadout?.sets?.[slot.id] || [];
  const active = run?.loadout?.active?.[slot.id] || 0;
  const id = ids[active];
  if (!id || !run.class) return null;
  const itemRef = `armor/${run.class}/${id}`;
  return itemByRef(registries, itemRef) ? itemRef : null;
}

function ownedItemRefs(registries, run) {
  const refs = [];
  for (const instance of run.deck || []) {
    const id = sourceArmamentId(registries, run, instance);
    const itemRef = id && `armament/${id}`;
    if (itemRef && !refs.includes(itemRef)) refs.push(itemRef);
  }
  // OWNED IS CARRIED, NOT COMPOSED. An armament the player holds in Inventory
  // (loadout.storage) or in a hand set that is not the active one supplies no
  // deck cards today, and reading ownership off the composed deck alone left
  // it off the Smith's grid — a Greatsword found and stored could never be
  // upgraded until it was equipped (Codex, #528). carriedIds is the same
  // reader the inventory count below already uses.
  for (const id of carriedIds(run.loadout)) {
    const itemRef = armamentById(registries, id) ? `armament/${id}` : null;
    if (itemRef && !refs.includes(itemRef)) refs.push(itemRef);
  }
  const armourRef = activeArmourRef(registries, run);
  if (armourRef && !refs.includes(armourRef)) refs.push(armourRef);
  for (const id of run.relics || []) {
    const itemRef = `relic/${id}`;
    if (itemByRef(registries, itemRef) && !refs.includes(itemRef)) refs.push(itemRef);
  }
  return refs;
}

function genericCardChanges(affectedCards, requirements) {
  const rows = [];
  for (const card of affectedCards) for (const change of card.changes) {
    rows.push(Object.freeze({
      kind: change.kind,
      tag: change.tag,
      label: `${card.name} ${change.op}`,
      before: change.before,
      after: change.after,
      cardId: card.cardId,
      role: card.role,
    }));
  }
  for (const row of requirements) if (row.currentRequired !== row.nextRequired) {
    rows.push(Object.freeze({ kind: 'requirement', tag: `requirement:${row.attributeId}`, label: `${row.label} requirement`, before: row.currentRequired, after: row.nextRequired }));
  }
  return Object.freeze(rows);
}

/** Stable, distinct owned item choices with exact, non-noop change receipts. */
export function smithingPlan(registries, run, explicitRules = undefined) {
  rulesFor(registries, explicitRules);
  const levelMap = levels(run);
  for (const [itemRef, level] of Object.entries(levelMap)) {
    if (!itemByRef(registries, itemRef)) throw new Error(`Unknown run.itemUpgradeLevels item '${itemRef}'`);
    const tiers = itemUpgradeTiers(registries, itemRef);
    if (level > (tiers.at(-1) || 0)) throw new Error(`run.itemUpgradeLevels.${itemRef} exceeds its highest authored tier ${tiers.at(-1) || 0}`);
  }
  const stones = stoneBalance(run);
  const inventory = carriedIds(run.loadout);
  const candidates = [];
  for (const itemRef of ownedItemRefs(registries, run)) {
    const identity = itemRefIdentity(itemRef);
    const piece = itemByRef(registries, itemRef);
    const currentLevel = levelMap[itemRef] || 0;
    const nextLevel = currentLevel + 1;
    const upgradeRows = itemUpgradeRows(registries, itemRef, nextLevel);
    if (!upgradeRows.length) continue;
    const cost = itemUpgradeCost(upgradeRows);
    const affectedCards = identity.itemKind === 'armament'
      ? sourceCards(registries, run, identity.itemId)
        .map((card) => smithingCardReceipt(registries, run, card, nextLevel))
        .filter((card) => card.changes.some((change) => change.before !== change.after))
      : [];
    const previewCards = identity.itemKind === 'armament'
      ? armamentRolePreviews(registries, run, piece, nextLevel)
      : Object.freeze([]);
    const requirements = identity.itemKind === 'armament'
      ? requirementPreview(registries, run, piece, currentLevel, nextLevel)
      : Object.freeze([]);
    const authoredChanges = upgradeRows.filter((row) => row.tag !== 'upgrade:cost:smithing-stone');
    // A stored armament composes no live cards, so its preview is what the
    // upgrade does to the cards it WOULD supply (the authored role previews,
    // `used: false`), never an empty list that reads as "nothing changes".
    const changes = identity.itemKind === 'armament'
      ? genericCardChanges(affectedCards.length ? affectedCards : previewCards, requirements)
      : itemUpgradeValueReceipts(registries, itemRef, currentLevel, nextLevel);
    if (!authoredChanges.length || !changes.length || changes.every((row) => row.before === row.after)) continue;
    const shortfall = Math.max(0, cost - stones);
    const candidate = {
      itemRef,
      itemKind: identity.itemKind,
      itemId: identity.itemId,
      itemName: piece.name,
      ...(identity.classId ? { classId: identity.classId } : {}),
      ...(identity.itemKind === 'armament' ? { armamentId: identity.itemId, armamentName: piece.name } : {}),
      currentLevel,
      nextLevel,
      cost,
      stones,
      shortfall,
      affordable: shortfall === 0,
      inventoryCount: identity.itemKind === 'armament' ? inventory.filter((id) => id === identity.itemId).length : 1,
      requirements,
      authoredChanges: Object.freeze(authoredChanges.map((row) => Object.freeze({ ...row }))),
      affectedCards: Object.freeze(affectedCards),
      previewCards,
      changes,
    };
    candidates.push(Object.freeze(candidate));
  }
  return Object.freeze({ schemaVersion: SMITHING_SCHEMA_VERSION, stones, candidates: Object.freeze(candidates) });
}

/** Add stable source/tier carriers to deck or hand instances after promotion. */
export function restampSmithingCards(registries, run, cards = run.deck || []) {
  for (const instance of cards) {
    const pieceId = sourceArmamentId(registries, run, instance);
    if (!pieceId) continue;
    instance.sourceArmamentId = pieceId;
    instance.smithingLevel = levels(run)[`armament/${pieceId}`] || 0;
    instance.upgraded = false;
  }
  return cards;
}

/** Host-side, revalidated generic commit. `free` is for event/keepsake grants. */
export function commitItemUpgrade(registries, run, requestedItemRef, explicitRules = undefined, { free = false, cards = undefined } = {}) {
  const itemRef = typeof requestedItemRef === 'string' && requestedItemRef.includes('/')
    ? requestedItemRef
    : `armament/${requestedItemRef}`;
  const plan = smithingPlan(registries, run, explicitRules);
  const candidate = plan.candidates.find((row) => row.itemRef === itemRef);
  if (!candidate) throw new Error(`Item '${itemRef}' is not an eligible Smithing candidate`);
  if (!free && !candidate.affordable) throw new Error(`Insufficient Smithing Stones (shortfall ${candidate.shortfall})`);
  const beforeStones = plan.stones;
  run.smithingStones = free ? beforeStones : beforeStones - candidate.cost;
  run.itemUpgradeLevels = { ...levels(run), [itemRef]: candidate.nextLevel };
  delete run.armamentLevels;
  restampSmithingCards(registries, run, cards || run.deck || []);
  const receipt = Object.freeze({
    schemaVersion: SMITHING_SCHEMA_VERSION,
    itemRef,
    itemKind: candidate.itemKind,
    itemId: candidate.itemId,
    itemName: candidate.itemName,
    ...(candidate.itemKind === 'armament' ? { armamentId: candidate.itemId, armamentName: candidate.itemName } : {}),
    beforeLevel: candidate.currentLevel,
    afterLevel: candidate.nextLevel,
    authoredCost: candidate.cost,
    spent: free ? 0 : candidate.cost,
    cost: free ? 0 : candidate.cost,
    stoneBalanceBefore: beforeStones,
    stoneBalanceAfter: run.smithingStones,
    free,
    changes: candidate.changes,
    affectedCards: candidate.affectedCards,
  });
  // The transaction's durable read-back. Solo Armoury/map and every co-op
  // snapshot project this same receipt; presentation never reconstructs what
  // was spent or which cards moved from current mutable state.
  run.lastSmithingReceipt = receipt;
  return receipt;
}

/** Backward-compatible name; bare ids still mean armament/<id>. */
export function commitSmithing(registries, run, itemRefOrArmamentId, explicitRules = undefined, options = {}) {
  return commitItemUpgrade(registries, run, itemRefOrArmamentId, explicitRules, options);
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
  rulesFor(registries, explicitRules);
  const hadLegacyLevels = run.armamentLevels != null;
  const wasMissing = run.smithingStones == null || run.itemUpgradeLevels == null || run.smithingRewardClaims == null;
  const priorLevels = levels(run);
  for (const [itemRef, level] of Object.entries(priorLevels)) {
    const maxTier = itemUpgradeTiers(registries, itemRef).at(-1) || 0;
    if (!itemByRef(registries, itemRef) || level > maxTier) throw new Error(`Invalid item upgrade level '${itemRef}=${level}'`);
  }
  const itemUpgradeLevels = { ...priorLevels };
  const promotedArmaments = new Set();
  for (const instance of run.deck || []) {
    const pieceId = sourceArmamentId(registries, run, instance);
    if (!pieceId || !instance.upgraded) continue;
    const itemRef = `armament/${pieceId}`;
    const beforeLevel = itemUpgradeLevels[itemRef] || 0;
    itemUpgradeLevels[itemRef] = Math.max(beforeLevel, 1);
    if (itemUpgradeLevels[itemRef] !== beforeLevel) promotedArmaments.add(pieceId);
    instance.upgraded = false;
  }
  run.smithingStones = run.smithingStones == null ? 0 : stoneBalance(run);
  run.itemUpgradeLevels = itemUpgradeLevels;
  delete run.armamentLevels;
  run.smithingRewardClaims = Array.isArray(run.smithingRewardClaims) ? [...new Set(run.smithingRewardClaims)] : [];
  if (run.lastSmithingReceipt != null) run.lastSmithingReceipt = receiptForCurrentSchema(registries, run.lastSmithingReceipt);
  validateLastReceipt(registries, run);
  restampSmithingCards(registries, run);
  return Object.freeze({
    fromSchemaVersion: run.schemaVersion ?? null,
    toSchemaVersion: SMITHING_SCHEMA_VERSION,
    initialized: wasMissing,
    migratedArmamentLevels: hadLegacyLevels,
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

export function ownedSmithingItems(registries, run) {
  return Object.freeze(ownedItemRefs(registries, run).map((itemRef) => Object.freeze({ ...itemRefIdentity(itemRef), item: itemByRef(registries, itemRef) })));
}
