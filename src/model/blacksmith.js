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
import { smithingPlan, commitItemUpgrade, withSmithService } from './smithing.js';
import { planCardUpgrade, commitCardUpgrade } from './cardUpgradeService.js';
import { blacksmithRules, blacksmithStoneDiscount, blacksmithPrices, tierUpgradePrice } from './blacksmithConfig.js';

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

export function blacksmithUpgradePlan(registries, run, itemRef, { purse = 'stones', priceMult = 1 } = {}) {
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
// Card upgrade
// ---------------------------------------------------------------------------

export function upgradeArtPlan(registries, run, instanceId, { priceMult = 1 } = {}) {
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
  return { instanceId: receipt.instanceId, spentStones: receipt.spentStones - lent, step: receipt.step, n: receipt.n };
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
// Which services can act now (SPEC §14.4, coordinator ruling on #1378)
// ---------------------------------------------------------------------------

/**
 * serviceCandidates(registries, run, id) → what service `id` could act on now, for the screen. Affordability is not
 * asked: a price the purse cannot meet is a refusal, not an empty service.
 */
export function serviceCandidates(registries, run, id) {
  switch (id) {
    case 'upgrade': return smithingPlan(registries, run).candidates;
    case 'upgradeArt': return upgradeableArts(registries, run);
    case 'rankUp': return rankUpCards(registries, run);
    default: return [];
  }
}

/** The sentence a service with nothing to act on shows (uiStrings `blacksmith.idle.<id>`). */
export function serviceIdleReason(id) {
  if (id === 'upgradeArt') return say('blacksmith.idle.upgradeCard');
  return say(`blacksmith.idle.${id}`);
}
