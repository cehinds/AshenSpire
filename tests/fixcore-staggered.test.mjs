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
import { applyAttackDamage, gainBlock, drainFixCorePoise, executeAction } from '../src/engine/actions.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { getMult } from '../src/engine/statuses.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules, fixCorePoiseRules, fixCoreStaggeredRules, fixCoreProtectionDescription, fixCoreStatusDefinition } from '../src/model/fixCoreMechanics.js';
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

test('shipped Core data: Poise drains what it prevented; Staggered stance -1 SP +1 Vulnerable extend-only', () => {
  assert.deepEqual(shipped.poise, { drain: 'prevented' });
  assert.deepEqual(shipped.staggered, { stance: true, staminaLoss: 1, vulnerableStacks: 1, extendOnly: true });
  assert.equal(shipped.statuses.staggerRiders.weak, 0);
  assert.deepEqual(fixCorePoiseRules({}), { drain: 'prevented' }, 'old saves fall back to the ruling');
  assert.equal(fixCoreStaggeredRules({}).staminaLoss, 1);
  assert.throws(() => validateFixCoreRules({ ...shipped, poise: { drain: 'ratio' } }), /poise/);
  assert.throws(() => validateFixCoreRules({ ...shipped, staggered: { ...shipped.staggered, staminaLoss: 1.5 } }), /staggered/);
});

test('Poise absorbs a quarter of the hit and loses what it absorbed (8 -> 6, Poise -2)', () => {
  for (const [damage, absorbed] of [[4, 1], [8, 2], [9, 3], [20, 5]]) {
    const { combat, target } = live();
    const event = hit(combat, target, damage);
    assert.equal(500 - target.hp, damage - absorbed, `${damage} damage`);
    assert.equal(20 - target.persistentPoise.value, absorbed);
    assert.equal(event.poiseAbsorbed, absorbed, 'the event says how much Poise absorbed');
  }
});

test('Block comes first: Poise absorbs only what Block left', () => {
  const { combat, target } = live(); target.block = 50;
  hit(combat, target, 20);
  assert.equal(target.persistentPoise.value, 20);
  const second = live(); second.target.block = 12;
  hit(second.combat, second.target, 20);
  assert.equal(20 - second.target.persistentPoise.value, 2, 'floor(8 x 0.75) = 6, so Poise absorbed 2 of the 8 Block left');
});

test('Poise cannot absorb more than it holds: the rest of the hit gets through', () => {
  const { combat, target } = live(1);
  hit(combat, target, 8);
  assert.equal(500 - target.hp, 7, 'absorbed 1, not 2');
  assert.equal(target.persistentPoise.value, 0);
});

test('extra Poise damage a card carries adds to the pool loss, in whole numbers, capped at the pool', () => {
  const { combat, target } = live();
  hit(combat, target, 8);
  assert.equal(drainFixCorePoise(combat, combat.player, target, 3.9), 3);
  assert.equal(target.persistentPoise.value, 15);
  assert.equal(drainFixCorePoise(combat, combat.player, target, 50), 15);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.combatStance.maneuver, 'staggered');
});

