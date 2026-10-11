// node --test workbench/tests/layout-battlefield-model.test.mjs — Layout Studio's
// Battlefield model against the real data file the game reads
// (src/content/formationPositioningPresets.js): parse and serialize round trip,
// and an edit that changes only the values it touches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from '../modules/layout/battlefield-model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const realText = readFileSync(join(ROOT, B.PRESETS_FILE), 'utf8');

test('the real presets file parses and serializes back byte for byte', () => {
  const parts = B.parsePresets(realText);
  assert.deepEqual(B.layoutKeys(parts.data), ['2x2', '1x1']);
  assert.equal(B.serializePresets(parts, parts.data), realText);
});

test('an edited value changes exactly its own line', () => {
  const parts = B.parsePresets(realText);
  const next = structuredClone(parts.data);
  next['2x2'].presentation.formationDepth = 72;
  const text = B.serializePresets(parts, next);
  const before = realText.split('\n'), after = text.split('\n');
  assert.equal(after.length, before.length, 'no line is added or removed');
  const changed = after.map((l, i) => (l === before[i] ? -1 : i)).filter((i) => i >= 0);
  assert.equal(changed.length, 1);
  assert.equal(after[changed[0]], '      "formationDepth": 72,');
  assert.equal(B.parsePresets(text).data['2x2'].presentation.formationDepth, 72);
});

test('a file without the presets object is refused by name', () => {
  assert.throws(() => B.parsePresets('export const OTHER = {};\n'), /FORMATION_POSITIONING_PRESETS was not found/);
});
