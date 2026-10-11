// node --test workbench/tests/layout-deck-model.test.mjs — Layout Studio's Deck row model for the
// deck editor's cost groups (the file the game reads): byte-exact round trip, the repo's own
// cost validation, the game's own badge function, and combine, split, reorder and label edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileEntries, deckEditorCostProblems, readConfigTree } from '../../tools/config-build.mjs';
import { deckEditorCosts } from '../../src/ui/models/deckEditorCosts.js';
import * as D from '../modules/layout/deck-model.mjs';

const TEXT = readFileSync(new URL('../../content/config/ui/presentation/deckEditorCosts.json', import.meta.url), 'utf8');
const data = D.parseDeck(TEXT);
const profile = { action: 2, mana: 3, stamina: 2, variable: false };
const badges = (d) => deckEditorCosts(profile, d.components.resourceGroups).map(({ id, label, value }) => ({ id, label, value }));

test('the real file round-trips byte for byte and is no change to save', () => {
  assert.equal(D.serializeDeck(data), TEXT);
  assert.equal(D.changedText(TEXT, data), null);
  assert.deepEqual(D.groupProblems(data), []);
});

test('a file with other keys, or in another shape, is refused rather than rewritten', () => {
  assert.throws(() => D.parseDeck(JSON.stringify({ ...data, extra: 1 }, null, 2)), /keys Layout Studio does not write/);
  assert.throws(() => D.parseDeck(JSON.stringify(data, null, 2)), /not in the form Layout Studio saves/);
  assert.throws(() => D.parseDeck('{"components":{}}'), /resourceGroups must be an array/);
});

test('the groups pass the same checks the config compiler runs on the file', () => {
  const groups = data.components.resourceGroups;
  const bad = [
    [{ ...groups[0], id: 'Bad Id' }, groups[1]],
    [groups[0], { ...groups[1], label: '  ' }],
    [groups[0]],
    [groups[0], { ...groups[1], resources: ['mana'] }],
    [{ ...groups[0], resources: ['gold'] }, groups[1]],
    [{ ...groups[0], art: '../secret.png' }, groups[1]],
  ];
  for (const list of bad) {
    const mine = D.groupProblems({ components: { resourceGroups: list } });
    const theirs = deckEditorCostProblems(D.DECK_FILE.replace('content/config/', ''), { components: { resourceGroups: list } });
    assert.ok(mine.length > 0, `model refuses ${JSON.stringify(list)}`);
    assert.ok(theirs.length > 0, `compiler refuses ${JSON.stringify(list)}`);
  }
});

test('reordering changes the order the game shows, and only that line moves in the file', () => {
  const next = D.reorderGroup(data, 0, 1);
  assert.deepEqual(badges(next).map((b) => b.id), ['stamina', 'mana']);
  const lines = (t) => t.split('\n');
  const before = lines(TEXT), after = lines(D.serializeDeck(next));
  assert.equal(after.length, before.length);
  assert.equal(after.filter((line, i) => line !== before[i]).length, 2, 'the two group lines swap and nothing else changes');
  assert.throws(() => D.reorderGroup(data, 0, 5), /outside the row/);
});

test('a label is what the game shows, and a blank label is refused', () => {
  const next = D.setLabel(data, 1, 'Stamina');
  assert.deepEqual(badges(next)[1], { id: 'stamina', label: 'Stamina', value: 2 });
  assert.throws(() => D.setLabel(data, 1, ' '), /must not be blank/);
});

test('combine shows one pool once and removes the group it empties; split puts it back', () => {
  const combined = D.moveResource(data, 'stamina', 0);
  assert.equal(combined.components.resourceGroups.length, 1);
  assert.deepEqual(badges(combined), [{ id: 'mana', label: 'MP', value: 5 }]);
  const split = D.splitResource(combined, 'stamina');
  assert.deepEqual(badges(split), [{ id: 'mana', label: 'MP', value: 3 }, { id: 'stamina', label: 'SP', value: 2 }]);
  assert.throws(() => D.splitResource(data, 'mana'), /nothing to split off/);
  assert.throws(() => D.moveResource(data, 'action', 0), /not in any group/);
  assert.equal(D.moveResource(data, 'mana', 0), data, 'moving a resource into its own group changes nothing');
});

test('a second group showing a pool already shown is refused, as the compiler refuses it', () => {
  const twice = { components: { resourceGroups: [
    { id: 'mana', label: 'MP', resources: ['mana'] },
    { id: 'stamina', label: 'SP', resources: ['stamina'] },
    { id: 'legacy', label: 'Action', resources: ['action'] },
  ] } };
  assert.match(D.groupProblems(twice).join(' '), /resource "stamina" is included more than once/);
  assert.match(deckEditorCostProblems('ui/presentation/deckEditorCosts.json', twice).join(' '), /resource "stamina" is included more than once/);
  // Old Action and Stamina in one group are one pool, and the compiler accepts that.
  const legacy = { components: { resourceGroups: [
    { id: 'mana', label: 'MP', resources: ['mana'] },
    { id: 'stamina', label: 'SP', resources: ['action', 'stamina'] },
  ] } };
  assert.deepEqual(D.groupProblems(legacy), []);
  assert.deepEqual(deckEditorCostProblems('ui/presentation/deckEditorCosts.json', legacy), []);
});

test('edited files pass the repo\'s config compiler with the rest of the real config', () => {
  const entries = readConfigTree(fileURLToPath(new URL('../../content', import.meta.url)));
  const FILE = 'ui/presentation/deckEditorCosts.json';
  assert.ok(entries.some((e) => e.rel === FILE), 'the cost file is in the real config tree');
  const with_ = (text) => entries.map((e) => (e.rel === FILE ? { rel: FILE, text } : e));
  assert.deepEqual(compileEntries(with_(TEXT)).errors, []);
  assert.deepEqual(compileEntries(with_(D.serializeDeck(D.reorderGroup(data, 0, 1)))).errors, []);
  assert.deepEqual(compileEntries(with_(D.serializeDeck(D.moveResource(data, 'stamina', 0)))).errors, []);
});

test('the browser copy of the badge rule gives the game\'s own badges for every profile and grouping', () => {
  const groups = data.components.resourceGroups;
  const separate = groups;
  const legacy = [groups[0], { ...groups[1], resources: ['action', 'stamina'] }];
  const combined = [{ id: 'all', label: 'Cost', resources: ['mana', 'stamina', 'action'] }];
  const profiles = [
    { action: 2, mana: 3, stamina: 2, variable: false },
    { action: 0, mana: 0, stamina: 0, variable: true },
    { action: 0, mana: 2, stamina: 0, variable: true },
    { action: 1, mana: 0, stamina: 4, variable: false },
  ];
  for (const profile of profiles) {
    for (const list of [separate, legacy, combined, [...separate].reverse()]) {
      assert.deepEqual(D.badgesFor(profile, list), deckEditorCosts(profile, list), JSON.stringify({ profile, list }));
    }
  }
});
