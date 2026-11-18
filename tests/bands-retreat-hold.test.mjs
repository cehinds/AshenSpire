// Owner, 2026-11-18: Retreat (card or push) gives each enemy sent back 1 Retreat stack. While it has one it stays in the back row (the
// empty-front-row pull does not move it). An Advance removes one: the player's (every enemy loses one) or the enemy's own (its approach
// spends the stack instead of stepping forward). With none left it advances as normal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { SetAdvanced } from '../src/engine/bandRows.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const endTurn = combat => dispatch(combat, { type: 'endTurn' });
const stacks = enemy => enemy.statuses?.retreat?.stacks || 0;
const rowEvents = (combat, id, reason) => combat.eventLog.filter(e => e.type === 'combatRowChanged' && e.targetId === id && e.reason === reason);

test('Retreat gives each front enemy sent back one stack; the empty front row does not pull it forward', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.retreat'] });
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.equal(enemy.row, 'back');
  assert.equal(stacks(enemy), 1);
  endTurn(combat);
  assert.equal(rowEvents(combat, enemy.id, 'frontEmpty').length, 0, 'a stacked enemy is not pulled forward');
});

test('a push (Gale Push) gives the target a stack', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.galePush'] });
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  assert.equal(enemy.row, 'back');
  assert.equal(stacks(enemy), 1);
});

test("the enemy's own approach spends the stack instead of moving it; the move played is the move shown", () => {
  let spent = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const combat = bandsFight({ enemyIds: ['wanderingSoldier'], seed, hand: ['core.retreat'] });
    const enemy = combat.enemies[0];
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
    const shown = enemy.intent.moveId;
    const before = combat.eventLog.filter(e => e.type === 'enemyMoveStarted').length;
    endTurn(combat);
    assert.equal(combat.eventLog.filter(e => e.type === 'enemyMoveStarted')[before]?.moveId, shown, `seed ${seed}: the move played is the move shown`);
    assert.equal(rowEvents(combat, enemy.id, 'approach').length, 0, `seed ${seed}: held, it does not step forward`);
    assert.equal(enemy.row, 'back');
    if (shown === 'advance') { spent++; assert.equal(stacks(enemy), 0, `seed ${seed}: the approach spent the stack`); }
    else assert.equal(stacks(enemy), 1, `seed ${seed}: no approach, the stack stays`);
  }
  assert.ok(spent > 0, 'some seed approaches while held');
});

test("the player's Advance removes one stack from every enemy", () => {
  const combat = bandsFight({ hand: ['core.retreat'] }); // wanderingSoldier front, graveWisp back
  const [soldier] = combat.enemies;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.equal(stacks(soldier), 1);
  SetAdvanced(combat, combat.player, true);
  assert.equal(stacks(soldier), 0);
  assert.equal(soldier.row, 'back', 'it stays back; only the stack is gone');
});

test('Reach ignores Retreat: a reach spell hits a stacked back-row enemy and leaves its stacks alone', () => {
  const combat = bandsFight({ hand: ['core.cinderDart'], stamina: 6 });
  const wisp = combat.enemies[1];
  assert.equal(wisp.row, 'back');
  wisp.statuses.retreat = { stacks: 2 };
  const hp = wisp.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: wisp.id });
  assert.ok(wisp.hp < hp, 'the reach card hit the back row');
  assert.equal(stacks(wisp), 2, 'a reach hit removes no Retreat stack');
  assert.ok(!(combat.player.advanced > 0), 'it did not Advance the player');
  assert.equal(wisp.row, 'back');
});

test('two enemies: an unstacked back enemy steps forward at once; the stacked one stays', () => {
  const combat = bandsFight({ hand: ['core.retreat'] });
  const [soldier, wisp] = combat.enemies;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.deepEqual([soldier.row, wisp.row], ['back', 'back']);
  assert.equal(stacks(wisp), 0, 'an enemy already back gets no stack');
  endTurn(combat);
  assert.equal(rowEvents(combat, wisp.id, 'frontEmpty').length, 1, 'the unstacked back enemy steps forward');
  assert.equal(rowEvents(combat, soldier.id, 'frontEmpty').length, 0, 'the stacked one stays');
});
