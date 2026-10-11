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

// `edit` is an optional [from, to] pair applied to the block, used by tests that
// disable one mechanism (for example the head lease) to show the race it closes.
export function storageSource(edit) {
  const html = readFileSync(PAGE, 'utf8');
  const a = html.indexOf(BEGIN);
  const b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('storage block markers missing in workbench.html');
  let src = html.slice(a, b + END.length);
  if (edit) {
    if (!src.includes(edit[0])) throw new Error('edit target missing: ' + edit[0]);
    src = src.replace(edit[0], edit[1]);
  }
  return src;
}

// Evaluates the storage block in a context built from `ctx`. `expose` is a JS
// expression evaluated after the block that returns the functions a test needs.
export function loadStorage(ctx, expose, edit) {
  if (!('TextEncoder' in ctx)) ctx.TextEncoder = TextEncoder;
  const context = vm.createContext(ctx);
  return vm.runInContext(storageSource(edit) + '\n;(' + expose + ')', context);
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

test('chunkRows keeps order and respects the size cap', () => {
  const { chunkRows } = loadStorage({}, '({ chunkRows })');
  const rows = Array.from({ length: 4000 }, (_, i) => [i, 'label ' + i, i % 7]);
  const chunks = chunkRows(rows);
  assert.equal(JSON.stringify(chunks.flat()), JSON.stringify(rows));
  for (const c of chunks) assert.ok(JSON.stringify({ rows: c }).length <= 170000);
  assert.ok(chunks.length > 1);
  // large rows force the size cap instead of the hash cut
  const big = Array.from({ length: 50 }, (_, i) => [i, 'y'.repeat(20000)]);
  const bigChunks = chunkRows(big);
  assert.equal(JSON.stringify(bigChunks.flat()), JSON.stringify(big));
  for (const c of bigChunks) assert.ok(JSON.stringify({ rows: c }).length <= 170000);
});

test('inserting one wide row at the top, as wide as its neighbours, changes at most two chunks', () => {
  const { chunkRows, hashText } = loadStorage({}, '({ chunkRows, hashText })');
  for (const [n, width] of [[600, 3000], [120, 20000]]) {
    const rows = Array.from({ length: n }, (_, i) => ['w' + i, 'z'.repeat(width - 8)]);
    const ids = (rs) => chunkRows(rs).map((c) => hashText(JSON.stringify({ rows: c })));
    const before = new Set(ids(rows));
    const after = ids([['new', 'q'.repeat(width - 8)], ...rows]);
    const changed = after.filter((h) => !before.has(h)).length;
    assert.ok(changed <= 2, 'width ' + width + ': changed blobs ' + changed);
  }
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
  const log = { sets: [], deletes: [], gets: [], leases: [] };
  const leases = new Map(); // path -> {holder, exp}; leases expire on their own, no release
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
    afterSet: async () => {}, // runs after a set is applied and its snapshots queued: async (path) => {}
    failSet: null, // (path) => ({code}) to reject a set with that code
    has: (p) => docs.has(p),
    read: (p) => (docs.has(p) ? JSON.parse(docs.get(p)) : undefined),
    put: (p, body) => { docs.set(p, JSON.stringify(body)); }, // silent seed, no snapshot
    doc(p) {
      return {
        id: idOf(p), path: p,
        async get() { log.gets.push(p); await fake.delay('get', p); return snapOf(p); },
        async set(data) {
          log.sets.push(p); await fake.delay('set', p);
          const bad = fake.failSet && fake.failSet(p);
          if (bad) throw Object.assign(new Error('rejected'), bad);
          docs.set(p, JSON.stringify(data)); emit(p);
          await fake.afterSet(p);
        },
        async delete() { log.deletes.push(p); await fake.delay('delete', p); docs.delete(p); emit(p); },
        async acquire(o) {
          await fake.delay('acquire', p);
          log.leases.push({ path: p, holder: o.holder, ttlMs: o.ttlMs });
          const now = Date.now(), L = leases.get(p);
          if (!L || L.exp <= now || L.holder === o.holder) {
            leases.set(p, { holder: o.holder, exp: now + Math.max(1000, o.ttlMs || 30000) });
            return { acquired: true, holder: o.holder };
          }
          return { acquired: false, expiresAt: new Date(L.exp).toISOString() };
        },
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

const EXPOSE = '({ subscribeTable, applyHead, onHead, flush, loadTheirs, keepMine, tableBanners, runBanner, tstate, chunkRows, hashText, headPath, blobPath })';

// One browser tab: its own state, sharing only the fake db with other tabs.
export function makePage(db, tables, edit) {
  const page = {
    db, canWrite: true, localMode: false,
    state: { data: {} }, dirty: new Set(), saving: new Set(), timers: {},
    loaded: new Set(), pending: new Set(), TABLES: tables,
    renders: 0, statuses: [],
    setTimeout, clearTimeout, setImmediate,
    render() { page.renders++; },
    setStatus(level, msg) { page.statuses.push({ level, msg }); },
    rebuild() {},
    saveLocal() {},
    exported: [],
    exportCSV(t) { page.exported.push(t); }, // page function: records the export
    focusStatus() { page.focused = (page.focused || 0) + 1; },
  };
  for (const t of Object.keys(tables)) page.state.data[t] = { columns: [...tables[t].columns], rows: [] };
  const api = loadStorage(page, EXPOSE, edit);
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
async function putBlobTable(db, api, t, objs, cols = COLS, savedAt = 1, base = '') {
  const rows = objs.map((o) => cols.map((c) => o[c] ?? ''));
  const blobs = [];
  for (const rs of api.chunkRows(rows)) {
    const h = api.hashText(JSON.stringify({ rows: rs }));
    await db.doc(api.blobPath(t, h)).set({ rows: rs, createdAt: 1 });
    blobs.push(h);
  }
  const head = { format: 'blobs', columns: cols, blobs, rev: 'r' + blobs.join('').slice(0, 12) + savedAt, base, savedAt };
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

test('a head with an unknown format is blocked even when it has integer parts', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { format: 'sheets', columns: COLS, parts: 1 });
  db.put('tables/t/parts/p0', { index: 0, rev: 'x', rows: [['a1', 'n', 1]] });
  api.subscribeTable('t');
  await waitFor(() => page.statuses.some((s) => /does not recognise/.test(s.msg)));
  assert.equal(page.loaded.has('t'), false);
  assert.equal(page.state.data.t.rows.length, 0);
});

test('backstop: a head not written on top of our recent save shows a conflict instead of replacing our rows', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  const xs = sample(20, 'x');
  editTable(A.page, xs);
  await A.api.flush('t'); // our save is recent
  A.api.subscribeTable('t');
  await waitFor(() => A.page.loaded.has('t'));
  // a peer writes a head that did not start from our save
  await putBlobTable(db, B.api, 't', sample(9, 'peer'), COLS, Date.now() + 1000, 'not-our-rev');
  await waitFor(() => A.api.tstate.t.conflict);
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(xs), 'our rows are kept');
  assert.equal(A.page.dirty.has('t'), true);
});

test('Load theirs right after our own save adopts theirs instead of tripping the backstop again', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  editTable(A.page, sample(20, 'x'));
  await A.api.flush('t'); // our save is recent
  A.api.subscribeTable('t');
  await waitFor(() => A.page.loaded.has('t'));
  await putBlobTable(db, B.api, 't', sample(9, 'peer'), COLS, Date.now() + 1000, 'not-our-rev');
  await waitFor(() => A.api.tstate.t.conflict);
  await A.api.loadTheirs('t');
  assert.equal(A.api.tstate.t.conflict, null, 'no conflict after an explicit choice');
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(sample(9, 'peer')));
});

test('a legacy write by an old tab after our load counts as a conflict', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 1, format: 'arrays', revs: ['x'] });
  db.put('tables/t/parts/p0', { index: 0, rev: 'x', rows: [['a1', 'n', 1]] });
  A.api.subscribeTable('t');
  await waitFor(() => A.page.loaded.has('t'));
  editTable(A.page, sample(3, 'mine')); // this tab has an unsaved edit...
  // ...when an old tab saves the table again
  await db.doc('tables/t/parts/p0').set({ index: 0, rev: 'y', rows: [['a2', 'm', 2]] });
  await db.doc('tables/t').set({ columns: COLS, parts: 1, format: 'arrays', revs: ['y'] });
  await settle(20);
  await A.api.flush('t');
  assert.ok(A.api.tstate.t.conflict, 'the legacy change is a conflict');
  assert.equal(A.page.dirty.has('t'), true);
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

