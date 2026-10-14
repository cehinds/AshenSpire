import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { makeAuditCombat } from '../tools/combat-audit/fixtures.mjs';
import { assertImmediateContracts, auditCounterLifecycle, auditStateSnapshot } from '../tools/combat-audit/cards.mjs';
test('positive authored effects require operation receipts even when card dispatch succeeds', () => {
  const card = { id: 'fixture', effects: [{ op: 'damage', amount: 6, target: 'enemy' }] };
  assert.throws(() => assertImmediateContracts(card, [{ type: 'cardPlayed', cardInstanceId: 'a' }], 'a'), /must emit damageDealt/);
  assert.throws(() => assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'b', incoming: 6 }], 'a'), /must emit damageDealt/);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'a', incoming: 6 }], 'a').covered, ['damage']);
});
test('counter reply payload requires preparation rather than premature HP damage', () => {
  const card = { id: 'counter', tags: ['maneuver:counter'], effects: [{ op: 'damage', amount: 6 }] };
  assert.throws(() => assertImmediateContracts(card, [], 'a'), /payload must arm/);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'combatCounterArmed', cardInstanceId: 'a' }], 'a'), {
    covered: ['counter-preparation'], uncovered: ['deferred-damage'] });
});

for (const mode of ['native', 'bundled']) test(`${mode}: real counter incoming, suppression, bypass and declined-reaction lifecycle`, async () => {
  const report = await auditCounterLifecycle({ mode });
  assert.equal(report.cases.length, 4);
  assert.deepEqual(report.failures, []);
});

for (const mode of ['native', 'bundled']) test(`${mode}: refusal state proof includes enemies, gates and RNG`, async () => {
  const api = await loadAuditRuntime(mode);
  const { combat } = makeAuditCombat(api, { classId: 'reaver', instance: { cardId: 'strike', upgraded: false } });
  let before = auditStateSnapshot(api, combat);
  combat.enemies[0].hp--;
  assert.notEqual(auditStateSnapshot(api, combat), before);
  before = auditStateSnapshot(api, combat);
  combat.triggerState.set('audit:unexpected', { fires: 1, turn: combat.turn, turnFires: 1 });
  assert.notEqual(auditStateSnapshot(api, combat), before);
  before = auditStateSnapshot(api, combat);
  combat.rng.float('misc');
  assert.notEqual(auditStateSnapshot(api, combat), before);
  combat.queue.push({ effect: { op: 'draw', amount: 1 }, source: combat.player });
  assert.throws(() => auditStateSnapshot(api, combat), /still resolving/);
});
