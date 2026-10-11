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

// Evaluates the storage block in a fresh context. `expose` is a JS expression
// evaluated after the block that returns the functions a test needs.
export function loadStorage(ctx, expose) {
  const context = vm.createContext(ctx);
  return vm.runInContext(storageSource() + '\n;(' + expose + ')', context);
}

test('storage block loads and chunk keeps every row in order', () => {
  const { chunk } = loadStorage({}, '({ chunk })');
  const rows = Array.from({ length: 500 }, (_, i) => [i, 'row ' + i + ' ' + 'x'.repeat(1000)]);
  const parts = chunk(rows);
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