test('a newer head that arrives while we save is applied once the save ends', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  A.api.subscribeTable('t');
  await settle(10);
  const xs = sample(20, 'x'), ys = sample(20, 'y');
  editTable(A.page, xs);
  let injected = false;
  db.afterSet = async (p) => {
    if (p !== 'tables/t' || injected) return;
    injected = true;
    const ours = db.read(p); // a peer that saw our save writes on top of it
    await putBlobTable(db, B.api, 't', ys, COLS, Date.now() + 60000, ours.rev); // a peer's head lands after ours
    await settle(20); // its snapshot arrives while our save is still in progress
  };
  await A.api.flush('t');
  await settle(30);
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(ys));
});

test('a head written on top of our save and stamped with a skewed clock is still applied', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  api.subscribeTable('t');
  await settle(10);
  editTable(page, sample(5, 'mine'));
  db.afterSet = async (p) => {
    if (p !== 'tables/t' || db.log.sets.filter((x) => x === p).length !== 1) return;
    const ours = db.read(p);
    await putBlobTable(db, makePage(db, T).api, 't', sample(4, 'peer'), COLS, 1, ours.rev); // savedAt far in the past
    await settle(20);
  };
  await api.flush('t');
  await settle(30);
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify(sample(4, 'peer')));
});

