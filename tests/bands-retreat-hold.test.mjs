// Owner, 2026-11-18: Retreat (card or push) gives each enemy sent back 1 Retreat stack. While it has one it stays in the back row (the
// empty-front-row pull does not move it). An Advance removes one: the player's (every enemy loses one) or the enemy's own (its approach
// spends the stack instead of stepping forward). With none left it advances as normal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { SetAdvanced } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
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

// Codex on PR #2835: a second Advance in the same turn (already at full duration) still spends a Retreat stack.
test('a repeated Advance spends a stack each time, even at full Advance duration', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.galePush'] });
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  applyStatus(combat, enemy, 'retreat', 1); // a second push's stack, without the SP for a second card
  assert.equal(stacks(enemy), 2);
  assert.equal(SetAdvanced(combat, combat.player, true), true);
  assert.equal(stacks(enemy), 1);
  assert.equal(SetAdvanced(combat, combat.player, true), true, 'the second Advance still acts');
  assert.equal(stacks(enemy), 0);
  assert.equal(SetAdvanced(combat, combat.player, true), false, 'with no stacks left and full duration it does nothing');
});

// Codex on PR #2835 (bandRows.js:172): a held enemy's approach spends ONE stack and does not move; the queued melee behind it must not land
// as if in range, nor wipe the other stacks through its implicit Advance. The plan shows an approach per stack; the plan shown is the plan played.
function heldPlan(seed, stackCount) {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], seed, hand: ['core.retreat'] });
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  enemy.statuses.retreat = { stacks: stackCount + 1 }; enemy.maxStamina = 6; // the first end turn plans a 6-SP turn (and may spend one stack)
  endTurn(combat);
  const start = stacks(enemy);
  const shown = [enemy.intent?.moveId, ...(enemy.plannedMoves || []).map(entry => entry.moveId)];
  const mark = combat.eventLog.length;
  endTurn(combat);
  return { combat, enemy, start, shown, events: combat.eventLog.slice(mark) };
}

test('a 6-SP plan with several stacks: each approach spends one, the enemy stays back, and no Slash lands while it holds a stack', () => {
  let held = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { enemy, start, events } = heldPlan(seed, 3);
    let left = start;
    for (const event of events) {
      if (event.type === 'combatEngagementMoved' && event.sourceId === enemy.id && left > 0) assert.equal(event.bands, 0, `seed ${seed}: a held approach announces no band move`);
      if (event.type === 'statusRemoved' && event.status === 'retreat' && event.targetId === enemy.id) left--;
      assert.ok(!(event.type === 'combatRowChanged' && event.targetId === enemy.id && event.reason === 'advance'), `seed ${seed}: no implicit Advance wipes the stacks`);
      if (event.type === 'damageDealt' && left > 0) assert.fail(`seed ${seed}: a melee attack landed while the enemy still held ${left} Retreat stacks`);
      if (event.type === 'combatRowChanged' && event.targetId === enemy.id && event.reason === 'approach') assert.equal(left, 0, `seed ${seed}: it steps forward only with no stacks left`);
    }
    assert.equal(stacks(enemy), Math.max(0, left), `seed ${seed}: stacks match the approaches played`);
    if (stacks(enemy) > 0) { held++; assert.equal(enemy.row, 'back', `seed ${seed}: still holding stacks, still in the back row`); }
  }
  assert.ok(held > 0, 'some seed ends the turn still holding stacks');
});

test('with one stack the approach spends it and the next Advance moves the enemy forward', () => {
  let stepped = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { combat, enemy, events } = heldPlan(seed, 0); // one stack in hand when the plan is read
    const removed = events.filter(e => e.type === 'statusRemoved' && e.status === 'retreat').length;
    const forward = events.findIndex(e => e.type === 'combatRowChanged' && e.targetId === enemy.id && ['approach', 'advance'].includes(e.reason));
    const spentAt = events.findIndex(e => e.type === 'statusRemoved' && e.status === 'retreat');
    if (forward >= 0) { stepped++; assert.ok(spentAt >= 0 && spentAt < forward, `seed ${seed}: the stack is spent first, then the step forward`); assert.equal(enemy.row, 'front'); }
    assert.ok(removed <= 1, `seed ${seed}: one stack, one removal`);
    assert.ok(combat.enemies[0] === enemy);
  }
  assert.ok(stepped > 0, 'some seed plays the second approach and steps forward');
});

test('intents shown equal moves played for a held enemy with a multi-action plan', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { shown, events } = heldPlan(seed, 3);
    const played = events.filter(e => e.type === 'enemyMoveStarted').map(e => e.moveId);
    assert.deepEqual(played, shown.filter(Boolean).slice(0, played.length), `seed ${seed}: the plan shown is the plan played`);
    assert.ok(played.length > 0);
  }
});
