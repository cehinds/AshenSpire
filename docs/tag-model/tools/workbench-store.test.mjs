// Tests for the tag workbench storage code. Loads the marked storage block of
// docs/tag-model/workbench.html into a node vm context with a fake db.
//
//   node --test docs/tag-model/tools/workbench-store.test.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readTable, parseCsv } from './csv.mjs';

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

// The banner block (renderBanners, btn, focusStatus) between its own markers.
export function bannerSource() {
  const html = readFileSync(PAGE, 'utf8');
  const a = html.indexOf('/* banners:begin */');
  const b = html.indexOf('/* banners:end */');
  if (a < 0 || b < 0 || b < a) throw new Error('banner block markers missing in workbench.html');
  return html.slice(a, b + '/* banners:end */'.length);
}

// Evaluates the storage and banner blocks in a context built from `ctx`. `expose` is a JS
// expression evaluated after the blocks that returns the functions a test needs.
export function loadStorage(ctx, expose, edit) {
  if (!('TextEncoder' in ctx)) ctx.TextEncoder = TextEncoder;
  const context = vm.createContext(ctx);
  return vm.runInContext(storageSource(edit) + '\n' + bannerSource() + '\n;(' + expose + ')', context);
}

// The few DOM calls the banner block makes: elements with attributes, children, text, click and focus.
export function makeDom() {
  class El {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.id = ''; this.className = ''; this.textContent = '';
      this.attributes = {}; this.children = []; this.onclick = null; this.tabIndex = undefined;
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k]; }
    appendChild(c) { this.children.push(c); return c; }
    append(...cs) { cs.forEach((c) => this.children.push(c)); }
    click() { if (this.onclick) this.onclick(); }
    focus() { doc.activeElement = this; }
  }
  const status = new El('div'); status.id = 'status';
  const doc = {
    activeElement: null,
    createElement: (tag) => new El(tag),
    getElementById: (id) => (id === 'status' ? status : null),
  };
  return doc;
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

const EXPOSE = '({ subscribeTable, applyHead, onHead, flush, markDirty, loadTheirs, keepMine, tableBanners, runBanner, renderBanners, tstate, chunkRows, hashText, headPath, blobPath })';

// One browser tab: its own state, sharing only the fake db with other tabs.
export function makePage(db, tables, edit) {
  const page = {
    db, canWrite: true, localMode: false,
    state: { data: {} }, dirty: new Set(), saving: new Set(), timers: {}, editGen: {},
    loaded: new Set(), pending: new Set(), TABLES: tables,
    renders: 0, statuses: [],
    setTimeout, clearTimeout, setImmediate,
    render() { page.renders++; },
    setStatus(level, msg) { page.statuses.push({ level, msg }); },
    rebuild() {},
    saveLocal() {},
    exported: [],
    exportCSV(t) { page.exported.push(t); }, // page function: records the export
    document: makeDom(),
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
    await db.doc(api.blobPath(t, h)).set({ rows: rs, createdAt: Date.now() }); // fresh, as a real writer leaves it
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

test('a rejected Keep mine pins the table: the conflict clears, and Keep mine does not resend the rejected save', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  editTable(A.page, sample(3, 'x'));
  await A.api.flush('t');
  editTable(B.page, sample(3, 'y'));
  await B.api.flush('t'); // B is in conflict
  assert.ok(B.api.tstate.t.conflict);
  db.failSet = (p) => (p === 'tables/t' ? { code: 'invalid_argument' } : null);
  await B.api.keepMine('t'); // rejected
  assert.equal(B.api.tstate.t.pinned, true);
  assert.equal(B.api.tstate.t.conflict, null, 'a pinned table shows only the pinned banner');
  const headSets = db.log.sets.filter((p) => p === 'tables/t').length;
  db.failSet = null;
  await B.api.keepMine('t');
  assert.equal(db.log.sets.filter((p) => p === 'tables/t').length, headSets, 'the rejected save is not resent');
});

test('Load theirs adopts the server table even when the head has not moved since we loaded it', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  const R = sample(6, 'r');
  await putBlobTable(db, api, 't', R);
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  editTable(page, sample(4, 'mine'));
  db.failSet = (p) => (p === 'tables/t' ? { code: 'invalid_argument' } : null);
  await api.flush('t');
  assert.equal(api.tstate.t.pinned, true);
  db.failSet = null;
  await api.loadTheirs('t');
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify(R), 'the head we already had is adopted again');
  assert.equal(page.dirty.has('t'), false);
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
  assert.equal(A.page.document.activeElement && A.page.document.activeElement.id, 'status', 'focus moves to the status line after a choice');
});

