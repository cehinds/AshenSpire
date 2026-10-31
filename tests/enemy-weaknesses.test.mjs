// Enemy weaknesses (owner, 2026-10-31; SPEC 5.3): authored data, hit classification, receipt stage, effects, UI rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { weaknessProblems, WEAKNESS_EFFECTS } from '../src/model/enemyWeaknessRules.js';

const registries = createRegistries(contentBundle);
const pack = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/characters.json', import.meta.url), 'utf8'))
  .filter(row => row.tags?.includes('character.enemy'));

test('every enemy (registry and Core pack) has valid weaknesses, and the two agree', () => {
  const all = contentBundle.enemies.map(def => registries.enemies.get(def.id));
  assert.equal(all.length, 33);
  for (const def of all) {
    assert.deepEqual(weaknessProblems(def.weaknesses), [], def.id);
    const row = pack.find(r => r.id === def.id);
    assert.deepEqual(row?.enemy.weaknesses, def.weaknesses, `${def.id} pack matches registry`);
    if (row.tags.includes('tier.boss')) assert.equal(def.weaknesses.length, 1, `${def.id} boss has exactly one`);
  }
});

test('the validator refuses malformed weaknesses', () => {
  assert.ok(weaknessProblems([]).length);
  assert.ok(weaknessProblems([{ to: 'blunt', effect: 'stacks' }]).length, 'stacks needs a status');
  assert.ok(weaknessProblems([{ to: 'burn', effect: 'damage' }]).length, 'damage needs a hit trigger');
  assert.ok(weaknessProblems([{ to: 'paralysis', effect: 'tick' }]).length, 'paralysis has no tick');
  assert.ok(weaknessProblems([{ to: 'blunt', effect: 'stagger', amount: 150 }]).length);
  assert.ok(weaknessProblems([{ to: 'blunt', effect: 'nope' }]).length);
  assert.deepEqual(weaknessProblems([{ to: 'frost', effect: 'damage' }, { to: 'frost', effect: 'stacks' }]), []);
  assert.equal(WEAKNESS_EFFECTS.length, 6);
});