test('a peer head that did not start from our save shows the conflict banner, and our rows stay', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  api.subscribeTable('t');
  await settle(10);
  const mine = sample(5, 'mine');
  editTable(page, mine);
  let injected = false;
  db.afterSet = async (p) => {
    if (p !== 'tables/t' || injected) return;
    injected = true;
    await putBlobTable(db, makePage(db, T).api, 't', sample(4, 'peer'), COLS, Date.now() + 1000, '');
    await settle(20);
  };
  await api.flush('t');
  await settle(30);
  assert.ok(api.tstate.t.conflict, 'conflict shown');
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify(mine));
});

test('the pinned state shows its own banner whose buttons export and load theirs', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T);
  A.api.subscribeTable('t');
  await settle(10);
  const mine = sample(5, 'x');
  editTable(A.page, mine);
  db.failSet = (p) => (p === 'tables/t' ? { code: 'invalid_argument' } : null);
  await A.api.flush('t');
  const banner = A.api.tableBanners('t').find((b) => /could not be saved/.test(b.text));
  assert.ok(banner, 'the pinned banner is shown');
  assert.equal(JSON.stringify(banner.buttons.map((b) => b.label)), JSON.stringify(['Export my edits (CSV)', 'Load theirs (discard mine)']));
  await A.api.runBanner('t', banner.buttons[0].id);
  assert.equal(JSON.stringify(A.page.exported), JSON.stringify(['t']), 'Export button exports the table');
  db.failSet = null;
  const theirs = sample(7, 'p');
  await putBlobTable(db, A.api, 't', theirs);
  await settle(40);
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(mine), 'the rejected edits stay on screen');
  await A.api.runBanner('t', banner.buttons[1].id);
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(theirs), 'Load theirs button adopts theirs');
  assert.ok(A.page.focused >= 1, 'focus moves to the status line after a choice');
});

