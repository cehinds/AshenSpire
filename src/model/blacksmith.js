// src/model/blacksmith.js — what the blacksmith does (SPEC §14.4, §14.6 step
// 6), headless.
//
// A blacksmith visit is a stock of kind `blacksmith` (engine/shopKinds.js
// buildBlacksmithStock): two stocked shelves — `armaments` (the market's
// §12.2 purchase, model/armamentTrading.js) and `smithStones` (the market's
// purchase, model/marketAdditions.js) — and services that keep no stock. Each
// service here is the shape every purchase in this game has: a PLAN is inert
// and names its refusal in one sentence (content/source/uiStrings.csv); a
// COMMIT re-plans, refuses a quote whose revision or price no longer matches
// (`stock.tradeRevision`), mutates, and bumps the revision, so one quote
// commits once.
//
//   upgrade      smithingPlan / commitItemUpgrade, from either purse
//   refineStones refine.from stones + refine.cinders → one refined stone
//   sigilSlots   cut one slot into a carried armament, up to sigilSlots.max
//   sigils       set a carried sigil into an empty slot, or take one out; free
//   extractArt   cardExtraction's commitExtraction, at its authored cost
//   installArt   cardExtraction's commitInstall (deck ∪ sideboard, §14.1)
//   upgradeArt   a loose weapon-art card's `upgraded`, for upgradeArt.stones
//   stackCopy    one more loose copy of a weapon art or technique, into the
//                sideboard, at stack.* rising per copy owned beyond the first
//
// PRICES. A service's price is read when quoted from the run's frozen
// `gameConfig.shops.blacksmith.*` rows (registries.shops), never stored, so it
// is the same after a reload; a price in cinders is scaled by a custom run's
// shop price multiplier, rounding up, as every market price is (§14.3). The
// upgrade's stone cost is smithingPlan's, from the item-upgrade rows, and the
// art services' are cardExtraction's.
//
// A SERVICE STAYS ONCE ROLLED (coordinator ruling on #1378): whether it can
// act is judged here, live, when it is shown and quoted — `serviceCandidates`
// lists what each could act on now, and the screen shows a service with none
// as unavailable, with the reason `serviceIdleReason` names.
import { shopSentence, shopStockKind, shopStockOfferings } from './shopKinds.js';
import { carriedIds, isItemOwned } from './loadout.js';
import { smithingPlan, commitItemUpgrade, SMITHING_PURSES } from './smithing.js';
import { extractionPlan, installPlan, commitExtraction, commitInstall } from './cardExtraction.js';
import { deckRules } from '../content/deckRules.js';
import { deckCopyLimit, ownedCopies } from './deckRules.js';

const say = (id, tokens = {}) => shopSentence(id, tokens);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const ART_TAG = 'extractable';
const TECHNIQUE_PREFIX = 'technique:';

/** The services a blacksmith offers, stockless (SPEC §14.4): each stays laid out once rolled. */
export const BLACKSMITH_SERVICES = Object.freeze(['upgrade', 'refineStones', 'sigilSlots', 'sigils', 'extractArt', 'installArt', 'upgradeArt', 'stackCopy']);

export const blacksmithRevision = (run) => run.shopStock?.tradeRevision || 0;

/** The blacksmith's offering row `id`, as configured for this run. */
export function blacksmithOffering(registries, id) {
  return (registries.shops?.blacksmith?.offerings || []).find((row) => row && row.id === id) || null;
}

/** Whether the visit open now is a blacksmith that laid out `id`. */
export function blacksmithOffers(run, id) {
  return !!run.shopStock && shopStockKind(run.shopStock) === 'blacksmith' && shopStockOfferings(run.shopStock).includes(id);
}