test('the pinned banner through its rendered buttons: Export, then Load theirs; role goes alert then group; focus lands on the status line', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T);
  A.api.subscribeTable('t');
  await settle(10);
  const mine = sample(5, 'x');
  editTable(A.page, mine);
  db.failSet = (p) => (p === 'tables/t' ? { code: 'invalid_argument' } : null);
  await A.api.flush('t');
  const doc = A.page.document;
  const buttonsOf = (box) => box.children.filter((c) => c.tagName === 'BUTTON');
  // first render: the banner is announced
  const first = doc.createElement('div');
  A.api.renderBanners(first, 't');
  assert.equal(first.children[0].getAttribute('role'), 'alert');
  // a re-render while the banner is still up: no second announcement
  const second = doc.createElement('div');
  A.api.renderBanners(second, 't');
  assert.equal(second.children[0].getAttribute('role'), 'group');
  const [exportBtn, theirsBtn] = buttonsOf(second.children[0]);
  assert.equal(JSON.stringify([exportBtn.textContent, theirsBtn.textContent]), JSON.stringify(['Export my edits (CSV)', 'Load theirs (discard mine)']));
  // Export button: exports, and the banner stays
  exportBtn.click();
  await settle(5);
  assert.equal(JSON.stringify(A.page.exported), JSON.stringify(['t']));
  // Load theirs button: adopts the server table, and focus lands on the status line
  db.failSet = null;
  const theirs = sample(7, 'p');
  await putBlobTable(db, A.api, 't', theirs);
  await settle(40);
  theirsBtn.click();
  await settle(40);
  assert.equal(JSON.stringify(A.page.state.data.t.rows), JSON.stringify(theirs));
  assert.equal(doc.activeElement && doc.activeElement.id, 'status', 'focus lands on #status');
  // once the banner is gone, a render draws no banner
  const after = doc.createElement('div');
  A.api.renderBanners(after, 't');
  assert.equal(after.children.length, 0);
});

test('a blob GC deletes after this save wrote it, before the head lands, is written again', async () => {
  const db = makeFakeDb();
  let once = false;
  db.afterSet = async (p) => { // one-shot: the first blob this save writes is removed straight away
    if (!once && p.includes('/blobs/')) { once = true; await db.doc(p).delete(); }
  };
  const W = makePage(db, T);
  const rows = sample(3, 'h');
  editTable(W.page, rows);
  await W.api.flush('t');
  const head = db.read('tables/t');
  assert.ok(head && head.blobs.length > 0);
  assert.ok(head.blobs.every((h) => db.has(W.api.blobPath('t', h))), 'every blob the head names exists');
  assert.equal(await storedRows(db), JSON.stringify(rows));
});

test('the re-check writes back only blobs this save built, never a stale hash carried in from an earlier attempt', async () => {
  const db = makeFakeDb();
  const W = makePage(db, T);
  editTable(W.page, sample(3, 's'));
  await W.api.flush('t', { written: new Set(['stalehash']) });
  assert.equal(db.has(W.api.blobPath('t', 'stalehash')), false, 'no blob is written for a hash this save did not build');
  assert.equal(await storedRows(db), JSON.stringify(sample(3, 's')));
});

// The first head get after a lease is granted takes 1.3 s, once: that lease is past its fence, so the save retries.
function slowGetAfterLease(db) {
  let justAcquired = false, slowed = false;
  db.delay = async (op, p) => {
    if (op === 'acquire') justAcquired = true;
    if (op === 'get' && p === 'tables/t' && justAcquired) {
      justAcquired = false;
      if (!slowed) { slowed = true; await settle(1300); }
    }
  };
}

test('an edit that lands while a save is in flight: the save retries with the edit rows and a fresh budget', async () => {
  const db = makeFakeDb();
  const W = makePage(db, T);
  W.page.loaded.add('t');
  W.page.dirty.add('t');
  W.page.state.data.t.rows = sample(3, 'a');
  slowGetAfterLease(db);
  const S1 =W.api.flush('t', { deadline: Date.now() + 1000 }); // a save with a 1 s budget, slow at its lease get
  await settle(300);
  const rows2 = sample(3, 'b');
  W.page.state.data.t.rows = rows2;
  W.api.markDirty('t'); // an edit lands while S1 is in flight; its own timer fires during S1
  await S1;
  await settle(2500);
  assert.equal(await storedRows(db), JSON.stringify(rows2));
  assert.equal(W.api.tstate.t.conflict, null, 'no false "could not save in time"');
});

