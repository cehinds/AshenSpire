// Owner, 2026-11-18 section 22: a hit between two combatants needs one Advance (1 SP, one stack spent) for each side that holds a Retreat stack,
// unless it has Reach. Player only 1 SP, enemy only 1 SP, both 2 SP, Reach 0. Shown cost = paid cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { SetEnemyRow } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const stacks = entity => entity.statuses?.retreat?.stacks || 0;
function fight(card, { player = 0, enemy = 0 } = {}) {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: [card], stamina: 6 });
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

test('the ruling counts sides, not stacks: a player holding 2 stacks closes one side, +1 SP (the Advance spends one stack)', () => {
  assert.equal(play('core.strike', { player: 2 }).paid, base + 1);
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
