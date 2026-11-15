// Owner, 2026-11-15 (W25-BANDS) rules 1, 2, 4: rows, the +1 melee surcharge on the back row, the timed Advance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { bandsFight, pairOf } from './helpers/bands-fight.mjs';

test('enemies stand in rows: a reach starter is back, the rest front; encounter placement wins', () => {
  const combat = bandsFight();
  assert.deepEqual(combat.enemies.map(e => e.row), ['front', 'back']);
  assert.equal(combat.rangeState.engagements[pairOf('e1')], 0);
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 1);
  const placed = bandsFight({ encounter: { id: 'x', rows: ['back', 'front'] } });
  assert.deepEqual(placed.enemies.map(e => e.row), ['back', 'front']);
});

test('a melee card at the front costs its price; at the back it costs +1 and auto-Advances, shown = paid', () => {
  const front = bandsFight({ hand: ['core.strike'] });
  const frontCost = previewCard(front, 'qa0', 'e1').cost;
  const back = bandsFight({ hand: ['core.strike'] });
  const backFace = previewCard(back, 'qa0', 'e2');
  assert.equal(backFace.cost, frontCost + 1);
  const before = back.player.stamina;
  dispatch(back, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.equal(before - back.player.stamina, backFace.cost);
  assert.ok(back.player.advanced > 0, 'the player is Advanced');
  assert.equal(back.rangeState.engagements[pairOf('e2')], 0);
});

test('the Advance lasts through the enemy phase and the next turn, then the back row is out of reach again', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'graveWisp'], hand: ['core.strike'] });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
  assert.equal(combat.player.advanced, 2);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.advanced, 1, 'still Advanced in the next turn');
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 0);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.advanced, 0);
});

const surgeonScalpel = ({ advanced = false } = {}) => {
  const combat = bandsFight({ enemyIds: ['courtSurgeon', 'wanderingSoldier'], seed: 5 });
  const surgeon = combat.enemies[0];
  assert.equal(surgeon.row, 'back');
  surgeon.intent = { ...surgeon.intent, moveId: 'scalpel', kind: 'attack' };
  surgeon.plannedMoves = []; // no follow-up this turn: the intent is the whole turn
  if (advanced) combat.player.advanced = 2, combat.rangeState = { ...combat.rangeState, engagements: { ...combat.rangeState.engagements, [pairOf('e1')]: 0 } };
  return { combat, surgeon };
};

test('Engage: a melee move from the back row is spent stepping forward; the attack lands the turn after', () => {
  const { combat, surgeon } = surgeonScalpel();
  const hp = combat.player.hp;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(surgeon.row, 'front');
  assert.equal(combat.player.hp, hp, 'no damage on the approach turn');
});

test('Engage: an Advanced player is in reach, so the back row attacks directly', () => {
  const { combat, surgeon } = surgeonScalpel({ advanced: true });
  const hp = combat.player.hp;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(surgeon.row, 'back', 'it did not move');
  assert.ok(combat.player.hp < hp, 'it hit');
});

test('with no front-row enemy left the back row steps forward at the enemy phase', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'graveWisp'] });
  combat.enemies[0].hp = 0; combat.enemies[0].alive = false;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.enemies[1].row, 'front');
  assert.equal(combat.rangeState.engagements[pairOf('e2')], 0);
});

test('a fight made without the bands key plays as before: no rows, no Advanced state, the paid Advance closes the pair for good', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const combat = bandsFight({ hand: ['core.strike'] });
    assert.deepEqual(combat.enemies.map(e => e.row), [undefined, undefined]);
    assert.equal(combat.rangeState.engagements[pairOf('e2')], 1);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: 'e2' });
    assert.equal(combat.player.advanced, undefined);
    assert.equal(combat.rangeState.engagements[pairOf('e2')], 0);
    dispatch(combat, { type: 'endTurn' }); dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.rangeState.engagements[pairOf('e2')], 0, 'persistent until something grows it');
  } finally { fixCoreMechanics.bands = saved; }
});
