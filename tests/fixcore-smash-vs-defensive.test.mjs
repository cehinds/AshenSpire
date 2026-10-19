// Owner ruling 2026-10-19: a Smash against a defensive stance (one the Smash beats: Defend or Prepared) deals
// 2 x normal damage + floor(0.25 x target's Block read before the hit), Block absorbs as usual, and the target's Poise loses
// floor(0.5 x that total) (capped at the Poise it holds) instead of the 25% absorption.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules, fixCoreSmashVsDefensiveRules } from '../src/model/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
const attack = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
function live({ stance = 'defend', block = 10, poise = 20, vulnerable = 0 } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block, barrier: 0, statuses: vulnerable ? { vulnerable: { stacks: vulnerable } } : {}, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  delete target.combatCounter;
  if (stance) target.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' }; else delete target.combatStance;
  return { combat, target };
}
const hit = (combat, target, amount, carrier = smash) => { primeAccuracyRolls(combat); applyAttackDamage(combat, combat.player, target, amount, [], carrier); return combat.eventLog.filter(row => row.type === 'damageDealt').at(-1); };

test('shipped data and validator: smashVsDefensive {2, 0.25, 0.5}', () => {
  assert.deepEqual(shipped.smashVsDefensive, { damageMultiplier: 2, blockFraction: 0.25, poiseFraction: 0.5 });
  assert.deepEqual(fixCoreSmashVsDefensiveRules({}), shipped.smashVsDefensive, 'old saves fall back to the ruling');
  assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, damageMultiplier: 0.5 } }), /smashVsDefensive/);
  assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, extra: 1 } }), /smashVsDefensive/);
});

test('worked example: Smash 12 vs a defending target with 10 Block = 24 + floor(0.25 x 10) = 26 total; Block takes 10, 16 reaches HP; Poise -13 (floor(0.5 x 26))', () => {
  const { combat, target } = live();
  const event = hit(combat, target, 12);
  assert.equal(event.amount, 26, '2 x 12 + 2');
  assert.equal(event.blocked, 10);
  assert.equal(500 - target.hp, 16, 'the 25% Poise absorption does not apply to this hit');
  assert.equal(target.block, 0);
  assert.equal(20 - target.persistentPoise.value, 13);
});

test('the preview matches live resolution (same function)', () => {
  const { combat, target } = live();
  const preview = previewDamageHits(combat, combat.player, target, 12, [], smash, 1);
  const receipt = preview.damageReceipt.hits[0];
  assert.equal(receipt.incoming, 26);
  assert.equal(receipt.blocked, 10);
  assert.equal(preview.hpLoss, 16);
  const event = hit(combat, target, 12);
  assert.equal(500 - target.hp, preview.hpLoss);
  assert.equal(event.blocked, receipt.blocked);
});

test('Prepared is a defensive stance for Smash too; Attack and neutral stances are not', () => {
  const prepared = live({ stance: 'prepared' }); hit(prepared.combat, prepared.target, 12);
  assert.equal(20 - prepared.target.persistentPoise.value, 13);
  const plain = live({ stance: 'attack' }); hit(plain.combat, plain.target, 12);
  assert.notEqual(20 - plain.target.persistentPoise.value, 13, 'normal Poise absorption path');
  const none = live({ stance: null }); hit(none.combat, none.target, 12);
  assert.equal(none.target.block, 0);
  assert.ok(500 - none.target.hp <= 12, 'no doubling without a defensive stance');
});

test('only Smash gets the bonus: an Attack into a defending target is unchanged', () => {
  const { combat, target } = live(); const event = hit(combat, target, 12, attack);
  assert.ok(event.amount <= 12, `no doubling and no Block bonus (got ${event.amount})`);
  assert.ok(20 - target.persistentPoise.value < 5, 'Poise takes only the 25% absorption');
});

test('Vulnerable stays in the normal damage before the doubling: 12 x 1.25 = 15, x2 = 30, +2 = 32', () => {
  const { combat, target } = live({ vulnerable: 1 }); const event = hit(combat, target, 12);
  assert.equal(event.amount, 32);
  assert.equal(20 - target.persistentPoise.value, 16, 'floor(0.5 x 32)');
});

test('Poise loss is capped at the Poise held; a break staggers once', () => {
  const { combat, target } = live({ poise: 5 }); hit(combat, target, 12);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.combatStance.maneuver, 'staggered');
  assert.equal(combat.eventLog.filter(row => row.type === 'poiseBroken').length, 1);
});

test('a bonus from zero Block is zero: Smash 12 vs defend with 0 Block = 24', () => {
  const { combat, target } = live({ block: 0 }); const event = hit(combat, target, 12);
  assert.equal(event.amount, 24);
  assert.equal(500 - target.hp, 24);
  assert.equal(20 - target.persistentPoise.value, 12);
});
