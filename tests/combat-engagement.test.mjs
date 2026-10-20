import test from 'node:test';
import assert from 'node:assert/strict';
import { RANGE_POLICY_DEFAULTS, snapshotRangePolicy, rangePolicyProblems, actorRangeKey, rangePairKey,
  createRangeState, rangeStateProblems, engagementBand, movedEngagementState, rangeActionPlan, rangePlanProblems } from '../src/model/combatEngagement.js';
const player = 'player:a', enemy = 'enemy:e1', other = 'enemy:e2';
const state = (range = 'ranged', policy = RANGE_POLICY_DEFAULTS) => createRangeState(policy,
  [{ key: player, startingRange: 'melee' }, { key: enemy, startingRange: range }, { key: other, startingRange: 'reach' }]);
const contact = (targetKey = enemy, coverage = 0, extra = {}) => ({ targetKey, coverage, weapon: true, sourceWeaponId: 'fixture', ...extra });

test('opposing engagement pairs initialize symmetrically and survive unrelated movement', () => {
  const before = state(), after = movedEngagementState(before, player, enemy, -1);
  assert.equal(engagementBand(before, enemy, player), 2);
  assert.equal(engagementBand(after, player, enemy), 1);
  assert.equal(engagementBand(after, player, other), 1);
  assert.equal(engagementBand(before, player, enemy), 2, 'the previous state is immutable');
  assert.equal(engagementBand(movedEngagementState(movedEngagementState(after, player, enemy, -1), player, enemy, -1), player, enemy), 0);
});

test('Advance prices the greatest gap once for repeated and mixed-source contacts', () => {
  const s = state();
  for (const [coverage, expected] of [[0, 2], [1, 1], [2, 0]]) {
    assert.equal(rangeActionPlan(s, player, [contact(enemy, coverage)]).advanceSp, expected);
  }
  const quote = rangeActionPlan(s, player, [contact(enemy, 2, { sourceWeaponId: 'bow' }), contact(other, 0, { sourceWeaponId: 'dagger' }), contact(other, 0)]);
  assert.equal(quote.advanceSp, 1);
  assert.deepEqual(quote.targets.map(row => row.coverage), [2, 0, 0]);
  assert.deepEqual(quote.targets.map(row => row.effectiveBand), [2, 0, 0]);
  assert.deepEqual(rangePlanProblems(quote, s, [player, enemy, other]), []);
});

test('Throw extends only a capable contact by one band without combining Advance', () => {
  const near = state('reach');
  const thrown = rangeActionPlan(near, player, [contact(enemy, 0, { throwCapable: true }), contact(other, 1)], { route: 'throw' });
  assert.equal(thrown.available, true); assert.equal(thrown.advanceSp, 0);
  assert.deepEqual(thrown.targets.map(row => row.precisionDelta), [-1, 0]);
  assert.equal(rangeActionPlan(state(), player, [contact(enemy, 0, { throwCapable: true })], { route: 'throw' }).available, false);
  assert.equal(rangeActionPlan(near, player, [contact(enemy, 0)], { route: 'throw' }).available, false);
  assert.equal(rangeActionPlan(near, player, [contact(enemy, 0, { throwCapable: true }), contact(other, 0)], { route: 'throw' }).available, false);
});

test('Reach Precision depends on the persistent band, never a temporary approach', () => {
  const far = state(), close = movedEngagementState(movedEngagementState(far, player, enemy, -1), player, enemy, -1);
  assert.equal(rangeActionPlan(far, player, [contact(enemy, 1)]).targets[0].precisionDelta, 0);
  assert.equal(rangeActionPlan(close, player, [contact(enemy, 1)]).targets[0].precisionDelta, 1);
  assert.equal(rangeActionPlan(close, player, [contact(enemy, 1, { weapon: false })]).targets[0].precisionDelta, 0);
});

test('nested outgoing actions use incoming temporary distance without changing the stored pair', () => {
  const s = state(), incoming = rangeActionPlan(s, player, [contact()]);
  const reply = rangeActionPlan(s, enemy, [contact(player)], { context: incoming });
  assert.equal(reply.advanceSp, 0);
  assert.equal(reply.targets[0].band, 0);
  assert.equal(reply.targets[0].actualBand, 2);
  assert.equal(engagementBand(s, enemy, player), 2);
});

