// node --test workbench/tests/modules.test.mjs — the module registry, the
// placeholder contract and the host helpers (prefs, deep links, preview overrides).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../modules/index.mjs';
import { createModulePrefs, parseHash, hashFor, withPreviewOverrides, createReloadWaiter, buildAction } from '../modules/host.mjs';
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

test('Motion Studio is a real module: a library, a game-rendered stage and an inspector, not the placeholder', async () => {
  const src = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../modules/motion/index.mjs', import.meta.url), 'utf8'));
  assert.doesNotMatch(src, /placeholder\.mjs/);
  assert.match(src, /class="mo-lib"/);
  assert.match(src, /render\.html/);
  assert.match(src, /class="mo-insp"/);
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

test('Layout Studio is a real module, not the placeholder', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../modules/layout/index.mjs', import.meta.url), 'utf8');
  assert.ok(!/placeholder\.mjs/.test(src), 'layout does not import the placeholder');
  assert.match(src, /UI config/);
  const mod = await MODULES.find((m) => m.id === 'layout').load();
  assert.equal(typeof mod.default.mount, 'function');
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

test('a save reloads the preview when its build reload arrives, and a non-matching reload does not', () => {
  const w = createReloadWaiter();
  w.add(['content/source/weapons.csv'], 0);
  assert.equal(w.event('reload', { files: ['content/other.json'], startedAt: 1 }), null, 'a reload for other files does not settle the save');
  assert.equal(w.pending, 1);
  const hit = w.event('reload', { files: ['content/source/weapons.csv', 'x.css'], startedAt: 1 });
  assert.equal(hit.type, 'reload');
  assert.equal(w.pending, 0);
  assert.deepEqual(buildAction('reload', Boolean(hit), { auto: false }), { reload: true, failed: false });
  assert.deepEqual(buildAction('reload', false, { auto: false }), { reload: false, failed: false }, 'an unrelated reload with auto off leaves the preview alone');
});

test('a failed build of a saved file toasts instead of reloading, and clears the save', () => {
  const w = createReloadWaiter();
  w.add(['content/source/weapons.csv'], 0);
  const hit = w.event('reload-failed', { files: ['content/source/weapons.csv'], startedAt: 1, step: 'tools/content-build.mjs', output: 'boom' });
  assert.equal(hit.type, 'reload-failed');
  assert.equal(w.pending, 0);
  assert.deepEqual(buildAction('reload-failed', true), { reload: false, failed: true });
  assert.deepEqual(buildAction('reload-failed', false), { reload: false, failed: false }, 'an unrelated failure does not toast the save message');
});

test('with auto-reload on, a saved file reloads the preview once', () => {
  const w = createReloadWaiter();
  w.add(['content/source/weapons.csv'], 0);
  let reloads = 0;
  const hit = w.event('reload', { files: ['content/source/weapons.csv'], startedAt: 1 });
  if (buildAction('reload', Boolean(hit), { auto: true }).reload) reloads += 1;
  assert.equal(reloads, 1);
  assert.equal(buildAction('reload', false, { auto: true }).reload, true, 'auto-reload still reloads for an unrelated build');
});

test('a build event that beats the save response still settles it, within the window only', () => {
  let t = 1000;
  const w = createReloadWaiter({ now: () => t, windowMs: 1500 });
  assert.equal(w.event('reload', { files: ['content/source/a.json'], startedAt: 1000 }), null);
  t = 2000;
  assert.equal(w.add(['content/source/a.json'], 900).type, 'reload');
  assert.equal(w.pending, 0);
  t = 5000;
  w.event('reload', { files: ['content/source/b.json'], startedAt: 5000 });
  t = 9000;
  assert.equal(w.add(['content/source/b.json'], 4000), null, 'an event older than the window does not settle a later save');
  assert.equal(w.pending, 1);
});

test('a reload from a build that started before a save was sent cannot settle that save', () => {
  let t = 1000;
  const w = createReloadWaiter({ now: () => t, windowMs: 1500 });
  // An earlier save's build started at 1000 and its reload beat the later save's response.
  assert.equal(w.event('reload', { files: ['content/source/a.json'], startedAt: 1000 }), null);
  t = 1200;
  assert.equal(w.add(['content/source/a.json'], 1100), null, 'the older reload does not satisfy the newer save');
  assert.equal(w.pending, 1);
  t = 1300;
  const hit = w.event('reload', { files: ['content/source/a.json'], startedAt: 1250 });
  assert.equal(hit.type, 'reload', 'the build that started after the save was sent settles it');
  assert.equal(w.pending, 0);
});

test('a build started after the save was sent settles it even when its event beats the response', () => {
  let t = 1100;
  const w = createReloadWaiter({ now: () => t, windowMs: 1500 });
  assert.equal(w.event('reload', { files: ['content/source/a.json'], startedAt: 1050 }), null);
  t = 1200;
  assert.equal(w.add(['content/source/a.json'], 1000).type, 'reload');
  assert.equal(w.pending, 0);
});

test('a waiting save is settled only by a build that started after it was sent', () => {
  let t = 1000;
  const w = createReloadWaiter({ now: () => t });
  w.add(['content/source/a.json'], 1000);
  t = 1500;
  assert.equal(w.event('reload', { files: ['content/source/a.json'], startedAt: 990 }), null, 'a build that started before the save was sent does not settle it');
  assert.equal(w.event('reload', { files: ['content/source/a.json'] }), null, 'an event without a start time does not settle it');
  assert.equal(w.pending, 1);
  t = 2000;
  assert.equal(w.event('reload', { files: ['content/source/a.json'], startedAt: 1100 }).type, 'reload');
  assert.equal(w.pending, 0);
});
