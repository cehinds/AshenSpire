import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckEditorCosts } from '../src/ui/models/deckEditorCosts.js';
import { compileEntries, deckEditorCostProblems } from '../tools/config-build.mjs';

const rel = 'ui/presentation/deckEditorCosts.json';
const authored = JSON.parse(readFileSync(new URL('../content/config/ui/presentation/deckEditorCosts.json', import.meta.url), 'utf8'));
const groups = authored.components.resourceGroups;
const separate = [
  { id: 'mana', label: 'MP', resources: ['mana'] },
  { id: 'stamina', label: 'SP', resources: ['stamina'] },
  { id: 'action', label: 'AP', resources: ['action'] },
];

test('authored default folds action into SP after MP without changing costs', () => {
  const profile = Object.freeze({ action: 2, mana: 3, stamina: 4, variable: false });
  assert.deepEqual(deckEditorCosts(profile, groups).map(({ id, label, value }) => ({ id, label, value })), [
    { id: 'mana', label: 'MP', value: 3 }, { id: 'stamina', label: 'SP', value: 6 },
  ]);
  assert.equal(profile.action, 2);
});

test('authored grouping supports separate action and arbitrary order without losing a pool', () => {
  assert.deepEqual(deckEditorCosts({ action: 2, mana: 3, stamina: 4 }, separate).map(badge => badge.value), [3, 4, 2]);
  assert.deepEqual(deckEditorCosts({ action: 2, mana: 3, stamina: 4 }, [...separate].reverse()).map(badge => badge.id), ['action', 'stamina', 'mana']);
  assert.deepEqual(deckEditorCosts({ action: 2, mana: 3, stamina: 4 }, [{ id: 'all', label: 'Cost', resources: ['mana', 'stamina', 'action'] }]).map(badge => badge.value), [9]);
});

test('variable action preserves additional fixed cost and zero groups remain visible', () => {
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 0, stamina: 2, variable: true }, groups).map(badge => badge.value), [0, 'X+2']);
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 0, stamina: 0, variable: true }, groups).map(badge => badge.value), [0, 'X']);
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 0, stamina: 0 }, groups).map(badge => badge.value), [0, 0]);
});

test('configuration compiler accepts consolidated and separate display layouts', () => {
  const compile = resourceGroups => compileEntries([
    { rel: 'ui/tokens.json', text: '{"vars":{}}' },
    { rel, text: JSON.stringify({ components: { resourceGroups } }) },
  ]);
  assert.deepEqual(compile(groups).errors, []);
  assert.deepEqual(compile(separate).errors, []);
  assert.deepEqual(compile(separate).config.presentation.deckEditorCosts.components.resourceGroups, separate);
});

test('configuration refuses dropped, duplicated or unknown resources and unusable labels', () => {
  const problems = resourceGroups => deckEditorCostProblems(rel, { components: { resourceGroups } }).join('\n');
  assert.match(problems(groups.slice(0, 1)), /resource "action" is missing/);
  assert.match(problems([...groups, separate[2]]), /resource "action" is included more than once/);
  assert.match(problems([{ id: 'oops', label: '', resources: ['health'] }]), /unknown resource "health"/);
  assert.match(problems([{ id: 'oops', label: '', resources: ['health'] }]), /label must be a non-empty string/);
  assert.match(problems([]), /non-empty array/);
});

test('resource icons come from authored asset IDs and remain optional for alternative layouts', () => {
  assert.deepEqual(deckEditorCosts({ action: 1, mana: 2, stamina: 0 }, groups).map(badge => badge.art), [
    'assets/ui/stamina-orb/diamond.webp', 'assets/ui/stamina-orb/orb.webp',
  ]);
  assert.ok(deckEditorCosts({ action: 1, mana: 2, stamina: 0 }, separate).every(badge => !('art' in badge)));
});

test('resource icon configuration refuses URLs and paths escaping the asset tree', () => {
  for (const art of ['https://example.com/orb.webp', '../orb.webp', 'assets/../orb.webp', 'assets/ui/orb.webp?x=1', null]) {
    const bad = groups.map((group, index) => index ? group : { ...group, art });
    assert.match(deckEditorCostProblems(rel, { components: { resourceGroups: bad } }).join('\n'), /art must be a safe assets\/ image path/);
  }
});