test('a Keep mine retried after an edit still overwrites: the retry keeps its write intent', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  B.page.loaded.add('t'); // B has the table loaded, so its edits arm the save timer
  editTable(A.page, sample(3, 'a'));
  await A.api.flush('t');
  editTable(B.page, sample(3, 'y'));
  await B.api.flush('t'); // B is in conflict with A's head
  assert.ok(B.api.tstate.t.conflict);
  await settle(1600); // the conflict save's lease lapses (1.5 s), so the Keep mine acquires at once
  slowGetAfterLease(db);
  const K =B.api.keepMine('t'); // an overwrite, slow at its lease get, so it retries
  await settle(500);
  const rows2 = sample(3, 'z');
  B.page.state.data.t.rows = rows2;
  B.api.markDirty('t'); // an edit lands while the overwrite is in flight; its timer is still pending when the retry fires
  await K;
  await settle(2500);
  assert.equal(await storedRows(db), JSON.stringify(rows2));
  assert.equal(B.api.tstate.t.conflict, null);
});

// The formula-row issue rule (formulaRowIssue) between its markers in workbench.html.
function formulaIssueSource() {
  const html = readFileSync(PAGE, 'utf8');
  const a = html.indexOf('/* formula-issues:begin */');
  const b = html.indexOf('/* formula-issues:end */');
  if (a < 0 || b < 0 || b < a) throw new Error('formula-issues markers missing in workbench.html');
  return html.slice(a, b + '/* formula-issues:end */'.length);
}

test('a proposed formula with no expression is a note, not a problem', () => {
  const { formulaRowIssue } = vm.runInNewContext(formulaIssueSource() + '\n;({ formulaRowIssue })', {});
  const evalExpr = (e) => (String(e || '').trim() ? { v: 1 } : { err: 'empty expression', soft: false });
  const note = formulaRowIssue({ key: 'x', expr: '', status: 'proposed' }, evalExpr);
  assert.equal(note.note, true);
  assert.equal(note.msg, 'proposed, no formula yet');
  assert.equal(formulaRowIssue({ key: 'y', expr: '   ', status: 'proposed' }, evalExpr).note, true, 'blank counts as empty');
  const problem = formulaRowIssue({ key: 'z', expr: '', status: '' }, evalExpr);
  assert.equal(problem.msg, 'empty expression', 'an empty expression that is not proposed is still a problem');
  assert.ok(!problem.note);
  assert.equal(formulaRowIssue({ key: 'w', expr: '1+1', status: 'proposed' }, evalExpr), null, 'a formula with an expression is not an issue');
});

// Loads one marked block of workbench.html in its own context and returns what `expose` names.
function loadBlock(name, expose) {
  const html = readFileSync(PAGE, 'utf8');
  const end = '/* ' + name + ':end */';
  const a = html.indexOf('/* ' + name + ':begin */');
  const b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a) throw new Error(name + ' markers missing in workbench.html');
  return vm.runInNewContext(html.slice(a, b + end.length) + '\n;(' + expose + ')', {});
}
const evalStub = (e) => (String(e || '').trim() ? { v: 1 } : { err: 'empty expression', soft: false });
const TT_FORMULAS = (cols) => ({ t: { label: 'Formulas', key: 'key', columns: [...cols], refs: {} } });

// The workbench formula engine (findTag to the validation section), over the real tables.
function workbenchPreviewEval() {
  const html = readFileSync(PAGE, 'utf8');
  const start = html.indexOf('function findTag(k)');
  const end = html.indexOf('/* ---------- validation ---------- */');
  if (!(start > 0 && end > start)) throw new Error('workbench.html formula engine markers moved');
  const rowsOf = name => {
    const [header, ...body] = parseCsv(readFileSync(path.join(HERE, '..', 'tables', name), 'utf8'));
    return body.filter(r => !(r.length === 1 && r[0] === '')).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  };
  const tags = rowsOf('tags.csv');
  const IX = {
    tagByKey: new Map(tags.filter(r => r.key).map(r => [r.key, r])),
    tagById: new Map(tags.filter(r => r.id).map(r => [r.id, r])),
    val: new Map(rowsOf('values.csv').filter(r => r.key).map(r => [r.key, r])),
    frm: new Map(rowsOf('formulas.csv').filter(r => r.key).map(r => [r.key, r])),
    obj: new Map(), ast: new Map(), cmp: new Map(),
  };
  const state = { data: { ranks: { rows: [] } } };
  return new Function('IX', 'state', html.slice(start, end) + '\nreturn { evalExpr };')(IX, state).evalExpr;
}

