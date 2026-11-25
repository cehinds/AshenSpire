// The runtime enemy registry (registries.enemies, which combat reads) takes each
// enemy's starting poiseMax from the active profile's own pack. Core 2 carries the
// authored starting values, including the 2026-11-24 retune in 15d221435dc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

const enemyRows = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  .filter(row => row.tags?.includes('character.enemy'));
const corePack = enemyRows('../games/ashenspire/packs/core/characters.json');

function registryFor(core) {
  const profile = resolveGameProfile({ formatVersion: 1, core, modules: {} });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
}

test('Core 2 runtime registry: Wandering Soldier starts at the authored 3 Poise', () => {
  assert.equal(registryFor('ashen.core@2.0.0').enemies.get('wanderingSoldier').poiseMax, 3);
});

test('Core 2 runtime registry: every enemy poiseMax equals the Core 2 pack', () => {
  const runtime = registryFor('ashen.core@2.0.0');
  assert.equal(corePack.length, 65);
  for (const row of corePack) {
    assert.equal(runtime.enemies.get(row.id)?.poiseMax, row.enemy.poiseMax, `${row.id} poiseMax`);
  }
});
