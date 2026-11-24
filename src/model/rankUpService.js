// src/model/rankUpService.js — "rank up a card" as a service any door can offer (W25-R, owner 2026-11-14:
// "Blacksmiths and sometimes shop owners or event rewards or combat rewards has a chance to increase rank").
//
// The Blacksmith's rank-up (blacksmith.js commitRankUp) raises one owned card by one rank for cinders and a stone. The same
// raise is a service here, so a combat reward, a shop shelf and an event can offer it without a Blacksmith. Pure model:
// no document, no timers. Every chance reads the profile's data (rewards.json `rankUp`, shops.json `rankUp`) and rolls on
// a hash of the run's seed and the door's own key, never on a shared stream, so asking twice answers the same and a saved
// run with no `rankUp` data (or one made before this service) offers nothing and loads unchanged.
import { gameContent, gameModule } from './gameProfile.js';
import { uiStrings } from '../content/generated/uiStrings.js';
import { paidUpgradeCount } from './cardUpgrade.js';
import { UpgradeSlots } from './cardUpgradeLimits.js';
import { mulberry32 } from './rng.js';
import { OwnCardRank } from './cardRank.js';
import { upgradeSeed } from './cardUpgradeSteps.js';
import { blacksmithPrices } from './blacksmithConfig.js';

/** The rank a card cannot pass (state.js MAX_CARD_RANK; not imported, state.js pulls the whole run schema into this module). */
export const RANK_CEILING = 99;
/** The option an offer or a shop shelf carries for this service. */
export const RANK_UP_OPTION = Object.freeze({ kind: 'rankUps', id: 'cardRank' });

/** Core 2 (card ranks on) is the only profile that ranks cards. */
export const CardRanksOn = (run) => run?.gameProfile?.modules?.progression?.cardRanks === true;
/** A card's rank (an absent rank reads 1). */
export const InstanceRank = (card) => (Number.isInteger(card?.rank) && card.rank >= 1 ? card.rank : 1);
/**
 * The "Rank-up needs a fully upgraded card" rule (owner, 2026-11-23; progression module `rankUpNeedsFullUpgrades`, on unless
 * set false): with card ranks on, a card ranks up only once every upgrade slot it has is used (unranked 1, Rank 2 3, ...).
 * A rank-up bonus step uses no slot (paidUpgradeCount).
 */
export const RankUpNeedsFullUpgrades = (run) => CardRanksOn(run) && gameModule(run, 'progression')?.rankUpNeedsFullUpgrades !== false;
const sentence = (id) => uiStrings.find((row) => row.id === id)?.short || id;
/** RankUpBlock(run, card) -> '' when the card may rank up now, else the short reason it may not (the rule above). */
export function RankUpBlock(run, card) {
  return RankUpNeedsFullUpgrades(run) && paidUpgradeCount(card) < UpgradeSlots(run, card) ? sentence('rankUp.needsFull') : '';
}
/** The candidates that may rank up now: RankUpCandidates less those the full-upgrade rule holds back (shown, but disabled). */
/** The reason a door's rank-up waits when every candidate is held back by the full-upgrade rule. */
export const RankUpReadyReason = () => sentence('rankUp.noneReady');
export const RankUpReady = (registries, run) => RankUpCandidates(registries, run).filter((card) => !RankUpBlock(run, card));
/** Cards bound to equipment are raised through their item, never directly. */
export const EquipmentBound = (card) => !!card && (!!card.sourceArmamentId || !!card.grantedBy || card.equipmentRole === 'granted' || card.equipmentRole === 'weaponArt');
const ownedCards = (run) => [...(run?.deck || []), ...(run?.sideboard || [])].filter(Boolean);

/** The cards a rank-up could raise now: owned, run-owned (not equipment-bound), known to the registry, below the ceiling. */
export function RankUpCandidates(registries, run) {
  if (!CardRanksOn(run)) return [];
  return ownedCards(run).filter((card) => !EquipmentBound(card) && registries.cards.has(card.cardId) && InstanceRank(card) < RANK_CEILING);
}