test('the real formulas.csv imports, saves, loads and exports with its status column; a proposed placeholder is a note, and evasion.rating computes at rank 1', async () => {
  const { FORMULA_COLUMNS } = loadBlock('formula-columns', '({ FORMULA_COLUMNS })');
  const { parseCSV, importRows, toCSV } = loadBlock('csv', '({ parseCSV, importRows, toCSV })');
  const { formulaRowIssue } = loadBlock('formula-issues', '({ formulaRowIssue })');
  const csv = readFileSync(path.join(HERE, '..', 'tables', 'formulas.csv'), 'utf8');
  const tbl = { columns: [...FORMULA_COLUMNS], rows: [] };
  const parsed = parseCSV(csv);
  // A synthetic proposed placeholder, so the note rule is tested without a placeholder in the real table.
  parsed.rows.push(Object.fromEntries(FORMULA_COLUMNS.map(c => [c, ''])));
  Object.assign(parsed.rows[parsed.rows.length - 1], { key: 'proposed.placeholder', status: 'proposed' });
  importRows(tbl, 'key', parsed, 'replace');
  const db = makeFakeDb();
  const W = makePage(db, TT_FORMULAS(FORMULA_COLUMNS));
  W.page.loaded.add('t');
  W.page.state.data.t = tbl;
  W.page.dirty.add('t');
  await W.api.flush('t');
  const R = makePage(db, TT_FORMULAS(FORMULA_COLUMNS));
  R.api.subscribeTable('t');
  await waitFor(() => R.page.loaded.has('t'));
  const loaded = R.page.state.data.t;
  const placeholder = loaded.rows.find((r) => r.key === 'proposed.placeholder');
  assert.ok(placeholder, 'the fixture row loads');
  assert.equal(placeholder.status, 'proposed');
  assert.equal(formulaRowIssue(placeholder, evalStub).note, true, 'the fixture row is shown as a note, not a problem');
  const row = loaded.rows.find((r) => r.key === 'evasion.rating');
  assert.ok(row, 'evasion.rating loads');
  assert.equal(row.status, 'proposed');
  // At rank 1 with the preview values: armour base 0 + DEX term min(10 - 1, 0) + shield 0 + card 0 = 0.
  const evalPreview = workbenchPreviewEval();
  const computed = evalPreview(row.expr, 1, null, '');
  assert.ok('v' in computed, 'evasion.rating computes a number at rank 1');
  assert.equal(typeof computed.v, 'number');
  assert.equal(computed.v, 0, 'evasion.rating at rank 1 with preview values');
  assert.equal(formulaRowIssue(row, evalPreview), null, 'a formula with an expression is no issue');
  assert.match(toCSV(loaded.columns, loaded.rows).split('\n')[0], /,status$/, 'export keeps the status column');
});

test('a formulas head that names its columns keeps status: the table default columns include it', async () => {
  const { FORMULA_COLUMNS } = loadBlock('formula-columns', '({ FORMULA_COLUMNS })');
  const { formulaRowIssue } = loadBlock('formula-issues', '({ formulaRowIssue })');
  const db = makeFakeDb();
  // positional rows need their own column list; a columnless head is blocked (see the test below)
  db.put('tables/t', { columns: FORMULA_COLUMNS, rows: [['evasion.rating', '', 'character', 'TBD', 'proposed']] });
  const R = makePage(db, TT_FORMULAS(FORMULA_COLUMNS));
  R.api.subscribeTable('t');
  await waitFor(() => R.page.loaded.has('t'));
  const row = R.page.state.data.t.rows[0];
  assert.equal(row.status, 'proposed', 'status survives the load');
  assert.equal(formulaRowIssue(row, evalStub).note, true);
});

test('a blank proposed formula is styled as a muted note, not as an error', () => {
  const { formulaCellClass } = vm.runInNewContext(formulaIssueSource() + '\n;({ formulaCellClass })', {});
  assert.equal(formulaCellClass({ err: 'proposed, no formula yet', soft: true, note: true }), 'note');
  assert.equal(formulaCellClass({ err: 'unexpected end', soft: false }), 'bad', 'a real parse error stays red');
  assert.equal(formulaCellClass({ err: 'unknown ref', soft: true }), 'warn', 'a soft error warns');
});

test('a second banner that appears while another is up is announced as an alert', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T);
  A.api.subscribeTable('t');
  await settle(10);
  editTable(A.page, sample(5, 'x'));
  db.failSet = (p) => (p === 'tables/t' ? { code: 'invalid_argument' } : null);
  await A.api.flush('t'); // the pinned banner is up
  const doc = A.page.document;
  const first = doc.createElement('div');
  A.api.renderBanners(first, 't');
  assert.equal(first.children[0].getAttribute('role'), 'alert', 'the pinned banner is announced');
  A.api.tstate.t.incomplete = { message: 'Another banner appears.' };
  const second = doc.createElement('div');
  A.api.renderBanners(second, 't');
  const pinnedBox = second.children[0];
  const newBox = second.children.find((c) => c.children[0].textContent.startsWith('Another banner appears.'));
  assert.ok(newBox, 'the new banner is drawn');
  assert.equal(newBox.getAttribute('role'), 'alert', 'the new banner is announced');
  assert.equal(pinnedBox.getAttribute('role'), 'group', 'the pinned banner is not announced again');
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

