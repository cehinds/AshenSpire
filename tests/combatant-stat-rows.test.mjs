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
