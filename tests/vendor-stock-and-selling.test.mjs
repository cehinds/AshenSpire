// Owner 2026-11-20: vendors vary how many items each shelf holds (a [min, max] range per shelf, rolled per visit from
// the run seed and the node), and every vendor buys: the Blacksmith and a trader's workshop sell through the merchant's
// own sale transaction (SPEC §14.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { blacksmithVisitStock } from '../src/engine/shopKinds.js';
import { gameProfileShopStock, gameProfileRewardPools } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSalePlan, gameProfileShopSalePlans, commitGameProfileShopSale, vendorSaleStock } from '../src/model/gameProfileShopSales.js';
import { StockRangeProblem, StockRange, RollStockCount } from '../src/model/vendorStockRange.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(configuredContentBundle(contentBundle, {}), profile)), profile);
const newRun = (seed) => createRunState({ seed, classId: 'reaver', registries, runId: 'vendor-stock' });
const shopRules = (run) => gameContent(run, 'shops');

test('a stock count is a whole number or a [min, max] range that never empties a shelf', () => {
  for (const good of [0, 3, [1, 1], [2, 4], [4, 6]]) assert.equal(StockRangeProblem(good), '', JSON.stringify(good));
  for (const bad of [-1, 2.5, '3', [0, 3], [4, 2], [1], [1, 2, 3], [1, 'x'], null]) assert.notEqual(StockRangeProblem(bad), '', JSON.stringify(bad));
  assert.deepEqual(StockRange(3), { min: 3, max: 3 });
  assert.deepEqual(StockRange([2, 4]), { min: 2, max: 4 });
  assert.equal(RollStockCount(5, 1, 'x'), 5, 'a whole number is the count every visit');
  const seen = new Set();
  for (let n = 0; n < 200; n += 1) {
    const count = RollStockCount([2, 4], 7, `node${n}`);
    assert.ok(count >= 2 && count <= 4);
    assert.equal(RollStockCount([2, 4], 7, `node${n}`), count, 'the same seed and node roll the same count');
    seen.add(count);
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4], 'every count in the range turns up');
});

test('Core configures a range for every vendor shelf', () => {
  const rules = shopRules(newRun(1));
  for (const [name, value] of [['itemsPerCategory', rules.itemsPerCategory], ['blacksmith.armamentStock', rules.blacksmith.armamentStock], ['blacksmith.weaponArtStock', rules.blacksmith.weaponArtStock]]) {
    assert.equal(StockRangeProblem(value), '', name);
    const range = StockRange(value);
    assert.ok(range.max > range.min, `${name} varies`);
  }
});

test('a merchant shelf holds its own count from the range, per visit, seeded by the run and the node', () => {
  const range = StockRange(shopRules(newRun(1)).itemsPerCategory);
  const counts = new Set();
  for (let n = 0; n < 120; n += 1) {
    const run = newRun(500 + n), shopId = `1:node${n}`;
    const stock = gameProfileShopStock(registries, run, createRng(run.seed), { shopId });
    const pools = gameProfileRewardPools(registries, run);
    const byKind = Object.groupBy(stock.options.filter((option) => option.kind !== 'rankUps'), (option) => option.kind);
    for (const [kind, rows] of Object.entries(byKind)) {
      // A shelf whose pool runs short offers what exists (weapon arts usually do).
      assert.ok(rows.length <= range.max, `${shopId} ${kind}: ${rows.length}`);
      if ((pools[kind] || []).length >= range.max && kind !== 'weaponArts' && kind !== 'combatCards') assert.ok(rows.length >= range.min, `${shopId} ${kind}: ${rows.length}`);
      counts.add(rows.length);
    }
    const twin = newRun(500 + n);
    assert.deepEqual(gameProfileShopStock(registries, twin, createRng(twin.seed), { shopId }).options, stock.options, 'the same run and node stock the same shelves');
  }
  assert.ok(counts.has(range.min) && counts.has(range.max), `shelf sizes seen: ${[...counts]}`);
});

