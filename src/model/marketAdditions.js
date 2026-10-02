// src/model/marketAdditions.js — what the market sells beyond today's shelves
// (SPEC §14.3, §14.6 step 5a), headless.
//
// Each addition is an offering in content/shops.js whose stock the visit rolls
// on `shopOffers` (engine/shopKinds.js) and persists on the stock beside the
// shelves, so a reload neither rerolls it nor restores what was sold. This file
// owns the purchases, in the shape armamentTrading.js already uses: a PLAN is
// inert and names its refusal in words; a COMMIT re-plans, refuses a quote
// that no longer matches (`tradeRevision`, the price), and only then mutates.
//
//   smithStones  priced per stone, a per-visit stock; adds to run.smithingStones
//   armour       armour sets of the run's class it does not own; the bought
//                set joins `run.loadout.boughtArmour`, which ownership() reads
//   sigils       non-legendary sigils the run does not carry; into run.sigils
//   innRest      a full rest through the inn's own location visit, once per
//                visit, refused by name under a `restDenied` relic. The plan is
//                here; the commit runs the visit, so it is the engine's
//                (engine/shopKinds.js commitInnRest).
import { ownership } from './loadout.js';
import { shopSentence, shopStockOfferings } from './shopKinds.js';
import { restDeniedBy, locationTags, locationRestTags, INN_LOCATION } from './locations.js';
import { ownedSigilIds } from './sigils.js';

// The shapes of what these purchases write, and the list of additions, are a
// leaf of their own: model/marketStock.js.

export const revision = (run) => run.shopStock?.tradeRevision || 0;
const say = (id, tokens = {}) => shopSentence(id, tokens);
const offered = (run, id) => !!run.shopStock && shopStockOfferings(run.shopStock).includes(id);
const affordable = (run, cost) => Number.isSafeInteger(run.cinders) && run.cinders >= cost;
const priced = (cost) => Number.isSafeInteger(cost) && cost > 0;

export function stale(quote, plan) {
  if (quote.revision !== plan.revision || quote.cost !== plan.cost) throw new Error(say('shop.refuse.stale'));
}

/** The armour row a stock offer names, by its `{ classId, id }` (armour ids repeat across classes). */
export function armourPiece(registries, item) {
  return (registries.equipment.armour || []).find((row) => row.classId === item.classId && row.id === item.id) || null;
}

// ---------------------------------------------------------------------------
// Smithing Stones
// ---------------------------------------------------------------------------

export function smithStonePurchasePlan(registries, run, count = 1) {
  const shelf = run.shopStock?.smithStones;
  const n = Number(count);
  const cost = shelf && Number.isSafeInteger(n) ? shelf.price * n : NaN;
  let reason = '';
  if (!offered(run, 'smithStones') || !shelf) reason = say('shop.refuse.notOffered');
  else if (!(Number.isSafeInteger(n) && n > 0)) reason = say('shop.refuse.stones', { left: shelf.left, count });
  else if (n > shelf.left) reason = say('shop.refuse.stones', { left: shelf.left, count: n });
  else if (!priced(cost)) reason = say('shop.refuse.unpriced');
  else if (!affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, count: n, price: shelf?.price, cost, revision: revision(run) };
}

