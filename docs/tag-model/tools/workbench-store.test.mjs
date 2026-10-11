// Tests for the tag workbench storage code. Loads the marked storage block of
// docs/tag-model/workbench.html into a node vm context with a fake db.
//
//   node --test docs/tag-model/tools/workbench-store.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'workbench.html');
const BEGIN = '/* storage:begin */';
const END = '/* storage:end */';

export function storageSource() {
  const html = readFileSync(PAGE, 'utf8');
  const a = html.indexOf(BEGIN);
  const b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('storage block markers missing in workbench.html');
  return html.slice(a, b + END.length);
}

// Evaluates the storage block in a context built from `ctx`. `expose` is a JS
// expression evaluated after the block that returns the functions a test needs.
export function loadStorage(ctx, expose) {
  const context = vm.createContext(ctx);
  return vm.runInContext(storageSource() + '\n;(' + expose + ')', context);
}

test('storage block loads and chunkRows keeps every row in order', () => {
  const { chunkRows } = loadStorage({}, '({ chunkRows })');
  const rows = Array.from({ length: 500 }, (_, i) => [i, 'row ' + i + ' ' + 'x'.repeat(1000)]);
  const parts = chunkRows(rows);
  assert.ok(parts.length >= 2);
  // vm arrays come from another realm, so compare JSON text, not prototypes.
  assert.equal(JSON.stringify(parts.flat()), JSON.stringify(rows));
});