test('invalid_argument on save pins the rejected edits: a peer head never replaces them until Load theirs', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T);
  A.api.subscribeTable('t');
  await settle(10);
  const mine = sample(5, 'x');
  editTable(A.page, mine);
  db.failSet = (p) => (p === 'tables/t' ? { code: 'invalid_argument' } : null);
  await A.api.flush('t');
  assert.equal(A.page.canWrite, false);
  assert.equal(A.api.tstate.t.pinned, true);
  assert.equal(A.page.dirty.has('t'), true, 'the rejected edits stay pending');
  db.failSet = null;
  const theirs = sample(7, 'p');
  await putBlobTable(db, A.api, 't', theirs);
  await settle(40);
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(mine), 'the rejected edits stay on screen');
  await A.api.loadTheirs('t');
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(theirs), 'Load theirs adopts theirs');
});

test('the first save after a load reuses the blobs the reader already holds', async () => {
  const db = makeFakeDb();
  const W = makePage(db, T);
  const objs = sample(3000, 'r');
  await putBlobTable(db, W.api, 't', objs);
  W.api.subscribeTable('t');
  await waitFor(() => W.page.loaded.has('t'));
  const mark = db.log.sets.length;
  editTable(W.page, [...objs.slice(0, 2999), { id: 'end', name: 'e', qty: 9 }]);
  await W.api.flush('t');
  const blobWrites = db.log.sets.slice(mark).filter((p) => p.includes('/blobs/'));
  assert.ok(blobWrites.length <= 2, 'blob writes after load: ' + blobWrites.length);
});

test('chunk size counts UTF-8 bytes, not characters', () => {
  const { chunkRows } = loadStorage({}, '({ chunkRows })');
  const rows = Array.from({ length: 12 }, (_, i) => ['é'.repeat(30000), i]); // ~60 KB each in UTF-8
  const chunks = chunkRows(rows);
  assert.equal(JSON.stringify(chunks.flat()), JSON.stringify(rows));
  const enc = new TextEncoder();
  for (const c of chunks) {
    if (c.length > 1) assert.ok(enc.encode(JSON.stringify({ rows: c })).length <= 170000 + 20, 'multi-row chunk over the cap');
  }
});

test('a single row between the cap and 250 KB saves as its own blob', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  const big = { id: 'big', name: 'x'.repeat(200000), qty: 1 };
  editTable(page, [big]);
  await api.flush('t');
  assert.equal(page.dirty.has('t'), false);
  assert.equal(await storedRows(db), JSON.stringify([big]));
});

test('a row over 250 KB refuses the save, names the row, and writes nothing', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  editTable(page, [{ id: 'huge', name: 'x'.repeat(260000), qty: 1 }]);
  await api.flush('t');
  assert.equal(db.log.sets.length, 0, 'nothing written');
  assert.equal(page.dirty.has('t'), true, 'edit kept');
  assert.ok(page.statuses.some((s) => s.level === 'bad' && /huge.*over 250 KB/.test(s.msg)));
});

test('a blob whose content does not hash to its id blocks the table', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  const head = await putBlobTable(db, api, 't', sample(40));
  const id = head.blobs[0];
  const doc = db.read(api.blobPath('t', id));
  doc.rows[0][0] = 'tampered';
  db.put(api.blobPath('t', id), doc);
  api.subscribeTable('t');
  await waitFor(() => page.statuses.some((s) => /incomplete on the server/.test(s.msg)));
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

test('Load theirs waits for an in-flight save, then adopts theirs', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  editTable(A.page, sample(3, 'x'));
  await A.api.flush('t');
  editTable(B.page, sample(3, 'y'));
  await B.api.flush('t'); // B is now in conflict
  const theirs = JSON.stringify(sample(3, 'x'));
  B.page.saving.add('t'); // a save of B's is in flight
  const done = B.api.loadTheirs('t');
  await settle(60);
  assert.equal(JSON.stringify(B.page.state.data.t.rows), JSON.stringify(sample(3, 'y')), 'waits while the save runs');
  B.page.saving.delete('t');
  await done;
  assert.equal(JSON.stringify(B.page.state.data.t.rows), theirs);
});

