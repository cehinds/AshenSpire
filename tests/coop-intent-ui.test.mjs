import test from 'node:test';
import assert from 'node:assert/strict';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
import { projectCombatantInspector } from '../src/ui/models/CombatantInspectorSections.js';

const enemy = {
  intent: { kind: 'attack', moveId: 'secretBolt', damage: 99, hits: 2, totalDamage: 198,
    combatProfile: { camp: 'spell', maneuver: 'ranged', school: 'frost', damageType: 'frost' } },
  intentReads: { scout: true, warrior: false },
};
const definition = { id: 'intentReadFixture', moves: { secretBolt: { intent: 'attack', damage: 4 } } };

test('couch seat switches reuse host read and conceal move, effects and live catalog highlight', () => {
  const before = JSON.stringify(enemy);
  const scout = coopEnemyIntent(enemy, 'scout');
  assert.equal(scout.moveId, 'secretBolt');
  assert.equal(scout.damage, 99);
  assert.equal(scout.stance, 'casting');
  assert.equal(scout.profile.school, 'frost');
  const warrior = coopEnemyIntent(enemy, 'warrior');
  assert.equal(warrior.moveId, null);
  assert.equal(warrior.damage, undefined);
  assert.equal(warrior.totalDamage, undefined);
  assert.equal(warrior.profile.school, undefined);
  assert.equal(warrior.stance, 'casting');
  const hiddenCatalog = enemyMoveCards(definition, { enemy, preview: warrior });
  assert.equal(hiddenCatalog.some(card => card.active), false);
  assert.doesNotMatch(hiddenCatalog[0].detail, /99|198|preview damage/);
  assert.equal(enemyMoveCards(definition, { enemy, preview: scout })[0].active, true);
  assert.deepEqual(coopEnemyIntent(enemy, 'scout'), scout);
  assert.equal(JSON.stringify(enemy), before);
});

test('missing seat or missing profiled read fails closed; staggered remains readable', () => {
  assert.equal(coopEnemyIntent(enemy, 'outsider').hidden, true);
  assert.equal(coopEnemyIntent({ ...enemy, intentReads: undefined }, 'scout').hidden, true);
  assert.equal(coopEnemyIntent({ intent: { kind: 'buff', moveId: 'legacySupport' } }, 'scout').hidden, false);
  assert.equal(coopEnemyIntent({ ...enemy, intent: { kind: 'staggered', moveId: null } }, 'warrior').stance, 'staggered');
});

test('inspector summary rejects a hidden move name and damage passed by any caller', () => {
  const view = projectCombatantInspector({ name: 'Caster', resources: [],
    intent: { ...coopEnemyIntent(enemy, 'warrior'), name: 'secretBolt', detail: '99 damage' } });
  const summary = view.sections.find(section => section.id === 'summary');
  const text = JSON.stringify(summary.rows);
  assert.match(text, /casting.*Move hidden/);
  assert.doesNotMatch(text, /secretBolt|99 damage/);
});

test('revealed seats select their own host-priced hit sequence only after the strict read gate', () => {
  const projected = { ...enemy, intentPreviews: {
    scout: { ...enemy.intent, damage: 2, hitDamages: [2, 5, 5], hits: 3, totalDamage: 12 },
    warrior: { ...enemy.intent, damage: 5, hitDamages: [5, 5, 5], hits: 3, totalDamage: 15 },
  } };
  const before = JSON.stringify(projected);
  assert.deepEqual(coopEnemyIntent(projected, 'scout').hitDamages, [2, 5, 5]);
  assert.equal(coopEnemyIntent(projected, 'scout').totalDamage, 12);
  for (const seat of ['warrior', 'outsider']) {
    const hidden = coopEnemyIntent(projected, seat);
    assert.equal(hidden.hidden, true);
    assert.equal(hidden.moveId, null);
    assert.equal(hidden.hitDamages, undefined);
    assert.equal(hidden.totalDamage, undefined);
  }
  assert.equal(JSON.stringify(projected), before);
  const bothRead = { ...projected, intentReads: { scout: true, warrior: true } };
  assert.deepEqual(coopEnemyIntent(bothRead, 'warrior').hitDamages, [5, 5, 5]);
  assert.equal(coopEnemyIntent(bothRead, 'warrior').totalDamage, 15);
  assert.equal(coopEnemyIntent({ ...bothRead,
    intentPreviews: { scout: { hidden: true, moveId: 'leaked', hitDamages: [99, 99] } } }, 'scout').hitDamages, undefined);
});