const cinders = (n, priceMult) => (priceMult === 1 ? n : Math.ceil(n * priceMult));
const affordable = (run, cost) => Number.isSafeInteger(run.cinders) && run.cinders >= cost;
const stones = (run) => (Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0);
const cardName = (registries, cardId) => registries.cards.get(cardId)?.name || cardId;
const armamentName = (registries, itemRef) => {
  const id = String(itemRef || '').replace(/^armament\//, '');
  return (registries.equipment.armaments || []).find((piece) => piece.id === id)?.name || id;
};

// THE STALE-QUOTE REFUSAL (§12.2, §14.3): the revision and every price the
// quote named must still be what the plan says now.
function stale(quote, plan) {
  for (const key of ['revision', 'cost', 'stones', 'refined']) {
    if ((quote?.[key] ?? 0) !== (plan[key] ?? 0)) throw new Error(say('shop.refuse.stale'));
  }
}
function bump(run, plan) {
  run.shopStock.tradeRevision = plan.revision + 1;
}

// ---------------------------------------------------------------------------
// The run's cards: loose arts and stackable ids
// ---------------------------------------------------------------------------

const owned = (run) => [...(run.deck || []), ...(run.sideboard || [])].filter(Boolean);
/** A loose card: run-owned, in deck or sideboard, not granted, no equipment role (SPEC §14.4). */
export const isLooseCard = (card) => !!card && !card.grantedBy && !isItemOwned(card) && !card.equipmentRole;
const tagsOf = (registries, cardId) => registries.cards.get(cardId)?.tags || [];
const isArt = (registries, cardId) => tagsOf(registries, cardId).includes(ART_TAG);
const isTechnique = (registries, cardId) => tagsOf(registries, cardId).some((tag) => String(tag).startsWith(TECHNIQUE_PREFIX));

/** The loose weapon-art instances an art upgrade could take now. */
export function upgradeableArts(registries, run) {
  return owned(run).filter((card) => isLooseCard(card) && isArt(registries, card.cardId) && card.upgraded !== true && !!registries.cards.get(card.cardId)?.upgrade);
}

/** The card ids a stacked copy could be made of now: a loose weapon art or technique, never a basic. */
export function stackableCardIds(registries, run, settings = {}) {
  const ids = [];
  for (const card of owned(run)) {
    if (!isLooseCard(card) || ids.includes(card.cardId)) continue;
    if (deckRules.unlimitedCardIds.includes(card.cardId)) continue;
    if (!isArt(registries, card.cardId) && ownedCopies(run, card.cardId) >= deckCopyLimit(registries, card.cardId, settings, run.class)) continue;
    if (isArt(registries, card.cardId) || isTechnique(registries, card.cardId)) ids.push(card.cardId);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Sigil slots
// ---------------------------------------------------------------------------

const slotRules = (registries) => blacksmithOffering(registries, 'sigilSlots')?.sigilSlots || { base: 0, max: 0, cinders: 1 };
const carriedRefs = (run) => [...new Set(carriedIds(run.loadout))].map((id) => `armament/${id}`);

/** One armament's slot list: its record, or `sigilSlots.base` empty slots (SPEC §14.4). */
export function sigilSlotsOf(registries, run, itemRef) {
  const record = object(run.sigilSlots) ? run.sigilSlots[itemRef] : undefined;
  return Array.isArray(record) ? [...record] : Array(slotRules(registries).base || 0).fill(null);
}

/** Every carried armament with its slots, for the screen and the live service check. */
export function sigilSlotPieces(registries, run) {
  const { max } = slotRules(registries);
  return carriedRefs(run).map((itemRef) => {
    const slots = sigilSlotsOf(registries, run, itemRef);
    return { itemRef, name: armamentName(registries, itemRef), slots, max, canCut: slots.length < max };
  });
}

export function sigilSlotPlan(registries, run, itemRef, { priceMult = 1 } = {}) {
  const rules = slotRules(registries);
  const cost = cinders(rules.cinders, priceMult);
  const slots = sigilSlotsOf(registries, run, itemRef);
  const name = armamentName(registries, itemRef);
  let reason = '';
  if (!blacksmithOffers(run, 'sigilSlots')) reason = say('blacksmith.refuse.notOffered');
  else if (!carriedRefs(run).includes(itemRef)) reason = say('blacksmith.refuse.notCarried', { name });
  else if (slots.length >= rules.max) reason = say('blacksmith.refuse.slotsFull', { name, max: rules.max });
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, itemRef, name, slots: slots.length, cost, revision: blacksmithRevision(run) };
}

export function commitSigilSlot(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = sigilSlotPlan(registries, run, quote.itemRef, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.sigilSlots = { ...(object(run.sigilSlots) ? run.sigilSlots : {}), [plan.itemRef]: [...sigilSlotsOf(registries, run, plan.itemRef), null] };
  run.cinders -= plan.cost;
  bump(run, plan);
  return { itemRef: plan.itemRef, slots: plan.slots + 1, spent: plan.cost };
}

export function sigilInstallPlan(registries, run, itemRef, index, sigilId) {
  const slots = sigilSlotsOf(registries, run, itemRef);
  const name = armamentName(registries, itemRef);
  const def = registries.sigils.has(sigilId) ? registries.sigils.get(sigilId) : null;
  let reason = '';
  if (!blacksmithOffers(run, 'sigils')) reason = say('blacksmith.refuse.notOffered');
  else if (!carriedRefs(run).includes(itemRef)) reason = say('blacksmith.refuse.notCarried', { name });
  else if (!(Number.isSafeInteger(index) && index >= 0 && index < slots.length)) reason = say('blacksmith.refuse.noSlot', { name });
  else if (slots[index] !== null) reason = say('blacksmith.refuse.slotTaken', { name });
  else if (!def || !(run.sigils || []).includes(sigilId)) reason = say('blacksmith.refuse.sigilNotCarried', { name: def?.name || sigilId });
  // A legendary is attuned, never slotted (SPEC §15.4).
  else if (def.rarity === 'legendary') reason = say('blacksmith.refuse.sigilLegendary', { name: def.name });
  return { ok: !reason, reason, itemRef, index, sigilId, cost: 0, revision: blacksmithRevision(run) };
}

export function commitSigilInstall(registries, run, quote) {
  const plan = sigilInstallPlan(registries, run, quote.itemRef, quote.index, quote.sigilId);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if (quote.sigilId !== plan.sigilId) throw new Error(say('shop.refuse.stale'));
  const slots = sigilSlotsOf(registries, run, plan.itemRef);
  slots[plan.index] = plan.sigilId;
  const carried = [...run.sigils];
  carried.splice(carried.indexOf(plan.sigilId), 1);
  run.sigils = carried;
  run.sigilSlots = { ...(object(run.sigilSlots) ? run.sigilSlots : {}), [plan.itemRef]: slots };
  bump(run, plan);
  return { itemRef: plan.itemRef, index: plan.index, sigilId: plan.sigilId };
}

/** Taking a sigil out is free, and it goes back to `run.sigils` (SPEC §14.4), whether or not the piece is still carried. */
export function sigilRemovePlan(registries, run, itemRef, index) {
  const record = object(run.sigilSlots) && Array.isArray(run.sigilSlots[itemRef]) ? run.sigilSlots[itemRef] : [];
  const name = armamentName(registries, itemRef);
  let reason = '';
  if (!blacksmithOffers(run, 'sigils')) reason = say('blacksmith.refuse.notOffered');
  else if (!(Number.isSafeInteger(index) && index >= 0 && index < record.length) || typeof record[index] !== 'string') reason = say('blacksmith.refuse.slotEmpty', { name });
  return { ok: !reason, reason, itemRef, index, sigilId: record[index] ?? null, cost: 0, revision: blacksmithRevision(run) };
}

export function commitSigilRemove(registries, run, quote) {
  const plan = sigilRemovePlan(registries, run, quote.itemRef, quote.index);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if (quote.sigilId !== plan.sigilId) throw new Error(say('shop.refuse.stale'));
  const slots = [...run.sigilSlots[plan.itemRef]];
  slots[plan.index] = null;
  run.sigilSlots = { ...run.sigilSlots, [plan.itemRef]: slots };
  run.sigils = [...(run.sigils || []), plan.sigilId];
  bump(run, plan);
  return { itemRef: plan.itemRef, index: plan.index, sigilId: plan.sigilId };
}

// ---------------------------------------------------------------------------
// Refining
// ---------------------------------------------------------------------------

export function refinePlan(registries, run, { priceMult = 1 } = {}) {
  const refine = blacksmithOffering(registries, 'refineStones')?.refine || null;
  const cost = refine ? cinders(refine.cinders, priceMult) : 0;
  let reason = '';
  if (!blacksmithOffers(run, 'refineStones') || !refine) reason = say('blacksmith.refuse.notOffered');
  else if (stones(run) < refine.from) reason = say('blacksmith.refuse.refineStones', { from: refine.from, have: stones(run) });
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, stones: refine?.from ?? 0, cost, value: refine?.value ?? null, revision: blacksmithRevision(run) };
}

export function commitRefine(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = refinePlan(registries, run, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.smithingStones = stones(run) - plan.stones;
  run.cinders -= plan.cost;
  run.smithingStonesRefined = (Number.isSafeInteger(run.smithingStonesRefined) ? run.smithingStonesRefined : 0) + 1;
  bump(run, plan);
  return { spentStones: plan.stones, spent: plan.cost, refined: run.smithingStonesRefined };
}

// ---------------------------------------------------------------------------
// Item upgrade, from either purse
// ---------------------------------------------------------------------------

export function blacksmithUpgradePlan(registries, run, itemRef, { purse = 'stones' } = {}) {
  const candidate = smithingPlan(registries, run).candidates.find((row) => row.itemRef === itemRef) || null;
  const refinedPurse = purse === 'refined';
  let reason = '';
  if (!blacksmithOffers(run, 'upgrade')) reason = say('blacksmith.refuse.notOffered');
  else if (!SMITHING_PURSES.includes(purse)) reason = say('blacksmith.refuse.notOffered');
  else if (!candidate) reason = say('blacksmith.refuse.upgradeNone', { name: armamentName(registries, itemRef) });
  else if (refinedPurse && !candidate.refinedAffordable) reason = say('blacksmith.refuse.refined', { cost: candidate.refinedCost ?? '—', have: run.smithingStonesRefined || 0 });
  else if (!refinedPurse && !candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run) });
  return {
    ok: !reason, reason, itemRef, purse, candidate,
    stones: candidate && !refinedPurse ? candidate.cost : 0,
    refined: candidate && refinedPurse ? candidate.refinedCost : 0,
    cost: 0, revision: blacksmithRevision(run),
  };
}

export function commitBlacksmithUpgrade(registries, run, quote) {
  const plan = blacksmithUpgradePlan(registries, run, quote.itemRef, { purse: quote.purse });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const receipt = commitItemUpgrade(registries, run, plan.itemRef, undefined, { purse: plan.purse });
  bump(run, plan);
  return receipt;
}

// ---------------------------------------------------------------------------
// Weapon arts: extract, install, upgrade
// ---------------------------------------------------------------------------

export function blacksmithExtractPlan(registries, run, itemRef, mountKey) {
  const plan = extractionPlan(registries, run);
  const candidate = plan.candidates.find((row) => row.itemRef === itemRef);
  const mount = candidate?.mounts.find((row) => row.mountKey === mountKey) || null;
  let reason = '';
  if (!blacksmithOffers(run, 'extractArt')) reason = say('blacksmith.refuse.notOffered');
  else if (!mount) reason = say('blacksmith.refuse.noMount');
  else if (!candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run) });
  return { ok: !reason, reason, itemRef, mountKey, stones: plan.cost, cost: 0, revision: blacksmithRevision(run) };
}

