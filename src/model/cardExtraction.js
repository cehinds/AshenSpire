// src/model/cardExtraction.js — the smith's two card services: EXTRACT a card
// out of an item's mount so it becomes the run's own, and INSTALL a run-owned
// card into an emptied or open mount. Owner ruling, 2026-09-03.
//
// Same shape as smithing.js, on purpose: a PLAN that enumerates every legal
// transaction with its exact cost and consequence, and a COMMIT that
// revalidates through that same plan before touching the run. The screen
// renders the plan and calls the commit; it prices nothing and decides
// nothing. A third service is this file's pattern again, not a new one.
//
// Ownership is the one idea underneath (loadout.js, "Card ownership"): a card
// is the run's or one item's. Extraction moves a card from an item to the run
// — the item-owned instance leaves on the next restamp and a run-owned one
// with the same card arrives; the mount it left shows its kind's fallback.
// Installation is the reverse. Neither touches an item's authoring: what the
// smith did is `run.itemMounts`, read by the composer through cardMounts.js.

import { itemRefIdentity, resolveUpgradedItem } from './itemUpgrades.js';
import { carriedIds, equippedPieces, isItemOwned, itemMountInstances, pieceItemRef, stampDeck } from './loadout.js';
import {
  cardMountRules, isExtraMountKey, itemMountEntries, openExtraMountKey, resolveFallbackCard,
} from './cardMounts.js';
import { normalizeSmithingRules, SMITH_SERVICES } from './smithingRules.js';

export { SMITH_SERVICES };
export const MOUNT_RECEIPT_SCHEMA_VERSION = 1;

function ownObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function integer(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
  return value;
}

/** The service table, from balance or the caller. */
export function smithServiceRules(registries, explicit = undefined) {
  return normalizeSmithingRules(explicit || registries?.balance?.smithing).services;
}

function stoneBalance(run) {
  return integer(run?.smithingStones == null ? 0 : run.smithingStones, 'run.smithingStones');
}

function cardTags(registries, cardId) {
  const def = registries.cards.get(cardId);
  return def ? (def.tags || []) : [];
}

function cardName(registries, cardId) {
  const def = registries.cards.get(cardId);
  return def ? def.name : cardId;
}

function itemByRef(registries, itemRef) {
  const identity = itemRefIdentity(itemRef);
  if (!identity || !['armament', 'armor'].includes(identity.itemKind)) return null;
  try { return resolveUpgradedItem(registries, itemRef, 0); } catch { return null; }
}

/**
 * Every item the run can bring to a smith: worn pieces, carried armaments
 * (Inventory and the inactive hand sets — the same reader the Smith's upgrade
 * grid uses), and the worn outfit. Each once, worn first.
 */
export function ownedMountItems(registries, run) {
  const out = [];
  const seen = new Set();
  const push = (piece, equipped) => {
    const itemRef = pieceItemRef(piece);
    if (!itemRef || seen.has(itemRef)) return;
    seen.add(itemRef);
    out.push({ itemRef, piece, equipped });
  };
  for (const piece of equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) push(piece, true);
  for (const id of carriedIds(run.loadout)) {
    const piece = (registries.equipment.armaments || []).find((row) => row.id === id);
    if (piece) push(piece, false);
  }
  return out;
}

/**
 * mountRows(registries, run, item) -> [row]
 *
 * One row per mount on the item, authored and extra alike, each saying what
 * sits in it now and how it got there:
 *   state 'authored'   the card the item was authored with
 *         'installed'  a card a smith seated
 *         'fallback'   emptied; showing its kind's fallback
 *         'empty'      emptied; showing nothing
 *         'open'       an extra mount nothing has been seated in
 * Only 'authored' and 'installed' mounts hold a card that can be extracted;
 * a fallback is the mount's, not the item's, and is never lifted out.
 */
