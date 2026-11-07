import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { blacksmithVisitStock } from '../src/engine/shopKinds.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));

test('a Core blacksmith visit scales armament cinder prices by the custom multiplier', () => {
  const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), {})), profile);
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  const stock = blacksmithVisitStock(registries, createRng(4), run);
  const priced = blacksmithVisitStock(registries, createRng(4), run, { priceMult: 1.5 });

  assert.ok(stock.armaments.length > 0, 'the actual visit has armaments to price');
  assert.deepEqual(priced.armaments, stock.armaments.map(item => ({
    ...item, ...(item.cost === undefined ? {} : { cost: Math.ceil(item.cost * 1.5) }),
  })), 'every armament keeps its identity and scales its price, rounding up');
});