export function commitBlacksmithExtract(registries, run, quote) {
  const plan = blacksmithExtractPlan(registries, run, quote.itemRef, quote.mountKey);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const receipt = commitExtraction(registries, run, plan.itemRef, plan.mountKey);
  bump(run, plan);
  return receipt;
}

export function blacksmithInstallPlan(registries, run, itemRef, mountKey, instanceId) {
  const plan = installPlan(registries, run);
  const candidate = plan.candidates.find((row) => row.itemRef === itemRef);
  const mount = candidate?.mounts.find((row) => row.mountKey === mountKey) || null;
  const card = mount?.cards.find((row) => row.instanceId === instanceId) || null;
  let reason = '';
  if (!blacksmithOffers(run, 'installArt')) reason = say('blacksmith.refuse.notOffered');
  else if (!mount || !card) reason = say('blacksmith.refuse.noMount');
  else if (!candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run) });
  return { ok: !reason, reason, itemRef, mountKey, instanceId, stones: plan.cost, cost: 0, revision: blacksmithRevision(run) };
}

export function commitBlacksmithInstall(registries, run, quote) {
  const plan = blacksmithInstallPlan(registries, run, quote.itemRef, quote.mountKey, quote.instanceId);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const receipt = commitInstall(registries, run, plan.itemRef, plan.mountKey, plan.instanceId);
  bump(run, plan);
  return receipt;
}

