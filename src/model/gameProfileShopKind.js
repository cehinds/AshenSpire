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
