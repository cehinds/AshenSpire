// Shops sometimes stock ranked cards (owner, 2026-11-23): each Core shop or trader card offer rolls a rank from shops.json
// `rankedOfferChancePct` ({ "1": 20, "2": 5 }: 20% Rank 1, 5% Rank 2, else unranked). The roll is a hash of the run seed,
// the offer and its slot, so it draws no RNG stream (every seeded price and pick stays where it was) and a reload or a
// revisit sees the same rank. The offer carries the rank onto the bought card; its price reads it (rankedCardPrice.js).
import { gameContent } from './gameProfile.js';
import { mulberry32 } from './rng.js';
import { upgradeSeed } from './cardUpgradeSteps.js';
import { CardRanksOn } from './rankUpService.js';

/** ShopOfferRankChances(run) -> [[rank, pct], ...] highest rank first, or [] when the profile authors none. */
export function ShopOfferRankChances(run) {
  const table = gameContent(run, 'shops')?.rankedOfferChancePct;
  if (!CardRanksOn(run) || !table || typeof table !== 'object') return [];
  return Object.entries(table)
    .map(([rank, pct]) => [Number(rank), Number(pct)])
    .filter(([rank, pct]) => Number.isSafeInteger(rank) && rank >= 1 && Number.isFinite(pct) && pct > 0)
    .sort((a, b) => b[0] - a[0]);
}

/** RollShopOfferRank(run, key) -> the rank a shop card offer arrives at (0 = unranked), the same for the same key. */
export function RollShopOfferRank(run, key) {
  const chances = ShopOfferRankChances(run);
  if (!chances.length) return 0;
  const roll = mulberry32(upgradeSeed(run.seed, `shopOfferRank:${key}`, 0))() * 100;
  let edge = 0;
  for (const [rank, pct] of chances) {
    edge += pct;
    if (roll < edge) return rank;
  }
  return 0;
}

/** RankShopCardOffers(run, offerId, options) -> options, each card offer given its rolled rank (none when unranked). */
export function RankShopCardOffers(run, offerId, options) {
  options.forEach((option, index) => {
    if (option?.kind !== 'combatCards' || option.rank !== undefined) return;
    const rank = RollShopOfferRank(run, `${offerId}:${index}:${option.id}`);
    if (rank > 0) option.rank = rank;
  });
  return options;
}
