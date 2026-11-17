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

// TRADERS VARY (playtest 2026-11-17 item 42): a merchant node stocks 3 to 6 shelves. Every trader sells armaments,
// cards and relics and buys (the sell shelf); the rest of its shelves are drawn from `shops.trader.optional`, and some
// traders also keep a Blacksmith's workshop (`shops.trader.smithChance` percent). Both are seeded from the run seed
// and the node, like the Blacksmith share above, so a reload and a revisit agree and no named RNG stream moves.
const traderRules = (run) => gameContent(run, 'shops')?.trader || null;

/** configuredTraderCategories(run, shopId, fallback) → the shelves this trader stocks, or `fallback` without a trader table. */
export function configuredTraderCategories(run, shopId, fallback) {
  const rules = traderRules(run);
  if (!rules) return fallback;
  const always = (rules.always || []).filter((kind) => fallback.includes(kind));
  const optional = (rules.optional || []).filter((kind) => fallback.includes(kind) && !always.includes(kind));
  const min = Math.max(always.length, Number.isInteger(rules.minCategories) ? rules.minCategories : always.length);
  const max = Math.min(always.length + optional.length, Math.max(min, Number.isInteger(rules.maxCategories) ? rules.maxCategories : min));
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

/** configuredTraderOffersSmith(run, shopId) → true when this merchant node also keeps a Blacksmith's workshop. */
export function configuredTraderOffersSmith(run, shopId) {
  const chance = traderRules(run)?.smithChance;
  if (!Number.isInteger(chance) || chance <= 0) return false;
  return upgradeStepRng(run.seed, `trader-smith:${shopId}`, 0)() * 100 < Math.min(100, chance);
}
