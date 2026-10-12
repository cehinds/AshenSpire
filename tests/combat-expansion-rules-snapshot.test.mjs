import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatExpansionRuleSnapshot, combatExpansionRulesProblems } from '../src/model/combatExpansionRules.js';

const fresh = () => createCombatExpansionRuleSnapshot();

test('a frozen snapshot is valid as written', () => {
  assert.deepEqual(combatExpansionRulesProblems(fresh()), []);
});

test('a snapshot missing a since-added status row (no rider names it) is accepted', () => {
  const snapshot = fresh();
  delete snapshot.statuses.statuses.offBalance;
  assert.deepEqual(combatExpansionRulesProblems(snapshot), []);
});

test('a snapshot with a malformed present status row is still refused', () => {
  const snapshot = fresh();
  snapshot.statuses.statuses.bleed.cap = 'many';
  assert.match(combatExpansionRulesProblems(snapshot).join(';'), /statuses\.statuses\.bleed\.cap must be finite/);
});

test('a snapshot with an unknown extra status row is still refused', () => {
  const snapshot = fresh();
  snapshot.statuses.statuses.phantomStatus = structuredClone(snapshot.statuses.statuses.bleed);
  assert.match(combatExpansionRulesProblems(snapshot).join(';'), /statuses\.statuses\.phantomStatus is unknown/);
});

test('a damage rider naming a status with no row in the snapshot is refused', () => {
  const snapshot = fresh();
  delete snapshot.statuses.statuses.necroticBlight;
  assert.match(combatExpansionRulesProblems(snapshot).join(';'), /damageRiders\.necrotic\.status necroticBlight has no status row/);
});
