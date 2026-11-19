// Owner, 2026-11-18: Gale Push and Hit and Run ("Retreat one band") send the target to the back row, as enemy retreats and Force pushes do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { bandsFight, pairOf } from './helpers/bands-fight.mjs';

for (const cardId of ['core.galePush', 'core.hitAndRun']) {
  test(`${cardId} moves its front-row target to the back row (state, band, drawn rank)`, () => {
    const combat = bandsFight({ hand: [cardId] });
    const [soldier] = combat.enemies;
    assert.equal(soldier.row, 'front');
    assert.equal(soldier.formationCell[1], '3');
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: soldier.id });
    assert.equal(soldier.row, 'back');
    assert.equal(combat.rangeState.engagements[pairOf(soldier.id)], 1);
    assert.equal(soldier.formationCell[1], '4', 'drawn in the back rank column');
    assert.ok(combat.eventLog.some(event => event.type === 'combatRowChanged' && event.targetId === soldier.id && event.row === 'back'));
  });
}
