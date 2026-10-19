// Owner D13 / D4 (2026-10-18): Poise damage = floor(0.2 x incoming), dealt before the hit; a break puts the owner in
// the Staggered stance (-1 SP, +1 Vulnerable); repeat breaks only lengthen Vulnerable; Block restores Poise (capped).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { prepareBreakInterrupt } from '../src/engine/combatStatusControl.js';
import { applyAttackDamage, gainBlock } from '../src/engine/actions.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { getMult } from '../src/engine/statuses.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules, fixCorePoiseRules, fixCoreStaggeredRules, fixCoreProtectionDescription } from '../src/model/fixCoreMechanics.js';
import { combatStanceRow } from '../src/model/combatTacticsDisplay.js';
import { damageReceiptLines } from '../src/ui/components/damageReceipt.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const carrier = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
function live(poise = 20) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  delete target.combatStance; delete target.combatCounter;
  return { combat, target };
}
const hit = (combat, target, amount, source = combat.player) => { primeAccuracyRolls(combat); applyAttackDamage(combat, source, target, amount, [], carrier); return combat.eventLog.filter(row => row.type === 'damageDealt').at(-1); };

test('shipped Core data: Poise 0.2 depleting, Staggered stance -1 SP +1 Vulnerable extend-only', () => {
  assert.deepEqual(shipped.poise, { damageRatio: 0.2, depletes: true });
  assert.deepEqual(shipped.staggered, { stance: true, staminaLoss: 1, vulnerableStacks: 1, extendOnly: true });
  assert.equal(shipped.statuses.staggerRiders.weak, 0);
  assert.deepEqual(fixCorePoiseRules({}), { damageRatio: 0.2, depletes: true }, 'old saves fall back to the ruling');
  assert.equal(fixCoreStaggeredRules({}).staminaLoss, 1);
  assert.throws(() => validateFixCoreRules({ ...shipped, poise: { damageRatio: 2, depletes: true } }), /poise/);
  assert.throws(() => validateFixCoreRules({ ...shipped, staggered: { ...shipped.staggered, staminaLoss: 1.5 } }), /staggered/);
});

test('Poise damage is floor(0.2 x the whole hit), dealt before it lands', () => {
  for (const [damage, lost] of [[4, 0], [5, 1], [9, 1], [10, 2], [24, 4]]) {
    const { combat, target } = live();
    const event = hit(combat, target, damage);
    assert.equal(20 - target.persistentPoise.value, lost, `${damage} damage`);
    assert.equal(event.poiseSpent ?? 0, lost);
  }
});

test('Poise damage is a whole share even when Block soaks the hit', () => {
  const { combat, target } = live(); target.block = 50;
  hit(combat, target, 20);
  assert.equal(target.persistentPoise.value, 16);
});

test('a hit that breaks Poise lands unmitigated and staggers: stance, -1 SP, +1 Vulnerable', () => {
  const { combat, target } = live(2);
  hit(combat, target, 10);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.hp, 490, 'the breaking hit met no Poise mitigation');
  assert.equal(target.combatStance.maneuver, 'staggered');
  assert.equal(target.pendingStaminaLoss, 1);
  assert.equal(target.statuses.vulnerable.stacks, 1);
  assert.equal(target.statuses.staggered, undefined, 'not a stacking status');
  assert.equal(target.statuses.weak, undefined);
  assert.ok(!target.skipNextTurn);
  assert.equal(combat.eventLog.filter(row => row.type === 'poiseBroken').length, 1);
});

test('repeat breaks add Vulnerable duration only: the multiplier stays x1.25', () => {
  const { combat, target } = live(2);
  hit(combat, target, 10);
  assert.equal(getMult(combat, target, 'damageTakenMult'), 1.25);
  target.persistentPoise.value = 1;
  hit(combat, target, 10);
  assert.equal(target.statuses.vulnerable.stacks, 2, 'duration grows');
  assert.equal(getMult(combat, target, 'damageTakenMult'), 1.25, 'never x1.25^n');
  assert.equal(target.pendingStaminaLoss, 2);
});

