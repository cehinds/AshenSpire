// enemies.turnActions (docs/design/SIMPLE-COMBAT-PLAN.md step 1): "single" plans and plays one
// move a turn, its shown intent; "spPool" (Core today) plans as many moves as the SP pool buys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import {
  SimpleCombatFixture,
  SimpleCombatRegistries,
  SimpleCombatFight,
} from './helpers/simple-combat.mjs';

const SINGLE_ACTION = 'singleEnemyAction';
const END_TURN = { type: 'endTurn' };
const MOVE_STARTED = 'enemyMoveStarted';
const PROBE = SimpleCombatFixture.enemyTurnProbe;

// Each seed's planned follow-ups and the moves the enemy then plays in its first turn.
function enemyTurns(overrideName)
{
  const registries = SimpleCombatRegistries(overrideName);
  return PROBE.seeds.map(seed =>
  {
    const combat = SimpleCombatFight(registries, seed);
    const enemy = combat.enemies[0];
    Object.assign(combat.player, { hp: PROBE.playerHp, maxHp: PROBE.playerHp });
    const followUps = enemy.plannedMoves.length;
    const played = dispatch(combat, END_TURN).events
      .filter(event => event.type === MOVE_STARTED && event.sourceId === enemy.id)
      .length;
    return { followUps, played };
  });
}

test('enemies.turnActions spPool: some enemy plans and plays more than one move', () =>
{
  const turns = enemyTurns(null);
  assert.ok(turns.some(turn => turn.followUps > 0), 'a plan has follow-ups');
  assert.ok(turns.some(turn => turn.played > 1), 'an enemy turn plays several moves');
});

test('enemies.turnActions single: every enemy plans and plays one move', () =>
{
  const turns = enemyTurns(SINGLE_ACTION);
  for (const turn of turns)
  {
    assert.equal(turn.followUps, 0, 'no follow-ups are planned');
    assert.ok(turn.played <= 1, 'at most the head move plays');
  }
  assert.ok(turns.some(turn => turn.played === 1), 'the head move still plays');
});
