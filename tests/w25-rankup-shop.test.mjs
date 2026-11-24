// W25-R: some shops stock "Rank up a card" at the Blacksmith's price (15% of shops); buying asks for the card.
import { FillUpgradeSlots } from './helpers/rank-up-ready.mjs';
import { OwnCardRank } from '../src/model/cardRank.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileShopStock, gameProfileShopPurchasePlan, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { InstanceRank, RankUpCandidates } from '../src/model/rankUpService.js';
import { ConfiguredTraderCategories } from '../src/model/gameProfileShopKind.js';
import { ShelfStockCounts } from '../src/model/vendorStockRange.js';
import { gameContent } from '../src/model/gameProfile.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), {})), profile);
// Owner 2026-11-23: rank-up needs a fully upgraded card (on by default), so these runs start with every slot used.
const newRun = (seed = 9) => {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'w25-rankup-shop' });
  FillUpgradeSlots(run);
  return run;
};
const shelf = (stock) => stock.options.findIndex((option) => option.kind === 'rankUps');

function shopWithRankUp(run) {
  for (let n = 0; n < 400; n += 1) {
    const stock = gameProfileShopStock(registries, run, createRng(run.seed), { shopId: `1:s${n}` });
    if (shelf(stock) >= 0) return { shopId: `1:s${n}`, stock };
    delete run.gameProfileRewardOffers[`shop:1:s${n}`];
  }
  assert.fail('no shop stocked a rank-up in 400 tries');
}

test('about 15% of shops stock a rank-up, the same ones every time the seed is replayed', () => {
  const run = newRun(21);
  const stocked = (r) => Array.from({ length: 400 }, (_, n) => {
    const stock = gameProfileShopStock(registries, r, createRng(r.seed), { shopId: `1:s${n}` });
    const has = shelf(stock) >= 0;
    delete r.gameProfileRewardOffers[`shop:1:s${n}`];
    return has;
  });
  const first = stocked(run), second = stocked(newRun(21));
  assert.deepEqual(first, second);
  const rate = first.filter(Boolean).length / 4;
  assert.ok(rate > 10 && rate < 21, `rate ${rate}`);
});

test('the shelf costs the Blacksmith price and rides the saved stock: a reload neither adds nor drops it', () => {
  const run = newRun(21);
  const { shopId, stock } = shopWithRankUp(run);
  const at = shelf(stock);
  assert.equal(stock.options[at].price, 240);
  assert.equal(gameProfileShopPurchasePlan(registries, run, shopId, at).price, 240);
  const again = gameProfileShopStock(registries, run, createRng(run.seed), { shopId });
  assert.equal(again.options.filter((option) => option.kind === 'rankUps').length, 1);
  // A stock saved before this service has no shelf and never grows one.
  const old = newRun(21);
  const plain = gameProfileShopStock(registries, old, createRng(old.seed), { shopId: '1:old' });
  const copy = structuredClone(plain);
  copy.options = copy.options.filter((option) => option.kind !== 'rankUps');
  old.gameProfileRewardOffers['shop:1:old'] = copy;
  assert.equal(gameProfileShopStock(registries, old, createRng(old.seed), { shopId: '1:old' }).options.length, copy.options.length);
});

test('buying raises the chosen card, takes the cinders once, and stocks no replacement', () => {
  const run = newRun(21);
  const { shopId, stock } = shopWithRankUp(run);
  const at = shelf(stock);
  run.cinders = 500;
  const card = RankUpCandidates(registries, run)[0];
  const rank = OwnCardRank(card), options = stock.options.length;
  const quote = gameProfileShopPurchasePlan(registries, run, shopId, at);
  assert.equal(quote.ok, true, quote.reason);
  assert.throws(() => purchaseGameProfileShopOffer(registries, run, shopId, at, createRng(run.seed), quote), /Choose a card/);
  assert.equal(run.cinders, 500, 'a refused purchase spends nothing');
  const receipt = purchaseGameProfileShopOffer(registries, run, shopId, at, createRng(run.seed), { ...quote, instanceId: card.instanceId });
  assert.deepEqual([receipt.kind, receipt.price, receipt.rank], ['rankUps', 240, rank + 1]);
  assert.equal(run.cinders, 260);
  assert.equal(OwnCardRank(RankUpCandidates(registries, run).find((row) => row.instanceId === card.instanceId)), rank + 1);
  const after = run.gameProfileRewardOffers[`shop:${shopId}`];
  assert.equal(after.options.length, options, 'nothing restocked');
  assert.ok(after.taken.includes(at));
  assert.equal(gameProfileShopPurchasePlan(registries, run, shopId, at).ok, false, 'sold out');
  assert.ok(!Object.keys(run.gameProfileShopPurchasePrices || {}).some((key) => key.startsWith('rankUps')), 'no resale ceiling for a service');
});

