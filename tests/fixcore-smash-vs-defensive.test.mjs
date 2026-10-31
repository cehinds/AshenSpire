// Owner ruling 2026-10-23: a Smash against a defensive stance (one the Smash beats: Defend or Prepared) deals
// 1.25 x normal damage + floor(0.25 x target's Block read before the hit), Block absorbs as usual, and the target's Poise loses
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
import { validateFixCoreRules, fixCoreSmashVsDefensiveRules, normalizeFixCoreRules } from '../src/model/fixCoreMechanics.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { damageReceiptLines } from '../src/ui/components/damageReceipt.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
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

test('shipped data and validator: smashVsDefensive {1.25, 0.25, 0.5}', () => {
  assert.deepEqual(shipped.smashVsDefensive, { damageMultiplier: 1.25, blockFraction: 0.25, poiseFraction: 0.5 });
  assert.deepEqual(fixCoreSmashVsDefensiveRules({}), shipped.smashVsDefensive, 'old saves fall back to the ruling');
  assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, damageMultiplier: 0.5 } }), /smashVsDefensive/);
  assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, extra: 1 } }), /smashVsDefensive/);
  for (const field of ['damageMultiplier', 'blockFraction', 'poiseFraction'])
    for (const bad of [null, '0.25', '2', true, NaN, Infinity])
      assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, [field]: bad } }), /smashVsDefensive/, `${field}=${String(bad)}`);
});

test('worked example: Smash 12 vs a defending target with 10 Block = 15 + floor(0.25 x 10) = 17 total; Block takes 10, 7 reaches HP; Poise -8 (floor(0.5 x 17))', () => {
  const { combat, target } = live();
  const event = hit(combat, target, 12);
  assert.equal(event.amount, 17, '1.25 x 12 + 2');
  assert.equal(event.blocked, 10);
  assert.equal(500 - target.hp, 7, 'the 25% Poise absorption does not apply to this hit');
  assert.equal(target.block, 0);
  assert.equal(20 - target.persistentPoise.value, 8);
  // Poise lost 8 as damage, not absorption: absorption fields stay 0 and the log/receipt say "Poise damage 8".
  assert.equal(event.poiseAbsorbed, 0);
  assert.equal(event.poiseMitigated, 0);
  assert.equal(event.poiseDamage, 8);
  assert.equal(event.damageReceipt.hits[0].poiseReduced, 0);
  assert.equal(event.damageReceipt.hits[0].poiseDamage, 8);
  const line = combatLogEntries([event], { registries: reg, players: [combat.player], enemies: combat.enemies }).map(row => row.text).join(' ');
  assert.match(line, /Poise damage 8 \(20 → 12\)/);
  assert.doesNotMatch(line, /Poise absorbed/);
  assert.match(line, /Block absorbed 10/);
  assert.match(line, /7 HP dealt/);
  const receiptText = damageReceiptLines(event.damageReceipt).join('\n');
  assert.match(receiptText, /Poise damage 8/);
  assert.doesNotMatch(receiptText, /Poise absorbed/);
});

test('the preview matches live resolution (same function)', () => {
  const { combat, target } = live();
  const preview = previewDamageHits(combat, combat.player, target, 12, [], smash, 1);
  const receipt = preview.damageReceipt.hits[0];
  assert.equal(receipt.incoming, 17);
  assert.equal(receipt.blocked, 10);
  assert.equal(preview.hpLoss, 7);
  const event = hit(combat, target, 12);
  assert.equal(500 - target.hp, preview.hpLoss);
  assert.equal(event.blocked, receipt.blocked);
});

test('Prepared is a defensive stance for Smash too; Attack and neutral stances are not', () => {
  const prepared = live({ stance: 'prepared' }); hit(prepared.combat, prepared.target, 12);
  assert.equal(20 - prepared.target.persistentPoise.value, 8);
  const plain = live({ stance: 'attack' }); hit(plain.combat, plain.target, 12);
  assert.notEqual(20 - plain.target.persistentPoise.value, 8, 'normal Poise absorption path');
  const none = live({ stance: null }); hit(none.combat, none.target, 12);
  assert.equal(none.target.block, 0);
  assert.ok(500 - none.target.hp <= 12, 'no defensive-stance bonus without a defensive stance');
});

