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
//   upgradeArt   a loose weapon-art card's `upgraded`, for upgradeArt.stones. In a Core run (card ranks on)
//                it is the card upgrade of any deck card, through cardUpgradeService at its own
//                price (Free, or 1 Smithing Stone past the free allowance), with no per-visit limit
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
import { smithingPlan, commitItemUpgrade, withSmithService, SMITHING_PURSES } from './smithing.js';
import { extractionPlan, extractionRefusal, installPlan, commitExtraction, commitInstall } from './cardExtraction.js';
import { deckRules } from '../content/deckRules.js';
import { deckCopyLimit, ownedCopies } from './deckRules.js';
import { planCardUpgrade, commitCardUpgrade } from './cardUpgradeService.js';
import { blacksmithRules, blacksmithStoneDiscount, blacksmithPrices, tierUpgradePrice } from './blacksmithConfig.js';

const say = (id, tokens = {}) => shopSentence(id, tokens);
/** The `{plural}` token of the uiStrings rows: '' for exactly one, 's' otherwise. */
export const plural = (count) => (count === 1 ? '' : 's');
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

/**
 * What a Core (card ranks on) Blacksmith offers (owner ask 2026-10-31): the equipment upgrade, the card upgrade, a card rank-up,
 * and two shelves (armaments rolled at tiers, weapon arts). Nothing else.
 */
export const CORE_BLACKSMITH_OFFERINGS = Object.freeze(['upgrade', 'upgradeArt', 'rankUp', 'armaments', 'weaponArts']);

/**
 * Core (card ranks on) is an allow-list, not a deny-list: Core has no sigils, no copy-stacking, no weapon-art mounts
 * (a configured deck is not projected from `run.itemMounts`, so extracting or installing would delete a card with
 * nothing equipment-owned in its place) and no refined stones, so every offering outside CORE_BLACKSMITH_OFFERINGS is
 * withheld: never rolled, never planned or committed, and hidden by the screen even for an old saved stock.
 */
export const blacksmithWithholds = (run, id) => run?.gameProfile?.modules?.progression?.cardRanks === true && !CORE_BLACKSMITH_OFFERINGS.includes(id);

/** Whether the visit open now is a blacksmith that laid out `id`. */
export function blacksmithOffers(run, id) {
  return !blacksmithWithholds(run, id) && !!run.shopStock && shopStockKind(run.shopStock) === 'blacksmith' && shopStockOfferings(run.shopStock).includes(id);
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

/** Core (card ranks on): `upgradeArt` upgrades any deck card through the card-upgrade service (owner ruling 2026-10-28). */
export const coreCardUpgrades = (run) => run?.gameProfile?.modules?.progression?.cardRanks === true;
const upgradeablePlan = (plan) => plan.ok || plan.code === 'stones';

/** The loose weapon-art instances an art upgrade could take now. In Core: every owned card with a next upgrade (a short purse still lists it). */
export function upgradeableArts(registries, run) {
  if (coreCardUpgrades(run)) return owned(run).filter((card) => card && upgradeablePlan(planCardUpgrade(run, registries, card.instanceId)));
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
  else if (stones(run) < refine.from) reason = say('blacksmith.refuse.refineStones', { from: refine.from, have: stones(run), plural: plural(refine.from) });
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

export function blacksmithUpgradePlan(registries, run, itemRef, { purse = 'stones', priceMult = 1 } = {}) {
  // Core: stones come off by the blacksmith's discount, and the work costs cinders by the tier it reaches.
  const candidate = smithingPlan(registries, run, undefined, { stoneDiscount: blacksmithStoneDiscount(run) }).candidates.find((row) => row.itemRef === itemRef) || null;
  const refinedPurse = purse === 'refined';
  const cost = candidate && blacksmithRules(run) ? cinders(tierUpgradePrice(run, candidate.nextLevel), priceMult) : 0;
  let reason = '';
  if (!blacksmithOffers(run, 'upgrade')) reason = say('blacksmith.refuse.notOffered');
  else if (!SMITHING_PURSES.includes(purse)) reason = say('blacksmith.refuse.notOffered');
  // Core has no refining, so no refined purse to pay from.
  else if (refinedPurse && blacksmithWithholds(run, 'refineStones')) reason = say('blacksmith.refuse.notOffered');
  else if (!candidate) reason = say('blacksmith.refuse.upgradeNone', { name: armamentName(registries, itemRef) });
  else if (refinedPurse && !candidate.refinedAffordable) reason = say('blacksmith.refuse.refined', { cost: candidate.refinedCost ?? '—', have: run.smithingStonesRefined || 0, plural: plural(candidate.refinedCost) });
  else if (!refinedPurse && !candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run), plural: plural(candidate.cost) });
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return {
    ok: !reason, reason, itemRef, purse, candidate,
    stones: candidate && !refinedPurse ? candidate.cost : 0,
    refined: candidate && refinedPurse ? candidate.refinedCost : 0,
    cost, revision: blacksmithRevision(run),
  };
}