export function mountRows(registries, run, { itemRef, piece }) {
  const rules = cardMountRules(registries);
  const entries = itemMountEntries(run, itemRef);
  const authored = itemMountInstances(registries, run, piece, { authored: true });
  const current = itemMountInstances(registries, run, piece);
  const rows = authored.map((inst) => {
    const entry = entries[inst.instanceId];
    const live = current.find((row) => row.instanceId === inst.instanceId) || null;
    const state = !entry ? 'authored' : entry.card ? 'installed' : (live ? 'fallback' : 'empty');
    const cardId = live ? live.cardId : null;
    return Object.freeze({
      mountKey: inst.instanceId,
      kind: inst.equipmentRole,
      state,
      authoredCardId: inst.cardId,
      cardId,
      cardName: cardId ? cardName(registries, cardId) : null,
      upgraded: live ? live.upgraded === true : false,
      extractable: Boolean(cardId) && (state === 'authored' || state === 'installed')
        && Boolean(rules.extractableTag) && cardTags(registries, cardId).includes(rules.extractableTag),
      fallbackCardId: resolveFallbackCard(registries, rules, itemRef, inst.equipmentRole),
      accepts: (rules.kinds[inst.equipmentRole] || {}).accepts || [],
      extractions: entry && Number.isInteger(entry.extractions) ? entry.extractions : 0,
      extra: false,
    });
  });
  for (const [key, entry] of Object.entries(entries)) {
    if (!isExtraMountKey(key) || !entry || !entry.card) continue;
    rows.push(Object.freeze({
      mountKey: key,
      kind: rules.extraMounts.kind,
      state: 'installed',
      authoredCardId: null,
      cardId: entry.card,
      cardName: cardName(registries, entry.card),
      upgraded: entry.upgraded === true,
      extractable: Boolean(rules.extractableTag) && cardTags(registries, entry.card).includes(rules.extractableTag),
      fallbackCardId: null,
      accepts: (rules.kinds[rules.extraMounts.kind] || {}).accepts || [],
      extractions: Number.isInteger(entry.extractions) ? entry.extractions : 0,
      extra: true,
    }));
  }
  const open = openExtraMountKey(registries, run, itemRef);
  if (open) {
    rows.push(Object.freeze({
      mountKey: open,
      kind: rules.extraMounts.kind,
      state: 'open',
      authoredCardId: null,
      cardId: null,
      cardName: null,
      upgraded: false,
      extractable: false,
      fallbackCardId: null,
      accepts: (rules.kinds[rules.extraMounts.kind] || {}).accepts || [],
      extractions: 0,
      extra: true,
    }));
  }
  return Object.freeze(rows);
}

function identityFields(registries, itemRef, piece) {
  const identity = itemRefIdentity(itemRef);
  return {
    itemRef,
    itemKind: identity.itemKind,
    itemId: identity.itemId,
    itemName: piece.name,
    ...(identity.classId ? { classId: identity.classId } : {}),
  };
}

function priced(cost, stones) {
  const shortfall = Math.max(0, cost - stones);
  return { cost, stones, shortfall, affordable: shortfall === 0 };
}

// ---- extract ---------------------------------------------------------------

/** Every extractable mount on every owned item, priced. */
export function extractionPlan(registries, run, explicitRules = undefined) {
  const rules = smithServiceRules(registries, explicitRules);
  const stones = stoneBalance(run);
  const cost = rules.extract.cost;
  const candidates = [];
  for (const item of ownedMountItems(registries, run)) {
    const mounts = mountRows(registries, run, item).filter((row) => row.extractable);
    if (!mounts.length) continue;
    candidates.push(Object.freeze({
      ...identityFields(registries, item.itemRef, item.piece),
      equipped: item.equipped,
      ...priced(cost, stones),
      mounts,
    }));
  }
  return Object.freeze({ schemaVersion: MOUNT_RECEIPT_SCHEMA_VERSION, service: 'extract', stones, cost, candidates: Object.freeze(candidates) });
}

function nextTransaction(run) {
  const n = integer(run.mountTransactions == null ? 0 : run.mountTransactions, 'run.mountTransactions') + 1;
  run.mountTransactions = n;
  return n;
}

function writeMount(run, itemRef, mountKey, entry) {
  const entries = { ...itemMountEntries(run, itemRef) };
  if (entry === null) delete entries[mountKey];
  else entries[mountKey] = entry;
  const all = { ...(run.itemMounts || {}) };
  if (Object.keys(entries).length) all[itemRef] = entries;
  else delete all[itemRef];
  run.itemMounts = all;
}

