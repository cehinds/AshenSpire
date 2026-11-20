// tests/loadout-split.test.mjs — src/model/loadout.js is a door onto src/model/loadout/*.js.
//
// Three things must stay true of the split, and each is a way it silently rots:
//   1. The door and the barrel say the same names, so no importer of
//      loadout.js loses (or quietly gains) an export when a part changes.
//   2. No part imports the barrel or the door — a part imports the part it
//      needs. Through the barrel that would be a cycle, and the bundler turns
//      a cycle into a destructured `undefined`.
//   3. The parts form a DAG. tools/bundle.mjs reads only static
//      `import { }` / `export { }`, so `export *` is not an option either.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'src', 'model', 'loadout');
const parts = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();
const read = (name) => readFileSync(join(dir, name), 'utf8');
const importsOf = (src) => [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

test('the door and the barrel export exactly the same names', async () => {
  const door = await import('../src/model/loadout.js');
  const barrel = await import('../src/model/loadout/index.js');
  assert.deepEqual(Object.keys(door).sort(), Object.keys(barrel).sort());
  assert.ok(Object.keys(door).length >= 89, 'the split lost exports');
});

test('no part imports the barrel or the door, and nothing uses export *', () => {
  for (const f of parts) {
    const src = read(f);
    for (const spec of importsOf(src)) {
      assert.ok(spec !== './index.js' && !/model\/loadout\.js$|^\.\.\/loadout\.js$/.test(spec), `${f} imports ${spec}`);
    }
    assert.ok(!/^export\s*\*/m.test(src), `${f} uses export *`);
  }
  assert.ok(!/^export\s*\*/m.test(readFileSync(join(here, '..', 'src', 'model', 'loadout.js'), 'utf8')));
});

test('the parts import each other without a cycle', () => {
  const edges = new Map(parts.map((f) => [f, importsOf(read(f)).filter((s) => /^\.\/[\w]+\.js$/.test(s)).map((s) => s.slice(2))]));
  const state = new Map();
  const visit = (f, stack) => {
    assert.notEqual(state.get(f), 1, `import cycle: ${[...stack, f].join(' > ')}`);
    if (state.get(f) === 2) return;
    state.set(f, 1);
    for (const next of edges.get(f)) {
      assert.ok(edges.has(next), `${f} imports ${next}, which is not a part`);
      visit(next, [...stack, f]);
    }
    state.set(f, 2);
  };
  for (const f of parts) visit(f, []);
});