test('no passive Poise regeneration; a Block card adds its Block to Poise, capped at max, and grants Block', () => {
  const { combat, target } = live(10);
  assert.equal(target.persistentPoise.value, 10);
  for (let round = 0; round < 2; round++) {
    dispatch(combat, { type: 'endTurn' });
    for (let guard = 0; combat.pendingReaction && guard < 20; guard++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  assert.ok(combat.turn >= 3, 'two full rounds passed');
  assert.equal(target.persistentPoise.value, 10, 'no passive regeneration across rounds');
  target.block = 0;
  gainBlock(combat, target, 6, { cardId: 'defend' });
  const gained = target.block;
  assert.ok(gained >= 6);
  assert.equal(target.persistentPoise.value, 10 + gained);
  gainBlock(combat, target, 9, { cardId: 'defend' });
  assert.equal(target.persistentPoise.value, 20, 'capped at max Poise, not min(block, max)');
});

test('the player is staggered the same way: next turn -1 SP, stance, +1 Vulnerable', () => {
  const { combat, target } = live();
  const player = combat.player; player.persistentPoise = { value: 1, max: 20 }; player.block = 0; player.hp = player.maxHp = 100;
  primeAccuracyRolls(combat); applyAttackDamage(combat, target, player, 6, [], carrier);
  assert.equal(player.persistentPoise.value, 0);
  assert.equal(player.pendingActionLoss, 1);
  assert.equal(player.combatStance.maneuver, 'staggered');
  assert.equal(player.statuses.vulnerable.stacks, 1);
});

test('preview of a multihit card sees the break: later hits take Vulnerable', () => {
  const { combat, target } = live(1);
  const preview = previewDamageHits(combat, combat.player, target, 20, [], carrier, 2);
  assert.equal(preview.hitDamages[1], Math.floor(preview.hitDamages[0] * 1.25));
});

test('UI: the Staggered stance row and the receipt Poise line', () => {
  const { combat, target } = live(2);
  hit(combat, target, 10);
  assert.equal(combatStanceRow(target).name, 'Staggered stance');
  const lines = damageReceiptLines({ hits: [{ incoming: 10, hpLoss: 10, poiseDamage: 2 }], totalDamage: 10 });
  assert.ok(lines.some(line => /Poise damage −2/.test(line)));
});

test('one break is one stagger: a smash-advantage hit that also breaks Poise staggers once', () => {
  const { combat, target } = live(1);
  target.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  primeAccuracyRolls(combat); applyAttackDamage(combat, combat.player, target, 10, [], smash);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.statuses.vulnerable.stacks, 1);
  assert.equal(target.pendingStaminaLoss, 1);
});

test('under Core an interrupt reports no cancelled move (staggering cancels nothing)', () => {
  const { combat, target } = live();
  target.pendingMove = { moveId: 'strike', resolveOnTurn: combat.turn + 1 };
  const event = prepareBreakInterrupt(combat, target, 'poiseBreak');
  assert.equal(event[1].cancelledMove, null);
  assert.equal(target.pendingMove.moveId, 'strike');
});

test('preview skips the break Vulnerable when impact protection would refuse the stagger', () => {
  const { combat, target } = live(1);
  combat.foundation = { rules: { impact: { protectionTurns: 1 } } };
  target.impactProtectedUntil = combat.turn;
  const preview = previewDamageHits(combat, combat.player, target, 20, [], carrier, 2);
  assert.equal(preview.hitDamages[1], preview.hitDamages[0], 'no Vulnerable on the second hit');
});

test('preview equals live when an earlier hit breaks Poise (stance replaced, one stagger per round)', () => {
  const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  const setup = () => { const f = live(2); f.target.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' }; return f; };
  const a = setup();
  const preview = previewDamageHits(a.combat, a.combat.player, a.target, 10, [], smash, 2).hitDamages;
  const b = setup();
  const live2 = [];
  for (let i = 0; i < 2; i++) { const before = b.target.hp; primeAccuracyRolls(b.combat); applyAttackDamage(b.combat, b.combat.player, b.target, 10, [], smash); live2.push(before - b.target.hp); }
  assert.deepEqual(preview, live2);
});
