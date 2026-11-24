// A card's rank raises what it costs to buy (owner, 2026-11-23): +`rankPricePct` percent of the price per rank the card's
// face shows (shops.json `rankPricePct`, 25), rounded to whole Cinders; an unranked card pays the plain price. The sale
// basis reads the same price, so a ranked card also sells for more but never above what it costs.
import { gameModule } from './gameProfile.js';
import { VisibleCardRank } from './cardRank.js';
import { PricedShops } from './liveShopPrices.js';

/** RankPricePct(run) -> the percent each visible rank adds to a card's price, 0 when unset. */
export function RankPricePct(run) {
  const pct = gameModule(run, 'shops')?.rankPricePct ?? PricedShops(run)?.rankPricePct;
  return Number.isFinite(pct) && pct > 0 ? pct : 0;
}

/** RankedCardPrice(run, price, card) -> `price` raised for the card's visible rank (an offer or an owned instance). */
export function RankedCardPrice(run, price, card) {
  const rank = VisibleCardRank(card);
  const pct = RankPricePct(run);
  if (!rank || !pct || !Number.isFinite(price)) return price;
  return Math.round(price * (1 + (pct / 100) * rank));
}
