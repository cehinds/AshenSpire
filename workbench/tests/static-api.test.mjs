// node --test workbench/tests/static-api.test.mjs — the published Workbench's API shim,
// in node: a fake fetch serves an in-memory snapshot and a Map stands in for localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticApi, changedFiles, discardChanges, LOCAL } from '../static/static-api.mjs';

const BASE = '/AshenSpire/workbench/';
const ORIGIN = 'https://example.test';

const SNAPSHOT = {
  meta: { branch: 'dev', head: 'abc1234', builtAt: '2026-10-13T00:00:00Z' },
  snap: {
    tools: { status: 200, body: [{ id: 'game', name: 'Game' }, { id: 'editor', name: 'Editor' }] },
    'data/status': { status: 200, body: { ok: true } },
  },
  index: {
    'content/a.json': { hash: 'h-a', kind: 'json' },
    'content/sub/b.csv': { hash: 'h-b', kind: 'csv' },
    'content/notes.txt': { hash: 'h-n', kind: 'text' },
    'docs/readme.md': { hash: 'h-r', kind: 'text' },
  },
};

const PUBLISHED = {
  'content/a.json': '{\n  "a": 1\n}\n',
  'content/sub/b.csv': 'id,name\n1,Ember\n',
  'content/notes.txt': 'first\nsecond\n',
  'docs/readme.md': '# Readme\n',
};

