// Owner, 2026-10-18 15:55: "I like ward I just want it toggled off in the json for now".
// content/source/fixCoreMechanics.json ward.enabled switches Ward off under FixCore; code stays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction, gainBlock } from '../src/engine/actions.js';
import { fixCoreRules, fixCoreWardEnabled, fixCoreProtectionDescription, protectionReceipt, validateFixCoreRules } from '../src/model/fixCoreMechanics.js';
import { persistentWardMaximum } from '../src/model/combatRatings.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

function fixture(wardEnabled, points = 20) {
  const combat = createCombat({ registries: createRegistries(contentBundle), rng: createRng(901), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  combat.fixCoreRules = structuredClone(fixCoreRules(combat));
  combat.fixCoreRules.ward = { enabled: wardEnabled };
  const target = combat.enemies[0];
  Object.assign(target, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, ratings: { ar: 0, dr: 0, pr: 0, ward: points, poise: points },
    persistentWard: { value: points, max: points }, persistentPoise: { value: points, max: points }, damageResistanceFlat: {}, damageWeaknessPercent: {} });
  delete target.combatCounter; delete target.combatEvade; delete target.combatStance;
  primeAccuracyRolls(combat);
  return { combat, target };
}

test('shipped data switches Ward off', () => {
  assert.equal(shipped.ward.enabled, false);
  assert.equal(fixCoreWardEnabled(shipped), false);
  assert.equal(fixCoreWardEnabled({}), true, 'missing = on');
  assert.throws(() => validateFixCoreRules({ ...shipped, ward: { enabled: 'no' } }), /ward/);
});

test('ward off: no Ward pool maximum, no Ward protection', () => {
  const { combat, target } = fixture(false);
  assert.equal(persistentWardMaximum(combat, target), 0);
  assert.equal(protectionReceipt(combat, target, 'magical', 20).amount, 20);
  assert.match(fixCoreProtectionDescription(combat, target, 'physical'), /restore Poise by/);
  assert.doesNotMatch(fixCoreProtectionDescription(combat, target, 'physical'), /Ward/);
});

test('ward off: Block restores Poise only, damage not reduced by Ward', () => {
  const { combat, target } = fixture(false);
  target.persistentWard.value = 0; target.persistentPoise.value = 0; target.persistentWard.max = 0;
  gainBlock(combat, target, 6, { cardId: 'defend' });
  assert.equal(target.persistentWard.value, 0);
  assert.equal(target.persistentPoise.value, 6);
  const carrier = { skipRatingBonus: true, tags: ['camp:spell', 'maneuver:attack', 'damage:arcane'],
    combatProfile: { camp: 'spell', maneuver: 'attack', damageType: 'arcane', range: 'melee', targeting: 'single' }, magicShare: 1 };
  target.block = 0;
  enqueueExpandedAction(combat, [{ effect: { op: 'damage', target: 'enemy', amount: 20 }, source: combat.player, owner: combat.player, target, card: carrier, meta: {} }], { source: combat.player, target, carrier });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  assert.equal(target.hp, 80);
});

test('ward on (override): old behaviour', () => {
  const { combat, target } = fixture(true);
  assert.equal(protectionReceipt(combat, target, 'magical', 20).amount, 15);
  assert.match(fixCoreProtectionDescription(combat, target, 'magical'), /both Poise and Ward/);
  target.persistentWard.value = 0; target.persistentPoise.value = 0;
  gainBlock(combat, target, 6, { cardId: 'defend' });
  assert.equal(target.persistentWard.value, 6);
  assert.equal(target.persistentPoise.value, 6);
});
