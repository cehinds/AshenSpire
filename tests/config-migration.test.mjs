// tests/config-migration.test.mjs — the JS config tables that moved into
// content/config/ui/presentation/, and the shims left in their place.
//
// TWO CLAIMS, AND THEY ARE DIFFERENT CLAIMS:
//
//   1. NOTHING MOVED BUT THE HOME. tests/fixtures/config-migration-baseline
//      .json was captured by tests/capture-config-baseline.mjs running on dev
//      BEFORE any shim existed, so it records what the hand-written modules
//      actually exported. Every module is re-transcribed here and held to it —
//      values, types, KEY ORDER, and the results of the functions that read the
//      tables. Key order is in the contract because consumers iterate these:
//      legendEntries walks NODE_TYPES, menuRows walks the band order, so a JSON
//      round-trip that reordered keys would change a screen while every value
//      stayed equal.
//
//   2. THE SHIMS AUTHOR NO NUMBER. A shim that quietly keeps one literal is the
//      second copy the move exists to delete, and it is invisible — the values
//      still agree on the day it is written. Same shape as the wireframeUi
//      guard in tests/ui-config.test.mjs.
//
// NOTHING IS ALLOWED TO DIFFER, including how deeply a table is frozen. The
// compiled config is deep-frozen; several of these tables were shallow-frozen
// or not frozen at all, so the shims hand out copies shaped to match — see
// src/config/authored.js. That is not fussiness. tools/surfaces.mjs's known-bad
// corpus plants each defect by mutating ONE table in memory, "exactly the way
// an author would by hand", and against a deep-frozen MENU_TABS that plant
// raises a TypeError instead of the red it exists to produce. A migration that
// changes what a consumer may do with what it is handed has not kept the
// consumer, however much safer the new rule sounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATED, captureModule } from './capture-config-baseline.mjs';
import { numericLiterals } from './source-literals.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const lf = (text) => text.replace(/\r\n/g, '\n');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/config-migration-baseline.json', import.meta.url), 'utf8'));

/** Every path at which `want` and `got` differ, as readable lines. */
function differences(want, got, path = '') {
  if (JSON.stringify(want) === JSON.stringify(got)) return [];
  const bothObjects = want && got && typeof want === 'object' && typeof got === 'object';
  if (!bothObjects) return [`${path}: ${JSON.stringify(want)} -> ${JSON.stringify(got)}`];
  const keys = new Set([...Object.keys(want), ...Object.keys(got)]);
  return [...keys].flatMap((k) => differences(want[k], got[k], `${path}.${k}`));
}

for (const rel of MIGRATED) {
  test(`${rel} exports exactly what it exported before the move`, async () => {
    assert.ok(baseline[rel], `${rel} is in the baseline fixture`);
    const changed = differences(baseline[rel], await captureModule(rel));
    assert.deepEqual(changed, [], `${rel} must be identical to dev:\n  ${changed.join('\n  ')}`);
  });
}

test('the baseline covers every migrated module and every module is reached', () => {
  assert.deepEqual(Object.keys(baseline).sort(), [...MIGRATED].sort());
});


// ---------------------------------------------------------------------------
// The shims author no number of their own.
// ---------------------------------------------------------------------------
//
// A shim that quietly keeps one literal is the second copy the move exists to
// delete, and it is invisible: the two values still agree on the day it is
// written. Same shape as the wireframeUi guard in tests/ui-config.test.mjs.
//
// SHIMS is MIGRATED plus paintedOutfits.js, which is not in the equality
// fixture because it exports only DOM builders and needs a document — but its
// stage geometry, its timings and its aura artwork moved out all the same, so
// it is held to the no-literals promise with the rest.
const SHIMS = [...MIGRATED, 'src/ui/paintedOutfits.js'];

for (const rel of SHIMS) {
  test(`${rel} authors no number of its own`, () => {
    const source = lf(readFileSync(join(ROOT, ...rel.split('/')), 'utf8'));
    assert.match(source, /config\/generated\/ui\.js/, `${rel} reads the compiled config`);
    const found = numericLiterals(source);
    const report = found.map((f) => `  ${rel}:${f.line}  ${f.value}  |  ${f.text}`).join('\n');
    assert.deepEqual(found, [], `these numbers belong in content/config, not in the shim:\n${report}`);
  });
}

test('the guard can still see a literal that is smuggled back in', () => {
  // The guard's own integrity: a check that cannot fail is not a check, and a
  // stripper with one bracket wrong goes quiet rather than red.
  const planted = [
    "import { uiConfig } from '../config/generated/ui.js';",
    "// a comment with 4321 in it is not code",
    "const prose = 'a string with 8765 in it is not code';",
    'const gap = 12;',
    'const css = `width:${gap * 7}px`;',
  ].join('\n');
  assert.deepEqual(numericLiterals(planted).map((f) => f.value), ['12', '7'],
    'comments and string bodies are ignored; declarations and interpolations are not');
});