test('policy snapshots honor explicit zero and off; old fights have no plan', () => {
  const off = snapshotRangePolicy(RANGE_POLICY_DEFAULTS, { rangeMechanics: false, rangeAdvanceSpPerBand: 0 });
  assert.equal(off.enabled, false); assert.equal(off.advanceSpPerBand, 0);
  const s = state('ranged', off), plan = rangeActionPlan(s, player, [contact(enemy, 1, { throwCapable: true })]);
  assert.equal(plan.advanceSp, 0); assert.equal(plan.targets[0].precisionDelta, 0);
  assert.equal(movedEngagementState(s, player, enemy, -1), s);
  assert.equal(rangeActionPlan(null, player, []), null);
  assert.throws(() => snapshotRangePolicy(RANGE_POLICY_DEFAULTS, { rangeAdvanceSpPerBand: -1 }), /Invalid range/);
  assert.ok(rangePolicyProblems({ ...off, version: 2 }).length);
});

test('save validators reject unknown, missing, duplicate, tampered and malformed data', () => {
  const s = state(), ids = [player, enemy, other];
  assert.deepEqual(rangeStateProblems(s, ids), []);
  assert.ok(rangeStateProblems({ ...s, version: 2 }, ids).length);
  assert.ok(rangeStateProblems({ ...s, policy: { ...s.policy, surprise: true } }, ids).length);
  assert.ok(rangeStateProblems({ ...s, engagements: {} }, ids).length);
  assert.ok(rangeStateProblems({ ...s, engagements: { ...s.engagements, [rangePairKey(player, 'enemy:unknown')]: 1 } }, ids).length);
  const plan = rangeActionPlan(s, player, [contact()]);
  assert.deepEqual(rangePlanProblems(plan, s, ids), []);
  assert.ok(rangePlanProblems({ ...plan, advanceSp: 0 }, s, ids).length);
  assert.ok(rangePlanProblems({ ...plan, targets: [...plan.targets, ...plan.targets] }, s, ids).length);
  assert.ok(rangePlanProblems({ ...plan, paid: { energy: 1, stamina: 1, mana: 0 } }, s, ids).length);
  const moved = movedEngagementState(s, player, enemy, -1);
  assert.deepEqual(rangePlanProblems(JSON.parse(JSON.stringify(plan)), moved, ids), [], 'a frozen quote remains valid after later persistent movement');
});

test('co-op actor keys distinguish entities with the same engine player id and detached copies', () => {
  const a = { id: 'player', kind: 'player' }, b = { id: 'player', kind: 'player' };
  const ctx = { players: new Map([['a', { entity: a }], ['b', { entity: b }]]) };
  assert.equal(actorRangeKey(ctx, a), 'player:a'); assert.equal(actorRangeKey(ctx, b), 'player:b');
  assert.equal(actorRangeKey(ctx, { ...b, rangeActorKey: 'player:b' }), 'player:b');
});

test('range quotes reject arithmetic overflow rather than freezing an imprecise payment', () => {
  const huge = state('ranged', { ...RANGE_POLICY_DEFAULTS, advanceSpPerBand: Number.MAX_SAFE_INTEGER });
  assert.throws(() => rangeActionPlan(huge, player, [contact()]), /safe integer/);
});

test('mixed sources share one temporary pair distance in either authored order', () => {
  const s = state();
  const sources = [contact(enemy, 0), contact(enemy, 1, { sourceWeaponId: 'halberd' }), contact(enemy, 2, { weapon: false, sourceWeaponId: null })];
  for (const rows of [sources, [...sources].reverse()]) {
    const root = rangeActionPlan(s, player, rows);
    assert.deepEqual(root.targets.map(row => row.effectiveBand), [0, 0, 0]);
    assert.deepEqual(root.targets.map(row => row.coverage), rows.map(row => row.coverage));
    assert.deepEqual(rangePlanProblems(root, s), []);
    const counter = rangeActionPlan(s, enemy, [contact(player)], { context: root });
    assert.equal(counter.advanceSp, 0);
    assert.equal(counter.targets[0].band, 0);
  }
});