// Reference FNV-1a 64 over UTF-16 code units, using BigInt.
function refFnv64(s) {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

test('hashText matches FNV-1a 64 and is stable', () => {
  const { hashText } = loadStorage({}, '({ hashText })');
  assert.equal(hashText('a'), 'af63dc4c8601ec8c'); // published FNV-1a 64 vector
  assert.equal(hashText(''), 'cbf29ce484222325');
  for (const s of ['{"rows":[[1,"x"]]}', '{"rows":[["é","漢字"]]}', 'x'.repeat(5000)]) {
    assert.equal(hashText(s), refFnv64(s));
  }
  assert.equal(hashText('same'), hashText('same'));
});

test('chunkRows keeps order, respects the size cap and the 20-row minimum', () => {
  const { chunkRows } = loadStorage({}, '({ chunkRows })');
  const rows = Array.from({ length: 4000 }, (_, i) => [i, 'label ' + i, i % 7]);
  const chunks = chunkRows(rows);
  assert.equal(JSON.stringify(chunks.flat()), JSON.stringify(rows));
  chunks.slice(0, -1).forEach((c) => assert.ok(c.length >= 20, 'chunk under 20 rows'));
  for (const c of chunks) assert.ok(JSON.stringify({ rows: c }).length <= 170000);
  assert.ok(chunks.length > 1);
  // large rows force the size cap instead of the hash cut
  const big = Array.from({ length: 50 }, (_, i) => [i, 'y'.repeat(20000)]);
  const bigChunks = chunkRows(big);
  assert.equal(JSON.stringify(bigChunks.flat()), JSON.stringify(big));
  for (const c of bigChunks) assert.ok(JSON.stringify({ rows: c }).length <= 170000);
});

test('inserting one row at the top changes at most two chunks', () => {
  const { chunkRows, hashText } = loadStorage({}, '({ chunkRows, hashText })');
  const rows = Array.from({ length: 3000 }, (_, i) => ['tag' + i, 'key' + i, 'desc ' + i]);
  const ids = (rs) => chunkRows(rs).map((c) => hashText(JSON.stringify({ rows: c })));
  const before = new Set(ids(rows));
  const after = ids([['new', 'new', 'new'], ...rows]);
  const changed = after.filter((h) => !before.has(h)).length;
  assert.ok(changed <= 2, 'changed blobs: ' + changed);
});

// ---- fake db: documents as JSON text; writes and reads can be slowed by `delay` ----
export function makeFakeDb() {
  const docs = new Map();
  const listeners = [];
  const log = { sets: [], deletes: [], gets: [] };
  const parentOf = (p) => p.slice(0, p.lastIndexOf('/'));
  const idOf = (p) => p.slice(p.lastIndexOf('/') + 1);
  const snapOf = (p) => {
    const has = docs.has(p);
    return { id: idOf(p), path: p, exists: has, data: () => (has ? JSON.parse(docs.get(p)) : undefined), metadata: {} };
  };
  const collOf = (p) => ({ docs: [...docs.keys()].filter((k) => parentOf(k) === p).map(snapOf) });
  const emit = (p) => {
    for (const l of listeners) {
      if (!l.live) continue;
      if (l.kind === 'doc' && l.path === p) setImmediate(() => l.live && l.fn(snapOf(p)));
      if (l.kind === 'coll' && parentOf(p) === l.path) setImmediate(() => l.live && l.fn(collOf(l.path)));
    }
  };
  const subscribe = (l) => {
    listeners.push(l);
    setImmediate(() => l.live && l.fn(l.kind === 'doc' ? snapOf(l.path) : collOf(l.path)));
    return () => { l.live = false; };
  };
  const fake = {
    docs, log,
    delay: async () => {}, // tests replace this: async (op, path) => {}
    has: (p) => docs.has(p),
    read: (p) => (docs.has(p) ? JSON.parse(docs.get(p)) : undefined),
    put: (p, body) => { docs.set(p, JSON.stringify(body)); }, // silent seed, no snapshot
    doc(p) {
      return {
        id: idOf(p), path: p,
        async get() { log.gets.push(p); await fake.delay('get', p); return snapOf(p); },
        async set(data) { log.sets.push(p); await fake.delay('set', p); docs.set(p, JSON.stringify(data)); emit(p); },
        async delete() { log.deletes.push(p); await fake.delay('delete', p); docs.delete(p); emit(p); },
        onSnapshot(next) { return subscribe({ kind: 'doc', path: p, fn: next, live: true }); },
      };
    },
    collection(p) {
      return {
        path: p,
        async get() { log.gets.push(p + '/*'); await fake.delay('list', p); return collOf(p); },
        onSnapshot(next) { return subscribe({ kind: 'coll', path: p, fn: next, live: true }); },
      };
    },
  };
  return fake;
}

const EXPOSE = '({ subscribeTable, applyHead, onHead, flush, loadTheirs, keepMine, tstate, chunkRows, hashText, headPath, blobPath })';

// One browser tab: its own state, sharing only the fake db with other tabs.
export function makePage(db, tables) {
  const page = {
    db, canWrite: true, localMode: false,
    state: { data: {} }, dirty: new Set(), saving: new Set(), timers: {},
    loaded: new Set(), pending: new Set(), TABLES: tables,
    renders: 0, statuses: [],
    setTimeout, clearTimeout, setImmediate,
    render() { page.renders++; },
    setStatus(level, msg) { page.statuses.push({ level, msg }); },
    rebuild() {},
  };
  for (const t of Object.keys(tables)) page.state.data[t] = { columns: [...tables[t].columns], rows: [] };
  const api = loadStorage(page, EXPOSE);
  return { page, api };
}

export const waitFor = async (cond, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 5));
  }
};
export const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const T = { t: { label: 'T', key: 'id', columns: ['id', 'name', 'qty'] } };
const COLS = ['id', 'name', 'qty'];
const sample = (n, tag = 'a') => Array.from({ length: n }, (_, i) => ({ id: tag + i, name: 'name ' + i, qty: i }));

// Writes a blob-format table through the db (what a writer leaves behind).
async function putBlobTable(db, api, t, objs, cols = COLS) {
  const rows = objs.map((o) => cols.map((c) => o[c] ?? ''));
  const blobs = [];
  for (const rs of api.chunkRows(rows)) {
    const h = api.hashText(JSON.stringify({ rows: rs }));
    await db.doc(api.blobPath(t, h)).set({ rows: rs, createdAt: 1 });
    blobs.push(h);
  }
  const head = { format: 'blobs', columns: cols, blobs, rev: 'r' + blobs.join('').slice(0, 12), base: '', savedAt: 1 };
  await db.doc(api.headPath(t)).set(head);
  return head;
}