test('(d) a legacy (a) table loads, and its first save writes the new format and deletes only the parts it read', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 2, format: 'arrays', revs: ['x', 'x'] });
  db.put('tables/t/parts/p0', { index: 0, rev: 'x', rows: [['a1', 'n', 1]] });
  db.put('tables/t/parts/p1', { index: 1, rev: 'x', rows: [['a2', 'm', 2]] });
  db.put('tables/t/parts/extra', { index: 9, rev: 'z', rows: [['zz', 'z', 0]] }); // not part of the head: not ours to delete
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  const rows = [{ id: 'a1', name: 'n', qty: 1 }, { id: 'a2', name: 'm', qty: 2 }, { id: 'a3', name: 'new', qty: 3 }];
  editTable(page, rows);
  await api.flush('t');
  assert.equal(db.read('tables/t').format, 'blobs', 'the first save writes the new format');
  assert.equal(db.has('tables/t/parts/p0'), false);
  assert.equal(db.has('tables/t/parts/p1'), false);
  assert.equal(db.has('tables/t/parts/extra'), true, 'an unread part is left alone');
  assert.equal(api.tstate.t.conflict, null, 'an unchanged legacy head is not a conflict');
  assert.equal(await storedRows(db), JSON.stringify(rows));
});

test('(d) a legacy (b) object-parts table converts on its first save too', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { columns: COLS, parts: 1 });
  db.put('tables/t/parts/q0', { index: 0, rows: [{ id: 'b1', name: 'n', qty: 3 }] });
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  editTable(page, [{ id: 'b1', name: 'n', qty: 3 }, { id: 'b2', name: 'm', qty: 4 }]);
  await api.flush('t');
  assert.equal(db.read('tables/t').format, 'blobs');
  assert.equal(db.has('tables/t/parts/q0'), false);
  assert.equal(await storedRows(db), JSON.stringify([{ id: 'b1', name: 'n', qty: 3 }, { id: 'b2', name: 'm', qty: 4 }]));
});

test('(f) GC never deletes a blob referenced by the current or the previous head', async () => {
  const db = makeFakeDb();
  const W = makePage(db, T);
  const ageBlobs = () => {
    for (const p of [...db.docs.keys()].filter((k) => k.includes('/blobs/'))) db.put(p, { ...db.read(p), createdAt: 1 });
  };
  editTable(W.page, sample(300, 'v1'));
  await W.api.flush('t');
  const h1 = db.read('tables/t').blobs.slice();
  ageBlobs();
  // orphans: old (GC may delete), recent (kept), no createdAt (kept)
  db.put(W.api.blobPath('t', 'orphanold'), { rows: [], createdAt: 1 });
  db.put(W.api.blobPath('t', 'orphanrecent'), { rows: [], createdAt: Date.now() });
  db.put(W.api.blobPath('t', 'orphannostamp'), { rows: [] });
  editTable(W.page, sample(300, 'v2'));
  await W.api.flush('t');
  const h2 = db.read('tables/t').blobs.slice();
  assert.ok(h1.every((x) => db.has(W.api.blobPath('t', x))), 'the previous head keeps its blobs');
  assert.equal(db.has(W.api.blobPath('t', 'orphanold')), false, 'an old unreferenced blob is deleted');
  assert.equal(db.has(W.api.blobPath('t', 'orphanrecent')), true, 'a recent blob is kept');
  assert.equal(db.has(W.api.blobPath('t', 'orphannostamp')), true, 'a blob without createdAt is kept');
  ageBlobs();
  editTable(W.page, sample(300, 'v3'));
  await W.api.flush('t');
  const h3 = db.read('tables/t').blobs.slice();
  assert.ok(h2.every((x) => db.has(W.api.blobPath('t', x))), 'the previous head keeps its blobs');
  assert.ok(h3.every((x) => db.has(W.api.blobPath('t', x))), 'the current head keeps its blobs');
  const gone = h1.filter((x) => !h2.includes(x) && !h3.includes(x));
  assert.ok(gone.length > 0);
  assert.ok(gone.every((x) => !db.has(W.api.blobPath('t', x))), 'blobs of two heads back are collected');
});

