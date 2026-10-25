// A guard bypass (Piercing/Precision) is spent over the whole hit, physical and magic, in contact order (owner,
// 2026-10-25: Block soaks magic too). The plan (prepareExpandedDefense) and the live per-contact apply must spend it the
// same way, so the HP each contact takes live is the HP the plan forecast.
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, prepareExpandedDefense } from '../src/engine/actions.js';
import * as Matchups from '../src/engine/combatMatchups.js';

function fixture(block) {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.block = block; enemy.barrier = 0; enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
  delete enemy.persistentPoise;
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  if (enemy.persistentWard) { enemy.persistentWard.max = 0; enemy.persistentWard.value = 0; }
  primeAccuracyRolls(combat);
  return { combat, enemy };
}

// Contact 1: 8 split as 3 physical + 5 magic; contact 2: 5 physical. Bypass 4, Block 20.
const carrier = { tags: ['camp:physical'], skipRatingBonus: true, physicalDamageType: 'blunt',
  combatProfile: { camp: 'physical', maneuver: 'strike', damageType: 'blunt', range: 'melee', targeting: 'single' } };
const contacts = [
  { camp: 'physical', maneuver: 'strike', damageType: 'blunt', physicalDamageType: 'blunt', magicDamageType: 'arcane', magicShare: 5 / 8, amount: 8, splitBase: 8 },
  { camp: 'physical', maneuver: 'strike', damageType: 'blunt', physicalDamageType: 'blunt', magicShare: 0, amount: 5, splitBase: 5 },
];

test('live Block spends a guard bypass over magic and physical as the plan does', () => {
  const { combat, enemy } = fixture(20);
  const receipt = Matchups.beginTacticalAction(combat, combat.player, enemy, carrier, contacts);
  assert.equal(receipt.avoided, false, 'fixture: the action lands');
  receipt.guardBypass = 4;
  prepareExpandedDefense(combat, enemy, receipt, carrier);
  assert.deepEqual(receipt.amounts, [8, 5], 'fixture: the contacts are 8 and 5');
  assert.deepEqual(receipt.blockableAmounts, [3, 5], 'fixture: contact 1 is 3 physical + 5 magic');
  const planned = receipt.hpAmounts.slice();
  // The bypass of 4 covers contact 1's 3 physical and 1 of its magic (4 HP); Block takes its other 4 magic and all of contact 2.
  assert.deepEqual(planned, [4, 0]);
  const lost = receipt.amounts.map((amount, index) => {
    const before = enemy.hp;
    applyAttackDamage(combat, combat.player, enemy, amount, carrier.tags, { ...carrier, expansionContact: { receipt, index } });
    return before - enemy.hp;
  });
  assert.deepEqual(lost, planned, 'each contact loses the HP the plan forecast');
  assert.equal(enemy.block, 20 - 4 - 5, 'Block soaked contact 1\'s 4 unbypassed magic and contact 2\'s 5');
});
