import test from 'node:test';
import assert from 'node:assert/strict';
import { combatStatusRules } from '../src/content/combatStatusRules.js';
import { statuses as definitions } from '../src/content/statuses.js';
import { applyStatus } from '../src/engine/statuses.js';
import * as S from '../src/engine/combatStatusControl.js';
import { statusControlProblems } from '../src/model/combatStatusState.js';

function setup(ward = 3) {
  const events = [], queued = [], rolls = [100]; let cursor = 0;
  const entity = { id: 'p1', kind: 'player', alive: true, hp: 10, maxHp: 50, energy: 12,
    attributes: { constitution: 0, wisdom: 3, intelligence: 4 }, statuses: {} };
  const ctx = { combatExpansionVersion: 2, combatStatusRules: structuredClone(combatStatusRules), player: entity,
    registries: { statuses: new Map(definitions.map(def => [def.id, def])) },
    rng: { int() { return rolls[Math.min(cursor++, rolls.length - 1)]; } },
    emit(type, payload) { events.push({ type, ...payload }); }, enqueue(action) { queued.push(action); } };
  S.initializePersistentWard(entity, ward);
  return { ctx, entity, events, queued, rolls, cursor: () => cursor };
}

test('three completed magical gauges consume Ward 3 and admit the breaking ailment', () => {
  const { ctx, entity } = setup();
  const first = S.applyStatusPressure(ctx, entity, 'burn', 6, null, { actionKey: '1' });
  assert.equal(entity.persistentWard.value, 2); assert.equal(first.fullyResisted, true);
  S.applyStatusPressure(ctx, entity, 'sleep', 6, null, { actionKey: '2' });
  assert.equal(entity.persistentWard.value, 1); assert.equal(entity.statuses.sleep, undefined);
  const last = S.applyStatusPressure(ctx, entity, 'paralysis', 6, null, { actionKey: '3' });
  assert.equal(entity.persistentWard.value, 0); assert.equal(last.activeAdded, 1);
  assert.equal(last.fullyResisted, false);
});

test('partial and overflowing pressure refuse a full Counter receipt', () => {
  const { ctx, entity } = setup();
  const partial = S.applyStatusPressure(ctx, entity, 'sleep', 2);
  assert.equal(partial.acceptedBuildup, 2); assert.equal(partial.fullyResisted, false);
  const fill = S.applyStatusPressure(ctx, entity, 'sleep', 5);
  assert.equal(entity.persistentWard.value, 2);
  assert.equal(fill.acceptedBuildup, 1); assert.equal(fill.fullyResisted, false);
  const immune = S.applyStatusPressure(ctx, entity, 'sleep', 2, null, { resistancePercent: 100 });
  assert.equal(immune.fullyResisted, true, 'old gauge pressure is not newly admitted by a fully resisted action');
});

test('large pressure fills several times, speeds up while active and retains capped overflow', () => {
  const { ctx, entity } = setup(0);
  const receipt = S.applyStatusPressure(ctx, entity, 'sleep', 23);
  assert.equal(receipt.activeAdded, 3); assert.equal(entity.statuses.sleep.stacks, 3);
  assert.equal(entity.statusControl.gauges.sleep.value, 9);
  S.manualRecovery(ctx, entity, [{ status: 'sleep', stacks: 1 }]);
  S.applyStatusPressure(ctx, entity, 'sleep', 1);
  assert.equal(entity.statuses.sleep.stacks, 3); assert.equal(entity.statusControl.gauges.sleep.value, 6);
});

test('source camp chooses Ward versus Poise independently of ailment identity', () => {
  const { ctx, entity } = setup(); entity.poiseMeter = { value: 0, max: 2 };
  const physical = S.applyStatusPressure(ctx, entity, 'sleep', 6, null, { camp: 'physical' });
  assert.equal(physical.poiseStrain, 1); assert.equal(entity.persistentWard.value, 3);
  S.applyStatusPressure(ctx, entity, 'sleep', 6, null, { camp: 'physical' });
  assert.equal(entity.statuses.sleep.stacks, 1); assert.equal(entity.poiseMeter.value, 0);
  S.applyStatusPressure(ctx, entity, 'bleed', 7, null, { camp: 'spell' });
  assert.equal(entity.persistentWard.value, 2); assert.equal(entity.statuses.bleeding, undefined);
});

test('authored Venom retains bodily poison through the explicit pressure door', () => {
  const { ctx, entity } = setup(0);
  const receipt = S.applyStatusPressure(ctx, entity, 'venom', 10, null, { camp: 'physical' });
  assert.equal(receipt.activeAdded, 2);
  assert.equal(entity.statuses.venom.stacks, 2);
  assert.equal(entity.statusControl.gauges.venom.recoveryProfile, 'bodily');
});

