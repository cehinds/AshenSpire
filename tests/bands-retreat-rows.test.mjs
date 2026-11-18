// Owner, 2026-11-18: a player Retreat (core.retreat, core.backstep's Retreat) ends the Advance and sends every front-row enemy to the back row, Advanced or not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { bandsFight, pairOf } from './helpers/bands-fight.mjs';
import { cardFaceLines } from '../src/model/cardFaceText.js';

for (const cardId of ['core.retreat', 'core.backstep']) {
  test(`${cardId}, not Advanced: the front enemy goes to the back row (band 1, drawn in the back rank); the back enemy stays`, () => {
    const combat = bandsFight({ hand: [cardId] });
    const [soldier, wisp] = combat.enemies;
    assert.deepEqual([soldier.row, wisp.row, combat.player.advanced > 0], ['front', 'back', false]);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
    assert.deepEqual([soldier.row, wisp.row], ['back', 'back']);
    assert.equal(combat.rangeState.engagements[pairOf(soldier.id)], 1);
    assert.equal(soldier.formationCell[1], '4');
    assert.ok(combat.eventLog.some(event => event.type === 'combatRowChanged' && event.targetId === soldier.id && event.row === 'back'));
  });
  test(`${cardId}, Advanced: the Advance ends and the front enemy goes back`, () => {
    const combat = bandsFight({ hand: [cardId] });
    combat.player.advanced = 2;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
    assert.equal(combat.player.advanced, 0);
    assert.deepEqual(combat.enemies.map(enemy => enemy.row), ['back', 'back']);
    assert.equal(combat.rangeState.engagements[pairOf(combat.enemies[0].id)], 1);
  });
}
test('back-row enemies stay back (a lone back-row foe)', () => {
  const combat = bandsFight({ hand: ['core.retreat'], enemyIds: ['graveWisp'] });
  assert.equal(combat.enemies[0].row, 'back');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.equal(combat.enemies[0].row, 'back');
});
test('the Retreat card text says foes step back', () => {
  const combat = bandsFight({ hand: ['core.retreat'] });
  const card = combat.registries.cards.get('core.retreat');
  assert.match(JSON.stringify(cardFaceLines(card, null, combat.registries)), /front-row foes step back/);
  assert.ok(previewCard(combat, 'qa0'));
});
