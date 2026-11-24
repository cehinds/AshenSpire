// src/model/blacksmith.js — what the Core Blacksmith does (SPEC §14.4), headless.
//
// A blacksmith visit is a stock of kind `blacksmith` (engine/shopKinds.js buildBlacksmithStock, laid out by
// model/blacksmithStock.js): two stocked shelves, `armaments` and `weaponArts`, and services that keep no stock.
// Each service here is the shape every purchase in this game has: a PLAN is inert and names its refusal in one
// sentence (content/source/uiStrings.csv); a COMMIT re-plans, refuses a quote whose revision or price no longer
// matches (`stock.tradeRevision`), mutates, and bumps the revision, so one quote commits once.
//
//   upgrade      smithingPlan / commitItemUpgrade: one equipment tier, for stones and the tier's cinder price
//   upgradeArt   the card upgrade of any deck card, through cardUpgradeService at its own price (Free, or 1 Smithing
//                Stone past the free allowance), with no per-visit limit
//   rankUp       one more rank on an owned card, for cinders and a stone
//
// The legacy blacksmith's refine, sigil-slot, sigil, extract, install and stack services went with the legacy shops
// (only Core ships). Prices are read when quoted from the run's frozen Core blacksmith rules (blacksmithConfig.js),
// never stored; a price in cinders is scaled by a custom run's shop price multiplier, rounding up.
//
// A SERVICE STAYS ONCE ROLLED (coordinator ruling on #1378): whether it can act is judged here, live, when it is
// shown and quoted — `serviceCandidates` lists what each could act on now, and the screen shows a service with none
// as unavailable, with the reason `serviceIdleReason` names.
import { shopSentence, shopStockKind, shopStockOfferings } from './shopKinds.js';
import { smithingPlan, commitItemUpgrade, withSmithService, ownedSmithingItems } from './smithing.js';
import { coreSmithingActive } from './smithingCore.js';
import { PlanSmithUpgrade, ApplySmithUpgrade } from './smithUpgrade.js';
import { mulberry32 } from './rng.js';
import { RANK_CEILING, InstanceRank, EquipmentBound, RankUpCandidates, RaiseCardRank, RankUpBlock, RankUpPrice } from './rankUpService.js';
import { OwnCardRank } from './cardRank.js';
import { CardCopyCandidates, CopyOwnedCard, CardCopyUsesLeft, CardCopyPrice } from './cardCopyService.js';
import { upgradeSeed } from './cardUpgradeSteps.js';
import { upgradeCount } from './cardUpgrade.js';
import { PlanCategoryChange, ApplyCategoryChange, CategoryChoices } from './smithCategory.js';
import { SmithUpgradeSlots } from './smithUpgrade.js';
import { ItemRank, ItemUpgradeCount } from './itemPicks.js';
import { ITEM_SMITH } from '../content/itemProperties.js';
import { planCardUpgrade, commitCardUpgrade } from './cardUpgradeService.js';
import { blacksmithRules, blacksmithStoneDiscount, blacksmithPrices, tierUpgradePrice, CardUpgradePrice } from './blacksmithConfig.js';
import { OfferSalted } from './upgradeOffer.js';

const say = (id, tokens = {}) => shopSentence(id, tokens);
/** The `{plural}` token of the uiStrings rows: '' for exactly one, 's' otherwise. */
export const plural = (count) => (count === 1 ? '' : 's');

/** The services a Core blacksmith offers, stockless (SPEC §14.4): each stays laid out once rolled. */
export const BLACKSMITH_SERVICES = Object.freeze(['upgrade', 'upgradeArt', 'rankUp']);

export const blacksmithRevision = (run) => run.shopStock?.tradeRevision || 0;

/**
 * What a Core (card ranks on) Blacksmith offers (owner ask 2026-10-31): the equipment upgrade, the card upgrade, a card rank-up,
 * and two shelves (armaments rolled at tiers, weapon arts). Nothing else.
 */
// `cardCopy` (owner 2026-11-20) is laid out only by some Blacksmiths (shops.json blacksmith.cardCopy, blacksmithStock.js).
export const CORE_BLACKSMITH_OFFERINGS = Object.freeze(['upgrade', 'upgradeArt', 'rankUp', 'armaments', 'weaponArts', 'cardCopy']);

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
  for (const key of ['revision', 'cost', 'stones']) {
    if ((quote?.[key] ?? 0) !== (plan[key] ?? 0)) throw new Error(say('shop.refuse.stale'));
  }
}
function bump(run, plan) {
  run.shopStock.tradeRevision = plan.revision + 1;
}