test('the Blacksmith rack and art shelf vary within their ranges', () => {
  const rules = shopRules(newRun(1)).blacksmith;
  const arm = StockRange(rules.armamentStock), arts = StockRange(rules.weaponArtStock);
  const sizes = new Set();
  for (let n = 0; n < 60; n += 1) {
    const run = newRun(900 + n);
    run.gameProfileOpenShop = `1:node${n}`;
    const stock = blacksmithVisitStock(registries, createRng(run.seed), run);
    const rack = stock.armaments || [];
    assert.ok(rack.length >= arm.min && rack.length <= arm.max, `rack ${rack.length}`);
    assert.ok((stock.weaponArts || []).length <= arts.max, `arts ${(stock.weaponArts || []).length}`);
    sizes.add(rack.length);
  }
  assert.ok(sizes.size > 1, 'racks differ in size');
});

function blacksmithVisit(seed = 41) {
  const run = newRun(seed);
  run.cinders = 100;
  run.gameProfileOpenShop = '1:smith';
  run.shopStock = blacksmithVisitStock(registries, createRng(run.seed), run);
  const relic = registries.relics.all().find((row) => !run.relics.includes(row.id));
  run.relics = [...run.relics, relic.id];
  return { run, relic };
}

test('a Blacksmith buys: the same sale plan, priced as the merchant prices it, trading against the visit stock', () => {
  const { run, relic } = blacksmithVisit();
  assert.equal(run.gameProfileRewardOffers?.['shop:1:smith'], undefined, 'no merchant offer at a Blacksmith node');
  assert.equal(vendorSaleStock(run, '1:smith'), run.shopStock);
  const quote = gameProfileShopSalePlan(registries, run, '1:smith', 'relics', relic.id);
  assert.equal(quote.ok, true, quote.reason);
  assert.ok(gameProfileShopSalePlans(registries, run, '1:smith').some((plan) => plan.identity === relic.id));
  const revision = run.shopStock.tradeRevision || 0, rack = structuredClone(run.shopStock.armaments);
  const receipt = commitGameProfileShopSale(registries, run, '1:smith', quote);
  assert.equal(receipt.received, quote.price);
  assert.equal(run.cinders, 100 + quote.price);
  assert.ok(!run.relics.includes(relic.id), 'the relic is gone');
  assert.equal(run.shopStock.kind, 'blacksmith', 'the visit stock stays a Blacksmith');
  assert.equal(run.shopStock.tradeRevision, revision + 1, 'the sale bumps the visit stock revision');
  assert.deepEqual(run.shopStock.armaments, rack, 'the rack is untouched');
  assert.throws(() => commitGameProfileShopSale(registries, run, '1:smith', quote), 'one quote commits once');
});

test("a trader's open workshop sells against the workshop; back at the trader the trader's offer is the stock", () => {
  const { run, relic } = blacksmithVisit(43);
  const offer = gameProfileShopStock(registries, run, createRng(run.seed), { shopId: '1:smith' });
  run.gameProfileTraderSmith = '1:smith';
  assert.equal(vendorSaleStock(run, '1:smith'), run.shopStock);
  commitGameProfileShopSale(registries, run, '1:smith', gameProfileShopSalePlan(registries, run, '1:smith', 'relics', relic.id));
  assert.equal(run.shopStock.tradeRevision, 1);
  assert.equal(run.gameProfileRewardOffers['shop:1:smith'].tradeRevision || 0, 0, "the trader's own offer is not touched");
  assert.deepEqual(run.gameProfileRewardOffers['shop:1:smith'].options, offer.options, "the trader's shelves are unchanged");
  delete run.gameProfileTraderSmith;
  assert.equal(vendorSaleStock(run, '1:smith'), run.gameProfileRewardOffers['shop:1:smith']);
});

test('the shops schema refuses a malformed shelf count', async () => {
  const { resolveGameProfile: resolve } = await import('../src/model/gameProfile.js');
  const game = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
  for (const bad of ['3', -5, 2.5, [0, 4], [1, 2, 3], {}]) {
    const custom = structuredClone(game);
    custom.modules = { ...(custom.modules || {}), shops: { ...(custom.modules?.shops || {}), itemsPerCategory: bad } };
    assert.throws(() => resolve(custom), undefined, JSON.stringify(bad));
  }
});

test('away from every vendor nothing sells', () => {
  const run = newRun(5);
  const relic = registries.relics.all()[0];
  run.relics = [relic.id];
  const quote = gameProfileShopSalePlan(registries, run, '1:none', 'relics', relic.id);
  assert.equal(quote.ok, false);
  assert.match(quote.reason, /vendor/);
});