test('Keep mine rewrites the blobs its base shared with the server head when GC removed them', async () => {
  const db = makeFakeDb();
  const A = makePage(db, T), B = makePage(db, T);
  const xs = sample(300, 'x');
  editTable(A.page, xs);
  await A.api.flush('t'); // H1
  const h1 = db.read('tables/t').blobs.slice();
  B.api.subscribeTable('t');
  await waitFor(() => B.page.loaded.has('t')); // B's base is H1
  const changed = xs.slice(0, 299).concat([{ id: 'last', name: 'changed', qty: 0 }]);
  editTable(B.page, changed); // B has unsaved edits, so the heads A writes next are deferred, not adopted
  const ageBlobs = () => { for (const p of [...db.docs.keys()].filter((k) => k.includes('/blobs/'))) db.put(p, { ...db.read(p), createdAt: 1 }); };
  ageBlobs();
  // each save must finish (not just start) before the next, so H2 and H3 really land in order
  const saved = () => waitFor(() => !A.page.dirty.has('t') && !A.page.saving.has('t'), 8000);
  editTable(A.page, sample(300, 'y'));
  await A.api.flush('t');
  await saved(); // H2: keeps H1 as the previous head
  editTable(A.page, sample(300, 'z'));
  await A.api.flush('t');
  await saved(); // H3: GC drops the H1-only blobs
  assert.ok(h1.some((h) => !db.has(B.api.blobPath('t', h))), 'GC removed a blob that B\'s base still lists');
  await B.api.flush('t'); // conflict with H3
  assert.ok(B.api.tstate.t.conflict, 'B is in conflict');
  await B.api.keepMine('t');
  const head = db.read('tables/t');
  assert.ok(head.blobs.every((h) => db.has(B.api.blobPath('t', h))), 'every blob the new head names exists');
  assert.equal(await storedRows(db), JSON.stringify(changed));
});

// A db view whose blob listing can be stale or can change the db between the listing and the deletes.
function gcView(db, onList) {
  return {
    doc: (p) => db.doc(p),
    collection: (p) => ({
      path: p,
      onSnapshot: (...a) => db.collection(p).onSnapshot(...a),
      get: async () => { const q = await db.collection(p).get(); return onList ? onList(p, q, db) : q; },
    }),
  };
}

test('each blob is stamped with the time it was written, not the time the save began', async () => {
  const db = makeFakeDb();
  db.delay = async (op, p) => { if (op === 'set' && p.includes('/blobs/')) await settle(20); };
  const W = makePage(db, T);
  const start = Date.now();
  editTable(W.page, sample(3000, 'r')); // about 47 blobs, written one after another
  await W.api.flush('t');
  const stamps = [...db.docs.keys()].filter((k) => k.includes('/blobs/')).map((k) => JSON.parse(db.docs.get(k)).createdAt);
  assert.ok(stamps.length > 10);
  assert.ok(Math.max(...stamps) >= start + 20 * (stamps.length - 1) * 0.8, 'the last blob is stamped when it was written');
});

test('GC re-gets each candidate: a blob the listing shows as old, but which was just rewritten, is kept', async () => {
  const db = makeFakeDb();
  const W = makePage(gcView(db, (p, q) => (p.endsWith('/blobs')
    ? { docs: q.docs.map((d) => (d.id === 'orphan' ? { id: d.id, data: () => ({ rows: [], createdAt: 1 }) } : d)) }
    : q)), T);
  editTable(W.page, sample(20, 'x'));
  await W.api.flush('t');
  db.put(W.api.blobPath('t', 'orphan'), { rows: [], createdAt: Date.now() }); // a peer just rewrote it
  editTable(W.page, sample(20, 'y'));
  await W.api.flush('t');
  assert.equal(db.has(W.api.blobPath('t', 'orphan')), true, 'a fresh blob survives the stale listing');
});

test('GC keeps the blobs of a live head that lands while it is listing', async () => {
  const db = makeFakeDb();
  let injected = false;
  const W = makePage(gcView(db, (p, q, real) => {
    if (p.endsWith('/blobs') && !injected) {
      injected = true;
      real.put('tables/t', { format: 'blobs', columns: COLS, blobs: ['peerblob'], rev: 'peer', base: '', savedAt: 1 });
    }
    return q;
  }), T);
  db.put(W.api.blobPath('t', 'peerblob'), { rows: [], createdAt: 1 }); // old, and referenced only by the peer's head
  editTable(W.page, sample(20, 'x'));
  await W.api.flush('t');
  assert.equal(db.has(W.api.blobPath('t', 'peerblob')), true, 'the live head\'s blob is kept');
});

test('slow blob writes stop at the save deadline, show the warning, and make no further writes', async () => {
  const db = makeFakeDb();
  db.delay = async (op, p) => { if (op === 'set' && p.includes('/blobs/')) await settle(400); };
  const W = makePage(db, T);
  editTable(W.page, sample(1500, 'b')); // about 20 blobs at 400 ms each
  await W.api.flush('t', { deadline: Date.now() + 1500 });
  await waitFor(() => W.api.tstate.t.conflict, 8000);
  assert.ok(W.page.statuses.some((s) => s.level === 'warn' && /in time/.test(s.msg)), 'the warning is shown');
  const before = db.log.sets.length;
  await settle(3000);
  assert.equal(db.log.sets.length, before, 'no writes after the deadline');
});

