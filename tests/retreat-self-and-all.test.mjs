// Owner, 2026-11-18 section 22: a card that affects the player and every enemy plays when you select the player OR any enemy as its target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { cardTargetPlan, SelfAndAll } from '../src/model/cardTargets.js';
import { bandsFight, registries } from './helpers/bands-fight.mjs';

const stacks = (entity, id) => entity.statuses?.[id]?.stacks || 0;

test('Rallying Roar and Reaping Arc are self-and-all; a single-foe card and a self card are not', () => {
  assert.ok(SelfAndAll(registries.cards.get('core.rallyingRoar')));
  assert.ok(SelfAndAll(registries.cards.get('core.reapingArc')));
  assert.ok(!SelfAndAll(registries.cards.get('core.smokeVeil')), 'one chosen foe');
  assert.ok(!SelfAndAll(registries.cards.get('core.strike')), 'a single hit');
  assert.ok(!SelfAndAll(registries.cards.get('core.defend')), 'self only');
});

test('the target plan lists every living enemy and the player', () => {
  const combat = bandsFight({ hand: ['core.rallyingRoar'] });
  const plan = cardTargetPlan(registries.cards.get('core.rallyingRoar'), combat.player.id, combat.enemies, [{ id: combat.player.id, alive: true, connected: true }], { solo: true });
  assert.equal(plan.mode, 'enemy');
  assert.deepEqual([...plan.legalIds].sort(), [combat.player.id, ...combat.enemies.map(e => e.id)].sort());
});

test('a single-foe card keeps the enemies as its only legal targets', () => {
  const combat = bandsFight({ hand: ['core.strike'] });
  const plan = cardTargetPlan(registries.cards.get('core.strike'), combat.player.id, combat.enemies, [{ id: combat.player.id, alive: true, connected: true }], { solo: true });
  assert.ok(!plan.legalIds.includes(combat.player.id));
});

for (const [name, pick] of [['the player', combat => combat.player.id], ['an enemy', combat => combat.enemies[1].id], ['no target', () => undefined]]) {
  test(`Rallying Roar played on ${name}: Block for the player, Weak on every enemy`, () => {
    const combat = bandsFight({ hand: ['core.rallyingRoar'] });
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: pick(combat) });
    assert.ok(combat.player.block > 0, 'Block');
    for (const enemy of combat.enemies) assert.equal(stacks(enemy, 'weak'), 2, `${enemy.id} Weak`);
  });
}

test('a single-foe card still refuses the player as its target', () => {
  const combat = bandsFight({ hand: ['core.strike'] });
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: combat.player.id }), /Invalid enemy target/);
});
