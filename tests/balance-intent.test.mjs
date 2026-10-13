// tools/balance-intent.mjs: intent DPS must stay finite when an enemy carries an
// enemy reaction move (a move with `reaction` and no `weight`). Such a move is
// never rolled as an intent (src/engine/combat.js weightedMovePick), so it must
// not enter the weighting; before the fix it made every enemy with one print NaN.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { intentStats } from '../tools/balance-intent.mjs';

test('a reaction move with no weight does not change intent DPS', () => {
  const base = {
    hp: [10, 10],
    moves: {
      thrust: { intent: 'attack', damage: 10, weight: 50 },
      rally: { intent: 'buff', weight: 50 },
    },
  };
  const withReaction = {
    ...base,
    moves: { ...base.moves, counter: { intent: 'attack', damage: 3, reaction: { on: ['playerAction'], minIncoming: 0 } } },
  };
  const a = intentStats(base);
  const b = intentStats(withReaction);
  assert.ok(Number.isFinite(b.dps), `dps is ${b.dps}`);
  assert.ok(Number.isFinite(b.heal), `heal is ${b.heal}`);
  assert.equal(a.dps, 5);
  assert.equal(b.dps, a.dps);
});

test('locked moves are still excluded from intent DPS', () => {
  const def = {
    hp: [10, 10],
    moves: {
      thrust: { intent: 'attack', damage: 10, weight: 100 },
      phase2: { intent: 'attack', damage: 99, weight: 100, locked: true },
    },
  };
  assert.equal(intentStats(def).dps, 10);
});

test('every shipped enemy has a finite intent DPS and self-heal', () => {
  for (const def of contentBundle.enemies) {
    const { dps, heal } = intentStats(def);
    assert.ok(Number.isFinite(dps), `${def.id} intent dps is ${dps}`);
    assert.ok(Number.isFinite(heal), `${def.id} heal is ${heal}`);
  }
});

test('Gilded Knight keeps its 5.5 intent DPS (thrust 11 at weight 50 of 100)', () => {
  const def = contentBundle.enemies.find((e) => e.id === 'gildedKnight');
  assert.equal(intentStats(def).dps, 5.5);
});