test('v2 active grants stay separate from buildup and cap hard controls', () => {
  const { ctx, entity, queued } = setup();
  applyStatus(ctx, entity, 'sleep', 99);
  assert.equal(entity.statuses.sleep.stacks, 3); assert.deepEqual(entity.statusControl.gauges, {});
  applyStatus(ctx, entity, 'burn', 2);
  assert.equal(entity.statuses.burn.stacks, 2); assert.equal(entity.persistentWard.value, 3);
  assert.equal(queued.length, 0);
});

test('legacy status procs retain their old semantics outside version2', () => {
  const { ctx, entity, queued } = setup(); delete ctx.combatExpansionVersion;
  applyStatus(ctx, entity, 'frost', 10);
  assert.equal(entity.statuses.frost.meter.value, 0);
  assert(queued.some(action => action.effect.op === 'loseHp'));
  assert.equal(entity.statuses.frozen, undefined);
});

test('manual mixed recovery spends SP once, preserves normal hand and refuses duplicate/unaffordable selections', () => {
  const { ctx, entity, events } = setup();
  applyStatus(ctx, entity, 'sleep', 2); applyStatus(ctx, entity, 'paralysis', 1);
  assert.equal(S.controlGate(ctx, entity, { usableWhile: ['sleep'] }).allowed, false);
  assert.equal(S.controlGate(ctx, entity, { builtinRecovery: true }).allowed, true);
  const bad = S.manualRecovery(ctx, entity, [{ status: 'sleep', stacks: 1 }, { status: 'sleep', stacks: 1 }]);
  assert.equal(bad.ok, false); assert.equal(entity.energy, 12);
  const first = S.manualRecovery(ctx, entity, [{ status: 'sleep', stacks: 2 }, { status: 'paralysis', stacks: 1 }]);
  assert.equal(first.cost, 7); assert.equal(entity.energy, 5); assert.equal(first.restrictions.locked, false);
  assert.equal(events.filter(event => event.type === 'staminaSpent').length, 1);
  assert.equal(events.filter(event => event.type === 'cardPlayed').length, 0);
  applyStatus(ctx, entity, 'paralysis', 3);
  assert.equal(S.manualRecovery(ctx, entity, [{ status: 'paralysis', stacks: 3 }]).ok, false);
  assert.equal(entity.energy, 5); assert.equal(entity.statuses.paralysis.stacks, 3);
});

test('waiting breaks one lock and guarantees a Resolve window without clearing budgets', () => {
  const { ctx, entity, rolls } = setup(); entity.energy = 0;
  applyStatus(ctx, entity, 'sleep', 3); applyStatus(ctx, entity, 'paralysis', 2);
  const ended = S.endControlTurn(ctx, entity, 'paralysis');
  assert.equal(ended.removed, 1); assert.equal(entity.statuses.paralysis.stacks, 1);
  assert.equal(ended.resolveNextTurn, true);
  rolls[0] = 100;
  S.recoverStatusesAtOwnerStart(ctx, entity, { cycle: 2 });
  assert.equal(S.controlRestrictions(ctx, entity).locked, false);
  assert.equal(S.controlRestrictions(ctx, entity).counterDisabled, false);
  assert.equal(S.sleepRestoration(ctx, entity).hp, 0);
  assert.equal(S.statusIncomingModifier(ctx, entity, { reach: 'contact' }).percent, 0);
  S.endControlTurn(ctx, entity);
  assert.equal(S.controlRestrictions(ctx, entity).locked, true);
});

test('Mental recovery matches weighted stats/stack penalty and rolls once per cycle', () => {
  const { ctx, entity, rolls, cursor } = setup();
  applyStatus(ctx, entity, 'sleep', 1);
  assert.equal(S.recoveryChance(ctx, entity, 'sleep'), 33);
  applyStatus(ctx, entity, 'sleep', 1); assert.equal(S.recoveryChance(ctx, entity, 'sleep'), 23);
  applyStatus(ctx, entity, 'sleep', 1); assert.equal(S.recoveryChance(ctx, entity, 'sleep'), 13);
  rolls[0] = 1;
  S.recoverStatusesAtOwnerStart(ctx, entity, { cycle: 1 });
  assert.equal(entity.statuses.sleep.stacks, 2);
  const before = cursor(); S.recoverStatusesAtOwnerStart(ctx, entity, { cycle: 1 });
  assert.equal(cursor(), before);
  entity.attributes.wisdom = 1000; assert.equal(S.recoveryChance(ctx, entity, 'sleep'), 80);
});

