import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckEditorCosts } from '../src/ui/models/deckEditorCosts.js';
import { compileEntries, deckEditorCostProblems } from '../tools/config-build.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

const rel = 'ui/presentation/deckEditorCosts.json';
const authored = JSON.parse(readFileSync(new URL('../content/config/ui/presentation/deckEditorCosts.json', import.meta.url), 'utf8'));
const groups = authored.components.resourceGroups;
const separate = [
  { id: 'mana', label: 'MP', resources: ['mana'] },
  { id: 'stamina', label: 'SP', resources: ['stamina'] },
];
const legacy = [separate[0], { ...separate[1], resources: ['action', 'stamina'] }];

test('authored default shows canonical SP after MP without double-counting the action alias', () => {
  const profile = Object.freeze({ action: 2, mana: 3, stamina: 2, variable: false });
  assert.deepEqual(deckEditorCosts(profile, groups).map(({ id, label, value }) => ({ id, label, value })), [
    { id: 'mana', label: 'MP', value: 3 }, { id: 'stamina', label: 'SP', value: 2 },
  ]);
  assert.equal(profile.action, 2);
  assert.deepEqual(deckEditorCosts(profile, legacy).map(badge => badge.value), [3, 2]);
});

test('authored grouping supports arbitrary order and grouping without losing a pool', () => {
  const profile = { action: 2, mana: 3, stamina: 2 };
  assert.deepEqual(deckEditorCosts(profile, separate).map(badge => badge.value), [3, 2]);
  assert.deepEqual(deckEditorCosts(profile, [...separate].reverse()).map(badge => badge.id), ['stamina', 'mana']);
  assert.deepEqual(deckEditorCosts(profile, [{ id: 'all', label: 'Cost', resources: ['mana', 'stamina', 'action'] }]).map(badge => badge.value), [5]);
  assert.deepEqual(deckEditorCosts({ action: 2, mana: 3 }, legacy).map(badge => badge.value), [3, 2]);
});

test('variable stamina preserves independent fixed mana and zero groups remain visible', () => {
  const combined = [{ id: 'all', label: 'Cost', resources: ['mana', 'stamina', 'action'] }];
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 2, stamina: 0, variable: true }, combined).map(badge => badge.value), ['X+2']);
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 0, stamina: 0, variable: true }, groups).map(badge => badge.value), [0, 'X']);
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 0, stamina: 0, variable: true }, legacy).map(badge => badge.value), [0, 'X']);
  assert.deepEqual(deckEditorCosts({ action: 0, mana: 0, stamina: 0 }, groups).map(badge => badge.value), [0, 0]);
});

test('configuration compiler accepts consolidated and separate display layouts', () => {
  const compile = resourceGroups => compileEntries([
    { rel: 'ui/tokens.json', text: '{"vars":{}}' },
    { rel, text: JSON.stringify({ components: { resourceGroups } }) },
  ]);
  assert.deepEqual(compile(groups).errors, []);
  assert.deepEqual(compile(separate).errors, []);
  assert.deepEqual(compile(legacy).errors, []);
  assert.deepEqual(compile(separate).config.presentation.deckEditorCosts.components.resourceGroups, separate);
});

test('configuration refuses dropped, duplicated or unknown resources and unusable labels', () => {
  const problems = resourceGroups => deckEditorCostProblems(rel, { components: { resourceGroups } }).join('\n');
  assert.match(problems(groups.slice(0, 1)), /resource "stamina" is missing/);
  assert.match(problems([...groups, { id: 'action', label: 'AP', resources: ['action'] }]), /resource "stamina" is included more than once/);
  assert.match(problems([{ id: 'oops', label: '', resources: ['health'] }]), /unknown resource "health"/);
  assert.match(problems([{ id: 'oops', label: '', resources: ['health'] }]), /label must be a non-empty string/);
  assert.match(problems([]), /non-empty array/);
});

test('every shipped card and upgrade displays the framework stamina price once', () => {
  const registries = createRegistries(contentBundle);
  for (const card of registries.cards.all()) for (const upgraded of [false, true]) {
    const profile = registries.framework.costProfile(resolveCard(registries, { cardId: card.id, upgraded }));
    const badges = deckEditorCosts(profile, groups);
    assert.equal(badges.find(badge => badge.id === 'stamina').value, profile.variable ? 'X' : profile.stamina, `${card.id} upgraded=${upgraded}`);
    assert.equal(badges.find(badge => badge.id === 'mana').value, profile.mana);
  }
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