test('reader assembles a complete blob head into objects', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  const objs = sample(120);
  await putBlobTable(db, api, 't', objs);
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify(objs));
});

test('a missing blob blocks assembly and editing, after two retries', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  const head = await putBlobTable(db, api, 't', sample(120));
  const gone = api.blobPath('t', head.blobs[0]);
  db.docs.delete(gone);
  api.subscribeTable('t');
  await waitFor(() => page.statuses.some((s) => /incomplete on the server/.test(s.msg)));
  assert.equal(page.loaded.has('t'), false);
  assert.equal(page.state.data.t.rows.length, 0);
  assert.equal(db.log.gets.filter((p) => p === gone).length, 3, 'one get plus two retries');
});

test('legacy (a) arrays-with-revs head assembles from its parts', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 2, format: 'arrays', revs: ['x', 'x'] });
  db.put('tables/t/parts/p0', { index: 0, rev: 'x', rows: [['a1', 'n', 1]] });
  db.put('tables/t/parts/p1', { index: 1, rev: 'x', rows: [['a2', 'm', 2]] });
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify([{ id: 'a1', name: 'n', qty: 1 }, { id: 'a2', name: 'm', qty: 2 }]));
});

test('legacy (a) with revs never assembles a part from another save', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 2, format: 'arrays', revs: ['x', 'y'] });
  db.put('tables/t/parts/p0', { index: 0, rev: 'x', rows: [['a1', 'n', 1]] });
  db.put('tables/t/parts/p1', { index: 1, rev: 'z', rows: [['a2', 'm', 2]] });
  api.subscribeTable('t');
  await settle(30);
  assert.equal(page.loaded.has('t'), false, 'part 1 has a rev its head does not list');
  assert.equal(page.state.data.t.rows.length, 0);
  await db.doc('tables/t/parts/p1').set({ index: 1, rev: 'y', rows: [['a2', 'm', 2]] });
  await waitFor(() => page.loaded.has('t'));
  assert.equal(page.state.data.t.rows.length, 2);
});

test('legacy (b) object-parts head waits for every part, then assembles', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 2 });
  db.put('tables/t/parts/q0', { index: 0, rows: [{ id: 'b1', name: 'n', qty: 3 }] });
  api.subscribeTable('t');
  await settle(20);
  assert.equal(page.loaded.has('t'), false, 'waits for part 1');
  await db.doc('tables/t/parts/q1').set({ index: 1, rows: [{ id: 'b2', name: 'm', qty: 4 }] });
  await waitFor(() => page.loaded.has('t'));
  assert.equal(page.state.data.t.rows.length, 2);
});

test('a newer head never replaces unsaved local edits', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  await putBlobTable(db, api, 't', sample(30));
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  const mine = sample(5, 'mine');
  page.state.data.t.rows = mine;
  page.dirty.add('t');
  await putBlobTable(db, api, 't', sample(40, 'theirs'));
  await settle(30);
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify(mine));
  assert.ok(api.tstate.t.latest && api.tstate.t.latest.blobs.length >= 1, 'newer head recorded');
});

test('oldest inline-rows head loads its rows instead of an empty table', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, rows: [{ id: 'i1', name: 'n', qty: 5 }] });
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify([{ id: 'i1', name: 'n', qty: 5 }]));
});

test('a head with no recognised format blocks the table; it never loads as empty', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 0 });
  api.subscribeTable('t');
  await waitFor(() => page.statuses.some((s) => /does not recognise/.test(s.msg)));
  assert.equal(page.loaded.has('t'), false);
  assert.equal(page.state.data.t.rows.length, 0);
});

// Writer helper: a tab holding `objs` as its unsaved table.
function editTable(page, objs) {
  page.state.data.t.rows = objs;
  page.dirty.add('t');
}
// Assembles the stored table as a fresh reader sees it.
async function storedRows(db) {
  const reader = makePage(db, T);
  reader.api.subscribeTable('t');
  await waitFor(() => reader.page.loaded.has('t'));
  return JSON.stringify(reader.page.state.data.t.rows);
}