/**
 * RaiseCardRank(registries, run, instanceId) -> { instanceId, rank }. Raises that owned card by one rank, mutating `run`
 * (callers wanting an all-or-nothing change hand a clone). Throws when the card is not a candidate. The one place a
 * rank-up lands: the Blacksmith's and every other door's.
 */
export function RaiseCardRank(registries, run, instanceId) {
  const card = RankUpCandidates(registries, run).find((row) => row.instanceId === instanceId);
  if (!card) throw new Error('That card cannot be ranked up.');
  const blocked = RankUpBlock(run, card);
  if (blocked) throw new Error(blocked);
  card.rank = OwnCardRank(card) + 1; // owner 2026-11-23: an unranked card becomes Rank 1, so each rank-up opens one slot
  return { instanceId: card.instanceId, rank: card.rank };
}

/** Whether a percent chance hits, rolled on a hash of the run's seed and the door's key (the same answer however often it is asked). */
export function RollRankUp(run, key, chancePct) {
  if (!(chancePct > 0)) return false;
  if (chancePct >= 100) return true;
  return mulberry32(upgradeSeed(run.seed, `rankUp:${key}`, 0))() * 100 < chancePct;
}

const wholePct = (n) => (Number.isFinite(n) && n > 0 ? Math.min(100, n) : 0);

/** The percent chance a won fight (pool 'normal' | 'elite' | 'boss') adds a rank-up to its reward (rewards.json `rankUp.chancePct`; missing = 0). */
export const CombatRankUpChance = (run, pool) => (CardRanksOn(run) ? wholePct(gameContent(run, 'rewards')?.rankUp?.chancePct?.[pool]) : 0);
/** The percent chance a won fight's rank-up comes as an extra pick beside the card pick, not instead of it (rewards.json `rankUp.bonusPickPct`; missing = 0, the rank-up uses the pick). */
export const CombatRankUpBonusChance = (run) => (CardRanksOn(run) ? wholePct(gameContent(run, 'rewards')?.rankUp?.bonusPickPct) : 0);
/** Whether this won fight's rank-up is a bonus pick (key: the offer's id; a hash roll like the rank-up's own, so no stream moves). */
export const CombatRankUpIsBonus = (run, offerId) => RollRankUp(run, `bonus:${offerId}`, CombatRankUpBonusChance(run));
/** The percent chance a shop's stock carries a rank-up (shops.json `rankUp.stockChancePct`; missing = 0). */
export const ShopRankUpChance = (run) => (CardRanksOn(run) ? wholePct(gameContent(run, 'shops')?.rankUp?.stockChancePct) : 0);
/** The cinders a shop asks for a rank-up to Rank 1: the Blacksmith's own price (shops.json `blacksmith.prices.rankUp`), its "from" price. */
export const ShopRankUpPrice = (run) => blacksmithPrices(run).rankUp;
/**
 * RankUpPrice(base, toRank) -> what reaching `toRank` costs (owner, 2026-11-23): the rank-up price times the target rank, so
 * Rank 1 costs it once and Rank 5 five times. A card's next rank is OwnCardRank + 1; an item's is its rank + 1.
 */
export const RankUpPrice = (base, toRank) => (Number.isSafeInteger(base) ? base * Math.max(1, toRank) : base);

/** Whether this won fight's reward carries a rank-up (key: the offer's id). */
export const CombatRewardRanksUp = (registries, run, offerId, pool) => RankUpCandidates(registries, run).length > 0 && RollRankUp(run, offerId, CombatRankUpChance(run, pool));
/** Whether this shop's stock carries a rank-up (key: the shop's id). */
export const ShopStocksRankUp = (registries, run, shopId) => RankUpCandidates(registries, run).length > 0 && RollRankUp(run, `shop:${shopId}`, ShopRankUpChance(run));
