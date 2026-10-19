// The runtime enemy registry (registries.enemies, which combat reads) takes each
// enemy's starting poiseMax from the active profile's own pack. Core 2 carries the
// halved values (owner, 2026-10-19: lower enemy starting poise by 50 percent); the
// archived Core 1 profile keeps its pinned values, though both read the same act lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

const enemyRows = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  .filter(row => row.tags?.includes('character.enemy'));
const corePack = enemyRows('../games/ashenspire/packs/core/characters.json');
const core1Pack = enemyRows('../games/ashenspire/packs/core-v1/characters.json');

function registryFor(core) {
  const profile = resolveGameProfile({ formatVersion: 1, core, modules: {} });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
}

test('Core 2 runtime registry: Wandering Soldier starts at poise 5', () => {
  assert.equal(registryFor('ashen.core@2.0.0').enemies.get('wanderingSoldier').poiseMax, 5);
});

test('Core 2 runtime registry: every enemy poiseMax equals the Core 2 pack', () => {
  const runtime = registryFor('ashen.core@2.0.0');
  assert.equal(corePack.length, 33);
  for (const row of corePack) {
    assert.equal(runtime.enemies.get(row.id)?.poiseMax, row.enemy.poiseMax, `${row.id} poiseMax`);
  }
});

test('Core 1 runtime registry: Wandering Soldier keeps poise 10', () => {
  assert.equal(registryFor('ashen.core@1.0.0').enemies.get('wanderingSoldier').poiseMax, 10);
});

test('Core 1 runtime registry: every enemy poiseMax equals the core-v1 pack', () => {
  const runtime = registryFor('ashen.core@1.0.0');
  assert.equal(core1Pack.length, 33);
  for (const row of core1Pack) {
    assert.equal(runtime.enemies.get(row.id)?.poiseMax, row.enemy.poiseMax, `${row.id} poiseMax`);
  }
});