export function upgradeArtPlan(registries, run, instanceId) {
  const card = owned(run).find((row) => row.instanceId === instanceId) || null;
  const price = blacksmithOffering(registries, 'upgradeArt')?.stones ?? 0;
  const name = card ? cardName(registries, card.cardId) : '';
  let reason = '';
  if (!blacksmithOffers(run, 'upgradeArt')) reason = say('blacksmith.refuse.notOffered');
  else if (!card) reason = say('shop.refuse.gone');
  else if (!isLooseCard(card)) reason = say('blacksmith.refuse.artNotLoose', { name });
  else if (!isArt(registries, card.cardId)) reason = say('blacksmith.refuse.notArt', { name });
  else if (card.upgraded === true) reason = say('blacksmith.refuse.artUpgraded', { name });
  else if (!registries.cards.get(card.cardId)?.upgrade) reason = say('blacksmith.refuse.noCardUpgrade', { name });
  else if (stones(run) < price) reason = say('blacksmith.refuse.stones', { cost: price, have: stones(run) });
  return { ok: !reason, reason, instanceId, stones: price, cost: 0, revision: blacksmithRevision(run) };
}

export function commitUpgradeArt(registries, run, quote) {
  const plan = upgradeArtPlan(registries, run, quote.instanceId);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  owned(run).find((row) => row.instanceId === plan.instanceId).upgraded = true;
  run.smithingStones = stones(run) - plan.stones;
  bump(run, plan);
  return { instanceId: plan.instanceId, spentStones: plan.stones };
}