export function commitSmithStonePurchase(registries, run, quote) {
  const plan = smithStonePurchasePlan(registries, run, quote.count);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.smithingStones = (run.smithingStones || 0) + plan.count;
  run.cinders -= plan.cost;
  run.shopStock.smithStones.left -= plan.count;
  run.shopStock.tradeRevision = plan.revision + 1;
  return { count: plan.count, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Armour
// ---------------------------------------------------------------------------

export function armourPurchasePlan(registries, run, item, { meta = {} } = {}) {
  const piece = item ? armourPiece(registries, item) : null;
  let reason = '';
  if (!offered(run, 'armour') || !item || !(run.shopStock.armour || []).includes(item)) reason = say('shop.refuse.gone');
  else if (!piece || !priced(item.cost)) reason = say('shop.refuse.unpriced');
  // Stocked for another class (the Turncoat's Mirror changed `run.class`
  // since): refused by name, never sold as the run's own set.
  else if (item.classId !== run.class) reason = say('shop.refuse.armourClass', { name: piece.name });
  else if (!run.loadout) reason = say('shop.refuse.noLoadout');
  else if (ownership(registries, { meta, loadout: run.loadout }).has(piece)) reason = say('shop.refuse.armourOwned', { name: piece.name });
  else if (!affordable(run, item.cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, item, piece, cost: item?.cost, revision: revision(run) };
}

export function commitArmourPurchase(registries, run, quote, { meta = {} } = {}) {
  const plan = armourPurchasePlan(registries, run, quote.item, { meta });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.loadout.boughtArmour = [...(run.loadout.boughtArmour || []), { classId: plan.piece.classId, id: plan.piece.id }];
  run.cinders -= plan.cost;
  run.shopStock.armour.splice(run.shopStock.armour.indexOf(plan.item), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.piece.id, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Sigils
// ---------------------------------------------------------------------------

export function sigilPurchasePlan(registries, run, item) {
  const def = item && registries.sigils.has(item.id) ? registries.sigils.get(item.id) : null;
  let reason = '';
  if (!offered(run, 'sigils') || !item || !(run.shopStock.sigils || []).includes(item)) reason = say('shop.refuse.gone');
  else if (!def || !priced(item.cost)) reason = say('shop.refuse.unpriced');
  // Defence in depth (SPEC §15.4, rarity at every door): a legendary is never
  // shop stock, so a shelf a hand edit filled cannot sell one.
  else if (def.rarity === 'legendary') reason = say('shop.refuse.sigilLegendary', { name: def.name });
  else if (ownedSigilIds(run).includes(item.id)) reason = say('shop.refuse.sigilOwned', { name: def.name });
  else if (!affordable(run, item.cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, item, def, cost: item?.cost, revision: revision(run) };
}

export function commitSigilPurchase(registries, run, quote) {
  const plan = sigilPurchasePlan(registries, run, quote.item);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.sigils = [...(run.sigils || []), plan.item.id];
  run.cinders -= plan.cost;
  run.shopStock.sigils.splice(run.shopStock.sigils.indexOf(plan.item), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.item.id, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Inn rest
// ---------------------------------------------------------------------------

/**
 * innRestPlan(registries, run) → the quote for a full rest bought here. The
 * `restDenied` refusal reads the inn's own tag set (its carrier), the set its
 * bed is judged by, so the market refuses exactly what the inn refuses.
 */
export function innRestPlan(registries, run) {
  const offer = run.shopStock?.innRest;
  const deniedBy = restDeniedBy(registries, run, locationRestTags(registries, locationTags(registries, INN_LOCATION)));
  let reason = '';
  if (!offered(run, 'innRest') || !offer) reason = say('shop.refuse.notOffered');
  else if (offer.bought) reason = say('shop.refuse.innBought');
  else if (deniedBy) reason = say('shop.refuse.innDenied', { relic: registries.relics.get(deniedBy).name });
  else if (!priced(offer.price)) reason = say('shop.refuse.unpriced');
  else if (!affordable(run, offer.price)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, cost: offer?.price, deniedBy, revision: revision(run) };
}

// ---------------------------------------------------------------------------
// Skill books and revive tokens (SPEC §14.3, step 5b)
// ---------------------------------------------------------------------------

const CONSUMABLE_SHELVES = Object.freeze({ skillBooks: 'skillBook', reviveTokens: 'revive' });

/** A book or token off its shelf: plus one to its count in `run.consumables`. */
export function consumablePurchasePlan(registries, run, shelf, item) {
  const kind = CONSUMABLE_SHELVES[shelf];
  const def = item && registries.consumables.has(item.id) ? registries.consumables.get(item.id) : null;
  let reason = '';
  if (!kind || !offered(run, shelf) || !item || !(run.shopStock[shelf] || []).includes(item)) reason = say('shop.refuse.gone');
  else if (!def || def.kind !== kind || !priced(item.cost)) reason = say('shop.refuse.unpriced');
  else if (!affordable(run, item.cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, shelf, item, def, cost: item?.cost, revision: revision(run) };
}

export function commitConsumablePurchase(registries, run, shelf, quote) {
  const plan = consumablePurchasePlan(registries, run, shelf, quote.item);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.consumables = { ...(run.consumables || {}) };
  run.consumables[plan.item.id] = (run.consumables[plan.item.id] || 0) + 1;
  run.cinders -= plan.cost;
  run.shopStock[shelf].splice(run.shopStock[shelf].indexOf(plan.item), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.item.id, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Companions
// ---------------------------------------------------------------------------

export function companionPurchasePlan(registries, run, item) {
  const def = item && registries.companions.has(item.id) ? registries.companions.get(item.id) : null;
  let reason = '';
  if (!offered(run, 'companions') || !item || !(run.shopStock.companions || []).includes(item)) reason = say('shop.refuse.gone');
  else if (!def || !priced(item.cost)) reason = say('shop.refuse.unpriced');
  else if ((run.companions || []).some((row) => row.id === item.id)) reason = say('shop.refuse.companionHas', { name: def.name });
  else if (!affordable(run, item.cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, item, def, cost: item?.cost, revision: revision(run) };
}

/** Appends `{ id, combatsLeft: combats }` (one of each travels at a time). */
export function commitCompanionPurchase(registries, run, quote) {
  const plan = companionPurchasePlan(registries, run, quote.item);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  run.companions = [...(run.companions || []), { id: plan.def.id, combatsLeft: plan.def.combats }];
  run.cinders -= plan.cost;
  run.shopStock.companions.splice(run.shopStock.companions.indexOf(plan.item), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.def.id, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// The quest event
// ---------------------------------------------------------------------------

/**
 * questEventPlan(registries, run) → the quote for following the market's
 * event. Refused by name when taken, when the run has seen the event since
 * the shelf was stocked, or when the purse is short.
 */
export function questEventPlan(registries, run) {
  const offer = run.shopStock?.questEvent;
  let reason = '';
  if (!offered(run, 'questEvent') || !offer) reason = say('shop.refuse.notOffered');
  else if (offer.taken) reason = say('shop.refuse.questTaken');
  else if (!registries.events.has(offer.eventId)) reason = say('shop.refuse.gone');
  else if ((run.seenEvents || []).includes(offer.eventId)) reason = say('shop.refuse.questSeen');
  else if (!priced(offer.price)) reason = say('shop.refuse.unpriced');
  else if (!affordable(run, offer.price)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, eventId: offer?.eventId, cost: offer?.price, revision: revision(run) };
}

/**
 * commitQuestEvent(registries, run, quote) → { eventId, spent }. Spends the
 * price, marks the offer taken and the event seen. The host then closes the
 * visit as Leave does and opens the event door (main.js showShop), so the
 * door opens once.
 */
export function commitQuestEvent(registries, run, quote) {
  const plan = questEventPlan(registries, run);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan);
  if (quote.eventId !== plan.eventId) throw new Error(say('shop.refuse.stale'));
  run.cinders -= plan.cost;
  run.shopStock.questEvent.taken = true;
  run.seenEvents = [...(run.seenEvents || []), plan.eventId];
  run.shopStock.tradeRevision = plan.revision + 1;
  return { eventId: plan.eventId, spent: plan.cost };
}