/**
 * Lift the card out of one mount. The mount empties (an extra mount is
 * deleted, which is what "open" means); a run-owned instance of the card
 * joins the deck; the restamp sweeps the item-owned instance and seats the
 * fallback. Revalidated through the plan; `free` is for an event that grants
 * the service.
 */
export function commitExtraction(registries, run, itemRef, mountKey, explicitRules = undefined, { free = false } = {}) {
  const plan = extractionPlan(registries, run, explicitRules);
  const candidate = plan.candidates.find((row) => row.itemRef === itemRef);
  if (!candidate) throw new Error(`Item '${itemRef}' has no extractable mount`);
  const mount = candidate.mounts.find((row) => row.mountKey === mountKey);
  if (!mount) throw new Error(`Mount '${mountKey}' on '${itemRef}' is not extractable`);
  if (!free && !candidate.affordable) throw new Error(`Insufficient Smithing Stones (shortfall ${candidate.shortfall})`);
  const before = plan.stones;
  run.smithingStones = free ? before : before - candidate.cost;
  const n = nextTransaction(run);
  writeMount(run, itemRef, mountKey, mount.extra ? null : { card: null, extractions: mount.extractions + 1 });
  const instanceId = `extracted:${n}:${mount.cardId}`;
  if (!Array.isArray(run.deck)) run.deck = [];
  run.deck.push({ instanceId, cardId: mount.cardId, upgraded: mount.upgraded === true });
  stampDeck(registries, run);
  const receipt = Object.freeze({
    schemaVersion: MOUNT_RECEIPT_SCHEMA_VERSION,
    service: 'extract',
    ...identityFields(registries, itemRef, ownedMountItems(registries, run).find((item) => item.itemRef === itemRef)?.piece || { name: candidate.itemName }),
    mountKey,
    kind: mount.kind,
    cardId: mount.cardId,
    cardName: mount.cardName,
    instanceId,
    fallbackCardId: mount.extra ? null : mount.fallbackCardId,
    authoredCost: candidate.cost,
    spent: free ? 0 : candidate.cost,
    cost: free ? 0 : candidate.cost,
    stoneBalanceBefore: before,
    stoneBalanceAfter: run.smithingStones,
    free,
    transaction: n,
  });
  run.lastMountReceipt = receipt;
  return receipt;
}

// ---- install ---------------------------------------------------------------

/** The run-owned cards a mount of `accepts` could seat. */
function installableCards(registries, run, accepts) {
  return (run.deck || [])
    .filter((inst) => inst && !isItemOwned(inst) && !inst.equipmentRole)
    .filter((inst) => cardTags(registries, inst.cardId).some((tag) => accepts.includes(tag)))
    .map((inst) => Object.freeze({
      instanceId: inst.instanceId,
      cardId: inst.cardId,
      cardName: cardName(registries, inst.cardId),
      upgraded: inst.upgraded === true,
    }));
}

/** Every open mount on every owned item, with the deck cards it would take, priced. */
export function installPlan(registries, run, explicitRules = undefined) {
  const rules = smithServiceRules(registries, explicitRules);
  const stones = stoneBalance(run);
  const cost = rules.install.cost;
  const candidates = [];
  for (const item of ownedMountItems(registries, run)) {
    const mounts = [];
    for (const row of mountRows(registries, run, item)) {
      if (!['fallback', 'empty', 'open'].includes(row.state)) continue;
      const cards = installableCards(registries, run, row.accepts);
      if (!cards.length) continue;
      mounts.push(Object.freeze({ ...row, cards: Object.freeze(cards) }));
    }
    if (!mounts.length) continue;
    candidates.push(Object.freeze({
      ...identityFields(registries, item.itemRef, item.piece),
      equipped: item.equipped,
      ...priced(cost, stones),
      mounts: Object.freeze(mounts),
    }));
  }
  return Object.freeze({ schemaVersion: MOUNT_RECEIPT_SCHEMA_VERSION, service: 'install', stones, cost, candidates: Object.freeze(candidates) });
}

/**
 * Seat one run-owned deck card in one open mount. The deck instance leaves
 * (the card is the item's now); the restamp mints the item-owned instance in
 * that mount if the item is worn. Revalidated through the plan.
 */