// Serves the snapshot and each published file as the static site does.
function fakeFetch() {
  const calls = [];
  const impl = async (u) => {
    calls.push(u);
    const p = new URL(u, ORIGIN).pathname;
    if (p === BASE + 'static-api/snapshot.json') return new Response(JSON.stringify(SNAPSHOT), { status: 200 });
    const m = p.match(/^\/AshenSpire\/workbench\/static-api\/files\/(.+)\.json$/);
    if (m && PUBLISHED[m[1]] !== undefined) {
      const path = m[1];
      return new Response(JSON.stringify({ path, text: PUBLISHED[path], hash: SNAPSHOT.index[path].hash, kind: SNAPSHOT.index[path].kind }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
  return { impl, calls };
}

class MapStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

function setup() {
  const { impl, calls } = fakeFetch();
  const storage = new MapStorage();
  const api = createStaticApi({ base: BASE, origin: ORIGIN, fetchImpl: impl, storage });
  const url = (path, search = '') => new URL(BASE + 'api/' + path + search, ORIGIN);
  const get = async (path, search) => (await api.handle(url(path, search))).json();
  const post = async (path, body) => {
    const res = await api.handle(url(path), { method: 'POST', body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  return { api, storage, calls, get, post, url };
}

test('files/list filters by dir and by ext with or without dots, sorted', async () => {
  const { get } = setup();
  assert.deepEqual(await get('files/list', '?dir=content&ext=csv,json'), {
    dir: 'content', files: ['content/a.json', 'content/sub/b.csv'], truncated: false,
  });
  assert.deepEqual((await get('files/list', '?ext=.json')).files, ['content/a.json']);
  assert.deepEqual((await get('files/list', '?ext=JSON')).files, ['content/a.json']);
  assert.deepEqual((await get('files/list', '?dir=content/')).files, ['content/a.json', 'content/notes.txt', 'content/sub/b.csv']);
  assert.equal((await get('files/list')).files.length, 4);
});

test('files/read returns the published text and hash', async () => {
  const { get } = setup();
  const r = await get('files/read', '?path=content/a.json');
  assert.equal(r.path, 'content/a.json');
  assert.equal(r.text, PUBLISHED['content/a.json']);
  assert.equal(r.hash, 'h-a');
});

test('files/read of a path not in the snapshot is a 404 with an error', async () => {
  const { api, url } = setup();
  const res = await api.handle(url('files/read', '?path=content/missing.json'));
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /not in the published snapshot/);
});

test('save then read returns the new text and a 64-hex hash', async () => {
  const { get, post } = setup();
  const saved = await post('files/save', { changes: [{ path: 'content/a.json', text: '{"a": 2}\n' }] });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.backup, null);
  assert.equal(saved.body.static, true);
  assert.equal(saved.body.files[0].path, 'content/a.json');
  assert.match(saved.body.files[0].hash, /^[0-9a-f]{64}$/);
  const r = await get('files/read', '?path=content/a.json');
  assert.equal(r.text, '{"a": 2}\n');
  assert.equal(r.hash, saved.body.files[0].hash);
});

test('the hash of a save is the SHA-256 of the UTF-8 text', async () => {
  const { post } = setup();
  const { body } = await post('files/save', { changes: [{ path: 'content/notes.txt', text: 'abc' }] });
  assert.equal(body.files[0].hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('a newly saved path appears in files/list', async () => {
  const { get, post } = setup();
  await post('files/save', { changes: [{ path: 'content/new.json', text: '{}\n' }] });
  assert.deepEqual((await get('files/list', '?dir=content&ext=json')).files, ['content/a.json', 'content/new.json']);
});

test('a save with a malformed change is refused', async () => {
  const { post } = setup();
  const res = await post('files/save', { changes: [{ path: 'content/a.json' }] });
  assert.equal(res.status, 400);
});

test('files/diff returns hunks for a change and none when the text is equal', async () => {
  const { post } = setup();
  const changed = await post('files/diff', { path: 'content/notes.txt', text: 'first\nthird\n' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.path, 'content/notes.txt');
  assert.equal(changed.body.exists, true);
  assert.equal(changed.body.added, 1);
  assert.equal(changed.body.removed, 1);
  assert.ok(changed.body.hunks.length >= 1);
  const same = await post('files/diff', { path: 'content/notes.txt', text: PUBLISHED['content/notes.txt'] });
  assert.deepEqual(same.body.hunks, []);
  assert.equal(same.body.added, 0);
  assert.equal(same.body.removed, 0);
});

test('files/diff compares against the saved overlay once a file is saved', async () => {
  const { post } = setup();
  await post('files/save', { changes: [{ path: 'content/notes.txt', text: 'first\nthird\n' }] });
  const same = await post('files/diff', { path: 'content/notes.txt', text: 'first\nthird\n' });
  assert.deepEqual(same.body.hunks, []);
});

test('files/diff of an unknown path reports exists false', async () => {
  const { post } = setup();
  const r = await post('files/diff', { path: 'content/brand-new.json', text: 'x\n' });
  assert.equal(r.body.exists, false);
  assert.equal(r.body.added, 1);
});

test('tools maps game to up with the game url and every other tool to down', async () => {
  const { get } = setup();
  const tools = await get('tools');
  const game = tools.find((t) => t.id === 'game');
  const editor = tools.find((t) => t.id === 'editor');
  assert.equal(game.status, 'up');
  assert.equal(game.url, ORIGIN + BASE + 'game/');
  assert.equal(editor.status, 'down');
  assert.equal(editor.conflict, LOCAL);
});

test('session reports the static site', async () => {
  const { get } = setup();
  const s = await get('session');
  assert.equal(s.static, true);
  assert.equal(s.token, 'static');
  assert.equal(s.port, 0);
});

test('a stored snapshot GET route answers with its status and body', async () => {
  const { api, url } = setup();
  const res = await api.handle(url('data/status'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('an unknown POST is 501 with the local-only message', async () => {
  const { api, url } = setup();
  const res = await api.handle(url('jobs/start'), { method: 'POST', body: '{}' });
  assert.equal(res.status, 501);
  assert.equal((await res.json()).error, LOCAL);
});

test('an unknown GET is 404 with the local-only message', async () => {
  const { api, url } = setup();
  const res = await api.handle(url('nothing/here'));
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, LOCAL);
});

test('changedFiles lists the saved overlay; discardChanges clears it', async () => {
  const { storage, post } = setup();
  assert.deepEqual(changedFiles(storage, BASE), {});
  await post('files/save', { changes: [{ path: 'content/a.json', text: 'A\n' }, { path: 'content/new.json', text: 'N\n' }] });
  assert.deepEqual(changedFiles(storage, BASE), { 'content/a.json': 'A\n', 'content/new.json': 'N\n' });
  assert.equal(storage.getItem('wb-static-overlay:' + BASE) !== null, true);
  discardChanges(storage, BASE);
  assert.deepEqual(changedFiles(storage, BASE), {});
});

test('the overlay is keyed by base, so two sites do not share edits', async () => {
  const { storage, post } = setup();
  await post('files/save', { changes: [{ path: 'content/a.json', text: 'A\n' }] });
  assert.deepEqual(changedFiles(storage, '/other/'), {});
});

test('onChange reports the changed-file count after each save', async () => {
  const { impl } = fakeFetch();
  const seen = [];
  const api = createStaticApi({ base: BASE, origin: ORIGIN, fetchImpl: impl, storage: new MapStorage(), onChange: (n) => seen.push(n) });
  await api.handle(new URL(BASE + 'api/files/save', ORIGIN), { method: 'POST', body: JSON.stringify({ changes: [{ path: 'content/a.json', text: 'A\n' }] }) });
  await api.handle(new URL(BASE + 'api/files/save', ORIGIN), { method: 'POST', body: JSON.stringify({ changes: [{ path: 'content/notes.txt', text: 'B\n' }] }) });
  assert.deepEqual(seen, [1, 2]);
});

test('importing the module in node does not touch window or document', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  const mod = await import('../static/static-api.mjs');
  assert.equal(typeof mod.createStaticApi, 'function');
  assert.equal(typeof globalThis.window, 'undefined');
});
