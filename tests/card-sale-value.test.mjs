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
import { ItemRankOf } from '../src/model/itemRank.js';
import { RankPricePct } from '../src/model/rankedCardPrice.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(configuredContentBundle(contentBundle, {}), profile)), profile);
const SHOP = '1:smith';
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const authoredShop = json('../content/source/balanceShop.json');
const authoredPrices = json('../games/ashenspire/packs/core/shops.json');
const cardSale = (basis, shop = registries.balance.shop) => {
  const sale = Math.floor(basis * shop.sellFraction);
  return Number.isFinite(shop.cardSellMultiplier) && shop.cardSellMultiplier > 0
    ? Math.min(Math.floor(sale * shop.cardSellMultiplier), basis) : sale;
};

function visit() {
  const run = createRunState({ seed: 41, classId: 'reaver', registries, runId: 'card-sale' });
  run.cinders = 100;
  run.gameProfileOpenShop = SHOP;
  run.shopStock = blacksmithVisitStock(registries, createRng(run.seed), run);
  const definition = registries.cards.all().find(row => gameContent(run, 'shops').priceTable.card[row.rarity]);
  const card = { instanceId: 'sale-1', cardId: definition.id, upgraded: false };
  run.sideboard = [...(run.sideboard || []), card];
  return { run, card };
}
const cheapest = (run, rarity) => gameContent(run, 'shops').priceTable.card[rarity][0];

test('the current sale settings follow the authoritative JSON', () => {
  assert.equal(registries.balance.shop.cardSellMultiplier, authoredShop.cardSellMultiplier);
  assert.equal(registries.balance.shop.sellFraction, authoredShop.sellFraction);
});

test('a card uses the authored sale fraction and multiplier, capped at its buy-price basis', () => {
  const { run, card } = visit();
  const rarity = registries.cards.get(card.cardId).rarity;
  const basis = cheapest(run, rarity);
  const quote = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId);
  assert.equal(quote.ok, true, quote.reason);
  assert.equal(quote.price, cardSale(basis));
  assert.ok(quote.price <= basis, 'never above the buy-price basis');
  commitGameProfileShopSale(registries, run, SHOP, quote);
  assert.equal(run.cinders, 100 + quote.price);
});

test('buying a card and selling it back never profits: the paid price caps the sale', () => {
  const { run, card } = visit();
  const rarity = registries.cards.get(card.cardId).rarity;
  run.gameProfileShopPurchasePrices = { [`combatCards:${card.cardId}`]: Math.floor(cheapest(run, rarity) / 2) };
  const quote = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId);
  assert.ok(quote.price <= Math.floor(cheapest(run, rarity) / 2), `sold for ${quote.price}`);
});

test('a ranked relic sells at the ordinary fraction of its rank-adjusted basis', () => {
  const { run } = visit();
  const relic = registries.relics.all().find(row => !run.relics.includes(row.id) && gameContent(run, 'shops').priceTable.relic[row.rarity]);
  if (!run.relics.includes(relic.id)) run.relics = [...run.relics, relic.id];
  const row = gameContent(run, 'shops').priceTable.relic;
  const basis = (Array.isArray(row) ? row : row[relic.rarity] ?? row.common)[0];
  assert.equal(gameProfileShopSalePlan(registries, run, SHOP, 'relics', relic.id).price, Math.floor(Math.round(basis * (1 + RankPricePct(run) / 100 * ItemRankOf('relics', relic, run.class))) * registries.balance.shop.sellFraction));
});

test('a multiplier of 1 sells cards like everything else', () => {
  const { run, card } = visit();
  const shop = { ...registries.balance.shop, cardSellMultiplier: 1 };
  const doubledReg = { ...registries, balance: { ...registries.balance, shop: { ...shop, sellFraction: 0.5, cardSellMultiplier: 2 } } };
  const plainReg = { ...registries, balance: { ...registries.balance, shop: { ...shop, sellFraction: 0.5 } } };
  const doubled = gameProfileShopSalePlan(doubledReg, run, SHOP, 'combatCards', card.instanceId).price;
  const plain = gameProfileShopSalePlan(plainReg, run, SHOP, 'combatCards', card.instanceId).price;
  assert.equal(plain, Math.floor(cheapest(run, registries.cards.get(card.cardId).rarity) * 0.5));
  assert.equal(doubled, Math.min(plain * 2, cheapest(run, registries.cards.get(card.cardId).rarity)));
});

// Owner 2026-11-23: a card's rank raises its buy price by rankPricePct (25) percent per visible rank, and the card sale cap
// reads that rank-raised price.
test('the current rank surcharge follows the authoritative JSON', async () => {
  const { RankPricePct } = await import('../src/model/rankedCardPrice.js');
  const { run } = visit();
  assert.equal(RankPricePct(run), authoredPrices.rankPricePct);
});

test('a ranked card costs +25% per visible rank, rounded; an unranked card the plain price', async () => {
  const { RankedCardPrice } = await import('../src/model/rankedCardPrice.js');
  const { run } = visit();
  run.gameProfile.modules.shops = { ...run.gameProfile.modules.shops, rankPricePct: 25 };
  assert.equal(RankedCardPrice(run, 100, { cardId: 'core.strike' }), 100, 'no badge: +0');
  assert.equal(RankedCardPrice(run, 100, { cardId: 'core.strike', rank: 1 }), 125, '"Rank 1": +25%');
  assert.equal(RankedCardPrice(run, 100, { cardId: 'core.strike', rank: 4 }), 200, '"Rank 4": +100%');
  assert.equal(RankedCardPrice(run, 34, { cardId: 'core.strike', rank: 1 }), 43, 'whole cinders (42.5 rounds to 43)');
});

test('a ranked card sells against its rank-raised price: more than unranked, never above that price', () => {
  const { run, card } = visit();
  const basis = cheapest(run, registries.cards.get(card.cardId).rarity);
  const unranked = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId).price;
  card.rank = 4;
  const raised = Math.round(basis * (1 + RankPricePct(run) / 100 * card.rank));
  const ranked = gameProfileShopSalePlan(registries, run, SHOP, 'combatCards', card.instanceId).price;
  assert.equal(ranked, cardSale(raised));
  assert.ok(ranked >= unranked, `${ranked} >= ${unranked}`);
  assert.ok(ranked <= raised, 'never above the rank-raised buy price');
});
