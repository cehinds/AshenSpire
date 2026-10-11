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
