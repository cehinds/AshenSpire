import test from 'node:test';
import assert from 'node:assert/strict';
import { createAshenBlightState, ashenBlightProblems, ashenBlightCombatProblems, effectiveAshenBlightAttributes } from '../src/model/ashenBlight.js';
import { payAshenBlight, rollAshenBlightEncounter, chooseAshenBlightFeat, ashenBlightBonuses, corruptedCardProjection,
  beginAshenBlightCycle, ashenBlightMartialPoise, ashenBlightSpellBuildup, modulateAshenBlightRestoration } from '../src/engine/ashenBlight.js';
import { ashenBlightFeats } from '../src/content/ashenBlight.js';
import { corruptedCards } from '../src/content/cards/corrupted.js';

function fixture(draws = [.95]) {
  let rolls = 0;
  const ctx = { combatExpansionVersion: 2, draw: () => { const value = draws[Math.min(rolls, draws.length - 1)]; rolls++; return value; } };
  const owner = { combatExpansionVersion: 2, attributes: { strength: 4, intelligence: 4, constitution: 4 }, ashenBlight: createAshenBlightState() };
  const pay = (amount, receiptId = `p${owner.ashenBlight.payments.length}`, combatKey = 'fight1') => payAshenBlight(ctx, owner, { amount, receiptId, combatKey });
  return { ctx, owner, pay, rolls: () => rolls };
}

test('legacy corruption calls are inert and validation has no randomness', () => {
  const { ctx, owner, rolls } = fixture(); ctx.combatExpansionVersion = 1;
  const original = structuredClone(owner);
  assert.equal(payAshenBlight(ctx, owner, { amount: 100 }).active, false);
  assert.equal(rollAshenBlightEncounter(ctx, owner, 'room').rolled, false);
  assert.deepEqual(owner, original); assert.equal(rolls(), 0);
});

test('accepted payment is persistent, duplicate receipts are inert, conflicting receipts reject', () => {
  const { owner, pay, rolls } = fixture(); pay(12, 'free-replica');
  const saved = structuredClone(owner.ashenBlight);
  assert.equal(pay(12, 'free-replica').duplicate, true);
  assert.deepEqual(owner.ashenBlight, saved); assert.equal(rolls(), 0);
  assert.throws(() => pay(15, 'free-replica'), /conflicts/);
  assert.deepEqual(ashenBlightProblems(JSON.parse(JSON.stringify(saved))), []);
});

test('threshold resolves once before callers may run effects; loss cannot claim feats', () => {
  const { ctx, owner, pay, rolls } = fixture([.899999]);
  const result = pay(100, 'fatal'); assert.equal(result.terminal, true);
  assert.equal(result.outcome, 'lost'); assert.deepEqual(owner.ashenBlight.milestones, []);
  assert.equal(pay(100, 'fatal').terminal, true); assert.equal(rolls(), 1);
  assert.throws(() => chooseAshenBlightFeat(ctx, owner, { threshold: 25, path: 'survivor' }), /no milestone/);
  assert.throws(() => pay(1, 'later'), /terminal/);
  assert.deepEqual(ashenBlightProblems(owner.ashenBlight), []);
});

test('converted ordinary plays record zero while native prices record at cap without another threshold roll', () => {
  const { ctx, owner, pay, rolls } = fixture();
  pay(100, 'conversion');
  const ordinary = corruptedCardProjection(ctx, owner, { cost: 1, effects: [] });
  assert.equal(ordinary.ashenBlightCost, 0);
  const free = pay(ordinary.ashenBlightCost, 'ordinary');
  const native = pay(12, 'native');
  assert.equal(free.recorded, true); assert.equal(free.paid, 0); assert.equal(free.added, 0);
  assert.equal(native.recorded, true); assert.equal(native.paid, 12); assert.equal(native.added, 0);
  assert.equal(rolls(), 1);
  assert.deepEqual(owner.ashenBlight.payments.slice(-2).map(row => [row.amount, row.before, row.after]), [[0,100,100],[12,100,100]]);
  assert.deepEqual(ashenBlightProblems(owner.ashenBlight), []);
  assert.equal(pay(0, 'ordinary').duplicate, true);
});

