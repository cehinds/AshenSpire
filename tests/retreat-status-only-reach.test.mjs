// Owner, 2026-11-18 section 22: a card's status effects that do not come from a melee attack, Sweep, Smash or Counter are Reach: they apply to a
// retreated enemy at no Advance cost. Its own Block still applies. A melee hit with a status still pays for the hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { SetEnemyRow } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const stacks = (entity, id) => entity.statuses?.[id]?.stacks || 0;
function play(card, { enemyRetreat = 0, playerRetreat = 0 } = {}) {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: [card], stamina: 6 });
  const enemy = combat.enemies[0];
  if (enemyRetreat) { SetEnemyRow(combat, enemy, 'back', 'push'); applyStatus(combat, enemy, 'retreat', enemyRetreat, null); }
  if (playerRetreat) applyStatus(combat, combat.player, 'retreat', playerRetreat, null);
  const shown = previewCard(combat, 'qa0', enemy.id).cost;
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  return { combat, enemy, shown, paid: before - combat.player.stamina };
}

test('Smoke Veil (Defend: Block + Weak) costs the same against a retreated enemy, and the Weak lands', () => {
  const plain = play('core.smokeVeil');
  const away = play('core.smokeVeil', { enemyRetreat: 1 });
  assert.equal(away.shown, plain.shown, 'no surcharge shown');
  assert.equal(away.paid, plain.paid, 'no surcharge paid');
  assert.equal(stacks(away.enemy, 'weak'), 2, 'the Weak applied to the retreated enemy');
  assert.ok(away.combat.player.block > 0, 'its own Block still applies');
  assert.equal(stacks(away.enemy, 'retreat'), 1, 'no Advance, so the stack stays');
});

test('the status is free when the player holds Retreat too, and when both do', () => {
  const plain = play('core.smokeVeil');
  for (const sides of [{ playerRetreat: 1 }, { playerRetreat: 1, enemyRetreat: 1 }]) {
    const r = play('core.smokeVeil', sides);
    assert.equal(r.paid, plain.paid, JSON.stringify(sides));
    assert.equal(stacks(r.enemy, 'weak'), 2, JSON.stringify(sides));
  }
});

test('a melee hit that carries a status still pays for the hit', () => {
  const plain = play('core.jab');
  const away = play('core.jab', { enemyRetreat: 1 });
  assert.equal(away.shown, plain.shown + 1);
  assert.equal(away.paid, plain.paid + 1);
});
