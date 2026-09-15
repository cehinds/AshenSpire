import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SMITH_SLOTS, smithService, smithWorkspaceVars, smithCandidateRows, smithSelectorFace, smithPaneSlots,
} from '../src/ui/models/SmithWorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const item = (itemRef, name, extra = {}) => ({ itemRef, name, selected: false, ...extra });
const upgradeModel = (selectedRef = null) => {
  const candidates = [
    item('armament/straightSword', 'Straight Sword', { currentLevel: 0, nextLevel: 1, inventoryCount: 1 }),
    item('armor/reaver/default', 'Wayfarer Plate', { currentLevel: 2, nextLevel: 3, inventoryCount: 2 }),
  ].map((row) => ({ ...row, selected: row.itemRef === selectedRef }));
  return { properties: { candidates, selected: candidates.find((row) => row.selected) || null } };
};
const mountModel = (service, { itemRef = null, mountKey = null, instanceId = null } = {}) => {
  const candidates = [
    item('armament/a', 'Axe', { whereLabel: 'worn', mounts: [{ mountKey: 'm1' }] }),
    item('armament/b', 'Bow', { whereLabel: 'carried', mounts: [{ mountKey: 'm1' }, { mountKey: 'm2' }] }),
  ].map((row) => ({ ...row, selected: row.itemRef === itemRef }));
  const selected = candidates.find((row) => row.selected) || null;
  const selectedMount = selected && mountKey ? { mountKey } : null;
  const selectedCard = service === 'install' && selectedMount && instanceId ? { instanceId } : null;
  return { properties: { service, candidates, selected, selectedMount, selectedCard } };
};

test('the upgrade model has no service field and reads as the upgrade', () => {
  assert.equal(smithService(upgradeModel()), 'upgrade');
  assert.equal(smithService(mountModel('extract')), 'extract');
  assert.equal(smithService(mountModel('install')), 'install');
});

test('the item column takes the configured share and its bounds', () => {
  const vars = smithWorkspaceVars();
  assert.equal(vars['--w1-rail'], String(wireframeUi.smith.candidatesWidth));
  assert.equal(vars['--w1-rail-min'], `${wireframeUi.smith.candidatesMinRem}rem`);
  assert.equal(vars['--w1-rail-max'], `${wireframeUi.smith.candidatesMaxRem}rem`);
  assert.throws(() => smithWorkspaceVars({ candidatesWidth: 1.2, candidatesMinRem: 1, candidatesMaxRem: 2 }));
  assert.throws(() => smithWorkspaceVars({ candidatesWidth: 0.4, candidatesMinRem: 3, candidatesMaxRem: 2 }));
});

test('one row per offered candidate, in order, with no invented entry', () => {
  const rows = smithCandidateRows(upgradeModel('armor/reaver/default'));
  assert.deepEqual(rows.map((row) => row.member), ['armament/straightSword', 'armor/reaver/default']);
  assert.deepEqual(rows.map((row) => row.selected), [false, true]);
  assert.deepEqual(rows[0].status, { id: 'smith.row.tier', tokens: { from: 0, to: 1 } });
  const mounts = smithCandidateRows(mountModel('extract'));
  assert.deepEqual(mounts.map((row) => row.status.id), ['smith.row.mountOne', 'smith.row.mountMany']);
  assert.deepEqual(mounts[1].status.tokens, { where: 'carried', n: 2 });
  assert.equal(smithCandidateRows({ properties: { candidates: [] } }).length, 0);
});

test('the compact selector names the selection, or asks for one', () => {
  assert.deepEqual(smithSelectorFace(upgradeModel()), { id: 'smith.selector.none', text: null });
  assert.deepEqual(smithSelectorFace(upgradeModel('armament/straightSword')), { id: null, text: 'Straight Sword' });
});

test('the pane registers only the slots its service declares, in wireframe order', () => {
  assert.deepEqual([...smithPaneSlots(upgradeModel())], ['idle']);
  assert.deepEqual([...smithPaneSlots(upgradeModel('armament/straightSword'))], ['selected', 'changes', 'cost']);
  assert.deepEqual([...smithPaneSlots(mountModel('extract', { itemRef: 'armament/a' }))], ['selected', 'mounts', 'cost']);
  assert.deepEqual([...smithPaneSlots(mountModel('extract', { itemRef: 'armament/a', mountKey: 'm1' }))],
    ['selected', 'mounts', 'extractionPreview', 'cost']);
  assert.deepEqual([...smithPaneSlots(mountModel('install', { itemRef: 'armament/b' }))], ['selected', 'mounts', 'cost']);
  assert.deepEqual([...smithPaneSlots(mountModel('install', { itemRef: 'armament/b', mountKey: 'm2' }))],
    ['selected', 'mounts', 'cards', 'cost']);
  assert.deepEqual([...smithPaneSlots(mountModel('install', { itemRef: 'armament/b', mountKey: 'm2', instanceId: 'c1' }))],
    ['selected', 'mounts', 'cards', 'installPreview', 'cost']);
  for (const service of ['upgrade', 'extract', 'install']) {
    const order = SMITH_SLOTS[service];
    assert.ok(order.includes('selected') && order.at(-1) === 'cost', `${service} opens on the selection and ends on the cost`);
  }
});