test('survivor receives original milestone tiers and future rooms each roll once after restore', () => {
  const { ctx, owner, pay, rolls } = fixture([.9, .05, .049999]);
  assert.equal(pay(100).converted, true);
  assert.deepEqual(owner.ashenBlight.milestones.map(row => [row.threshold, row.tier]), [[25, 1], [50, 2], [75, 3]]);
  assert.equal(rollAshenBlightEncounter(ctx, owner, 'fight1').rolled, false);
  assert.equal(rollAshenBlightEncounter(ctx, owner, 'fight2').terminal, false);
  owner.ashenBlight = JSON.parse(JSON.stringify(owner.ashenBlight));
  assert.equal(rollAshenBlightEncounter(ctx, owner, 'fight2').duplicate, true);
  assert.equal(rollAshenBlightEncounter(ctx, owner, 'fight3').terminal, true);
  assert.equal(rollAshenBlightEncounter(ctx, owner, 'fight4').rolled, false); assert.equal(rolls(), 3);
});

test('milestone choices are ordered, claim once, and repeated paths add stats but use strongest effects', () => {
  const { ctx, owner, pay } = fixture(); pay(75);
  assert.throws(() => chooseAshenBlightFeat(ctx, owner, { threshold: 75, path: 'martial' }), /earlier/);
  for (const threshold of [25, 50, 75]) chooseAshenBlightFeat(ctx, owner, { threshold, path: 'martial' });
  assert.equal(ashenBlightBonuses(owner).attributes.strength, 6);
  assert.equal(ashenBlightBonuses(owner).martialPoise, 3);
  assert.equal(ashenBlightBonuses(owner).wardPenaltyPct, 20);
  assert.equal(effectiveAshenBlightAttributes(owner).strength, 10); assert.equal(owner.attributes.strength, 4);
  assert.throws(() => chooseAshenBlightFeat(ctx, owner, { threshold: 25, path: 'spell' }), /not pending/);
});

test('Martial replies share the owner cycle, require authored impact, and restore spent budgets', () => {
  const { ctx, owner, pay } = fixture(); pay(25); chooseAshenBlightFeat(ctx, owner, { threshold: 25, path: 'martial' });
  assert.equal(ashenBlightMartialPoise(ctx, owner, { cycleKey: 'owner1', camp: 'physical', authoredPoise: 0 }), 0);
  assert.equal(ashenBlightMartialPoise(ctx, owner, { cycleKey: 'owner1', camp: 'physical', authoredPoise: 5 }), 1);
  owner.ashenBlightCombat = JSON.parse(JSON.stringify(owner.ashenBlightCombat));
  assert.equal(ashenBlightMartialPoise(ctx, owner, { cycleKey: 'owner1', camp: 'physical', authoredPoise: 5 }), 0);
  assert.equal(ashenBlightMartialPoise(ctx, owner, { cycleKey: 'owner2', camp: 'physical', authoredPoise: 5 }), 1);
  assert.deepEqual(ashenBlightCombatProblems(owner.ashenBlightCombat), []);
});

test('Cinder picks one authored ailment and never grants a control stack or extends duration', () => {
  const { ctx, owner, pay } = fixture(); pay(25); chooseAshenBlightFeat(ctx, owner, { threshold: 25, path: 'spell' });
  const request = { cycleKey: 'owner1', school: 'lightning', buildups: [{ status: 'burn', amount: 2 }, { status: 'paralysis', amount: 3 }] };
  assert.throws(() => ashenBlightSpellBuildup(ctx, owner, { ...request, selectedStatus: 'sleep' }), /authored/);
  assert.deepEqual(ashenBlightSpellBuildup(ctx, owner, request), { status: 'burn', amount: 1 });
  assert.equal(ashenBlightSpellBuildup(ctx, owner, { ...request, selectedStatus: 'paralysis' }), null);
  assert.deepEqual(ashenBlightSpellBuildup(ctx, owner, { ...request, cycleKey: 'owner2', selectedStatus: 'paralysis' }), { status: 'paralysis', amount: 1 });
});

test('full-pool positive restoration consumes the Survivor cycle; zero attempts do not', () => {
  const { ctx, owner, pay } = fixture(); pay(25); chooseAshenBlightFeat(ctx, owner, { threshold: 25, path: 'survivor' });
  assert.equal(modulateAshenBlightRestoration(ctx, owner, { kind: 'hp', amount: 0, cycleKey: 'owner1', missing: 9 }).claimed, false);
  assert.equal(modulateAshenBlightRestoration(ctx, owner, { kind: 'hp', amount: 10, cycleKey: 'owner1', missing: 0 }).claimed, true);
  const next = modulateAshenBlightRestoration(ctx, owner, { kind: 'hp', amount: 10, cycleKey: 'owner1', missing: 20 });
  assert.equal(next.claimed, false); assert.equal(next.amount, 10);
});