const owned = (run) => [...(run.deck || []), ...(run.sideboard || [])].filter(Boolean);

/** Core (card ranks on): `upgradeArt` upgrades any deck card through the card-upgrade service (owner ruling 2026-10-28). */
export const coreCardUpgrades = (run) => run?.gameProfile?.modules?.progression?.cardRanks === true;
const upgradePlanOk = (plan) => plan.ok || plan.code === 'stones';

/** The cards a card upgrade could take now: every owned card with a next upgrade (a short purse still lists it). */
export function upgradeableArts(registries, run) {
  return owned(run).filter((card) => card && upgradePlanOk(planCardUpgrade(run, registries, card.instanceId)));
}

// ---------------------------------------------------------------------------
// Item upgrade
// ---------------------------------------------------------------------------

/**
 * The owned items the Blacksmith's item upgrade could act on now (Core 2): one row per weapon, shield, armour and
 * relic that still has an upgrade slot and an option to roll. A short purse still lists it; the quote says why.
 */
export function SmithUpgradeItems(registries, run) {
  return ownedSmithingItems(registries, run).map((row) => {
    const smith = PlanSmithUpgrade(run, row.itemRef);
    return { itemRef: row.itemRef, itemKind: row.itemKind, itemId: row.itemId, itemName: row.item?.name || '', used: smith.used, slots: smith.slots, nextLevel: smith.n, code: smith.code };
  }).filter((row) => row.itemName && row.code !== 'none' && row.code !== 'slots');
}

export function blacksmithUpgradePlan(registries, run, itemRef, { purse = 'stones', priceMult = 1 } = {}) {
  if (coreSmithingActive(run)) return coreUpgradePlan(registries, run, itemRef, { purse, priceMult });
  // Core: stones come off by the blacksmith's discount, and the work costs cinders by the tier it reaches.
  const candidate = smithingPlan(registries, run, undefined, { stoneDiscount: blacksmithStoneDiscount(run) }).candidates.find((row) => row.itemRef === itemRef) || null;
  const cost = candidate && blacksmithRules(run) ? cinders(tierUpgradePrice(run, candidate.nextLevel), priceMult) : 0;
  let reason = '';
  if (!blacksmithOffers(run, 'upgrade')) reason = say('blacksmith.refuse.notOffered');
  else if (purse !== 'stones') reason = say('blacksmith.refuse.notOffered');
  else if (!candidate) reason = say('blacksmith.refuse.upgradeNone', { name: armamentName(registries, itemRef) });
  else if (!candidate.affordable) reason = say('blacksmith.refuse.stones', { cost: candidate.cost, have: stones(run), plural: plural(candidate.cost) });
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return {
    ok: !reason, reason, itemRef, purse, candidate,
    stones: candidate ? candidate.cost : 0,
    cost, revision: blacksmithRevision(run),
  };
}

// Core 2 (W25 step 4): a choice of two or three rolled options, priced by the item's upgrade number (smithUpgrade.js).
function coreUpgradePlan(registries, run, itemRef, { purse, priceMult }) {
  const smith = PlanSmithUpgrade(run, itemRef, { priceMult });
  const name = ownedSmithingItems(registries, run).find((row) => row.itemRef === itemRef)?.item?.name || armamentName(registries, itemRef);
  let reason = '';
  if (!blacksmithOffers(run, 'upgrade') || purse !== 'stones') reason = say('blacksmith.refuse.notOffered');
  else if (smith.code === 'none') reason = say('blacksmith.refuse.upgradeNone', { name });
  else if (smith.code === 'slots') reason = say('blacksmith.refuse.slots', { name, used: smith.used, max: smith.slots });
  else if (smith.code === 'stones') reason = say('blacksmith.refuse.stones', { cost: smith.stones, have: stones(run), plural: plural(smith.stones) });
  else if (smith.code === 'cinders') reason = say('shop.refuse.cinders');
  return {
    ok: !reason, reason, itemRef, purse, name, smith, options: smith.options, n: smith.n,
    candidate: { itemRef, itemName: name, currentLevel: smith.used, nextLevel: smith.n, cost: smith.stones },
    stones: smith.stones, cost: smith.cinders, revision: blacksmithRevision(run),
  };
}