test('a head get that is always slow gives up at the save deadline instead of retrying forever', async () => {
  const db = makeFakeDb();
  db.delay = async (op, p) => { if (op === 'get' && p === 'tables/t') await settle(1400); };
  const W = makePage(db, T);
  editTable(W.page, sample(3, 'g'));
  await W.api.flush('t', { deadline: Date.now() + 2500 });
  await waitFor(() => W.api.tstate.t.conflict, 8000);
  assert.ok(W.page.statuses.some((s) => s.level === 'warn' && /in time/.test(s.msg)), 'the warning is shown');
  const gets = db.log.gets.filter((p) => p === 'tables/t').length;
  await settle(3000);
  assert.equal(db.log.gets.filter((p) => p === 'tables/t').length, gets, 'no retries after the deadline');
});

// One tab's view of the db: its first head get is slow, and every head set records how old its lease was.
function slowFirstGetTracedDb(db, getMs, sets) {
  let lastAcq = 0, firstGet = true;
  return {
    doc(p) {
      const d = db.doc(p);
      if (p !== 'tables/t') return d;
      return {
        id: d.id, path: p,
        get: async () => { if (firstGet) { firstGet = false; await settle(getMs); } return d.get(); },
        set: async (x) => { sets.push(Date.now() - lastAcq); return d.set(x); },
        acquire: async (o) => { const r = await d.acquire(o); if (r.acquired) lastAcq = Date.now(); return r; },
        onSnapshot: (...a) => d.onSnapshot(...a),
      };
    },
    collection: (p) => db.collection(p),
  };
}

test('fencing: a head set is never issued under a lease near expiry; a slow get makes the save retry', async () => {
  const db = makeFakeDb();
  const sets = [];
  const A = makePage(slowFirstGetTracedDb(db, 1400, sets), T);
  const rows = sample(5, 'x');
  editTable(A.page, rows);
  await A.api.flush('t');
  await waitFor(() => db.has('tables/t') && !A.page.saving.has('t') && !A.page.dirty.has('t'), 8000);
  assert.ok(sets.length >= 1, 'a head set happened');
  for (const age of sets) assert.ok(age <= 1250, 'head set issued ' + age + ' ms into its lease');
  assert.equal(await storedRows(db), JSON.stringify(rows));
  assert.equal(A.api.tstate.t.conflict, null);
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
const NO_LEASE = ['const lease=await acquireHead(t);', 'const lease={acquiredAt:Date.now(),ttlMs:1500};'];

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

// Column drift: every workbench table's default columns must contain the whole header
// of its CSV in docs/tag-model/tables, so a column added to a CSV cannot go missing here.
const CSV_DIR = path.join(HERE, '..', 'tables');
// The presentation inventory is generated and not on every branch. Its tables are
// checked only when the folder is present; the gameplay tables always are.
const HAS_PRES = existsSync(path.join(CSV_DIR, 'presentation'));
const CSV_FOR = {
  tags: 'tags.csv', objects: 'objects.csv', values: 'values.csv', formulas: 'formulas.csv',
  ranks: 'ranks.csv', relations: 'relations.csv', artSizes: 'assets.csv',
  assets: 'presentation/assets.csv', components: 'presentation/components.csv', layouts: 'presentation/layouts.csv',
  styles: 'presentation/styles.csv', tokens: 'presentation/tokens.csv', breakpoints: 'presentation/breakpoints.csv',
  animations: 'presentation/animations.csv', effects: 'presentation/effects.csv', resolutions: 'presentation/resolutions.csv',
  symbols: 'presentation/symbols.csv', combatSymbols: 'presentation/combat-symbols.csv',
  settings: 'presentation/settings.csv', strings: 'presentation/strings.csv',
};

function workbenchTableDefaults() {
  const html = readFileSync(PAGE, 'utf8');
  const fa = html.indexOf('/* formula-columns:begin */');
  const fb = html.indexOf('/* formula-columns:end */');
  const ta = html.indexOf('const TABLES = {');
  const tb = html.indexOf('\n};', ta);
  if (fa < 0 || fb < fa || ta < 0 || tb < ta) throw new Error('TABLES or formula-columns markers missing in workbench.html');
  const src = html.slice(fa, fb + '/* formula-columns:end */'.length) + '\n' + html.slice(ta, tb + 3) + '\n;TABLES';
  return vm.runInNewContext(src, {});
}

test('every workbench table has a CSV mapping, and every mapped CSV exists', () => {
  const tables = workbenchTableDefaults();
  assert.deepEqual(Object.keys(CSV_FOR).sort(), Object.keys(tables).sort());
  for (const file of Object.values(CSV_FOR)) {
    if (!HAS_PRES && file.startsWith('presentation/')) continue;
    assert.ok(existsSync(path.join(CSV_DIR, file)), 'missing CSV: ' + file);
  }
});

test('workbench default columns contain every column in the matching CSV header', () => {
  const tables = workbenchTableDefaults();
  for (const [table, file] of Object.entries(CSV_FOR)) {
    if (!HAS_PRES && file.startsWith('presentation/')) continue;
    const { header } = readTable(path.join(CSV_DIR, file));
    const missing = header.filter((c) => !tables[table].columns.includes(c));
    assert.deepEqual(missing, [], table + ' (' + file + ') is missing CSV columns in the workbench');
  }
});

// One named function of the page, read from its single source line (loadLocal is one line).
function pageFunctionLine(name) {
  const line = readFileSync(PAGE, 'utf8').split('\n').find((l) => l.startsWith('function ' + name + '('));
  if (!line) throw new Error('function ' + name + ' missing from workbench.html');
  return line;
}

test('a local save from an older page gains the default columns that are new', () => {
  const tables = workbenchTableDefaults();
  const order = vm.runInNewContext(readFileSync(PAGE, 'utf8').split('\n').find((l) => l.startsWith('const ORDER = ')) + '\n;ORDER', {});
  const saved = { objects: { columns: ['id', 'name'], rows: [{ id: 'o1', name: 'Dagger' }] } };
  const ctx = {
    localStorage: { getItem: () => JSON.stringify(saved) },
    state: { data: {} }, TABLES: tables, ORDER: order, LS: 'ashen-tag-workbench-v1',
  };
  vm.runInNewContext(pageFunctionLine('loadLocal') + '\n;loadLocal();', ctx);
  const got = ctx.state.data.objects;
  assert.equal(JSON.stringify(got.columns.slice(0, 2)), JSON.stringify(['id', 'name']), 'saved columns keep their order');
  for (const c of tables.objects.columns) assert.ok(got.columns.includes(c), 'default column kept: ' + c);
  assert.equal(JSON.stringify(got.rows), JSON.stringify([{ id: 'o1', name: 'Dagger' }]), 'saved rows are kept as they were');
});

test('a columnless head of positional rows is blocked, not read with the default columns', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { rows: [['x1', 'n', 1]] });
  api.subscribeTable('t');
  await settle(30);
  assert.equal(page.loaded.has('t'), false, 'the table is not loaded');
  assert.equal(page.state.data.t.rows.length, 0, 'no row is adopted');
  assert.ok(page.statuses.some((s) => s.level === 'bad' && /positional rows with no column list/.test(s.msg)), 'the block is shown');
});

