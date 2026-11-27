import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, purchaseGameProfileShopOffer, gameProfileRewardPools } from '../src/model/gameProfileRewards.js';
import { itemCombatPower } from '../src/content/generated/combatPower.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const source = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/shops.json', import.meta.url), 'utf8'));
const table = profile.content.shops.priceTable;
test('current shop price tables and rank surcharge follow JSON', () => {
  assert.deepEqual(table, source.priceTable);
  assert.equal(profile.content.shops.rankPricePct, source.rankPricePct);
});
const fresh = seed => createRunState({ seed, classId: 'reaver', registries });
const rangeOf = (option, run) => {
  // W25-R: the rank-up service is priced at the Blacksmith's own rank-up price, not from the item price table.
  if (option.kind === 'rankUps') return { range: [profile.content.shops.blacksmith.prices.rankUp, profile.content.shops.blacksmith.prices.rankUp], rank: 0 };
  const kind = { combatCards: 'card', weaponArts: 'weaponArt', relics: 'relic', weapons: 'armament', armor: 'armour', potions: 'flask' }[option.kind];
  const def = option.kind === 'combatCards' || option.kind === 'weaponArts' ? registries.cards.get(option.id)
    : option.kind === 'relics' ? registries.relics.get(option.id) : option.kind === 'potions' ? registries.flasks.get(option.id)
    : option.kind === 'weapons' ? registries.equipment.armaments.find(row => row.id === option.id)
    : registries.equipment.armour.find(row => row.id === option.id && row.classId === run.class);
  const row = table[kind];
  const itemKey = { weapons: `weapon:${option.id}`, armor: `armour:${run.class}.${option.id}`, relics: `relic:${option.id}` }[option.kind];
  const rank = itemKey ? itemCombatPower[itemKey]?.rank ?? def?.rank ?? 0 : option.rank ?? 0;
  return { range: Array.isArray(row) ? row : row[def?.rarity] ?? row.common, rank };
};

test('every Core shop offer rolls its own price inside the authored range for its kind and rarity', () => {

  for (let seed = 1; seed <= 12; seed++) {
    const run = fresh(seed), stock = gameProfileShopStock(registries, run, createRng(seed), { shopId: 's' });
    for (const option of stock.options) {
      // The copy service (owner 2026-11-20) charges its own authored price (shops.json cardCopy.price), not a table range.
      if (option.kind === 'cardCopies') { assert.ok(Number.isSafeInteger(option.price) && option.price >= 0); continue; }
      // Ranked offers cost +25% per rank, rounded. Equipment uses its authored CP rank.
      const { range, rank } = rangeOf(option, run);
      const [min, max] = range.map((end) => Math.round(end * (1 + ((source.rankPricePct ?? 0) / 100) * rank)));
      assert.ok(Number.isSafeInteger(option.price) && option.price >= min && option.price <= max, `${option.kind} ${option.id} ${option.price} in ${min}-${max}`);
    }
  }
  assert.deepEqual(gameProfileShopStock(registries, fresh(1), createRng(1), { shopId: 's' }).options, gameProfileShopStock(registries, fresh(1), createRng(1), { shopId: 's' }).options, 'same seed, same prices');
});
function purchaseFixture(seed, shopId, price = 73) {
  const run = fresh(seed);
  const available = gameProfileRewardPools(registries, run);
  const kind = ['combatCards', 'potions', 'relics', 'weapons', 'armor'].find(key => available[key].length);
  const stock = { id: `shop:${shopId}`, source: 'shop', options: [{ kind, id: available[kind][0], price }], takeCount: 1, taken: [], claimed: null };
  (run.gameProfileRewardOffers ||= {})[stock.id] = stock;
  return { run, stock };
}

test('a purchase charges the persisted offer price and legacy stock keeps its single saved price', () => {
  const { run, stock } = purchaseFixture(4, 'p');
  run.cinders = 100000;
  const receipt = purchaseGameProfileShopOffer(registries, run, 'p', 0);
  assert.equal(receipt.price, stock.options[0].price);
  assert.equal(run.cinders, 100000 - stock.options[0].price);
  const { run: old, stock: saved } = purchaseFixture(5, 'o');
  delete saved.options[0].price;
  saved.price = 10; old.cinders = 25;
  assert.equal(gameProfileShopStock(registries, old, createRng(5), { shopId: 'o' }).options.some(option => option.price !== undefined), false, 'no prices are added to saved stock');
  assert.equal(purchaseGameProfileShopOffer(registries, old, 'o', 0).price, 10);
  assert.equal(old.cinders, 15);
});

test('an unaffordable offer is refused at its own price without mutation', () => {
  const { run, stock } = purchaseFixture(6, 'u');
  run.cinders = stock.options[0].price - 1;
  const before = JSON.stringify(run);
  assert.throws(() => purchaseGameProfileShopOffer(registries, run, 'u', 0), /Insufficient/);
  assert.equal(JSON.stringify(run), before);
});
