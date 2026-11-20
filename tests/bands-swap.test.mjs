// Owner, 2026-11-15 (W25-BANDS) rule 7: Upset the Ranks (1 Stamina, colorless uncommon) swaps the aimed enemy's row with the nearest enemy in the other row.
// Two-target selection does not exist in the card grammar, so the card aims at one enemy and its partner is chosen by the rule (nearest in the fight order).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { bandsFight, registries, pairOf } from './helpers/bands-fight.mjs';

test('the card is a 1 Stamina colorless uncommon skill', () => {
  const card = registries.cards.get('core.upsetRanks');
  assert.equal(card.class, 'colorless');
  assert.equal(card.rarity, 'uncommon');
  assert.equal(card.staminaCost, 1);
  assert.deepEqual(card.effects, [{ op: 'swapRows', target: 'enemy' }]);
});

test('aimed at the front enemy it swaps with the back enemy; shown cost = paid', () => {
  const combat = bandsFight({ hand: ['core.upsetRanks'] });
  const [soldier, wisp] = combat.enemies;
  assert.deepEqual([soldier.row, wisp.row], ['front', 'back']);
  const [cellA, cellB] = [soldier.formationCell, wisp.formationCell];
  const shown = previewCard(combat, 'qa0', soldier.id);
  assert.equal(shown.cost, 1, 'no Advance surcharge: it is not an attack');
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: soldier.id });
  assert.equal(before - combat.player.stamina, shown.cost);
  assert.deepEqual([soldier.row, wisp.row], ['back', 'front']);
  assert.equal(combat.rangeState.engagements[pairOf(soldier.id)], 1);
  assert.equal(combat.rangeState.engagements[pairOf(wisp.id)], 0);
  assert.deepEqual([soldier.formationCell, wisp.formationCell], [cellB, cellA], 'they trade ranks');
});

test('aimed at the back enemy the same pair swaps; the partner is the nearest in the other row', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'graveWisp', 'wanderingSoldier'], hand: ['core.upsetRanks'] });
  assert.deepEqual(combat.enemies.map(e => e.row), ['front', 'back', 'front']);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.deepEqual(combat.enemies.map(e => e.row), ['back', 'front', 'front'], 'e1 is nearest (a tie goes to the earlier)');
});

test('with nobody in the other row the target crosses alone', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'], hand: ['core.upsetRanks'] });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.deepEqual(combat.enemies.map(e => e.row), ['front', 'back']);
});

test('a fight made without the bands key: the card changes nothing', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const combat = bandsFight({ hand: ['core.upsetRanks'] });
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e1' });
    assert.deepEqual(combat.enemies.map(e => e.row), [undefined, undefined]);
  } finally { fixCoreMechanics.bands = saved; }
});