test('a conflict re-renders the panel, and Keep mine re-renders after it saves on their rev', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  editTable(A.page, sample(3, 'x'));
  await A.api.flush('t');
  const theirRev = db.read('tables/t').rev;
  editTable(B.page, sample(3, 'y'));
  const before = B.page.renders;
  await B.api.flush('t');
  assert.ok(B.page.renders > before, 'the conflict re-renders the banner');
  const beforeKeep = B.page.renders;
  await B.api.keepMine('t');
  assert.ok(B.page.renders > beforeKeep, 'Keep mine re-renders after the save');
  assert.equal(db.read('tables/t').base, theirRev, 'the overwrite is based on their rev');
});

test('head leases use a fresh holder per attempt and a 1.5 s ttl, so no tab can renew past a waiting writer', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  editTable(A.page, sample(3, 'x'));
  await A.api.flush('t');
  editTable(A.page, sample(3, 'x2'));
  await A.api.flush('t'); // a second save by the same tab
  const holders = db.log.leases.map((l) => l.holder);
  assert.equal(new Set(holders).size, holders.length, 'every attempt has its own holder');
  for (const l of db.log.leases) assert.ok(l.ttlMs >= 1000 && l.ttlMs <= 1500, 'ttl ' + l.ttlMs);
  // B waits at most about one ttl behind A's lease, then gets its turn and conflicts
  editTable(B.page, sample(3, 'y'));
  const started = Date.now();
  await B.api.flush('t');
  assert.ok(Date.now() - started < 4000, 'B waited ' + (Date.now() - started) + ' ms');
  assert.ok(B.api.tstate.t.conflict, 'B gets its turn and sees the conflict');
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

// Holds each head get until two writers have both asked (or 200 ms pass), so both
// reach the rev check before either writes. This is the interleaving the lease must stop.
function barrierOnHeadGets(db) {
  const pend = [];
  db.delay = (op, p) => {
    if (op !== 'get' || p !== 'tables/t') return undefined;
    return new Promise((res) => {
      pend.push(res);
      if (pend.length === 2) pend.splice(0).forEach((f) => f());
      else setTimeout(res, 200);
    });
  };
}
const NO_LEASE = ['if(!(await acquireHead(t)))', 'if(false)'];

test('(a) interleaved writers under the head lease: exactly one wins, the other sees a conflict', async () => {
  const db = makeFakeDb();
  barrierOnHeadGets(db);
  const A = makePage(db, T), B = makePage(db, T);
  const xs = sample(200, 'x'), ys = sample(200, 'y');
  editTable(A.page, xs);
  editTable(B.page, ys);
  await Promise.all([A.api.flush('t'), B.api.flush('t')]);
  db.delay = async () => {};
  await settle(30);
  const stored = await storedRows(db);
  const aWon = stored === JSON.stringify(xs), bWon = stored === JSON.stringify(ys);
  assert.ok(aWon !== bWon, 'exactly one writer won');
  const loser = aWon ? B : A;
  assert.ok(loser.api.tstate.t.conflict, 'the loser sees the conflict');
  assert.equal(loser.page.dirty.has('t'), true, 'the loser keeps its edits');
});

test('without the head lease, the same interleaving lets both writers pass the rev check', async () => {
  const db = makeFakeDb();
  barrierOnHeadGets(db);
  const A = makePage(db, T, NO_LEASE), B = makePage(db, T, NO_LEASE);
  editTable(A.page, sample(200, 'x'));
  editTable(B.page, sample(200, 'y'));
  await Promise.all([A.api.flush('t'), B.api.flush('t')]);
  assert.equal(A.api.tstate.t.conflict, null, 'A saw no conflict');
  assert.equal(B.api.tstate.t.conflict, null, 'B saw no conflict: both believe they won');
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
