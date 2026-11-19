// Owner, 2026-11-18 section 22 (amended 2026-11-19): a hit with no Reach needs one Advance (1 SP, one stack spent) for each Retreat stack, the enemy's and the
// player's. One stack each 1 SP, 3 enemy stacks 3 SP, 2 enemy + 1 player 3 SP, Reach 0. Shown cost = paid cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { SetEnemyRow } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const stacks = entity => entity.statuses?.retreat?.stacks || 0;
function fight(card, { player = 0, enemy = 0, stamina = 6 } = {}) {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: [card], stamina });
  const target = combat.enemies[0];
  if (enemy) { SetEnemyRow(combat, target, 'back', 'push'); applyStatus(combat, target, 'retreat', enemy, null); }
  if (player) applyStatus(combat, combat.player, 'retreat', player, null);
  return { combat, target };
}
function play(card, sides) {
  const { combat, target } = fight(card, sides);
  const shown = previewCard(combat, 'qa0', target.id).cost;
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: target.id });
  return { combat, target, shown, paid: before - combat.player.stamina };
}

const base = play('core.strike', {}).paid;

test('neither side retreated: the card costs its price', () => {
  const r = play('core.strike', {});
  assert.equal(r.shown, base);
});

test('only the player holds Retreat: +1 SP, shown = paid, the player\'s stack is spent', () => {
  const r = play('core.strike', { player: 1 });
  assert.equal(r.shown, base + 1);
  assert.equal(r.paid, base + 1);
  assert.equal(stacks(r.combat.player), 0);
});

test('only the enemy holds Retreat: +1 SP, shown = paid, its stack is spent', () => {
  const r = play('core.strike', { enemy: 1 });
  assert.equal(r.shown, base + 1);
  assert.equal(r.paid, base + 1);
  assert.equal(stacks(r.target), 0);
});

test('both hold Retreat: 2 Advances, +2 SP, shown = paid, both stacks are spent', () => {
  const r = play('core.strike', { player: 1, enemy: 1 });
  assert.equal(r.shown, base + 2);
  assert.equal(r.paid, base + 2);
  assert.equal(stacks(r.combat.player), 0);
  assert.equal(stacks(r.target), 0);
});

test('a Reach hit (a spell) needs no Advance on either side', () => {
  const none = play('core.cinderDart', {});
  const both = play('core.cinderDart', { player: 1, enemy: 1 });
  assert.equal(both.shown, none.shown);
  assert.equal(both.paid, none.paid);
  assert.equal(stacks(both.combat.player), 1, 'no Advance, no stack spent');
});

test('the player\'s own stacks count one Advance each: 2 stacks, +2 SP, both spent', () => {
  const r = play('core.strike', { player: 2 });
  assert.equal(r.shown, base + 2);
  assert.equal(r.paid, base + 2);
  assert.equal(stacks(r.combat.player), 0);
});

test('3 enemy stacks: 3 Advances, +3 SP (the back-row band is the first), all 3 spent', () => {
  const r = play('core.strike', { enemy: 3 });
  assert.equal(r.shown, base + 3);
  assert.equal(r.paid, base + 3);
  assert.equal(stacks(r.target), 0);
});

test('2 enemy stacks + 1 player stack: 3 Advances, +3 SP, the enemy\'s spent first and then the player\'s (all spent)', () => {
  const r = play('core.strike', { enemy: 2, player: 1 });
  assert.equal(r.shown, base + 3);
  assert.equal(r.paid, base + 3);
  assert.equal(stacks(r.target), 0);
  assert.equal(stacks(r.combat.player), 0);
});

test('no cap: 6 enemy stacks and 4 player stacks cost 10 Advances', () => {
  const r = play('core.strike', { enemy: 6, player: 4, stamina: 20 });
  assert.equal(r.shown, base + 10);
  assert.equal(r.paid, base + 10);
});

test('a Reach hit ignores stacks however many there are', () => {
  const none = play('core.cinderDart', {});
  const many = play('core.cinderDart', { player: 3, enemy: 3 });
  assert.equal(many.paid, none.paid);
});

test('a card\'s own free Advance (Driving Thrust) covers one stack, and the shown cost is the paid cost', () => {
  const r = play('core.drivingThrust', { enemy: 3 });
  const plain = play('core.drivingThrust', {});
  assert.equal(r.shown, plain.shown + 2);
  assert.equal(r.paid, r.shown);
  assert.equal(stacks(r.target), 0);
});

test('enemy moves: against a player holding Retreat, an enemy Advance (its own, or the one its attack pays) spends the stack; a move that needs none leaves it', () => {
  let spent = 0, kept = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const combat = bandsFight({ enemyIds: ['wanderingSoldier'], seed });
    applyStatus(combat, combat.player, 'retreat', 1, null);
    const before = combat.eventLog.filter(e => e.type === 'enemyMoveStarted').length;
    dispatch(combat, { type: 'endTurn' });
    const played = combat.eventLog.filter(e => e.type === 'enemyMoveStarted').slice(before).map(e => e.moveId);
    if (played.some(id => id === 'advance' || id === 'slash')) { spent++; assert.equal(stacks(combat.player), 0, `seed ${seed}: ${played} spent the player's stack`); }
    else { kept++; assert.equal(stacks(combat.player), 1, `seed ${seed}: ${played} needs no Advance`); }
  }
  assert.ok(spent > 0 && kept > 0, 'some seeds advance or attack, some do neither');
});