// ---------------------------------------------------------------------------
// Stacking a copy
// ---------------------------------------------------------------------------

export function stackCopyPlan(registries, run, cardId, { priceMult = 1, settings = {} } = {}) {
  const stack = blacksmithOffering(registries, 'stackCopy')?.stack || null;
  const def = registries.cards.get(cardId);
  const name = def?.name || cardId;
  const copies = owned(run).filter((card) => card.cardId === cardId);
  const extra = Math.max(0, copies.length - 1);
  const limit = deckCopyLimit(registries, cardId, settings, run.class);
  const stonePrice = stack ? stack.stones + stack.stepPerOwned * extra : 0;
  const cost = stack ? cinders(stack.cinders + stack.stepPerOwned * extra, priceMult) : 0;
  let reason = '';
  if (!blacksmithOffers(run, 'stackCopy') || !stack) reason = say('blacksmith.refuse.notOffered');
  else if (!def) reason = say('shop.refuse.gone');
  else if (deckRules.unlimitedCardIds.includes(cardId)) reason = say('blacksmith.refuse.stackBasic', { name });
  else if (!copies.length) reason = say('blacksmith.refuse.stackUnowned', { name });
  else if (!copies.some(isLooseCard)) reason = say('blacksmith.refuse.stackGranted', { name });
  else if (!isArt(registries, cardId) && !isTechnique(registries, cardId)) reason = say('blacksmith.refuse.stackKind', { name });
  // Extractable arts can still be seated in an item; a capped technique with
  // no such use must not sell another permanently unused sideboard copy.
  else if (!isArt(registries, cardId) && copies.length >= limit) reason = say('deckEditor.refuse.copyLimit', { name, limit });
  else if (stones(run) < stonePrice) reason = say('blacksmith.refuse.stones', { cost: stonePrice, have: stones(run) });
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, cardId, name, owned: copies.length, stones: stonePrice, cost, revision: blacksmithRevision(run) };
}

