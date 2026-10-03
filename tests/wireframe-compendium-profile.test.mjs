import test from 'node:test';
import assert from 'node:assert/strict';
import { compendiumSections, compendiumView, entryDetail } from '../src/ui/models/CompendiumModel.js';
import { PROFILE_CATEGORIES, profileCategoryOf, profileWorkspaceView } from '../src/ui/models/ProfileWorkspaceModel.js';
import { stepCategory, workspaceFrameVars } from '../src/ui/models/WorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const piece = (id, kind, extra = {}) => ({ id, kind, name: id.toUpperCase(), rarity: 'rare', hand: 'main', tags: ['edge'], ...extra });
const drawn = [
  { piece: piece('dagger', 'weapon'), reveal: { state: 'held' } },
  { piece: piece('katana', 'weapon'), reveal: { state: 'unfound', gate: 'unfound' } },
  { piece: piece('buckler', 'shield'), reveal: { state: 'listed', hint: 'Win a climb.' } },
  { piece: piece('axe', 'weapon', { rarity: undefined }), reveal: { state: 'unearned', gate: 'unearned' } },
];

test('W1f: kinds come from the rows, in table order, with held counts', () => {
  const sections = compendiumSections(drawn, (k) => k.toUpperCase());
  assert.deepEqual(sections.map((s) => [s.kind, s.label, s.have, s.total]), [['weapon', 'WEAPON', 1, 3], ['shield', 'SHIELD', 0, 1]]);
});

test('W1f: the view selects the first kind and entry, and a stale selection falls back', () => {
  const view = compendiumView(drawn);
  assert.equal(view.current, 'weapon');
  assert.equal(view.selected.piece.id, 'dagger');
  assert.deepEqual([view.held, view.total], [1, 4]);
  assert.deepEqual(view.categories.map((c) => c.selected), [true, false]);
  assert.equal(compendiumView(drawn, { current: 'weapon', selectedId: 'katana' }).selected.piece.id, 'katana');
  assert.equal(compendiumView(drawn, { current: 'shield', selectedId: 'katana' }).selected.piece.id, 'buckler');
  assert.equal(compendiumView(drawn, { current: 'armour' }).current, 'weapon');
  assert.equal(compendiumView([]).selected, null);
});

test('W1f: a withheld entry reveals only rarity, hand and why; never name, mods or tags', () => {
  const opts = { modLines: ['+2 Strength'], tags: [{ id: 'edge', label: 'Edge', blurb: 'Cuts.' }], lockCopy: { unfound: 'Not yet found.', unearned: 'Not yet earned.' } };
  const held = entryDetail(drawn[0].piece, drawn[0].reveal, opts);
  assert.equal(held.name, 'DAGGER');
  assert.deepEqual(held.mods, ['+2 Strength']);
  assert.deepEqual(held.tags.map((t) => t.label), ['Edge']);
  assert.equal(held.hint, '');
  const hidden = entryDetail(drawn[1].piece, drawn[1].reveal, opts);
  assert.equal(hidden.name, null);
  assert.deepEqual([...hidden.mods, ...hidden.tags], []);
  assert.equal(hidden.hint, 'Not yet found.');
  assert.ok(!JSON.stringify(hidden).includes('KATANA'));
  const listed = entryDetail(drawn[2].piece, drawn[2].reveal, opts);
  assert.equal(listed.name, 'BUCKLER');
  assert.deepEqual([...listed.mods, ...listed.tags], []);
  assert.equal(listed.hint, 'Win a climb.');
  assert.equal(entryDetail(drawn[3].piece, drawn[3].reveal, opts).rarity, 'common');
});

test('W1g: categories are the two drawer kinds; the first non-empty one opens', () => {
  assert.deepEqual([...PROFILE_CATEGORIES], ['meta', 'run']);
  assert.equal(profileCategoryOf({ kind: 'meta' }), 'meta');
  assert.equal(profileCategoryOf({ kind: 'run', slot: 2 }), 'run');
  const archives = [{ id: 'r1', kind: 'run' }, { id: 'r2', kind: 'run' }];
  const view = profileWorkspaceView(archives);
  assert.equal(view.current, 'run');
  assert.deepEqual(view.categories.map((c) => [c.id, c.count, c.selected]), [['meta', 0, false], ['run', 2, true]]);
  assert.equal(view.empty, null);
  const picked = profileWorkspaceView(archives, 'meta');
  assert.deepEqual([picked.current, picked.entries.length, picked.empty], ['meta', 0, 'category']);
  assert.equal(profileWorkspaceView([]).empty, 'drawer');
  assert.equal(profileWorkspaceView([]).current, 'meta');
});

test('W1g: viewing never changes the drawer list it reads', () => {
  const archives = [{ id: 'm', kind: 'meta' }, { id: 'r', kind: 'run' }];
  const before = JSON.stringify(archives);
  profileWorkspaceView(archives, 'run');
  assert.equal(JSON.stringify(archives), before);
});

test('W1: rail keys step and wrap; other keys do nothing', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(stepCategory(ids, 'a', 'ArrowDown'), 'b');
  assert.equal(stepCategory(ids, 'a', 'ArrowUp'), 'c');
  assert.equal(stepCategory(ids, 'c', 'ArrowRight'), 'a');
  assert.equal(stepCategory(ids, 'b', 'ArrowLeft'), 'a');
  assert.equal(stepCategory(ids, 'b', 'Home'), 'a');
  assert.equal(stepCategory(ids, 'b', 'End'), 'c');
  assert.equal(stepCategory(ids, 'b', 'Enter'), null);
  assert.equal(stepCategory([], 'b', 'Home'), null);
});

test('W1: the frame reads its shares from wireframeUi and refuses nonsense', () => {
  const vars = workspaceFrameVars();
  assert.equal(vars['--w1-frame-w'], String(wireframeUi.workspace.frameWidth));
  assert.equal(vars['--w1-rail'], '0.216');
  assert.equal(vars['--w1-rail-min'], '11rem');
  assert.throws(() => workspaceFrameVars({ ...wireframeUi.workspace, frameHeight: 90 }), /fraction/);
  assert.throws(() => workspaceFrameVars({ ...wireframeUi.workspace, railMinRem: 30 }), /inverted/);
});
