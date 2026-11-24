// src/model/vendorStockRange.js — how many items a vendor's shelf holds on one visit (owner, 2026-11-20; SPEC §14.2).
//
// A shelf's stock count is authored either as a whole number (the same count every visit) or as a `[min, max]`
// range. A range is rolled once per shelf per visit from the run seed, the node and the shelf, on a hash rather
// than a named RNG stream (like the trader's shelves in gameProfileShopKind.js), so a reload, a revisit and a
// preview all agree and no stream moves. Headless; nothing here mutates.
import { upgradeStepRng } from './cardUpgradeSteps.js';

const LIMIT = 1000;
const whole = (n) => Number.isSafeInteger(n) && n >= 0 && n <= LIMIT;

/** StockRangeProblem(value) → '' when `value` is a stock count (0..1000) or a `[min, max]` range (1 ≤ min ≤ max ≤ 1000), else why not. */
export function StockRangeProblem(value) {
  if (whole(value)) return '';
  if (Array.isArray(value)) {
    if (value.length !== 2 || !value.every(whole)) return 'a stock range is two whole numbers [min, max] from 0 to 1000';
    if (value[0] < 1) return 'a stock range starts at 1 or more, so a shelf it covers is never empty';
    if (value[1] < value[0]) return 'a stock range [min, max] needs min ≤ max';
    return '';
  }
  return 'a stock count is a whole number or a [min, max] range';
}

/** StockRange(value) → { min, max } for a valid count or range, else null. */
export function StockRange(value) {
  if (StockRangeProblem(value)) return null;
  return Array.isArray(value) ? { min: value[0], max: value[1] } : { min: value, max: value };
}

/** VendorNodeKey(run) → the open vendor node's id (the shop id main.js keeps), for seeding a visit's rolls. */
export const VendorNodeKey = (run) => run?.gameProfileOpenShop || `${run?.actNumber ?? 0}:${run?.mapNodeId ?? ''}`;

/**
 * RollStockCount(value, seed, key) → the count this shelf holds on this visit. A whole number comes back as is; a
 * range rolls min..max on a hash of the run seed and `key` (the vendor node and the shelf). An invalid value is 0.
 */
export function RollStockCount(value, seed, key) {
  const range = StockRange(value);
  if (!range) return 0;
  if (range.min === range.max) return range.min;
  return range.min + Math.floor(upgradeStepRng(seed, `shelf-stock:${key}`, 0)() * (range.max - range.min + 1));
}

/** ShelfStockCounts(run, shopId, kinds, value) → { [kind]: count } for one merchant visit, each shelf rolled on its own. */
export function ShelfStockCounts(run, shopId, kinds, value) {
  return Object.fromEntries(kinds.map((kind) => [kind, RollStockCount(value, run.seed, `${shopId}:${kind}`)]));
}
