// Playtest 2026-11-17 item 42: traders vary. Each stocks 3-6 shelves, always armaments, cards and relics; some keep a
// Blacksmith. Seeded per node: the same run and node always answer the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { ConfiguredTraderCategories, ConfiguredTraderOffersSmith } from '../src/model/gameProfileShopKind.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(configuredContentBundle(contentBundle, {}), profile)), profile);
const newRun = (seed) => createRunState({ seed, classId: 'reaver', registries, runId: 'trader-variety' });

test('every trader stocks 3-6 shelves including armaments, cards and relics, and the count varies', () => {
  const counts = new Set();
  let smiths = 0;
  for (let n = 0; n < 40; n += 1) {
    const run = newRun(100 + n);
    const shopId = `1:node${n}`;
    const shelves = ConfiguredTraderCategories(run, shopId, gameContent(run, 'rewards').categories);
    assert.ok(shelves.length >= 3 && shelves.length <= 6, `${shelves.length} shelves`);
    for (const kind of ['weapons', 'combatCards', 'relics']) assert.ok(shelves.includes(kind), `${kind} is always stocked`);
    assert.deepEqual(ConfiguredTraderCategories(run, shopId, gameContent(run, 'rewards').categories), shelves, 'seeded: same node, same shelves');
    counts.add(shelves.length);
    const stock = gameProfileShopStock(registries, run, createRng(run.seed), { shopId });
    const kinds = new Set(stock.options.map((option) => option.kind).filter((kind) => kind !== 'rankUps'));
    for (const kind of kinds) assert.ok(shelves.includes(kind), `${kind} is one of this trader's shelves`);
    if (ConfiguredTraderOffersSmith(run, shopId)) smiths += 1;
  }
  assert.ok(counts.size > 1, 'traders differ in how many shelves they keep');
  assert.ok(smiths > 0 && smiths < 40, 'some traders, not all, keep a Blacksmith');
});
