// src/model/blacksmithConfig.js — the Core blacksmith economy's authored numbers (SPEC §14.4), read from the
// active game profile's shops content (`games/ashenspire/packs/core/shops.json` -> `blacksmith`). Pure reads:
// nothing here rolls, prices or mutates. A profile without the block (Legacy, Current) gets null / neutral values.
import { gameContent } from './gameProfile.js';
import { uiStrings } from '../content/generated/uiStrings.js';

/** The `short` form of a uiStrings row with {tokens} filled (model code has no t()). */
export function uiSentence(id, tokens = {}) {
  const text = uiStrings.find((row) => row.id === id)?.short;
  if (!text) throw new Error(`uiStrings: '${id}' has no short form`);
  return text.replace(/\{(\w+)\}/g, (_, key) => String(tokens[key]));
}

/** The profile's `blacksmith` block, or null. */
export const blacksmithRules = (subject) => gameContent(subject, 'shops')?.blacksmith || null;

/**
 * The highest tier a rest-site Smith reaches (a blacksmith reaches the item ladder's top). null = no cap.
 * It lives beside the blacksmith's numbers because the rest module's settings schema is closed.
 */
export const restSmithMaxTier = (subject) => {
  const tier = blacksmithRules(subject)?.restSmithMaxTier;
  return Number.isInteger(tier) && tier >= 1 ? tier : null;
};

/** Smithing Stones a blacksmith takes off every stone price (min 0 after), else 0. */
export const blacksmithStoneDiscount = (subject) => {
  const n = blacksmithRules(subject)?.stoneDiscount;
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** The cinder price rows: tierUpgrade[tier-1], cardUpgrade, rankUp. Missing rows read 0. */
export function blacksmithPrices(subject) {
  const prices = blacksmithRules(subject)?.prices || {};
  const whole = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
  return {
    tierUpgrade: (Array.isArray(prices.tierUpgrade) ? prices.tierUpgrade : []).map(whole),
    cardUpgrade: whole(prices.cardUpgrade),
    rankUp: whole(prices.rankUp),
  };
}
/** Cinders for promoting an item to `nextTier` (1-based); the last row repeats past the table. */
export const tierUpgradePrice = (subject, nextTier) => {
  const rows = blacksmithPrices(subject).tierUpgrade;
  return rows.length ? rows[Math.min(rows.length, Math.max(1, nextTier)) - 1] : 0;
};
