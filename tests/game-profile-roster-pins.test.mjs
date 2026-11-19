import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createSaveManager, createMemoryStorage, runKey } from '../src/engine/save.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { CODEX_IDS } from '../tools/enemy-roster-table.mjs';

// Original saved-profile bytes, rather than today's Core with old route settings:
// this pin predates the 32 Codex enemies and must keep its own encounter pool.
const historicalJson = gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))).toString('utf8');
const historicalSnapshot = JSON.parse(historicalJson);
const pinnedIds = historicalSnapshot.content.enemies.map(enemy => enemy.id).sort();

function savedProfile() {
  const storage = createMemoryStorage();
  const savedJson = `{"gameProfile":${historicalJson}}`;
  storage.setItem(runKey(1), savedJson);
  const profile = resolveGameProfile(createSaveManager(storage).peekRunGameProfile(1));
  assert.equal(profile.hash, historicalSnapshot.hash, 'reading the original save preserves its pinned hash');
  assert.equal(storage.getItem(runKey(1)), savedJson, 'reading the profile never rewrites the saved bytes');
  return profile;
}

function registriesFor(bundle, profile) {
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(bundle, profile)), profile);
}

test('a real pre-Codex saved profile keeps exactly its pinned enemy roster and valid references', () => {
  const projected = applyGameProfileToContent(contentBundle, savedProfile());
  const pinned = new Set(pinnedIds);
  assert.equal(pinned.size, 33, 'the immutable historical fixture carries 33 enemies');
  assert.deepEqual(projected.enemies.map(enemy => enemy.id).sort(), pinnedIds);
  for (const id of CODEX_IDS) assert.ok(!projected.enemies.some(enemy => enemy.id === id), `${id} is absent from the old pin`);
  for (const move of projected.enemyMoves) assert.ok(pinned.has(move.enemyId), `${move.enemyId}.${move.id} belongs to the pin`);
  for (const encounter of projected.encounters) {
    for (const id of encounter.enemies) assert.ok(pinned.has(id), `${encounter.id} only fields pinned enemies`);
  }
  // Registry validation also rejects tagging rows that refer to the removed
  // enemies, moves or encounters; filtering only the visible lists is not enough.
  assert.doesNotThrow(() => createRegistries(projected));
});

test('the current Core profile still includes all 32 Codex enemies', () => {
  const projected = applyGameProfileToContent(contentBundle, resolveGameProfile('default'));
  const ids = new Set(projected.enemies.map(enemy => enemy.id));
  assert.equal(ids.size, 65);
  assert.equal(CODEX_IDS.length, 32);
  for (const id of CODEX_IDS) assert.ok(ids.has(id), `${id} remains available to new runs`);
  assert.doesNotThrow(() => createRegistries(projected));
});

test('old saved profiles roll the pre-Codex encounter maps with identical RNG consumption', () => {
  const profile = savedProfile();
  const actual = registriesFor(contentBundle, profile);
  const preCodex = {
    ...contentBundle,
    encounters: contentBundle.encounters.filter(encounter => !encounter.enemies.some(id => CODEX_IDS.includes(id))),
  };
  const expected = registriesFor(preCodex, profile);
  const run = createRunState({ registries: actual, seed: 73, classId: 'reaver' });
  for (const seed of [1, 7, 73, 511]) {
    for (const tier of [1, 2, 3]) {
      const actualRng = createRng(seed), expectedRng = createRng(seed);
      const seat = run.seatOrder[tier - 1];
      const context = `seed ${seed}, act ${tier} (${seat})`;
      assert.deepEqual(buildActMap(actual, actualRng, seat, tier), buildActMap(expected, expectedRng, seat, tier), context);
      assert.deepEqual(actualRng.getCounters(), expectedRng.getCounters(), `${context}: draw counts`);
    }
  }
});
