import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const table = profile.content.shops.priceTable;
const fresh = seed => createRunState({ seed, classId: 'reaver', registries });
const rangeOf = (option, run) => {
  const kind = { combatCards: 'card', weaponArts: 'weaponArt', relics: 'relic', weapons: 'armament', armor: 'armour', potions: 'flask' }[option.kind];
  const def = option.kind === 'combatCards' || option.kind === 'weaponArts' ? registries.cards.get(option.id)
    : option.kind === 'relics' ? registries.relics.get(option.id) : option.kind === 'potions' ? registries.flasks.get(option.id)
    : option.kind === 'weapons' ? registries.equipment.armaments.find(row => row.id === option.id)
    : registries.equipment.armour.find(row => row.id === option.id && row.classId === run.class);
  const row = table[kind];
  return Array.isArray(row) ? row : row[def?.rarity] ?? row.common;
};

test('every Core shop offer rolls its own price inside the authored range for its kind and rarity', () => {
  const prices = new Set(), kinds = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const run = fresh(seed), stock = gameProfileShopStock(registries, run, createRng(seed), { shopId: 's' });
    for (const option of stock.options) {
      const [min, max] = rangeOf(option, run);
      assert.ok(Number.isSafeInteger(option.price) && option.price >= min && option.price <= max, `${option.kind} ${option.id} ${option.price} in ${min}-${max}`);
      prices.add(option.price); kinds.add(option.kind);
    }
  }
  assert.ok(prices.size > 20, `prices vary (${prices.size} distinct)`);
  assert.ok(kinds.size >= 5);
  assert.deepEqual(gameProfileShopStock(registries, fresh(1), createRng(1), { shopId: 's' }).options, gameProfileShopStock(registries, fresh(1), createRng(1), { shopId: 's' }).options, 'same seed, same prices');
});
test('a purchase charges that offer\'s own price; stock saved with one price keeps charging it', () => {
  const run = fresh(4), stock = gameProfileShopStock(registries, run, createRng(4), { shopId: 'p' });
  run.cinders = 100000;
  const receipt = purchaseGameProfileShopOffer(registries, run, 'p', 2);
  assert.equal(receipt.price, stock.options[2].price);
  assert.equal(run.cinders, 100000 - stock.options[2].price);
  const old = fresh(5); gameProfileShopStock(registries, old, createRng(5), { shopId: 'o' });
  const saved = old.gameProfileRewardOffers['shop:o'];
  for (const option of saved.options) delete option.price;
  saved.price = 10; old.cinders = 25;
  assert.equal(gameProfileShopStock(registries, old, createRng(5), { shopId: 'o' }).options.some(option => option.price !== undefined), false, 'no prices are added to saved stock');
  assert.equal(purchaseGameProfileShopOffer(registries, old, 'o', 0).price, 10);
  assert.equal(old.cinders, 15);
});
test('an unaffordable offer is refused at its own price', () => {
  const run = fresh(6), stock = gameProfileShopStock(registries, run, createRng(6), { shopId: 'u' });
  run.cinders = stock.options[0].price - 1;
  assert.throws(() => purchaseGameProfileShopOffer(registries, run, 'u', 0), /Insufficient/);
});