test('(a) sequential writers: the second one gets a conflict and the store keeps the first table', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  const xs = sample(60, 'x'), ys = sample(60, 'y');
  editTable(A.page, xs);
  await A.api.flush('t');
  editTable(B.page, ys);
  await B.api.flush('t');
  assert.equal(await storedRows(db), JSON.stringify(xs));
  assert.ok(B.page.dirty.has('t'), 'local edits kept');
  assert.equal(B.api.tstate.t.conflict.theirRev, A.api.tstate.t.base);
  assert.equal(JSON.stringify(B.page.state.data.t.rows), JSON.stringify(ys));
});

test('(a) conflict choices: Load theirs drops local edits; Keep mine overwrites on their rev', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  const xs = sample(60, 'x'), ys = sample(60, 'y');
  editTable(A.page, xs);
  await A.api.flush('t');
  editTable(B.page, ys);
  await B.api.flush('t');
  await B.api.loadTheirs('t');
  assert.equal(JSON.stringify(B.page.state.data.t.rows), JSON.stringify(xs));
  assert.equal(B.page.dirty.has('t'), false);
  assert.equal(B.api.tstate.t.conflict, null);

  const zs = sample(60, 'z');
  editTable(A.page, zs);
  await A.api.flush('t'); // A moves the head on
  editTable(B.page, ys);
  await B.api.flush('t');
  assert.ok(B.api.tstate.t.conflict, 'conflict while mine is pending');
  await B.api.keepMine('t');
  assert.equal(await storedRows(db), JSON.stringify(ys));
  assert.equal(B.api.tstate.t.conflict, null);
  assert.equal(B.page.dirty.has('t'), false);
});

test('(a) interleaved writers: the stored table is exactly one writer\'s full table', async () => {
  const db = makeFakeDb();
  db.delay = async (op) => { if (op === 'set') await new Promise((r) => setTimeout(r, 15)); };
  const A = makePage(db, T), B = makePage(db, T);
  const xs = sample(200, 'x'), ys = sample(200, 'y');
  editTable(A.page, xs);
  editTable(B.page, ys);
  await Promise.all([A.api.flush('t'), B.api.flush('t')]);
  await settle(50);
  const stored = await storedRows(db);
  assert.ok(stored === JSON.stringify(xs) || stored === JSON.stringify(ys), 'mixed table stored');
});

test('(b) a reader during a slow save never assembles a mix of old and new rows', async () => {
  const db = makeFakeDb();
  const W = makePage(db, T), R = makePage(db, T);
  const v1 = sample(300, 'v'), v2 = sample(300, 'w');
  editTable(W.page, v1);
  await W.api.flush('t');
  R.api.subscribeTable('t');
  await waitFor(() => R.page.loaded.has('t'));
  const seen = [];
  R.page.render = () => seen.push(JSON.stringify(R.page.state.data.t.rows));
  db.delay = async (op, p) => { if (op === 'set' && p.includes('/blobs/')) await new Promise((r) => setTimeout(r, 25)); };
  editTable(W.page, v2);
  await W.api.flush('t');
  await settle(60);
  const ok = [JSON.stringify(v1), JSON.stringify(v2)];
  assert.ok(seen.length > 0);
  for (const s of seen) assert.ok(ok.includes(s), 'reader showed a mixed table');
  assert.equal(seen[seen.length - 1], ok[1]);
});

test('(c) inserting one row at the top rewrites at most two blobs', async () => {
  const db = makeFakeDb();
  const W = makePage(db, T);
  const objs = sample(3000, 'r');
  editTable(W.page, objs);
  await W.api.flush('t');
  const mark = db.log.sets.length;
  editTable(W.page, [{ id: 'top', name: 'new', qty: 0 }, ...objs]);
  await W.api.flush('t');
  const blobWrites = db.log.sets.slice(mark).filter((p) => p.includes('/blobs/'));
  assert.ok(blobWrites.length <= 2, 'blob writes: ' + blobWrites.length);
  assert.equal(await storedRows(db), JSON.stringify([{ id: 'top', name: 'new', qty: 0 }, ...objs]));
});