test('a hit that breaks Poise staggers: stance, -1 SP, +1 Vulnerable', () => {
  const { combat, target } = live(2);
  hit(combat, target, 10);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(500 - target.hp, 8, '10 damage, Poise absorbed its last 2');
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

test('no passive Poise regeneration across full rounds', () => {
  const { combat, target } = live(10);
  assert.equal(target.persistentPoise.value, 10);
  for (let round = 0; round < 2; round++) {
    dispatch(combat, { type: 'endTurn' });
    for (let guard = 0; combat.pendingReaction && guard < 20; guard++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  assert.ok(combat.turn >= 3, 'two full rounds passed');
  assert.equal(target.persistentPoise.value, 10, 'no passive regeneration across rounds');
});

test('a Block card adds its Block to Poise, capped at max, and grants exactly that Block', () => {
  const { combat, target } = live(10);
  gainBlock(combat, target, 6, { cardId: 'defend' });
  assert.equal(target.persistentPoise.value, 16);
  assert.equal(target.block, 6);
  gainBlock(combat, target, 9, { cardId: 'defend' });
  assert.equal(target.persistentPoise.value, 20, 'capped at max Poise, not min(block, max)');
  assert.equal(target.block, 15);
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
  assert.deepEqual(preview.hitDamages, [19, 25], 'hit 1: Poise absorbed its last 1; hit 2 meets Vulnerable x1.25');
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

test('under Core a break is not an interrupt: no enemyInterrupted, the pending move survives', () => {
  const { combat, target } = live();
  target.pendingMove = { moveId: 'strike', resolveOnTurn: combat.turn + 1 };
  assert.equal(prepareBreakInterrupt(combat, target, 'poiseBreak'), null);
  assert.equal(target.pendingMove.moveId, 'strike');
  assert.equal(target.combatStance.maneuver, 'staggered');
});

test('preview skips the break Vulnerable when impact protection would refuse the stagger', () => {
  const { combat, target } = live(1);
  combat.foundation = { rules: { impact: { protectionTurns: 1 } } };
  target.impactProtectedUntil = combat.turn;
  const preview = previewDamageHits(combat, combat.player, target, 20, [], carrier, 2);
  assert.deepEqual(preview.hitDamages, [19, 20], 'no Vulnerable on the second hit');
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

test('UI: the Staggered stance row and the receipt line say what Poise absorbed', () => {
  const { combat, target } = live(2);
  hit(combat, target, 10);
  assert.equal(combatStanceRow(target).name, 'Staggered stance');
  const lines = damageReceiptLines({ hits: [{ incoming: 10, hpLoss: 8, poiseReduced: 2 }], totalDamage: 8 });
  assert.ok(lines.some(line => /Poise absorbed 2/.test(line)));
});

test('the Poise tooltip and the Core Staggered definition describe the stance rules', () => {
  const { combat, target } = live();
  const text = fixCoreProtectionDescription(combat, target, 'poise');
  assert.match(text, /takes 25% off each hit \(you take the rest, rounded down\) and loses what it absorbed/);
  assert.match(text, /Staggered/);
  const def = fixCoreStatusDefinition(combat, 'staggered', { id: 'staggered', name: 'Staggered' });
  assert.match(def.tooltip, /1 SP next turn.*1 Vulnerable.*only extend/);
  assert.doesNotMatch(def.tooltip, /Weak|Interrupt|stacks/i);
});

const wardHit = (combat, target, amount, card = {}) => executeAction(combat, { effect: { op: 'wardDamage', target: 'enemy', amount }, source: combat.player, owner: combat.player, target, card, meta: {} });

test('Ward off: Ward damage drains Poise with the piercing x1.25, floored', () => {
  const { combat, target } = live();
  wardHit(combat, target, 3);
  assert.equal(target.persistentPoise.value, 17);
  wardHit(combat, target, 4, { combatProfile: { camp: 'spell', damageType: 'piercing' } });
  assert.equal(target.persistentPoise.value, 12, 'floor(4 x 1.25) = 5');
});

test('Ward on: Ward damage goes to Ward and leaves Poise alone', () => {
  const { combat, target } = live();
  combat.fixCoreRules = { ...structuredClone(combat.fixCoreRules || combat.gameProfile.fixCoreRules), ward: { enabled: true } };
  target.persistentWard = { value: 10, max: 10 };
  wardHit(combat, target, 3);
  assert.equal(target.persistentWard.value, 7);
  assert.equal(target.persistentPoise.value, 20);
});

test('floating text names why damage dropped: Poise absorbed N', async () => {
  const { guardHitFloatParts } = await import('../src/ui/fx.js');
  assert.equal(guardHitFloatParts({ amount: 6, blocked: 0, poiseAbsorbed: 2 }, 100).poise.text, 'Poise absorbed 2');
});

test('the break haptic fires on a Core enemy Poise break', async () => {
  const { enemyPoiseBroken } = await import('../src/ui/fx.js');
  const { combat, target } = live(2);
  hit(combat, target, 10);
  const event = combat.eventLog.find(row => row.type === 'poiseBroken');
  assert.ok(event);
  assert.equal(enemyPoiseBroken(event), true);
});

test('the Staggered row carries the profile\'s costs, hiding a zero clause', () => {
  const { combat, target } = live(2);
  combat.fixCoreRules = { ...structuredClone(combat.fixCoreRules || combat.gameProfile.fixCoreRules), staggered: { stance: true, staminaLoss: 2, vulnerableStacks: 0, extendOnly: true } };
  hit(combat, target, 10);
  const row = combatStanceRow(target);
  assert.match(row.detail, /Loses 2 SP next turn/);
  assert.doesNotMatch(row.detail, /Vulnerable/);
  assert.equal(target.pendingStaminaLoss, 2);
});

test('Core break: haptic fires, the log says staggered not interrupted, the pending move survives', async () => {
  const { enemyPoiseBroken } = await import('../src/ui/fx.js');
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const { combat, target } = live(2);
  target.pendingMove = { moveId: 'strike', resolveOnTurn: combat.turn + 1 };
  hit(combat, target, 10);
  const event = combat.eventLog.find(row => row.type === 'poiseBroken');
  assert.equal(enemyPoiseBroken(event), true);
  assert.ok(!event.interrupted);
  assert.ok(!combat.eventLog.some(row => row.type === 'enemyInterrupted'));
  assert.equal(target.pendingMove.moveId, 'strike');
  const text = JSON.stringify(combatLogEntries(combat.eventLog, { registries: reg, players: [], enemies: combat.enemies }));
  assert.match(text, /Poise broke/);
  assert.doesNotMatch(text, /interrupted/);
});

test('a Poise break that Impact protection refuses carries no stagger marker, haptic or "staggered" log line', async () => {
  const { enemyPoiseBroken } = await import('../src/ui/fx.js');
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const { combat, target } = live(2);
  combat.foundation = { rules: { impact: { protectionTurns: 1 } } };
  const events = []; // a plain recorder: the foundation's own event rules are not under test here
  combat.emit = (type, payload) => { events.push({ type, ...payload }); };
  target.impactProtectedUntil = combat.turn;
  hit(combat, target, 10);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.combatStance, undefined, 'protection refused the stagger');
  const event = events.find(row => row.type === 'poiseBroken');
  assert.ok(event);
  assert.ok(!event.poiseBreak);
  assert.equal(enemyPoiseBroken(event), false);
  const text = JSON.stringify(combatLogEntries(events, { registries: reg, players: [], enemies: combat.enemies }));
  assert.match(text, /Poise broke/);
  assert.doesNotMatch(text, /staggered/);
});

test('an unprotected Core break still carries the stagger marker and the "staggered" log line', async () => {
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const { combat, target } = live(2);
  hit(combat, target, 10);
  const event = combat.eventLog.find(row => row.type === 'poiseBroken');
  assert.equal(event.poiseBreak, true);
  assert.equal(target.combatStance.maneuver, 'staggered');
  assert.match(JSON.stringify(combatLogEntries(combat.eventLog, { registries: reg, players: [], enemies: combat.enemies })), /staggered/);
});