export function commitBlacksmithUpgrade(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = blacksmithUpgradePlan(registries, run, quote.itemRef, { purse: quote.purse, priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  // A Core run commits equipment upgrades only inside the Smith service; the stone price is smithingPlan's, less the discount.
  const receipt = withSmithService(registries, run, () => commitItemUpgrade(registries, run, plan.itemRef, undefined, { purse: plan.purse, stoneDiscount: blacksmithStoneDiscount(run) }));
  run.cinders -= plan.cost;
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
  else if (plan.refusal) reason = say(`blacksmith.refuse.extract.${plan.refusal}`);
  else if (!mount) reason = say('blacksmith.refuse.noMount');
  else if (!candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run), plural: plural(candidate.cost) });
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
  else if (!candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run), plural: plural(candidate.cost) });
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

function coreUpgradeArtPlan(registries, run, instanceId, priceMult = 1) {
  const card = owned(run).find((row) => row.instanceId === instanceId) || null;
  const verdict = card ? planCardUpgrade(run, registries, instanceId) : null;
  // The blacksmith takes its stone discount off the service's price (Free stays free; 1 stone becomes 0).
  const due = verdict ? Math.max(0, (verdict.cost ?? 0) - blacksmithStoneDiscount(run)) : 0;
  const payable = !!verdict && (verdict.ok || (verdict.code === 'stones' && stones(run) >= due));
  const cost = blacksmithRules(run) ? cinders(blacksmithPrices(run).cardUpgrade, priceMult) : 0;
  let reason = '';
  if (!blacksmithOffers(run, 'upgradeArt')) reason = say('blacksmith.refuse.notOffered');
  else if (!card) reason = say('shop.refuse.gone');
  else if (!payable) reason = verdict.reason;
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, instanceId, stones: due, cost, revision: blacksmithRevision(run), cardQuote: verdict };
}

export function upgradeArtPlan(registries, run, instanceId, { priceMult = 1 } = {}) {
  if (coreCardUpgrades(run)) return coreUpgradeArtPlan(registries, run, instanceId, priceMult);
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
  else if (stones(run) < price) reason = say('blacksmith.refuse.stones', { cost: price, have: stones(run), plural: plural(price) });
  return { ok: !reason, reason, instanceId, stones: price, cost: 0, revision: blacksmithRevision(run) };
}

