// Owner 2026-11-23: a card sells for twice the ordinary sale (balance.shop.cardSellMultiplier), never above its buy-price
// basis, so buying a card and selling it back never profits. Relics and the other kinds keep the ordinary sale.
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
import { gameProfileShopSalePlan, commitGameProfileShopSale } from '../src/model/gameProfileShopSales.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(configuredContentBundle(contentBundle, {}), profile)), profile);
const SHOP = '1:smith';

function visit() {
  const run = createRunState({ seed: 41, classId: 'reaver', registries, runId: 'card-sale' });
  run.cinders = 100;
  run.gameProfileOpenShop = SHOP;
  run.shopStock = blacksmithVisitStock(registries, createRng(run.seed), run);
  const card = { instanceId: 'sale-1', cardId: 'core.strike', upgraded: false };
  run.sideboard = [...(run.sideboard || []), card];
  return { run, card };
}
const cheapest = (run, rarity) => gameContent(run, 'shops').priceTable.card[rarity][0];

test('the data holds the owner number: cards sell at twice the ordinary sale', () => {
  assert.equal(registries.balance.shop.cardSellMultiplier, 2);
  assert.equal(registries.balance.shop.sellFraction, 0.5);
});

test('a card sells for twice the ordinary sale, capped at the cheapest buy price of its rarity', () => {
  const { run, card } = visit();
  const rarity = registries.cards.get(card.cardId).rarity;
  const basis = cheapest(run, rarity);
  const quote = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId);
  assert.equal(quote.ok, true, quote.reason);
  assert.equal(quote.price, Math.min(2 * Math.floor(basis * 0.5), basis));
  assert.ok(quote.price <= basis, 'never above the buy-price basis');
  commitGameProfileShopSale(registries, run, SHOP, quote);
  assert.equal(run.cinders, 100 + quote.price);
});

test('buying a card and selling it back never profits: the paid price caps the sale', () => {
  const { run, card } = visit();
  const rarity = registries.cards.get(card.cardId).rarity;
  run.gameProfileShopPurchasePrices = { [`combatCards:${card.cardId}`]: cheapest(run, rarity) - 7 };
  const quote = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId);
  assert.ok(quote.price <= cheapest(run, rarity) - 7, `sold for ${quote.price}`);
});

test('other kinds keep the ordinary sale', () => {
  const { run } = visit();
  const relic = registries.relics.all().find((row) => !run.relics.includes(row.id));
  run.relics = [...run.relics, relic.id];
  const row = gameContent(run, 'shops').priceTable.relic;
  const basis = (Array.isArray(row) ? row : row[relic.rarity] ?? row.common)[0];
  assert.equal(gameProfileShopSalePlan(registries, run, SHOP, 'relics', relic.id).price, Math.floor(basis * 0.5));
});

test('a multiplier of 1 sells cards like everything else', () => {
  const { run, card } = visit();
  const shop = { ...registries.balance.shop, cardSellMultiplier: 1 };
  const plainRegistries = Object.create(registries, { balance: { value: { ...registries.balance, shop } } });
  const doubled = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId).price;
  const plain = gameProfileShopSalePlan(plainRegistries, run, SHOP, 'combatCards', card.instanceId).price;
  assert.equal(plain, Math.floor(cheapest(run, registries.cards.get(card.cardId).rarity) * 0.5));
  assert.ok(doubled > plain);
});