export function commitInstall(registries, run, itemRef, mountKey, instanceId, explicitRules = undefined, { free = false } = {}) {
  const plan = installPlan(registries, run, explicitRules);
  const candidate = plan.candidates.find((row) => row.itemRef === itemRef);
  if (!candidate) throw new Error(`Item '${itemRef}' has no open mount`);
  const mount = candidate.mounts.find((row) => row.mountKey === mountKey);
  if (!mount) throw new Error(`Mount '${mountKey}' on '${itemRef}' is not open`);
  const card = mount.cards.find((row) => row.instanceId === instanceId);
  if (!card) throw new Error(`Deck card '${instanceId}' cannot be seated in mount '${mountKey}'`);
  if (!free && !candidate.affordable) throw new Error(`Insufficient Smithing Stones (shortfall ${candidate.shortfall})`);
  const before = plan.stones;
  run.smithingStones = free ? before : before - candidate.cost;
  const n = nextTransaction(run);
  const at = run.deck.findIndex((inst) => inst && inst.instanceId === instanceId);
  if (at === -1) throw new Error(`Deck card '${instanceId}' vanished between plan and commit`);
  run.deck.splice(at, 1);
  writeMount(run, itemRef, mountKey, { card: card.cardId, upgraded: card.upgraded, extractions: mount.extractions });
  stampDeck(registries, run);
  const receipt = Object.freeze({
    schemaVersion: MOUNT_RECEIPT_SCHEMA_VERSION,
    service: 'install',
    ...identityFields(registries, itemRef, ownedMountItems(registries, run).find((item) => item.itemRef === itemRef)?.piece || { name: candidate.itemName }),
    mountKey,
    kind: mount.kind,
    cardId: card.cardId,
    cardName: card.cardName,
    instanceId,
    replacedFallbackCardId: mount.state === 'fallback' ? mount.cardId : null,
    authoredCost: candidate.cost,
    spent: free ? 0 : candidate.cost,
    cost: free ? 0 : candidate.cost,
    stoneBalanceBefore: before,
    stoneBalanceAfter: run.smithingStones,
    free,
    transaction: n,
  });
  run.lastMountReceipt = receipt;
  return receipt;
}

// ---- who offers what -------------------------------------------------------

/**
 * smithServicesAt(registries, nodeKind, rng) -> { offered, services, rolled }
 *
 * The services a node of this kind offers on THIS visit. A chance of 100 is a
 * promise and consumes no roll; 0 is a refusal; anything between is one draw
 * on the smith's own RNG stream, so the roll cannot shift a later reward in
 * an existing seed. A node kind the table does not name offers nothing.
 */
export function smithServicesAt(registries, nodeKind, rng, explicitRules = undefined) {
  const rules = smithServiceRules(registries, explicitRules);
  const row = rules.offeredAt[nodeKind];
  if (!row) return Object.freeze({ nodeKind, offered: false, rolled: false, chance: 0, services: Object.freeze([]) });
  const rolled = row.chance > 0 && row.chance < 100;
  const offered = row.chance >= 100 ? true : row.chance <= 0 ? false : rng.chance('smith', row.chance);
  return Object.freeze({ nodeKind, offered, rolled, chance: row.chance, services: offered ? row.services : Object.freeze([]) });
}

/** Validate a stored `run.lastMountReceipt` against the registry. Throws by name. */
export function validateLastMountReceipt(registries, run) {
  if (run.lastMountReceipt == null) return;
  const receipt = ownObject(run.lastMountReceipt, 'run.lastMountReceipt');
  if (!['extract', 'install'].includes(receipt.service)) throw new Error('run.lastMountReceipt.service must be extract or install');
  if (!itemByRef(registries, receipt.itemRef)) throw new Error(`run.lastMountReceipt.itemRef '${receipt.itemRef}' is unknown`);
  if (!registries.cards.has(receipt.cardId)) throw new Error(`run.lastMountReceipt.cardId '${receipt.cardId}' is unknown`);
  for (const key of ['authoredCost', 'spent', 'cost', 'stoneBalanceBefore', 'stoneBalanceAfter', 'transaction']) {
    integer(receipt[key], `run.lastMountReceipt.${key}`);
  }
  if (receipt.stoneBalanceBefore - receipt.stoneBalanceAfter !== receipt.spent || receipt.cost !== receipt.spent) {
    throw new Error('run.lastMountReceipt cost/balance does not describe its transaction');
  }
}
