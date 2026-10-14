import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from '../tools/session.mjs';
import { armCombatCounter } from '../src/engine/combatMatchups.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';

function hostFight() {
  const registries = createRegistries({ ...legacyContentBundle,
    enemyMoves: legacyContentBundle.enemyMoves.map(move => ({ ...move,
      ...(move.damage != null ? { damage: 5, hits: 3,
        tags: ['camp:physical', 'maneuver:attack', 'damage:slashing', 'source:weapon', 'delivery:melee'] } : {}) })),
  });
  // This historical projection spends Counter on one hit; grouped v2 actions
  // have their own shared-action regressions.
  const host = createSession({ registries, seedString: 'GUARD2', combatExpansionVersion: 1 });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  assert.equal(host.snapshot().scene.kind, 'combat');
  return { host, combat: host.live.combat, registries };
}

test('co-op host projection clones saved fight rules and prices each seat without spending defenses or RNG', () => {
  const { host, combat, registries } = hostFight();
  const enemy = combat.enemies.find(entity => Object.values(registries.enemies.get(entity.enemyId).moves).some(move => move.damage != null));
  assert.ok(enemy, 'the fight supplies a real damaging move');
  const [moveId, move] = Object.entries(registries.enemies.get(enemy.enemyId).moves).find(([, move]) => move.damage != null);
  enemy.intent = { kind: 'attack', moveId, damage: 5, hits: 3,
    combatProfile: combatProfileFor({ ...move, enemyId: enemy.enemyId, moveId }) };
  enemy.intentReads = { p1: true, p2: true };
  delete enemy.pendingMove;
  const p1 = combat.players.get('p1').entity;
  const p2 = combat.players.get('p2').entity;
  p1.statuses = {}; p2.statuses = {}; enemy.statuses = {};
  p1.block = 6; p2.block = 0;
  combat.combatMatchupRules.counter.incomingMultiplier = 0.25;
  armCombatCounter(combat, p1, { combatProfile: { camp: 'physical', maneuver: 'counter', counterMode: 'melee' } }, { damage: 6 });
  // Session scenes are rebuilt after real host actions; snapshot/resync then
  // repeats that committed projection instead of rerunning an enemy roll.
  assert.equal(host.combatEndTurn('p2').ok, true);
  const state = () => JSON.stringify({ p1, p2, enemy, queue: combat.queue,
    counters: combat.rng.getCounters(), playerKey: combat.playerKey, events: combat.eventLog });
  const before = state();
  const scene = host.snapshot().scene;
  const wireEnemy = scene.enemies.find(entity => entity.id === enemy.id);
  assert.deepEqual(wireEnemy.intentPreviews.p1.hitDamages, [1, 5, 5]);
  assert.deepEqual(wireEnemy.intentPreviews.p2.hitDamages, [5, 5, 5]);
  assert.equal(wireEnemy.intentPreviews.p1.totalDamage, 11);
  assert.equal(wireEnemy.intentPreviews.p2.totalDamage, 15);
  assert.equal(state(), before);
  assert.deepEqual(scene.combatMatchupRules, combat.combatMatchupRules);
  scene.combatMatchupRules.counter.incomingMultiplier = 0.9;
  assert.equal(combat.combatMatchupRules.counter.incomingMultiplier, 0.25);
  const repeated = host.snapshot().scene.enemies.find(entity => entity.id === enemy.id);
  assert.deepEqual(repeated.intentPreviews, wireEnemy.intentPreviews);
  assert.equal(state(), before, 'snapshot/resync never rerolls or consumes a Counter');
});

test('co-op host prices hidden reads without damage fields and seat switches cannot reuse a teammate preview', () => {
  const { host, combat, registries } = hostFight();
  const enemy = combat.enemies[0];
  const [moveId, move] = Object.entries(registries.enemies.get(enemy.enemyId).moves)[0];
  enemy.intent = { kind: move.intent, moveId,
    combatProfile: combatProfileFor({ ...move, enemyId: enemy.enemyId, moveId }) };
  enemy.intentReads = { p1: false, p2: true };
  assert.equal(host.combatEndTurn('p2').ok, true);
  const counters = combat.rng.getCounters();
  const projected = host.snapshot().scene.enemies[0];
  const hidden = projected.intentPreviews.p1;
  assert.equal(hidden.hidden, true);
  for (const field of ['damage', 'hitDamages', 'totalDamage', 'effects']) assert.equal(hidden[field], undefined, field);
  assert.equal(hidden.moveId, null);
  const visible = coopEnemyIntent(projected, 'p2');
  assert.equal(visible.moveId, moveId);
  const selectedHidden = coopEnemyIntent(projected, 'p1');
  assert.equal(selectedHidden.hidden, true);
  assert.equal(selectedHidden.moveId, null);
  assert.equal(selectedHidden.hitDamages, undefined);
  assert.deepEqual(combat.rng.getCounters(), counters);
  assert.deepEqual(enemy.intentReads, { p1: false, p2: true });
  assert.deepEqual(coopEnemyIntent(projected, 'p2'), visible);
});