test('Ward uses additive modifiers, retains fractional carry across cycles/saves, and discards at full', () => {
  const { ctx, owner, pay } = fixture(); pay(75);
  chooseAshenBlightFeat(ctx, owner, { threshold: 25, path: 'spell' });
  chooseAshenBlightFeat(ctx, owner, { threshold: 50, path: 'survivor' });
  chooseAshenBlightFeat(ctx, owner, { threshold: 75, path: 'martial' });
  const sleep = modulateAshenBlightRestoration(ctx, owner, { kind: 'ward', amount: 1, cycleKey: 'owner1', missing: 10, sourceBudget: 1 });
  assert.equal(sleep.amount, 0); assert.ok(Math.abs(sleep.carry - .95) < 1e-9);
  owner.ashenBlightCombat = JSON.parse(JSON.stringify(owner.ashenBlightCombat));
  const later = modulateAshenBlightRestoration(ctx, owner, { kind: 'ward', amount: 1, cycleKey: 'owner1', missing: 10 });
  assert.equal(later.amount, 1); assert.ok(Math.abs(later.carry - .75) < 1e-9);
  beginAshenBlightCycle(ctx, owner, 'owner2'); assert.ok(Math.abs(owner.ashenBlightCombat.wardCarry - .75) < 1e-9);
  modulateAshenBlightRestoration(ctx, owner, { kind: 'ward', amount: 1, cycleKey: 'owner2', missing: 0 });
  assert.equal(owner.ashenBlightCombat.wardCarry, 0);
});

test('converted projection preserves X, lifecycle, identity, restoration/impact and input definitions', () => {
  const { ctx, owner, pay } = fixture(); pay(100);
  const def = { id: 'test', name: 'Test', cost: 2, manaCost: 3, keywords: [], tags: ['camp:spell'],
    effects: [{ op: 'damage', amount: 8 }, { op: 'heal', amount: 4 }, { op: 'restoreWard', amount: 5 }, { op: 'poise', amount: 3 }] };
  const original = structuredClone(def), converted = corruptedCardProjection(ctx, owner, def);
  assert.equal(converted.cost, 1); assert.equal(converted.manaCost, 3); assert.equal(converted.effects[0].amount, 10);
  assert.equal(converted.effects[1].amount, 5); assert.equal(converted.effects[2].amount, 5); assert.equal(converted.effects[3].amount, 3);
  assert.deepEqual(converted.keywords, []); assert.deepEqual(converted.tags, def.tags); assert.deepEqual(def, original);
  assert.equal(corruptedCardProjection(ctx, owner, { ...def, cost: 'X' }).cost, 'X');
  assert.equal(corruptedCardProjection(ctx, owner, { ...def, cost: 0 }).cost, 0);
});

test('authored content has nine locked-tier feats with exactly two benefits and one drawback', () => {
  assert.equal(ashenBlightFeats.length, 9);
  for (const feat of ashenBlightFeats) { assert.equal(feat.buffs.length, 2); assert.equal(feat.drawbacks.length, 1); }
  assert.deepEqual(corruptedCards.map(card => card.ashenBlightCost), [12, 15, 10]);
  for (const card of corruptedCards) { assert.equal(card.cost, 0); assert.equal(card.minCombatExpansionVersion, 2); assert.ok(card.keywords.includes('exhaust')); }
});

test('malformed and forged run/combat states are rejected', () => {
  for (const patch of [{ value: -1 }, { value: 100 }, { thresholdOutcome: 'survived' }, { value: 25, milestones: [] }, { payments: [{ id: 'x', amount: 10, before: 0, after: 11, combatKey: 'room', thresholdOutcome: null }] }]) {
    assert.ok(ashenBlightProblems({ ...createAshenBlightState(), ...patch }).length > 0);
  }
  assert.ok(ashenBlightCombatProblems({ cycleKey: 'x', used: { martial: false }, wardCarry: 1 }).length > 0);
});
