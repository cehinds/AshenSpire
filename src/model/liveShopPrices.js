// Shop prices apply to every run, saved ones included (owner, 2026-11-23). A run pins its game profile, shops content
// and all, so a run saved before a price change would keep the old prices while item, removal and event prices (content
// outside the profile) moved on. The price keys below therefore read the CURRENT shipped values of the run's Core bundle;
// every other pinned shops key (stock sizes, chances, uses, discounts) and every offer already rolled into a saved stock
// stays as the save has it. A profile that is not a shipped Core bundle keeps its own numbers.
import { gameContent, isCoreProfile, resolveGameProfile } from './gameProfile.js';

const liveByCore = new Map();
function LiveCoreShops(subject) {
  if (!isCoreProfile(subject)) return null;
  const core = (subject?.gameProfile || subject)?.author?.core;
  if (!liveByCore.has(core)) {
    let shops = null;
    try { shops = resolveGameProfile(core)?.content?.shops || null; } catch { shops = null; }
    liveByCore.set(core, shops);
  }
  return liveByCore.get(core);
}

/** The shops object a price reads: the pinned shops content with its price keys taken from the current Core bundle. */
export function PricedShops(subject) {
  const pinned = gameContent(subject, 'shops');
  const live = LiveCoreShops(subject);
  if (!pinned || !live) return pinned;
  return {
    ...pinned,
    ...(live.rankPricePct !== undefined ? { rankPricePct: live.rankPricePct } : {}),
    ...(pinned.cardCopy && live.cardCopy ? { cardCopy: { ...pinned.cardCopy, price: live.cardCopy.price } } : {}),
    blacksmith: pinned.blacksmith && live.blacksmith ? {
      ...pinned.blacksmith,
      prices: live.blacksmith.prices,
      ...(pinned.blacksmith.cardCopy && live.blacksmith.cardCopy ? { cardCopy: { ...pinned.blacksmith.cardCopy, price: live.blacksmith.cardCopy.price } } : {}),
    } : pinned.blacksmith,
  };
}
