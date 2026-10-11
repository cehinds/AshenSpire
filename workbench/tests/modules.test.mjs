// node --test workbench/tests/modules.test.mjs — the module registry, the
// placeholder contract and the host helpers (prefs, deep links, preview overrides).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../modules/index.mjs';
import { createModulePrefs, parseHash, hashFor, withPreviewOverrides } from '../modules/host.mjs';
import { icon } from '../ui/icons.mjs';

test('every module id loads and default-exports a mount()', async () => {
  const ids = MODULES.map((m) => m.id);
  assert.deepEqual(ids, ['data', 'layout', 'motion', 'entities', 'assets', 'review']);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const m of MODULES) {
    assert.ok(m.label && m.blurb, `${m.id} has a label and blurb`);
    assert.ok(['Studios', 'Project'].includes(m.group), `${m.id} group`);
    assert.match(icon(m.icon), /<svg/, `${m.id} icon ${m.icon} exists`);
    const mod = await m.load();
    assert.equal(typeof mod.default.mount, 'function', `${m.id} exports mount`);
  }
});

test('a placeholder module shows the coming-in-this-branch empty state and lists what it replaces', async () => {
  const layout = (await MODULES[1].load()).default;
  const el = { innerHTML: '' };
  const instance = layout.mount(el, {});
  assert.match(el.innerHTML, /Coming in this branch: /);
  assert.equal(typeof instance, 'object');
});

test('Data Studio is a real module, not the placeholder', async () => {
  const src = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../modules/data/index.mjs', import.meta.url), 'utf8'));
  assert.doesNotMatch(src, /placeholder\.mjs/);
  assert.match(src, /createGrid/);
  assert.match(src, /createCheckPanel/);
});

test('module prefs persist per module under wb.mod.<id> and survive a broken store', () => {
  const data = new Map();
  const storage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
  const prefs = createModulePrefs('data', storage);
  assert.equal(prefs.get('zoom', 100), 100);
  prefs.set('zoom', 150);
  assert.equal(prefs.get('zoom'), 150);
  assert.equal(JSON.parse(data.get('wb.mod.data')).zoom, 150);
  assert.equal(createModulePrefs('layout', storage).get('zoom', 1), 1, 'prefs are per module');
  const broken = createModulePrefs('data', { getItem: () => '{nope', setItem() { throw Error('full'); } });
  assert.equal(broken.get('zoom', 'd'), 'd');
  assert.doesNotThrow(() => broken.set('zoom', 2));
});

test('deep links round-trip: #mod=<id>&params', () => {
  assert.deepEqual(parseHash('#mod=data&table=cards&row=3'), { mod: 'data', params: { table: 'cards', row: '3' } });
  assert.equal(parseHash('#page=library'), null);
  assert.equal(parseHash(''), null);
  assert.equal(hashFor('data', { table: 'cards', skip: undefined, row: 3 }), '#mod=data&table=cards&row=3');
  assert.deepEqual(parseHash(hashFor('review', { q: 'a b' })).params, { q: 'a b' });
});

test('preview overrides add wb.<key> query values and drop null ones', () => {
  assert.equal(withPreviewOverrides('http://127.0.0.1:4320/', {}), 'http://127.0.0.1:4320/');
  assert.equal(withPreviewOverrides('http://127.0.0.1:4320/', { ui: 'compact' }), 'http://127.0.0.1:4320/?wb.ui=compact');
  assert.equal(withPreviewOverrides('/library/a.html', { ui: 'compact', x: null }), '/library/a.html?wb.ui=compact');
});
