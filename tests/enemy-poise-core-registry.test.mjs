// The runtime enemy registry that combat reads (registries.enemies) must carry the
// Core pack's halved poiseMax for every enemy (owner, 2026-10-19: lower enemy
// starting poise by 50 percent). The pack is the authoring source; the act*Enemies
// sources are what the runtime compiles from, so both must agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

const corePack = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/characters.json', import.meta.url), 'utf8'))
  .filter(row => row.tags?.includes('character.enemy'));
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const runtime = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('runtime Core registry: Wandering Soldier starts at poise 5', () => {
  assert.equal(runtime.enemies.get('wanderingSoldier').poiseMax, 5);
});

test('runtime Core registry: every enemy poiseMax equals the Core pack value', () => {
  assert.equal(corePack.length, 33);
  for (const row of corePack) {
    assert.equal(runtime.enemies.get(row.id)?.poiseMax, row.enemy.poiseMax, `${row.id} poiseMax`);
  }
});
