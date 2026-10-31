import test from 'node:test';
import assert from 'node:assert/strict';
import { combatStatRows } from '../src/ui/models/CombatantStatRows.js';
import { projectCombatantInspector } from '../src/ui/models/CombatantInspectorSections.js';
import { t } from '../src/ui/strings.js';

const rule = { tags: ['blade'], base: 0.05, weights: { dexterity: 0.1, wisdom: 0.2, intelligence: 0.1 }, divisor: 100, cap: 0.5, multiplier: 1.5 };
const attributes = { dexterity: 20, wisdom: 10, intelligence: 10 }; // 0.05 + (2 + 2 + 1) / 100 = 0.10
const base = [{ label: 'HP', value: 30, max: 40 }, { label: 'MP', value: 3, max: 5 }];
const stateRows = (resources) => Object.fromEntries(projectCombatantInspector({ name: 'X', resources }, t).sections.map((s) => [s.id, s])).state.rows;

test('Current state shows Precision, Evasion and Crit chance with the fighter\'s values', () => {
  const rows = combatStatRows({ statuses: { precision: { stacks: 2 }, evade: { stacks: 1 } }, critRules: [rule], attributes, kind: 'player' }, t);
  assert.deepEqual(stateRows([...base, ...rows]).map((r) => [r.label, r.value]),
    [['MP', '3 / 5'], ['Precision', '2'], ['Evasion', '1'], ['Crit', '10%']]);
});

test('a player keeps all three rows at 0; an enemy shows Precision and Evasion only', () => {
  const player = combatStatRows({ statuses: {}, attributes, kind: 'player' }, t);
  assert.deepEqual(stateRows(player).map((r) => [r.label, r.value]), [['Precision', '0'], ['Evasion', '0'], ['Crit', '0%']]);
  const enemy = combatStatRows({ statuses: {}, critRules: [rule], attributes, kind: 'enemy' }, t);
  assert.deepEqual(stateRows(enemy).map((r) => [r.label, r.value]), [['Precision', '0'], ['Evasion', '0']]);
});

test('rules sharing a tag add up, as an attack with those tags rolls them', () => {
  const keen = { tags: ['blade'], base: 0.03, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 };
  const rows = combatStatRows({ statuses: {}, critRules: [keen, rule], attributes, kind: 'player' }, t);
  assert.equal(rows[2].value, '13%'); // 3% + 10%, not the larger one alone
});

test('Evasion reads status stacks first and falls back to the Foundation dodge charges on entity.evade', () => {
  const value = (input) => combatStatRows({ attributes, kind: 'player', ...input }, t)[1].value;
  assert.equal(value({ statuses: {}, evade: 2 }), 2);
  assert.equal(value({ statuses: { evade: { stacks: 1 } }, evade: 2 }), 1);
  assert.equal(value({ statuses: {} }), 0);
});

test('rules on different tags sum for an attack card that carries both', () => {
  const keen = { tags: ['blade'], base: 0.08, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 };
  const blood = { tags: ['blood'], base: 0.12, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 };
  const chance = (attackTagSets) => combatStatRows({ statuses: {}, critRules: [keen, blood], attributes, kind: 'player', attackTagSets }, t)[2].value;
  assert.equal(chance([['blade', 'blood']]), '20%');
  assert.equal(chance([['blade'], ['blood']]), '12%');
  assert.equal(chance([]), '12%'); // no attack cards known: each rule's own tags
  assert.equal(chance([['guard']]), '0%');
});
