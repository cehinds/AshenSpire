// Which kind a configured (Core) shop node is: the merchandise shop, or a Blacksmith (owner ruling 2026-10-28:
// 25% of Core shop nodes). Decided from the run seed and the node alone, so a reload, a revisit and a preview all
// agree, and no named RNG stream moves. A profile without `blacksmithChance` (Legacy, Current) never rolls one.
import { gameContent, gameModule } from './gameProfile.js';
import { upgradeStepRng } from './cardUpgradeSteps.js';

export const configuredShopBlacksmithChance = (run) => {
  const chance = gameModule(run, 'shops')?.blacksmithChance ?? gameContent(run, 'shops')?.blacksmithChance ?? 0;
  return Number.isInteger(chance) && chance > 0 ? Math.min(100, chance) : 0;
};

/** configuredShopIsBlacksmith(run, shopId) → true when this shop node is the Blacksmith. */
export function configuredShopIsBlacksmith(run, shopId) {
  const chance = configuredShopBlacksmithChance(run);
  if (!chance) return false;
  return upgradeStepRng(run.seed, `shop-kind:${shopId}`, 0)() * 100 < chance;
}

/**
 * configuredShopKind(run, shopId) → 'blacksmith' | 'merchant': the one decision showShop (main.js) acts on.
 * An open Blacksmith visit (the kind rides run.shopStock) stays one; a node whose merchandise offer is already saved
 * (a Core save taken mid-shop before this rule existed) stays a merchandise shop whatever the hash says; otherwise the
 * seeded share decides.
 */
export function configuredShopKind(run, shopId) {
  if (run.shopStock && run.shopStock.kind === 'blacksmith') return 'blacksmith';
  if (run.gameProfileRewardOffers?.[`shop:${shopId}`]) return 'merchant';
  return !run.shopStock && configuredShopIsBlacksmith(run, shopId) ? 'blacksmith' : 'merchant';
}

// TRADERS VARY (playtest 2026-11-17 item 42): a trader offers 3 to 6 options in all (`shops.trader.minCategories` /
// `maxCategories` count every dock option: its buying shelves, Sell, the rank-up shelf when it stocks one, and a
// Blacksmith when it keeps one). Every trader
// sells armaments, cards and relics and buys (Sell); the rest of its shelves are drawn from `shops.trader.optional`,
// and some traders also keep a Blacksmith's workshop (`shops.trader.smithChance` percent). Both are seeded from the run seed
// and the node, like the Blacksmith share above, so a reload and a revisit agree and no named RNG stream moves.
const traderRules = (run) => gameContent(run, 'shops')?.trader || null;

/**
 * ConfiguredTraderCategories(run, shopId, fallback, { rankUpShelf }) → the buying shelves this trader stocks, or
 * `fallback` without a trader table. `rankUpShelf` says the stock also carries the rank-up shelf (its own dock tab).
 */
export function ConfiguredTraderCategories(run, shopId, fallback, { rankUpShelf = false } = {}) {
  const rules = traderRules(run);
  if (!rules) return fallback;
  const always = (rules.always || []).filter((kind) => fallback.includes(kind));
  const optional = (rules.optional || []).filter((kind) => fallback.includes(kind) && !always.includes(kind));
  // Sell, the rank-up shelf and the Blacksmith (when this trader has them) take places inside the option count.
  const fixedOptions = 1 + (rankUpShelf ? 1 : 0) + (ConfiguredTraderOffersSmith(run, shopId) ? 1 : 0);
  const min = Math.max(always.length, (Number.isInteger(rules.minCategories) ? rules.minCategories : always.length) - fixedOptions);
  const max = Math.min(always.length + optional.length, Math.max(min, (Number.isInteger(rules.maxCategories) ? rules.maxCategories : min + fixedOptions) - fixedOptions));
  const roll = upgradeStepRng(run.seed, `trader-shelves:${shopId}`, 0);
  const extra = min + Math.floor(roll() * (max - min + 1)) - always.length;
  const pool = [...optional];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(roll() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = new Set([...always, ...pool.slice(0, Math.max(0, extra))]);
  return fallback.filter((kind) => chosen.has(kind));
}

/** ConfiguredTraderOffersSmith(run, shopId) → true when this merchant node also keeps a Blacksmith's workshop. */
export function ConfiguredTraderOffersSmith(run, shopId) {
  const chance = traderRules(run)?.smithChance;
  if (!Number.isInteger(chance) || chance <= 0) return false;
  return upgradeStepRng(run.seed, `trader-smith:${shopId}`, 0)() * 100 < Math.min(100, chance);
}

/**
 * ConfiguredTraderDock(run, kinds, { smith }) → { kinds, smith }: the dock a trader shows, held to the 3-6 options
 * rule with Sell counted. A stock rolled since item 42 already fits and comes back whole; a stock saved before it
 * (every shelf stocked) keeps the always-stocked shelves, then the others in stock order while there is room, and
 * offers its Blacksmith only when a place is left. Shelves left off stay in the saved stock, unshown.
 */
export function ConfiguredTraderDock(run, kinds, { smith = false } = {}) {
  const rules = traderRules(run);
  const unique = [...new Set(kinds)];
  if (!rules) return { kinds: unique, smith };
  const max = Number.isInteger(rules.maxCategories) ? rules.maxCategories : unique.length + 1 + (smith ? 1 : 0);
  const room = Math.max(0, max - 1);
  const always = unique.filter((kind) => (rules.always || []).includes(kind));
  const shown = new Set([...always, ...unique.filter((kind) => !always.includes(kind))].slice(0, Math.max(room, always.length)));
  return { kinds: unique.filter((kind) => shown.has(kind)), smith: smith && shown.size + 1 < max };
}