/** The new copy is `{ instanceId: 'stack:<n>:<cardId>', cardId, upgraded: false }`, in the sideboard, with no mods. */
export function commitStackCopy(registries, run, quote, { priceMult = 1, settings = {} } = {}) {
  const plan = stackCopyPlan(registries, run, quote.cardId, { priceMult, settings });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const taken = new Set(owned(run).map((card) => card.instanceId));
  let n = 1;
  while (taken.has(`stack:${n}:${plan.cardId}`)) n++;
  const instance = { instanceId: `stack:${n}:${plan.cardId}`, cardId: plan.cardId, upgraded: false };
  run.sideboard = [...(Array.isArray(run.sideboard) ? run.sideboard : []), instance];
  run.smithingStones = stones(run) - plan.stones;
  run.cinders -= plan.cost;
  bump(run, plan);
  return { instanceId: instance.instanceId, spentStones: plan.stones, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Which services can act now (SPEC §14.4, coordinator ruling on #1378)
// ---------------------------------------------------------------------------

/**
 * serviceCandidates(registries, run, id) → what service `id` could act on
 * now, for the screen and for the build-time backstop (a service with none is
 * empty for the guarantee, but stays laid out). Affordability is not asked:
 * a price the purse cannot meet is a refusal, not an empty service.
 */
export function serviceCandidates(registries, run, id, settings = {}) {
  switch (id) {
    case 'upgrade': return smithingPlan(registries, run).candidates;
    case 'refineStones': return blacksmithOffering(registries, 'refineStones') ? ['refine'] : [];
    case 'sigilSlots': return sigilSlotPieces(registries, run).filter((piece) => piece.canCut);
    case 'sigils': {
      const pieces = sigilSlotPieces(registries, run);
      const settable = (run.sigils || []).some((sigilId) => registries.sigils.has(sigilId) && registries.sigils.get(sigilId).rarity !== 'legendary');
      const open = settable ? pieces.filter((piece) => piece.slots.includes(null)) : [];
      const set = Object.entries(object(run.sigilSlots) ? run.sigilSlots : {}).filter(([, slots]) => Array.isArray(slots) && slots.some((slot) => typeof slot === 'string'));
      return [...open.map((piece) => piece.itemRef), ...set.map(([itemRef]) => itemRef)];
    }
    case 'extractArt': return extractionPlan(registries, run).candidates;
    case 'installArt': return installPlan(registries, run).candidates;
    case 'upgradeArt': return upgradeableArts(registries, run);
    case 'stackCopy': return stackableCardIds(registries, run, settings);
    default: return [];
  }
}

/** The sentence a service with nothing to act on shows (uiStrings `blacksmith.idle.<id>`). */
export function serviceIdleReason(id) {
  return say(`blacksmith.idle.${id}`);
}
