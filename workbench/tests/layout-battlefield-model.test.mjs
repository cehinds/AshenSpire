// node --test workbench/tests/layout-battlefield-model.test.mjs — Layout Studio's
// Battlefield model against the real data file the game reads
// (src/content/formationPositioningPresets.js): parse and serialize round trip,
// the geometry against the supplied anchors and the game's own combatFormation,
// and an edit that changes only the values it touches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from '../modules/layout/battlefield-model.mjs';
import { combatFormation } from '../../src/ui/models/CombatFormationModel.js';

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

const eq = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-8, `${what}: ${a} vs ${b}`);
const presentationOf = (parts, key) => structuredClone(parts.data[key].presentation);

test('the geometry reproduces every anchor the file supplies, at full and half size', () => {
  const parts = B.parsePresets(realText);
  for (const key of B.layoutKeys(parts.data)) {
    const source = parts.data[key];
    for (const scale of [1, 0.5]) {
      const cells = B.battlefieldGeometry(presentationOf(parts, key), { width: source.battlefield.width * scale, height: source.battlefield.height * scale });
      for (const expected of source.anchors) {
        const got = cells.find((c) => c.cell === expected.cell);
        eq(got.x, expected.left * scale, `${key} ${expected.cell} x`);
        eq(got.ground, expected.top * scale, `${key} ${expected.cell} ground`);
      }
    }
  }
});

test('the geometry equals the game\'s combatFormation slot by slot, with and without groups', () => {
  const parts = B.parsePresets(realText);
  for (const key of B.layoutKeys(parts.data)) {
    const presentation = presentationOf(parts, key);
    const width = 1641, height = 526;
    const plan = combatFormation({ width, height, presentation: { ...presentation, formationGroups: JSON.stringify(presentation.formationGroups) }, friends: [], enemies: [] });
    const cells = B.battlefieldGeometry(presentation, { width, height });
    for (const c of cells) {
      const real = plan.cells.find((p) => p.cell === c.cell);
      eq(c.x, real.x, `${key} ${c.cell} x`);
      eq(c.ground, real.ground, `${key} ${c.cell} ground`);
    }
  }
  // A moved section and a single slot: the game applies both, parent first.
  const presentation = { ...presentationOf(parts, '2x2'), formationGroups: [
    { id: 'player', name: 'Player section', members: [], x: 5, y: -2, scale: 1 },
    { id: 'cell-enemy:1:1', name: 'Enemy B3', members: [], x: -3, y: 4, scale: 1.25 },
  ] };
  const width = 1641, height = 526;
  const plan = combatFormation({ width, height, presentation: { ...presentation, formationGroups: JSON.stringify(presentation.formationGroups) }, friends: [], enemies: [] });
  const cells = B.battlefieldGeometry(presentation, { width, height });
  for (const c of cells) {
    const real = plan.cells.find((p) => p.cell === c.cell);
    eq(c.x, real.x, `grouped ${c.cell} x`);
    eq(c.ground, real.ground, `grouped ${c.cell} ground`);
    eq(c.characterScale, real.characterScale || 1, `grouped ${c.cell} scale`);
  }
});

test('the geometry constants match the config file the game reads', () => {
  const grid = JSON.parse(readFileSync(join(ROOT, 'content/config/ui/presentation/combatFormationModel.json'), 'utf8')).sizing.grid;
  for (const k of Object.keys(B.GRID)) assert.equal(B.GRID[k], grid[k], k);
});