export function commitUpgradeArt(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = upgradeArtPlan(registries, run, quote.instanceId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if (coreCardUpgrades(run)) {
    // The service re-plans and refuses a quote whose rolled step, number or price changed; it spends the stones.
    // The service charges its own (rest) price, so the discount is lent to the purse for the call and the books
    // balance after it: the player pays (service price - discount, min 0).
    const lent = Math.min(blacksmithStoneDiscount(run), (plan.cardQuote?.cost ?? 0));
    run.smithingStones = stones(run) + lent;
    let receipt;
    try { receipt = commitCardUpgrade(run, registries, quote.cardQuote || plan.cardQuote); }
    catch (error) { run.smithingStones -= lent; throw error; }
    run.cinders -= plan.cost;
    bump(run, plan);
    return { instanceId: receipt.instanceId, spentStones: receipt.spentStones - lent, step: receipt.step, n: receipt.n };
  }
  owned(run).find((row) => row.instanceId === plan.instanceId).upgraded = true;
  run.smithingStones = stones(run) - plan.stones;
  bump(run, plan);
  return { instanceId: plan.instanceId, spentStones: plan.stones };
}

// ---------------------------------------------------------------------------
// Rank-up (Core only): one more rank on an owned card, for cinders and a stone
// ---------------------------------------------------------------------------

const RANK_CEILING = 99; // state.js MAX_CARD_RANK (not imported: state.js pulls the whole run schema into this module)
const instanceRank = (card) => (Number.isInteger(card?.rank) && card.rank >= 1 ? card.rank : 1);
const equipmentOwned = (card) => !!card && (!!card.sourceArmamentId || !!card.grantedBy || card.equipmentRole === 'granted' || card.equipmentRole === 'weaponArt');

/** The cards a rank-up could raise now: owned, run-owned (not equipment-bound), below the rank ceiling. */
export function rankUpCards(registries, run) {
  if (!coreCardUpgrades(run)) return [];
  return owned(run).filter((card) => !equipmentOwned(card) && registries.cards.has(card.cardId) && instanceRank(card) < RANK_CEILING);
}

export function rankUpPlan(registries, run, instanceId, { priceMult = 1 } = {}) {
  const card = owned(run).find((row) => row.instanceId === instanceId) || null;
  const rules = blacksmithRules(run);
  const price = cinders(blacksmithPrices(run).rankUp, priceMult);
  const need = Number.isSafeInteger(rules?.rankUpStones) && rules.rankUpStones > 0 ? rules.rankUpStones : 0;
  const name = card ? cardName(registries, card.cardId) : '';
  let reason = '';
  if (!coreCardUpgrades(run) || !blacksmithOffers(run, 'rankUp') || !rules) reason = say('blacksmith.refuse.notOffered');
  else if (!card) reason = say('shop.refuse.gone');
  else if (equipmentOwned(card) || !registries.cards.has(card.cardId)) reason = say('blacksmith.refuse.rankNone', { name });
  else if (instanceRank(card) >= RANK_CEILING) reason = say('blacksmith.refuse.rankMax', { name });
  else if (stones(run) < need) reason = say('blacksmith.refuse.stones', { cost: need, have: stones(run), plural: plural(need) });
  else if (!affordable(run, price)) reason = say('shop.refuse.cinders');
  const from = instanceRank(card);
  return { ok: !reason, reason, instanceId, name, from, to: from + 1, stones: need, cost: price, revision: blacksmithRevision(run) };
}

export function commitRankUp(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = rankUpPlan(registries, run, quote.instanceId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if ((quote.from ?? plan.from) !== plan.from) throw new Error(say('shop.refuse.stale'));
  owned(run).find((row) => row.instanceId === plan.instanceId).rank = plan.to;
  run.smithingStones = stones(run) - plan.stones;
  run.cinders -= plan.cost;
  bump(run, plan);
  return { instanceId: plan.instanceId, rank: plan.to, spentStones: plan.stones, spent: plan.cost };
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
  else if (stones(run) < stonePrice) reason = say('blacksmith.refuse.stones', { cost: stonePrice, have: stones(run), plural: plural(stonePrice) });
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
    case 'rankUp': return rankUpCards(registries, run);
    case 'stackCopy': return stackableCardIds(registries, run, settings);
    default: return [];
  }
}

/**
 * The sentence a service with nothing to act on shows (uiStrings
 * `blacksmith.idle.<id>`). Given the run, a service the run's own rules
 * refuse outright says that instead: extraction in a Sealed or Draft run
 * (`blacksmith.refuse.extract.poolDeck`, cardExtraction.js extractionRefusal).
 */
export function serviceIdleReason(id, run = null) {
  if (id === 'rankUp') return say('blacksmith.idle.rankUp');
  const refusal = id === 'extractArt' && run ? extractionRefusal(run) : null;
  if (!refusal && id === 'upgradeArt' && run && coreCardUpgrades(run)) return say('blacksmith.idle.upgradeCard');
  return say(refusal ? `blacksmith.refuse.extract.${refusal}` : `blacksmith.idle.${id}`);
}