test('a columnless legacy head whose parts are positional rows is blocked too', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { parts: 1, format: 'arrays' });
  db.put('tables/t/parts/p0', { index: 0, rows: [['a1', 'n', 1]] });
  api.subscribeTable('t');
  await settle(30);
  assert.equal(page.loaded.has('t'), false, 'the table is not loaded');
  assert.equal(page.state.data.t.rows.length, 0, 'no row is adopted');
});

test('a columnless head whose rows are objects still loads with the defaults', async () => {
  const db = makeFakeDb();
  const { page, api } = makePage(db, T);
  db.put('tables/t', { rows: [{ id: 'o1', name: 'n', qty: 2 }] });
  api.subscribeTable('t');
  await waitFor(() => page.loaded.has('t'));
  assert.equal(JSON.stringify(page.state.data.t.rows), JSON.stringify([{ id: 'o1', name: 'n', qty: 2 }]));
});

// CSVs under tables/ and tables/presentation/ that no workbench table edits. Empty on purpose:
// a new CSV must get a workbench table, or be added here with the reason in a comment.
const EXCLUDED_CSV = new Set([]);

test('every CSV under tables/ and tables/presentation/ is edited by a workbench table or excluded', () => {
  const mapped = new Set(Object.values(CSV_FOR));
  const found = [];
  for (const dir of HAS_PRES ? ['', 'presentation'] : ['']) {
    for (const f of readdirSync(path.join(CSV_DIR, dir))) {
      if (f.endsWith('.csv')) found.push(path.posix.join(dir, f));
    }
  }
  const unmapped = found.filter((f) => !mapped.has(f) && !EXCLUDED_CSV.has(f));
  assert.deepEqual(unmapped, [], 'CSV with no workbench table and not excluded');
  for (const f of EXCLUDED_CSV) assert.ok(found.includes(f) && !mapped.has(f), 'stale exclusion: ' + f);
});
