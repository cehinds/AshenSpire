// SPEC: Advanced lasts until your next turn ends or you play Retreat. A push ends the pusher's Advance only when the same card play advanced in
// first (Hit and Run steps back out); Gale Push while already Advanced leaves the Advance, the other enemy's band and its intent alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { bandsFight, pairOf } from './helpers/bands-fight.mjs';

const play = (combat, instanceId, targetId) => dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId });
const intentOf = enemy => JSON.stringify({ moveId: enemy.intent?.moveId, approachFor: enemy.intent?.approachFor ?? null });

test('Advance, then Gale Push on the front enemy: the Advance stays on, the back enemy stays in reach, its intent does not flip', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'graveWisp'], hand: ['core.advance', 'core.galePush'] });
  const [front, back] = combat.enemies;
  play(combat, 'qa0', back.id);
  assert.equal(combat.player.advanced, 2);
  const intentBefore = intentOf(back);
  play(combat, 'qa1', front.id);
  assert.equal(front.row, 'back', 'the pushed enemy goes to the back row');
  assert.equal(combat.player.advanced, 2, 'the push did not end the Advance');
  assert.equal(combat.rangeState.engagements[pairOf(back.id)], 0, 'the other enemy is still in reach');
  assert.equal(intentOf(back), intentBefore, 'its intent did not flip mid-turn');
  const moved = combat.eventLog.filter(e => e.type === 'combatEngagementMoved' && e.targetId === front.id).pop();
  assert.equal(moved.bands, 0, 'the receipt matches the engine: the Advance held the pair at band 0');
});

test('Hit and Run still steps the pusher back out of its own Advance', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.hitAndRun'] });
  const [enemy] = combat.enemies;
  enemy.row = 'back';
  play(combat, 'qa0', enemy.id);
  assert.ok(!(combat.player.advanced > 0), 'the Advance the card paid for is ended by its own retreat');
});
