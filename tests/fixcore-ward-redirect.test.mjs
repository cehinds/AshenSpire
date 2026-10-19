// Ward off (ward.enabled:false): a wardDamage effect drains Poise. It must still record the Poise pressure
// (group.ownPressure) and credit enemy knowledge, as the Ward path and a native poiseDamage effect do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { executeAction } from '../src/engine/actions.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

function fixture() {
  const combat = createCombat({ registries: createRegistries(contentBundle), rng: createRng(902), combatExpansionVersion: 2, reactionRulesVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  combat.fixCoreRules = structuredClone(fixCoreRules(combat));
  combat.fixCoreRules.ward = { enabled: false };
  const target = combat.enemies[0];
  Object.assign(target, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, persistentWard: { value: 0, max: 0 },
    persistentPoise: { value: 20, max: 20 }, damageResistanceFlat: {}, damageWeaknessPercent: {} });
  primeAccuracyRolls(combat);
  return { combat, target };
}
const wardHit = (combat, target, group, card = {}, meta = {}) => ({ effect: { op: 'wardDamage', target: 'enemy', amount: 5 },
  source: combat.player, owner: combat.player, target, card, meta: { expansionGroup: group, ...meta } });

test('ward off: redirected wardDamage records Poise pressure in the group', () => {
  const { combat, target } = fixture();
  const group = { targets: {}, key: 'g1' };
  executeAction(combat, wardHit(combat, target, group));
  assert.equal(target.persistentPoise.value, 15);
  assert.equal(group.ownPressure?.[target.id]?.poiseDealt, 5);
  assert.equal(group.ownPressure[target.id].wardDealt, 0);
});

test('ward off: redirected wardDamage records only what the pool held', () => {
  const { combat, target } = fixture();
  target.persistentPoise.value = 3;
  const group = { targets: {}, key: 'g2' };
  executeAction(combat, wardHit(combat, target, group));
  assert.equal(group.ownPressure[target.id].poiseDealt, 3);
});

test('ward off: a counter response credits enemy knowledge for redirected wardDamage', () => {
  const { combat, target } = fixture();
  const gained = []; const emit = combat.emit;
  combat.emit = (type, payload) => { if (type === 'perceptionGained') gained.push(payload); return emit(type, payload); };
  combat.skills = { perception: { xp: 0, level: 0, pendingDrafts: 0 } };
  combat.enemyKnowledge = { owners: { player: { knowledge: {}, pending: {}, earnedXp: 0, feedback: [], counterEnemyIds: [] } },
    rules: { perception: { correctPredictionXp: 1, maxLevel: 5, xpPerLevel: [10, 10, 10, 10, 10] } }, bankable: false };
  target.knowledgeAction = { serial: 7, reads: { player: { visibility: 'unknown' } } };
  const action = wardHit(combat, target, { targets: {}, key: 'g3' }, {}, { combatCounterReaction: true, enemyKnowledgeActionSerial: 7 });
  combat._abilityAction = action;
  executeAction(combat, action);
  assert.equal(gained.length, 1, 'the redirected Poise damage paid the response');
});