test('percentage Advantage keeps lower die, Disadvantage higher, and both cancel', () => {
  const { ctx, rolls, cursor } = setup(); rolls.splice(0, 1, 90, 10, 10, 90, 20);
  assert.equal(S.rollStatusChance(ctx, 30, { advantage: true }).success, true);
  assert.equal(S.rollStatusChance(ctx, 30, { disadvantage: true }).success, false);
  assert.equal(S.rollStatusChance(ctx, 30, { advantage: true, disadvantage: true }).success, true);
  assert.equal(cursor(), 5);
  assert.equal(S.effectiveChance(50, { advantage: true }), 75);
  assert.equal(S.effectiveChance(50, { disadvantage: true }), 25);
});

test('successful recovery shrinks pending gauge25%, does not restore Ward', () => {
  const { ctx, entity, rolls } = setup(); rolls[0] = 1;
  S.applyStatusPressure(ctx, entity, 'sleep', 4);
  S.spendPersistentWard(ctx, entity, 2);
  S.recoverStatusesAtOwnerStart(ctx, entity, { cycle: 1 });
  assert.equal(entity.statusControl.gauges.sleep.value, 3); assert.equal(entity.persistentWard.value, 1);
});

test('Sleep rest budgets survive removal/reinfliction/save and fractional Ward grant cannot repeat', () => {
  const { ctx, entity, rolls } = setup(); rolls[0] = 100;
  S.spendPersistentWard(ctx, entity, 2); applyStatus(ctx, entity, 'sleep', 3);
  S.recoverStatusesAtOwnerStart(ctx, entity, { cycle: 1 });
  const rest = S.sleepRestoration(ctx, entity, { wardModifierPercent: -20 });
  assert.deepEqual(rest, { hp: 6, ward: 0 }); assert.equal(entity.statusControl.wardRestoreCarry, 0.8);
  assert.equal(entity.statusControl.sleepWardGranted, true);
  delete entity.statuses.sleep; applyStatus(ctx, entity, 'sleep', 3);
  const saved = JSON.parse(JSON.stringify(entity));
  S.recoverStatusesAtOwnerStart(ctx, saved, { cycle: 2 });
  assert.deepEqual(S.sleepRestoration(ctx, saved), { hp: 0, ward: 0 });
  assert.equal(S.restorePersistentWard(ctx, saved, 1, { modifierPercent: -20 }).restored, 1);
  assert.equal(saved.persistentWard.value, 2);
});

test('full Ward does not spend Sleep allowance or bank excess restoration', () => {
  const { ctx, entity } = setup(); applyStatus(ctx, entity, 'sleep', 1);
  S.sleepRestoration(ctx, entity);
  assert.equal(entity.statusControl.sleepWardGranted, false);
  S.restorePersistentWard(ctx, entity, 10);
  assert.equal(entity.statusControl.wardRestoreCarry, 0);
  S.spendPersistentWard(ctx, entity, 1);
  S.recoverStatusesAtOwnerStart(ctx, entity, { cycle: 1 });
  S.sleepRestoration(ctx, entity);
  assert.equal(entity.persistentWard.value, 3);
});

test('fractional explicit Ward pressure carries while restore bonuses/penalties add once', () => {
  const { ctx, entity } = setup(5);
  for (let i = 0; i < 4; i++) S.spendPersistentWard(ctx, entity, 1.25);
  assert.equal(entity.persistentWard.value, 0); assert.equal(entity.statusControl.wardDamageCarry, 0);
  S.restorePersistentWard(ctx, entity, 2, { modifierPercent: 20 - 20 });
  assert.equal(entity.persistentWard.value, 2);
});

test('Sleep and Prone add received percentages; ranged Area ignores projectile exceptions by default', () => {
  const { ctx, entity } = setup(); applyStatus(ctx, entity, 'sleep', 3); applyStatus(ctx, entity, 'prone', 1);
  assert.deepEqual(S.statusIncomingModifier(ctx, entity, { camp: 'physical', reach: 'contact', targeting: 'area' }), { percent: 55, evadeBonus: 0 });
  assert.deepEqual(S.statusIncomingModifier(ctx, entity, { camp: 'physical', reach: 'far', targeting: 'single' }), { percent: 5, evadeBonus: 4 });
  assert.deepEqual(S.statusIncomingModifier(ctx, entity, { camp: 'physical', reach: 'far', targeting: 'area' }), { percent: 30, evadeBonus: 0 });
  assert.deepEqual(S.statusIncomingModifier(ctx, entity, { camp: 'physical', reach: 'near', targeting: 'area', projectile: true }), { percent: 5, evadeBonus: 2 });
  assert.equal(S.recoveryControls(ctx, entity).find(row => row.status === 'prone').disabled, true);
});

