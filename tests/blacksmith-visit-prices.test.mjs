import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { blacksmithVisitStock } from '../src/engine/shopKinds.js';

test('a blacksmith visit scales armament and stone cinder prices by the custom multiplier', () => {
  const settings = Object.fromEntries(contentBundle.shops.blacksmith.offerings.map(row =>
    [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
  const registries = createRegistries(configuredContentBundle(contentBundle, settings));
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  const stock = blacksmithVisitStock(registries, createRng(4), run);
  const priced = blacksmithVisitStock(registries, createRng(4), run, { priceMult: 1.5 });

  assert.ok(stock.armaments.length > 0, 'the actual visit has armaments to price');
  assert.deepEqual(priced.armaments, stock.armaments.map(item => ({
    ...item, cost: Math.ceil(item.cost * 1.5),
  })), 'every armament keeps its identity and scales its price, rounding up');
  assert.equal(priced.smithStones.price, Math.ceil(stock.smithStones.price * 1.5));
});
