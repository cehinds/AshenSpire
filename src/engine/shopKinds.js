// src/engine/shopKinds.js — the Blacksmith visit's stock (SPEC §14.4), headless.
//
// Core's Blacksmith lays out its own fixed workshop (model/blacksmithStock.js). The classic merchant's market and
// wise-master visits, and the weighted offering roll they shared, were removed with the legacy shops: only Core ships.
import { applyShopPriceMult } from '../model/marketStock.js';
import { coreCardUpgrades } from '../model/blacksmith.js';
import { blacksmithRules } from '../model/blacksmithConfig.js';
import { coreBlacksmithStock } from '../model/blacksmithStock.js';

/**
 * buildBlacksmithStock(registries, rng, run) → a Core Blacksmith visit (SPEC §14.4):
 * `{ kind: 'blacksmith', offerings, armaments?, smithStones? }`, laid out by model/blacksmithStock.js.
 */
export function buildBlacksmithStock(registries, rng, run) {
  if (!(blacksmithRules(run) && coreCardUpgrades(run))) throw new Error('buildBlacksmithStock: only a Core run opens a Blacksmith');
  return coreBlacksmithStock(registries, rng, run);
}

/**
 * blacksmithVisitStock(registries, rng, run, { priceMult }) → the stock a smith visit opens with (SPEC §14.2, §14.4);
 * a custom run's price multiplier scales its stone price, rounding up.
 */
export function blacksmithVisitStock(registries, rng, run, { priceMult = 1 } = {}) {
  return applyShopPriceMult(buildBlacksmithStock(registries, rng, run), priceMult);
}