/** Commit the quote; `quote.optionId` names the option chosen (the first rolled when none is named). */
export function commitBlacksmithUpgrade(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = blacksmithUpgradePlan(registries, run, quote.itemRef, { purse: quote.purse, priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if (plan.smith) {
    if ((quote.n ?? plan.n) !== plan.n) throw new Error(say('shop.refuse.stale'));
    const optionId = quote.optionId ?? plan.options[0].id;
    const receipt = withSmithService(registries, run, () => ApplySmithUpgrade(run, plan.smith, optionId));
    bump(run, plan);
    return receipt;
  }
  // A Core run commits equipment upgrades only inside the Smith service; the stone price is smithingPlan's, less the discount.
  const receipt = withSmithService(registries, run, () => commitItemUpgrade(registries, run, plan.itemRef, undefined, { purse: plan.purse, stoneDiscount: blacksmithStoneDiscount(run) }));
  run.cinders -= plan.cost;
  bump(run, plan);
  return receipt;
}

// ---------------------------------------------------------------------------
// Category change (W25 step 5): 1 Smithing Stone and 75 cinders, part of the Smith service
// ---------------------------------------------------------------------------

/** Whether the item is a weapon the Blacksmith can give another category (it offers an upgrade service and the item has one). */
export const CanChangeCategory = (registries, run, itemRef) => coreSmithingActive(run) && blacksmithOffers(run, 'upgrade') && CategoryChoices(run, itemRef).length > 0;

/** The quote for turning `itemRef` into `category`, keeping the properties named by `keepKeys`. */
export function CategoryChangePlan(registries, run, itemRef, category, keepKeys = [], { priceMult = 1 } = {}) {
  const name = ownedSmithingItems(registries, run).find((row) => row.itemRef === itemRef)?.item?.name || armamentName(registries, itemRef);
  const plan = PlanCategoryChange(run, itemRef, category, keepKeys, { priceMult });
  let reason = '';
  if (!CanChangeCategory(registries, run, itemRef)) reason = say('blacksmith.refuse.categoryNone', { name });
  else if (plan.code === 'category') reason = say('blacksmith.refuse.categoryNone', { name });
  else if (plan.code === 'keep') reason = say('shop.refuse.stale');
  else if (plan.code === 'keepMany') reason = say('blacksmith.refuse.keepMany', { max: plan.keepLimit });
  else if (plan.code === 'keepOne') reason = say('blacksmith.refuse.keepOne');
  else if (plan.code === 'stones') reason = say('blacksmith.refuse.stones', { cost: plan.stones, have: stones(run), plural: plural(plan.stones) });
  else if (plan.code === 'cinders') reason = say('shop.refuse.cinders');
  return { ...plan, ok: !reason, reason, name, cost: plan.cinders, revision: blacksmithRevision(run) };
}

export function CommitCategoryChange(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = CategoryChangePlan(registries, run, quote.itemRef, quote.category, quote.keep, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  // The properties rolled are the ones the quote showed, or the quote is stale.
  if (JSON.stringify(quote.newProperties?.map((row) => row.id) ?? plan.newProperties.map((row) => row.id)) !== JSON.stringify(plan.newProperties.map((row) => row.id))) throw new Error(say('shop.refuse.stale'));
  const receipt = withSmithService(registries, run, () => ApplyCategoryChange(run, plan));
  run.shopStock.tradeRevision = plan.revision + 1;
  return receipt;
}

// ---------------------------------------------------------------------------
// Item rank-up (W25 step 6): one more upgrade slot on an item, at the card rank-up's price
// ---------------------------------------------------------------------------

/** Quote for ranking `itemRef` up: +1 upgrade slot for the rank-up price (cinders and stones), until the slot ceiling. */
export function ItemRankUpPlan(registries, run, itemRef, { priceMult = 1 } = {}) {
  const rules = blacksmithRules(run);
  const name = ownedSmithingItems(registries, run).find((row) => row.itemRef === itemRef)?.item?.name || armamentName(registries, itemRef);
  // Owner 2026-11-23: the price is the rank-up price times the rank reached.
  const price = cinders(RankUpPrice(blacksmithPrices(run).rankUp, ItemRank(run, itemRef) + 1), priceMult);
  const need = Number.isSafeInteger(rules?.rankUpStones) && rules.rankUpStones > 0 ? rules.rankUpStones : 0;
  const slots = SmithUpgradeSlots(run, itemRef);
  let reason = '';
  if (!coreSmithingActive(run) || !blacksmithOffers(run, 'upgrade') || !rules) reason = say('blacksmith.refuse.notOffered');
  else if (slots >= ITEM_SMITH.maxSlots) reason = say('blacksmith.refuse.rankMax', { name });
  else if (stones(run) < need) reason = say('blacksmith.refuse.stones', { cost: need, have: stones(run), plural: plural(need) });
  else if (!affordable(run, price)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, itemRef, name, from: ItemRank(run, itemRef), to: ItemRank(run, itemRef) + 1, slots, used: ItemUpgradeCount(run, itemRef), stones: need, cost: price, revision: blacksmithRevision(run) };
}

export function CommitItemRankUp(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = ItemRankUpPlan(registries, run, quote.itemRef, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const receipt = withSmithService(registries, run, () => {
    run.itemRanks = { ...(run.itemRanks || {}), [plan.itemRef]: plan.to };
    run.smithingStones = stones(run) - plan.stones;
    run.cinders -= plan.cost;
    return { itemRef: plan.itemRef, rank: plan.to, slots: plan.slots + 1, spentStones: plan.stones, spent: plan.cost };
  });
  bump(run, plan);
  return receipt;
}

// ---------------------------------------------------------------------------
// Card upgrade
// ---------------------------------------------------------------------------

export function upgradeArtPlan(registries, run, instanceId, { priceMult = 1 } = {}) {
  const card = owned(run).find((row) => row.instanceId === instanceId) || null;
  const verdict = card ? planCardUpgrade(run, registries, instanceId, { vendor: 'blacksmith' }) : null;
  // The blacksmith takes its stone discount off the service's price (Free stays free; 1 stone becomes 0).
  const due = verdict ? Math.max(0, (verdict.cost ?? 0) - blacksmithStoneDiscount(run)) : 0;
  const payable = !!verdict && (verdict.ok || (verdict.code === 'stones' && stones(run) >= due));
  const cost = blacksmithRules(run) && card
    ? cinders(CardUpgradePrice(run, { upgrades: upgradeCount(card), rank: InstanceRank(card) }), priceMult) : 0;
  let reason = '';
  if (!blacksmithOffers(run, 'upgradeArt')) reason = say('blacksmith.refuse.notOffered');
  else if (!card) reason = say('shop.refuse.gone');
  else if (!payable) reason = verdict.reason;
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, instanceId, stones: due, cost, revision: blacksmithRevision(run), cardQuote: verdict };
}


/**
 * Whether Blacksmith work on this card also raises its rank (W25 step 3): `blacksmith.upgradeRankChance` percent,
 * rolled on the run's seed, the card, its upgrade number and the visit's offer key, so it is the same however often it is asked during the stay.
 */
export function UpgradeGrantsRank(run, instance) {
  return upgradeGrantsRankAt(run, instance, Array.isArray(instance?.upgradeSteps) ? instance.upgradeSteps.length : 0);
}
function upgradeGrantsRankAt(run, instance, steps) {
  const chance = blacksmithRules(run)?.upgradeRankChance;
  if (!(chance > 0) || !instance || EquipmentBound(instance)) return false;
  return mulberry32(upgradeSeed(run.seed, OfferSalted(run, `${instance.instanceId}#rankChance`), steps))() * 100 < chance;
}

export function commitUpgradeArt(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = upgradeArtPlan(registries, run, quote.instanceId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
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
  // The work may also raise the card's rank (rolled before the step was added: the count it had when quoted).
  const card = owned(run).find((row) => row.instanceId === receipt.instanceId);
  const ranked = !!card && InstanceRank(card) < RANK_CEILING && upgradeGrantsRankAt(run, card, receipt.n - 1);
  if (ranked) card.rank = OwnCardRank(card) + 1;
  return { instanceId: receipt.instanceId, spentStones: receipt.spentStones - lent, step: receipt.step, n: receipt.n, ...(ranked ? { rankedUp: card.rank } : {}) };
}

// ---------------------------------------------------------------------------
// Rank-up (Core only): one more rank on an owned card, for cinders and a stone
// ---------------------------------------------------------------------------

// The shared rank rules live in rankUpService.js, so a combat reward, a shop and an event raise a card the same way.

/** The cards a rank-up could raise now: owned, run-owned (not equipment-bound), below the rank ceiling. */
export function rankUpCards(registries, run) {
  return RankUpCandidates(registries, run);
}

export function rankUpPlan(registries, run, instanceId, { priceMult = 1 } = {}) {
  const card = owned(run).find((row) => row.instanceId === instanceId) || null;
  const rules = blacksmithRules(run);
  // Owner 2026-11-23: the price is the rank-up price times the rank the card reaches (Rank 1 once, Rank 5 five times).
  const price = cinders(RankUpPrice(blacksmithPrices(run).rankUp, OwnCardRank(card) + 1), priceMult);
  const need = Number.isSafeInteger(rules?.rankUpStones) && rules.rankUpStones > 0 ? rules.rankUpStones : 0;
  const name = card ? cardName(registries, card.cardId) : '';
  let reason = '';
  if (!coreCardUpgrades(run) || !blacksmithOffers(run, 'rankUp') || !rules) reason = say('blacksmith.refuse.notOffered');
  else if (!card) reason = say('shop.refuse.gone');
  else if (EquipmentBound(card) || !registries.cards.has(card.cardId)) reason = say('blacksmith.refuse.rankNone', { name });
  else if (InstanceRank(card) >= RANK_CEILING) reason = say('blacksmith.refuse.rankMax', { name });
  else if (RankUpBlock(run, card)) reason = RankUpBlock(run, card);
  else if (stones(run) < need) reason = say('blacksmith.refuse.stones', { cost: need, have: stones(run), plural: plural(need) });
  else if (!affordable(run, price)) reason = say('shop.refuse.cinders');
  const from = OwnCardRank(card); // an unranked card reads 0 and rises to Rank 1
  return { ok: !reason, reason, instanceId, name, from, to: from + 1, stones: need, cost: price, revision: blacksmithRevision(run) };
}

export function commitRankUp(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = rankUpPlan(registries, run, quote.instanceId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if ((quote.from ?? plan.from) !== plan.from) throw new Error(say('shop.refuse.stale'));
  RaiseCardRank(registries, run, plan.instanceId);
  run.smithingStones = stones(run) - plan.stones;
  run.cinders -= plan.cost;
  bump(run, plan);
  return { instanceId: plan.instanceId, rank: plan.to, spentStones: plan.stones, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Which services can act now (SPEC §14.4, coordinator ruling on #1378)
// ---------------------------------------------------------------------------

/**
 * serviceCandidates(registries, run, id) → what service `id` could act on now, for the screen. Affordability is not
 * asked: a price the purse cannot meet is a refusal, not an empty service.
 */
export function serviceCandidates(registries, run, id) {
  switch (id) {
    case 'upgrade': return coreSmithingActive(run) ? SmithUpgradeItems(registries, run) : smithingPlan(registries, run).candidates;
    case 'upgradeArt': return upgradeableArts(registries, run);
    case 'rankUp': return rankUpCards(registries, run);
    case 'cardCopy': return CardCopyUsesLeft(run.shopStock?.cardCopy) > 0 ? CardCopyCandidates(registries, run) : [];
    default: return [];
  }
}

/** The sentence a service with nothing to act on shows (uiStrings `blacksmith.idle.<id>`). */
/**
 * CardCopyPlan(registries, run, instanceId) → the quote for copying owned card `instanceId` at this Blacksmith's copy shelf
 * (owner 2026-11-20): `{ ok, reason, instanceId, name, cost, stones: 0, usesLeft, revision }`.
 */
export function CardCopyPlan(registries, run, instanceId) {
  const shelf = run.shopStock?.cardCopy || null;
  const card = CardCopyCandidates(registries, run).find((row) => row.instanceId === instanceId) || null;
  // The shelf's cost is an unranked card's; a ranked card costs +rankPricePct% per visible rank (owner, 2026-11-23).
  const cost = Number.isSafeInteger(shelf?.cost) ? CardCopyPrice(run, shelf.cost, card) : 0;
  const usesLeft = CardCopyUsesLeft(shelf);
  const name = card ? cardName(registries, card.cardId) : '';
  let reason = '';
  if (!blacksmithOffers(run, 'cardCopy') || !shelf) reason = say('blacksmith.refuse.notOffered');
  else if (usesLeft < 1) reason = say('blacksmith.idle.cardCopy');
  else if (!card) reason = say('shop.refuse.gone');
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, instanceId, name, cost, stones: 0, usesLeft, revision: run.shopStock?.tradeRevision || 0 };
}

/** CommitCardCopy(registries, run, quote) → { instance, spent }. The copy lands in the library; the shelf loses one use. */
export function CommitCardCopy(registries, run, quote) {
  const plan = CardCopyPlan(registries, run, quote.instanceId);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  const instance = CopyOwnedCard(registries, run, plan.instanceId);
  run.cinders -= plan.cost;
  run.shopStock.cardCopy = { ...run.shopStock.cardCopy, usesLeft: plan.usesLeft - 1 };
  bump(run, plan);
  return { instance, instanceId: instance.instanceId, id: instance.cardId, spent: plan.cost };
}

export function serviceIdleReason(id) {
  if (id === 'upgradeArt') return say('blacksmith.idle.upgradeCard');
  return say(`blacksmith.idle.${id}`);
}
