// SPEC §14.5 falsifier: "With defaults, a seed's market and blacksmith stocks
// are byte-identical before and after this step." The fixture holds what the
// tree before §14.6 step 7 built on fixed seeds (its _provenance names the ref
// and the method); this rebuilds each one with today's code and requires the
// same bytes, and the same stream counters where the fixture kept them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyContentBundle as contentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { marketVisitStock, buildBlacksmithStock } from '../src/engine/shopKinds.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/shop-stocks-pre-master.json', import.meta.url), 'utf8'));
// Replay the captured content catalog as well as its seeds. The 2026-10-02
// book expansion intentionally adds candidates; that is independently tested
// in book-learning.test.mjs, not a change to the master's stock algorithm.
const capturedBooks = new Set(Object.values(FIXTURE.marketAllOut).flatMap((stock) => (stock.skillBooks || []).map((book) => book.id)));
const capturedContent = { ...contentBundle, consumables: contentBundle.consumables.filter((row) => row.kind !== 'skillBook' || capturedBooks.has(row.id)) };
const allOut = (kind) => Object.fromEntries(contentBundle.shops[kind].offerings.map((row) => [`gameConfig.shops.${kind}.${row.id}.chance`, 100]));
const REG = {
  defaults: createRegistries(capturedContent),
  marketAllOut: createRegistries(configuredContentBundle(capturedContent, allOut('market'))),
  blacksmithAllOut: createRegistries(configuredContentBundle(capturedContent, allOut('blacksmith'))),
};

function take(registries, key, build) {
  const [classId, seed] = key.split(':');
  const run = createRunState({ seed: Number(seed), classId, registries, combatExpansionVersion: 1 });
  run.seenEvents = run.seenEvents || [];
  const rng = createRng(Number(seed));
  return { stock: build(registries, rng, run), counters: rng.getCounters() };
}

const CASES = {
  merchant: [REG.defaults, (r, rng, run) => marketVisitStock(r, rng, run, { meta: {}, door: 'merchant' })],
  atlasMarket: [REG.defaults, (r, rng, run) => marketVisitStock(r, rng, run, { meta: {}, door: 'atlas', ownerId: null })],
  marketAllOut: [REG.marketAllOut, (r, rng, run) => marketVisitStock(r, rng, run, { meta: {}, door: 'merchant' })],
  blacksmith: [REG.defaults, (r, rng, run) => buildBlacksmithStock(r, rng, run)],
  blacksmithAllOut: [REG.blacksmithAllOut, (r, rng, run) => buildBlacksmithStock(r, rng, run)],
};

for (const [name, [registries, build]] of Object.entries(CASES)) {
  test(`with the captured book catalog, the ${name} stocks are byte-identical to the tree before the wise master`, () => {
    const keys = Object.keys(FIXTURE[name]);
    assert.equal(keys.length, 50, 'every captured seed is replayed');
    for (const key of keys) {
      const { stock, counters } = take(registries, key, build);
      assert.equal(JSON.stringify(stock), JSON.stringify(FIXTURE[name][key]), `${name} ${key}`);
      const kept = FIXTURE.counters[`${name}:${key}`];
      // Sigils and intent visibility append after capture; shops use neither.
      const { sigils: drawnOnSigils = 0, enemyIntentVisibility: intentReads = 0, combatAvoidance: avoidance = 0, statusRecovery: recovery = 0, statusPressure: pressure = 0, ashenBlight: blight = 0, ...existing } = counters;
      assert.deepEqual([avoidance, recovery, pressure, blight], [0, 0, 0, 0], "legacy shops draw no expanded combat streams");
      if (kept) assert.equal(drawnOnSigils, 0, `${name} ${key}: nothing drawn on sigils`);
      if (kept) assert.equal(intentReads, 0, `${name} ${key}: nothing drawn on intent visibility`);
      if (kept) assert.deepEqual(existing, kept, `${name} ${key}: the streams drawn`);
    }
  });
}
