// Owner, 2026-11-15 (W25-BANDS): a fight saved with rows restores them; a fight saved before rows restores with none and keeps playing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { bandsFight, registries, pairOf } from './helpers/bands-fight.mjs';

const json = value => JSON.parse(JSON.stringify(value));
const restore = (combat, snapshot) => restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot });

test('rows and the Advanced state survive a save and load', () => {
  const combat = bandsFight({ hand: ['core.strike'] });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  const saved = json(serializeCombatSnapshot(combat));
  assert.deepEqual(combatSnapshotProblems(saved), []);
  const back = restore(combat, saved);
  assert.deepEqual(back.enemies.map(e => e.row), ['front', 'back']);
  assert.equal(back.player.advanced, 2);
  assert.equal(back.rangeState.engagements[pairOf('e2')], 0);
  assert.deepEqual(json(serializeCombatSnapshot(back)), saved);
  dispatch(back, { type: 'endTurn' });
  assert.equal(back.player.advanced, 1, 'the restored Advance keeps counting down');
});

test('a fight saved before rows (no bands key, no row fields) loads and keeps playing as before', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  let snapshot, combat;
  try { combat = bandsFight({ hand: ['core.strike'] }); snapshot = json(serializeCombatSnapshot(combat)); } finally { fixCoreMechanics.bands = saved; }
  assert.equal(Object.hasOwn(snapshot.fixCoreRules, 'bands'), false);
  const back = restore(combat, snapshot);
  assert.deepEqual(back.enemies.map(e => e.row), [undefined, undefined]);
  dispatch(back, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.equal(back.player.advanced, undefined);
  assert.equal(back.rangeState.engagements[pairOf('e2')], 0, 'the paid Advance still closes the pair for good');
  dispatch(back, { type: 'endTurn' });
  assert.equal(back.rangeState.engagements[pairOf('e2')], 0);
});
