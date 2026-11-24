// src/model/cardCopyService.js — "copy a card" as a service (owner 2026-11-20).
//
// Rewards never offer a card the player already owns (deck or library), so this service is the one way to hold a
// second copy. Three doors offer it:
//   - a relic whose `passives.cardCopyOnPickup` is N grants N one-time copies when it is picked up; each opens the usual
//     reward door listing every card the player owns (`StartCardCopyOffer`), and a skipped door spends the chance;
//   - some traders stock a copy shelf (shops.json `cardCopy.stockChancePct`), with limited uses;
//   - some Blacksmiths lay out a copy shelf (shops.json `blacksmith.cardCopy`), with limited uses.
// Pure model: no document. Every chance rolls on a hash of the run's seed and the door's key (like rankUpService.js), so
// asking twice answers the same, no shared stream moves, and a save made before this service (no `cardCopy` data, no
// `pendingCardCopies`) offers nothing and loads unchanged.
import { gameContent } from './gameProfile.js';
import { mulberry32 } from './rng.js';
import { upgradeSeed } from './cardUpgradeSteps.js';
import { EquipmentBound } from './rankUpService.js';
import { OwnCardRank } from './cardRank.js';
import { RankedCardPrice } from './rankedCardPrice.js';

/** The option a reward door or a trader shelf carries for this service. */
export const CARD_COPY_OPTION = Object.freeze({ kind: 'cardCopies', id: 'cardCopy' });
/** The source of the door a copy relic opens (its options are `combatCards` rows naming the instance they copy). */
export const CARD_COPY_SOURCE = 'copy';

const ownedCards = (run) => [...(run?.deck || []), ...(run?.sideboard || [])].filter(Boolean);
const variantKey = (card) => JSON.stringify([card.cardId, !!card.upgraded, OwnCardRank(card), card.upgradeSteps || null]);

/**
 * CardCopyCandidates(registries, run) -> one owned instance per distinct card variant (deck first, then library), each a
 * run-owned card the registry knows. Equipment-bound cards (a worn weapon's arts) come with their item and are never copied.
 */
