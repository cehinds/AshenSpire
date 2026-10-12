// Combat Rounds Preview (SPEC §4.11): the `combatRounds` RNG stream is appended
// last, so every existing stream keeps its rolls, and an off-mode save writes
// no new key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';

test('combatRounds is the last stream, and no earlier stream moved', () => {
  assert.equal(STREAM_NAMES.at(-1), 'combatRounds');
  assert.equal(STREAM_NAMES.indexOf('enemyIntentClue'), STREAM_NAMES.length - 2);
});

test('existing streams roll the same values on a fixed seed (golden from before the stream existed)', () => {
  const rng = createRng(12345);
  assert.deepEqual(
    [rng.float('map'), rng.float('map'), rng.int('shop', 0, 100), rng.float('enemyIntentClue')],
    [0.6159070006106049, 0.9308329280465841, 86, 0.12705140723846853],
  );
});

test('off mode: an untouched run has no combatRounds key in its counters', () => {
  const rng = createRng(777);
  const counters = rng.getCounters();
  assert.equal('combatRounds' in counters, false);
  rng.float('shuffle');
  assert.equal('combatRounds' in rng.getCounters(), false, 'drawing another stream adds no key');
  assert.equal(Object.keys(counters).length, STREAM_NAMES.length - 1);
});

test('once drawn, the stream is saved with its count and restores exactly', () => {
  const rng = createRng(9);
  rng.float('combatRounds');
  rng.float('combatRounds');
  const saved = rng.getCounters();
  assert.equal(saved.combatRounds, 2);
  const next = rng.float('combatRounds');
  const resumed = createRng(9, saved);
  assert.equal(resumed.float('combatRounds'), next);
});

test('a save written before the stream existed reads it as 0', () => {
  const old = createRng(7).getCounters(); // a pre-stream save: no combatRounds key
  assert.equal('combatRounds' in old, false);
  const restored = createRng(7);
  restored.restoreCounters(old);
  assert.equal(restored.getCounters().combatRounds, undefined, 'still omitted while zero');
  assert.equal(restored.float('combatRounds'), createRng(7).float('combatRounds'), 'first draw is draw 1');
});

test('restoreCounters still refuses a bad combatRounds counter', () => {
  const rng = createRng(1);
  const counters = rng.getCounters();
  assert.throws(() => rng.restoreCounters({ ...counters, combatRounds: -1 }), /Invalid RNG counter: combatRounds/);
});