test('only Smash gets the bonus: an Attack into a defending target is unchanged', () => {
  const { combat, target } = live(); const event = hit(combat, target, 12, attack);
  assert.ok(event.amount <= 12, `no defensive-stance bonus and no Block bonus (got ${event.amount})`);
  assert.ok(20 - target.persistentPoise.value < 5, 'Poise takes only the 25% absorption');
});

test('Vulnerable stays in the normal damage before the stance bonus: 12 x 1.25 = 15, x1.25 = 18.75, floor +2 = 20', () => {
  const { combat, target } = live({ vulnerable: 1 }); const event = hit(combat, target, 12);
  assert.equal(event.amount, 20);
  assert.equal(20 - target.persistentPoise.value, 10, 'floor(0.5 x 20)');
});

test('Poise loss is capped at the Poise held; a break staggers once', () => {
  const { combat, target } = live({ poise: 5 }); hit(combat, target, 12);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.combatStance.maneuver, 'staggered');
  assert.equal(combat.eventLog.filter(row => row.type === 'poiseBroken').length, 1);
});

test('a bonus from zero Block is zero: Smash 12 vs defend with 0 Block = 15', () => {
  const { combat, target } = live({ block: 0 }); const event = hit(combat, target, 12);
  assert.equal(event.amount, 15);
  assert.equal(500 - target.hp, 15);
  assert.equal(20 - target.persistentPoise.value, 7);
});

// The soldier's slash re-authored as a Smash (tags decide the maneuver), so the projection sees a Smash move.
const smashTags = ['camp:physical', 'maneuver:smash', 'damage:bludgeoning', 'source:weapon', 'delivery:melee'];
const smashEnemies = { get: id => { const row = reg.enemies.get(id); return id === 'wanderingSoldier' ? { ...row, moves: { ...row.moves, slash: { ...row.moves.slash, tags: smashTags } } } : row; }, has: id => reg.enemies.has(id) };

test('intent projection: a multi-hit Smash loses its stance bonus once an earlier hit breaks the defender\'s Poise (hit 1: 1.25 x 4 = 5, Poise 3 -> 1; hit 2: 5, Poise 1 -> 0 and Staggered; hit 3: 4 x 1.25 Vulnerable = 5; total 15)', () => {
  const { combat } = live({ block: 0, poise: 5 });
  combat.registries = { ...combat.registries, enemies: smashEnemies };
  Object.assign(combat.enemies[0], { statuses: {}, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  Object.assign(combat.player, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: 3, max: 20 }, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' } });
  delete combat.player.combatCounter;
  const enemy = combat.enemies[0];
  enemy.intent = { kind: 'attack', moveId: 'slash', damage: 4, hits: 3, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee', damageType: 'bludgeoning' } };
  enemy.intentRevealed = true; enemy.proposalIntentRevealedUntil = 99;
  const shown = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(shown.max, 15);
  const preview = previewDamageHits(combat, enemy, combat.player, 4, smashTags, enemy.intent, 3);
  assert.equal(preview.hpLoss, shown.max);
  assert.deepEqual(preview.damageReceipt.hits.map(hit => hit.poiseDamage ?? 0), [2, 1, 0], 'the broken stance stops the Smash Poise-damage rider');
  for (let i = 0; i < 3; i++) { primeAccuracyRolls(combat); applyAttackDamage(combat, enemy, combat.player, 4, smashTags, enemy.intent); }
  assert.equal(100 - combat.player.hp, shown.max);
});

test('missing saved-rule block uses the new default; explicit saved tuning stays intact', () => {
  for (const savedMultiplier of [undefined, 1.6, 2]) {
    const rules = structuredClone(shipped);
    if (savedMultiplier === undefined) delete rules.smashVsDefensive;
    else rules.smashVsDefensive.damageMultiplier = savedMultiplier;
    const before = structuredClone(rules);
    assert.equal(normalizeFixCoreRules(rules), rules);
    const { combat, target } = live();
    combat.fixCoreRules = rules;
    const preview = previewDamageHits(combat, combat.player, target, 12, [], smash);
    const event = hit(combat, target, 12);
    assert.equal(event.amount, Math.floor(12 * (savedMultiplier ?? 1.25)) + 2);
    assert.equal(500 - target.hp, preview.hpLoss);
    assert.deepEqual(rules, before, 'loading and resolving do not rewrite saved tuning');
  }
});