test('a short purse refuses it', () => {
  const run = newRun(21);
  const { shopId, stock } = shopWithRankUp(run);
  run.cinders = 119;
  const quote = gameProfileShopPurchasePlan(registries, run, shopId, shelf(stock));
  assert.equal(quote.ok, false);
  assert.match(quote.reason, /Insufficient cinders/);
});

test('a fresh stock with the rank-up shelf takes one more than a plain stock, so the shelf never costs a real item; a saved stock is unchanged', () => {
  const plainRun = newRun(21);
  const plain = gameProfileShopStock(registries, plainRun, createRng(plainRun.seed), { shopId: '1:plain' });
  assert.equal(shelf(plain), -1);
  const run = newRun(21);
  const { shopId, stock } = shopWithRankUp(run);
  const real = stock.options.filter((option) => option.kind !== 'rankUps').length;
  assert.equal(stock.options.length, real + 1);
  // Traders vary (playtest 2026-11-17 item 42): a plain stock for THIS shop is its own shelves times the shelf size.
  // The rank-up shelf is one of the trader's dock options, so a shop that stocks it makes room among its shelves.
  // Owner 2026-11-20: each shelf holds its own rolled count (vendorStockRange.js), so a plain stock is the sum of them.
  const items = (id, rankUpShelf) => Object.values(ShelfStockCounts(run, id, ConfiguredTraderCategories(run, id, gameContent(run, 'rewards').categories, { rankUpShelf }), gameContent(run, 'shops').itemsPerCategory)).reduce((sum, count) => sum + count, 0);
  assert.equal(plain.takeCount, items('1:plain', false));
  const plainHere = items(shopId, true);
  assert.equal(stock.takeCount, plainHere + 1);
  assert.ok(stock.takeCount >= real + 1, 'every real item and the shelf can all be bought');
  assert.equal(run.gameProfileRewardOffers[`shop:${shopId}`].takeCount, plainHere + 1);
  const again = gameProfileShopStock(registries, run, createRng(run.seed), { shopId });
  assert.equal(again.takeCount, plainHere + 1, 'a reload does not raise it again');
});

test('the shelf price is the Rank 1 price; a chosen card pays the rank-up price times the rank it reaches (owner 2026-11-23)', async () => {
  const { RankUpPrice } = await import('../src/model/rankUpService.js');
  assert.deepEqual([1, 2, 5].map((rank) => RankUpPrice(240, rank)), [240, 480, 1200]);
  const run = newRun(21);
  const { shopId, stock } = shopWithRankUp(run);
  const at = shelf(stock);
  run.cinders = 5000;
  const card = RankUpCandidates(registries, run)[0];
  card.rank = 2;
  FillUpgradeSlots(run, [card]);
  const shelfQuote = gameProfileShopPurchasePlan(registries, run, shopId, at);
  assert.equal(shelfQuote.price, 240);
  const picked = gameProfileShopPurchasePlan(registries, run, shopId, at, { instanceId: card.instanceId });
  assert.equal(picked.price, 720, 'Rank 2 to Rank 3: three times');
  assert.throws(() => purchaseGameProfileShopOffer(registries, run, shopId, at, createRng(run.seed), { ...shelfQuote, instanceId: card.instanceId }), /changed/);
  const receipt = purchaseGameProfileShopOffer(registries, run, shopId, at, createRng(run.seed), { ...shelfQuote, instanceId: card.instanceId, price: picked.price });
  assert.deepEqual([receipt.price, run.cinders], [720, 5000 - 720]);
});

test('the rank-up pick names each card its own price', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  await withKitDom(async () => {
    const { RankUpCardRows } = await import('../src/ui/components/rankUpCardModal.js');
    const run = newRun(21);
    const [plain, ranked] = RankUpCandidates(registries, run);
    ranked.rank = 1;
    FillUpgradeSlots(run, [ranked]);
    const rows = RankUpCardRows(registries, run, 240);
    assert.match(rows.find((r) => r.id === plain.instanceId).text, /240 cinders/);
    assert.match(rows.find((r) => r.id === ranked.instanceId).text, /480 cinders/);
  });
});
