// Owner, 2026-11-15 (W25-BANDS) rule 9: spell lanes. Fire's spread stays in the aimed enemy's row, Lightning's chain prefers an enemy in the same row,
// Force pushes the hit enemy back a row (the pull is in tests/bands-force.test.mjs). Fights without the bands block play the old "every enemy" rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { SetEnemyRow } from '../src/engine/bandRows.js';
import { ElementChainTarget, ElementSecondaryPlan } from '../src/engine/elementIdentity.js';

/** Three enemies: e1 and e2 in the front row, e3 in the back row. */
const lanes = (opts = {}) => {
  const f = fight({ enemies: 3, ...opts });
  SetEnemyRow(f.combat, f.enemies[2], 'back', 'test');
  return f;
};

test('fire spreads only across the aimed enemy\'s row: the front pair is hit, the back enemy is not; shown = dealt', () => {
  const { combat, enemies } = lanes();
  assert.deepEqual(enemies.map(e => e.row), ['front', 'front', 'back']);
  const played = play(combat, 'core.cinderDart', enemies[0].id);
  assert.ok(played.lost.e1 > 0 && played.lost.e2 > 0);
  assert.equal(played.lost.e3, 0, 'the back row is spared');
  assert.equal(played.lost.e1, played.row.faceValue, 'shown = dealt');
  assert.equal(played.lost.e1, played.lost.e2);
});

test('fire aimed at the lone back enemy hits only it, at full damage (no spread multiplier)', () => {
  const { combat, enemies } = lanes();
  const played = play(combat, 'core.cinderDart', enemies[2].id);
  assert.equal(played.lost.e1 + played.lost.e2, 0);
  assert.equal(played.lost.e3, played.row.faceValue, 'shown = dealt');
  const front = lanes();
  const spread = play(front.combat, 'core.cinderDart', front.enemies[0].id);
  assert.ok(played.lost.e3 > spread.lost.e1, 'alone in its row it is not x0.6');
});

test('the lightning chain prefers an enemy in the same row, else any', () => {
  const { combat, enemies, player } = lanes();
  SetEnemyRow(combat, enemies[1], 'back', 'test'); // e1 front; e2 and e3 back
  assert.equal(ElementChainTarget(combat, player, enemies[2]), enemies[1], 'a back enemy chains to the other back enemy');
  assert.equal(ElementChainTarget(combat, player, enemies[0]), enemies[1], 'no front partner: the next in order');
  SetEnemyRow(combat, enemies[2], 'front', 'test'); // e1, e3 front; e2 back
  assert.equal(ElementChainTarget(combat, player, enemies[0]), enemies[2], 'skips the next enemy in order (back row) for the same-row one');
  enemies[2].alive = false;
  assert.equal(ElementChainTarget(combat, player, enemies[0]), enemies[1], 'with no one in its row it chains to any');
  assert.equal(ElementSecondaryPlan(combat, player, enemies[0], { combatProfile: { camp: 'spell', school: 'lightning' }, tags: ['school:lightning'] })[0].target, enemies[1]);
});

test('live: Spark chains half to the same-row enemy, not the next in order; shown = dealt', () => {
  const { combat, enemies } = lanes();
  SetEnemyRow(combat, enemies[1], 'back', 'test');
  SetEnemyRow(combat, enemies[2], 'front', 'test'); // e1, e3 front; e2 back
  const played = play(combat, 'core.spark', enemies[0].id);
  assert.equal(played.lost.e1, played.row.faceValue, 'shown = dealt');
  assert.equal(played.lost.e2, 0, 'the next in order stands in the other row');
  assert.equal(played.lost.e3, Math.floor(played.lost.e1 / 2));
});

test('a fight made without the bands block: fire spreads to every enemy and lightning chains to the next in order', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const { combat, enemies, player } = fight({ enemies: 3 });
    assert.equal(enemies[0].row, undefined);
    assert.equal(ElementChainTarget(combat, player, enemies[0]), enemies[1]);
    const played = play(combat, 'core.cinderDart', enemies[0].id);
    assert.ok(played.lost.e1 > 0 && played.lost.e2 > 0 && played.lost.e3 > 0);
  } finally { fixCoreMechanics.bands = saved; }
});
