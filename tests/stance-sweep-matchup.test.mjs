// Owner ruling 2026-11-01 ("Counter and smash"): in the stances module, Sweep beats Counter and Smash,
// and nothing else. The matchup table is data (engine/modules/stances/defaults.json); the guide quotes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const defaults = JSON.parse(read('engine/modules/stances/defaults.json'));
const beats = (attacker, defender) => !!defaults.matchups[attacker]?.includes(defender);

test('Sweep beats Counter and Smash', () => {
  assert.equal(beats('sweep', 'counter'), true);
  assert.equal(beats('sweep', 'smash'), true);
});

test('Sweep does not beat Defend, Attack or Prepared', () => {
  for (const stance of ['defend', 'attack', 'prepared']) assert.equal(beats('sweep', stance), false, stance);
  assert.deepEqual([...defaults.matchups.sweep].sort(), ['counter', 'smash']);
});

test('the stances guide quotes the shipped matchup default', () => {
  assert.ok(read('engine/modules/stances/guide.md').includes(`default \`${JSON.stringify(defaults.matchups)}\``));
});