test('connected protected action wakes/shatters once; evasion and ticks do not', () => {
  const { ctx, entity } = setup(); applyStatus(ctx, entity, 'sleep', 3); applyStatus(ctx, entity, 'frozen', 3);
  S.completeStatusAction(ctx, entity, { damageType: 'blunt' }, { actionKey: 'multi', connected: true });
  S.completeStatusAction(ctx, entity, { damageType: 'blunt' }, { actionKey: 'multi', connected: true });
  assert.equal(entity.statuses.sleep.stacks, 2); assert.equal(entity.statuses.frozen.stacks, 2);
  S.completeStatusAction(ctx, entity, {}, { actionKey: 'evaded', connected: false });
  S.completeStatusAction(ctx, entity, {}, { actionKey: 'tick', damaging: false });
  assert.equal(entity.statuses.sleep.stacks, 2);
});

test('connected Fire clears pending Frost/Chilled/Frozen before incoming modifiers', () => {
  const { ctx, entity } = setup(0); S.applyStatusPressure(ctx, entity, 'frost', 11);
  assert.equal(entity.statuses.frozen.stacks, 2); assert.equal(entity.statusControl.gauges.frost.value, 1);
  S.beforeStatusAction(ctx, entity, { school: 'fire' }, { connected: false });
  assert(entity.statuses.frozen);
  S.beforeStatusAction(ctx, entity, { school: 'fire' }, { connected: true });
  assert.equal(entity.statuses.frozen, undefined); assert.equal(entity.statuses.chilled, undefined);
  assert.equal(entity.statusControl.gauges.frost.value, 0);
});

test('Grounded overrides Conductive and clears authored Paralysis pressure', () => {
  const { ctx, entity } = setup(); entity.combatTraits = { conductive: true, grounded: true };
  S.applyStatusPressure(ctx, entity, 'paralysis', 4); S.groundStatusPressure(ctx, entity);
  assert.equal(entity.statusControl.gauges.paralysis.value, 0);
  assert.deepEqual(S.electricalTraits(ctx, entity), { grounded: true, conductive: false, insulated: false });
});

test('positive Ward restoration attempts invoke shared feat budget hook before full-pool clamp', () => {
  const { ctx, entity } = setup(); const calls = [];
  ctx.restorationModifierPercent = (target, pool, source) => { calls.push([pool, source]); return 20; };
  assert.equal(S.restorePersistentWard(ctx, entity, 1).restored, 0);
  assert.deepEqual(calls, [['ward', 'effect']]);
  assert.equal(entity.statusControl.sleepWardGranted, false);
  applyStatus(ctx, entity, 'sleep', 1); S.sleepRestoration(ctx, entity);
  assert.deepEqual(calls.slice(1), [['hp', 'sleep'], ['ward', 'sleep']]);
});

test('saved Ward, carry, gauges, budgets and recovery cursor refuse malformed state', () => {
  const { entity } = setup(); assert.deepEqual(statusControlProblems(entity, 'player', { required: true }), []);
  const mutations = [e => { e.persistentWard.value = 99; }, e => { e.statusControl.wardRestoreCarry = 1; },
    e => { e.statusControl.sleepHpRestored = 7; }, e => { e.statusControl.lastRecoveryCycle = 99; },
    e => { e.statusControl.gauges.sleep = { value: -1, camp: 'spell', recoveryProfile: 'mental' }; }];
  for (const mutate of mutations) { const bad = structuredClone(entity); mutate(bad); assert(statusControlProblems(bad, 'player', { required: true }).length > 0); }
});
test('aggregate elemental flags include later contacts and finalize once', () => {
  const { ctx, entity } = setup(0);
  entity.statuses.frozen = { stacks: 2 }; entity.statuses.chilled = { stacks: 1 };
  S.beforeStatusAction(ctx, entity, { school: 'force', damageType: 'arcane', containsFire: true });
  assert.equal(entity.statuses.frozen, undefined); assert.equal(entity.statuses.chilled, undefined);
  entity.statuses.frozen = { stacks: 2 }; entity.statuses.chilled = { stacks: 1 };
  entity.statuses.decoy = { stacks: 2 }; entity.statuses.concealed = { stacks: 1 };
  S.completeStatusAction(ctx, entity, { damageType: 'arcane', containsBlunt: true, containsReveal: true }, { actionKey: 'mixed' });
  assert.equal(entity.statuses.frozen.stacks, 1); assert.equal(entity.statuses.chilled, undefined);
  assert.equal(entity.statuses.decoy, undefined); assert.equal(entity.statuses.concealed, undefined);
  S.completeStatusAction(ctx, entity, { containsBlunt: true }, { actionKey: 'mixed' });
  assert.equal(entity.statuses.frozen.stacks, 1);
});
