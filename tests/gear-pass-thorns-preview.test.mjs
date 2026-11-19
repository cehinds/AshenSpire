import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { applyAttackDamage } from '../src/engine/actions.js';

function fight(hp) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp, maxHp: hp, block: 0, persistentPoise: { value: 0, max: 0 } });
  Object.assign(combat.player, { hp: 100, maxHp: 100, block: 0, persistentPoise: { value: 0, max: 0 } });
  delete combat.player.combatStance; delete enemy.combatStance;
  assert.equal(combat.player.statuses.thorns.stacks, 1, 'the actual current Heavy armour grants Thorns');
  return { combat, enemy };
}
const carrier = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', damageType: 'blunt' }, skipRatingBonus: true };

test('current Heavy Thorns stops a multi-hit forecast when it kills the attacker, matching live', () => {
  const { combat, enemy } = fight(2);
  const quote = previewDamageHits(combat, enemy, combat.player, 10, carrier.tags, carrier, 3);
  assert.equal(enemy.hp, 2, 'forecast leaves the live attacker alone');
  assert.equal(combat.player.hp, 100);
  const before = combat.player.hp;
  let landed = 0;
  while (enemy.alive && landed < 3) { applyAttackDamage(combat, enemy, combat.player, 10, carrier.tags, carrier); landed++; }
  assert.equal(landed, 2);
  assert.equal(quote.hits, landed);
  assert.equal(quote.hpLoss, before - combat.player.hp);
  assert.equal(quote.attackerDead, true);
});

test('Thorns kills before Reflect, so neither the forecast nor live consumes the Reflect stack', () => {
  const { combat, enemy } = fight(1);
  combat.player.reflectStacks = 1;
  const quote = previewDamageHits(combat, enemy, combat.player, 10, carrier.tags, carrier, 3);
  assert.equal(combat.player.reflectStacks, 1, 'forecast is detached');
  applyAttackDamage(combat, enemy, combat.player, 10, carrier.tags, carrier);
  assert.equal(enemy.hp, 0);
  assert.equal(combat.player.reflectStacks, 1, 'a dead attacker never triggers Reflect');
  assert.equal(quote.hits, 1);
  assert.equal(quote.attackerDead, true);
  assert.ok(!combat.eventLog.some(row => row.type === 'reflectTriggered'));
});