export function CardCopyCandidates(registries, run) {
  const seen = new Set(), out = [];
  for (const card of ownedCards(run)) {
    if (EquipmentBound(card) || !card.cardId || !registries.cards.has(card.cardId)) continue;
    const key = variantKey(card);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

/** The ids already held by any instance, so a new copy's id never collides. */
function freshInstanceId(run, cardId) {
  const taken = new Set(ownedCards(run).map((card) => card.instanceId));
  let n = 1;
  while (taken.has(`copy:${n}:${cardId}`)) n++;
  return `copy:${n}:${cardId}`;
}

/**
 * CopyOwnedCard(registries, run, instanceId) -> the new instance. Mutates `run` (callers wanting all-or-nothing hand a
 * clone): the copy keeps the source's upgrade, rank and upgrade steps and lands in the library (`run.sideboard`).
 */
export function CopyOwnedCard(registries, run, instanceId) {
  const source = ownedCards(run).find((card) => card.instanceId === instanceId);
  if (!source || EquipmentBound(source) || !registries.cards.has(source.cardId)) throw new Error('That card cannot be copied.');
  const copy = { ...structuredClone(source), instanceId: freshInstanceId(run, source.cardId) };
  run.sideboard = [...(Array.isArray(run.sideboard) ? run.sideboard : []), copy];
  return copy;
}

// ---- the copy relic ---------------------------------------------------------------------------------------------------

/** How many one-time copies relic `relicId` grants when picked up (`passives.cardCopyOnPickup`; absent = 0). */
export function RelicCardCopies(registries, relicId) {
  const n = registries.relics.has(relicId) ? registries.relics.get(relicId)?.passives?.cardCopyOnPickup : 0;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** On pickup: queue the relic's copies (`run.pendingCardCopies`, absent on an older save = 0). Returns how many it added. */
export function GrantRelicCardCopies(registries, run, relicId) {
  const n = RelicCardCopies(registries, relicId);
  if (n) run.pendingCardCopies = (Number.isSafeInteger(run.pendingCardCopies) ? run.pendingCardCopies : 0) + n;
  return n;
}

/**
 * StartCardCopyOffer(registries, run) -> the offer id of a fresh copy door, or '' when no copy is waiting. Spends one
 * queued copy and saves the door as an ordinary reward offer (source 'copy', take 1): one `combatCards` option per
 * candidate, carrying `copyOf` (the instance it copies). With nothing to copy the queued chance is spent and '' returned.
 */
export function StartCardCopyOffer(registries, run) {
  const waiting = Number.isSafeInteger(run.pendingCardCopies) ? run.pendingCardCopies : 0;
  if (waiting < 1) return '';
  run.pendingCardCopies = waiting - 1;
  if (!run.pendingCardCopies) delete run.pendingCardCopies;
  const candidates = CardCopyCandidates(registries, run);
  if (!candidates.length) return '';
  run.gameProfileRewardOffers ||= {};
  let ordinal = 1;
  while (run.gameProfileRewardOffers[`copy:${ordinal}`]) ordinal++;
  const offerId = `copy:${ordinal}`;
  const options = candidates.map((card) => ({ kind: 'combatCards', id: card.cardId, copyOf: card.instanceId,
    ...(card.upgraded ? { upgraded: true } : {}), ...(OwnCardRank(card) ? { rank: OwnCardRank(card) } : {}) }));
  run.gameProfileRewardOffers[offerId] = { id: offerId, source: CARD_COPY_SOURCE, options, takeCount: 1, taken: [], claimed: null };
  return offerId;
}

// ---- the vendor service -----------------------------------------------------------------------------------------------

/** Whether a percent chance hits, on a hash of the run's seed and the door's key. */
export function RollCardCopy(run, key, chancePct) {
  if (!(chancePct > 0)) return false;
  if (chancePct >= 100) return true;
  return mulberry32(upgradeSeed(run.seed, `cardCopy:${key}`, 0))() * 100 < chancePct;
}

/**
 * CardCopyRule(run, door) -> { chancePct, uses, price } for door 'trader' (shops.json `cardCopy`) or 'blacksmith'
 * (shops.json `blacksmith.cardCopy`), or null when the profile authors none (the service is off).
 */
export function CardCopyRule(run, door) {
  const shops = gameContent(run, 'shops');
  const row = door === 'blacksmith' ? shops?.blacksmith?.cardCopy : shops?.cardCopy;
  if (!row || typeof row !== 'object') return null;
  const chancePct = Number.isFinite(row.stockChancePct) ? Math.max(0, Math.min(100, row.stockChancePct)) : 0;
  const uses = Number.isSafeInteger(row.uses) && row.uses > 0 ? row.uses : 1;
  const price = Number.isSafeInteger(row.price) && row.price >= 0 ? row.price : 0;
  return { chancePct, uses, price };
}

/** Whether this vendor (door 'trader' | 'blacksmith', key: the shop's id) stocks the copy service. */
export function VendorStocksCardCopy(registries, run, door, shopId) {
  const rule = CardCopyRule(run, door);
  return !!rule && CardCopyCandidates(registries, run).length > 0 && RollCardCopy(run, `${door}:${shopId}`, rule.chancePct);
}

/** The shelf a vendor stocks: `{ ...CARD_COPY_OPTION, price, usesLeft }` (price already scaled by `priceMult`). */
export function CardCopyShelf(run, door, { priceMult = 1 } = {}) {
  const rule = CardCopyRule(run, door);
  return { ...CARD_COPY_OPTION, price: priceMult === 1 ? rule.price : Math.ceil(rule.price * priceMult), usesLeft: rule.uses };
}

/** The uses a saved shelf has left (an absent count reads 1, so a shelf saved without one still sells once). */
/**
 * CardCopyPrice(run, shelfPrice, card) -> what copying `card` costs (owner, 2026-11-23): the shelf's price raised
 * `rankPricePct` percent per rank the card shows (rankedCardPrice.js). The shelf price is the "from" price, an unranked card's.
 */
export const CardCopyPrice = (run, shelfPrice, card) => RankedCardPrice(run, shelfPrice, card);
export const CardCopyUsesLeft = (shelf) => (Number.isSafeInteger(shelf?.usesLeft) ? Math.max(0, shelf.usesLeft) : 1);
