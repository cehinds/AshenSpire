// Owner 2026-11-23: copying a card costs the copy shelf's price raised rankPricePct (25) percent per rank the card shows,
// at the Blacksmith and at a trader. The shelf names a "from" price (an unranked card's); the pick names each card's own
// price, and the plan and commit charge it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, purchaseGameProfileShopOffer, gameProfileShopPurchasePlan } from '../src/model/gameProfileRewards.js';
import { CardCopyShelf, CardCopyPrice } from '../src/model/cardCopyService.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed) => createRunState({ seed, classId: 'reaver', registries: reg, runId: `copy-price-${seed}` });

test('the copy price: the shelf price for an unranked card, +25% per visible rank', () => {
  const run = fresh(3);
  assert.equal(CardCopyPrice(run, 320, { cardId: 'core.strike' }), 320);
  assert.equal(CardCopyPrice(run, 320, { cardId: 'core.strike', rank: 1 }), 400);
  assert.equal(CardCopyPrice(run, 320, { cardId: 'core.strike', rank: 4 }), 640);
});

test('Blacksmith: the plan and the commit charge the chosen card its rank-raised price', async () => {
  const { CardCopyPlan, CommitCardCopy } = await import('../src/model/blacksmith.js');
  const { buildBlacksmithStock } = await import('../src/engine/shopKinds.js');
  const run = fresh(13);
  run.cinders = 5000;
  run.shopStock = buildBlacksmithStock(reg, createRng(13), run);
  if (!run.shopStock.offerings.includes('cardCopy')) run.shopStock.offerings.push('cardCopy');
  run.shopStock.cardCopy = { cost: 280, usesLeft: 2 };
  const [plain, ranked] = run.deck;
  ranked.rank = 2;
  assert.equal(CardCopyPlan(reg, run, plain.instanceId).cost, 280, 'unranked: the shelf price');
  const quote = CardCopyPlan(reg, run, ranked.instanceId);
  assert.equal(quote.cost, 420, 'Rank 2: +50%');
  CommitCardCopy(reg, run, quote);
  assert.equal(run.cinders, 5000 - 420);
  assert.equal(run.sideboard.at(-1).rank, 2, 'the copy keeps the rank');
});

test('trader: the shelf quotes its from price; the chosen card is charged its own price; the old price is refused', () => {
  const run = fresh(9);
  run.cinders = 100000;
  const stock = gameProfileShopStock(reg, run, createRng(9), { shopId: 'copy' });
  stock.options.push({ ...CardCopyShelf(run, 'trader'), usesLeft: 2 }); stock.takeCount += 1;
  const index = stock.options.length - 1;
  const shelf = gameProfileShopPurchasePlan(reg, run, 'copy', index);
  assert.equal(shelf.price, 320, 'the from price');
  const target = run.deck[0];
  target.rank = 4;
  const picked = gameProfileShopPurchasePlan(reg, run, 'copy', index, { instanceId: target.instanceId });
  assert.equal(picked.price, 640, 'Rank 4: +100%');
  assert.throws(() => purchaseGameProfileShopOffer(reg, run, 'copy', index, createRng(1), { ...shelf, instanceId: target.instanceId }), /changed/, 'a quote at the from price is stale');
  const before = run.cinders;
  const receipt = purchaseGameProfileShopOffer(reg, run, 'copy', index, createRng(1), { ...shelf, instanceId: target.instanceId, price: picked.price });
  assert.equal(receipt.price, 640);
  assert.equal(run.cinders, before - 640);
  run.cinders = 500;
  assert.equal(gameProfileShopPurchasePlan(reg, run, 'copy', index, { instanceId: target.instanceId }).ok, false, 'a ranked copy the purse cannot pay is refused');
  assert.equal(gameProfileShopPurchasePlan(reg, run, 'copy', index).ok, true, 'while the from price is still payable');
});

test('the pick names each card its own price', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  await withKitDom(async () => {
    const { CardCopyRows } = await import('../src/ui/components/cardCopyModal.js');
    const run = fresh(5);
    run.deck[0].rank = 2;
    const rows = CardCopyRows(reg, run, 320);
    const row = (card) => rows.find((r) => r.id === card.instanceId);
    assert.match(row(run.deck[0]).text, /480 cinders/);
    const plain = run.deck.find((card) => !card.rank && rows.some((r) => r.id === card.instanceId));
    assert.match(row(plain).text, /320 cinders/);
  });
});
