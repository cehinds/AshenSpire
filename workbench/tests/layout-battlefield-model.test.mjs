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

// A stored percent is six places, so a px move is exact to about a millionth of a px; 1e-3 px is the bar for a moved slot.
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-3, `${what}: ${a} vs ${b}`);
const W = 1641, H = 526;
const slots = (key, parts) => B.battlefieldGeometry(presentationOf(parts, key), { width: W, height: H });

test('the inspector shows columns and rows read-only, labelled by the layout key', async () => {
  const { layoutKeyRowsHtml } = await import('../modules/layout/battlefield-view.mjs');
  const parts = B.parsePresets(realText);
  const html = layoutKeyRowsHtml(parts.data['2x2'].presentation);
  assert.match(html, /Set by the layout key/);
  for (const field of ['formationColumns', 'formationRows']) {
    assert.doesNotMatch(html, new RegExp(`<input[^>]*data-bf-field="${field}"`), `${field} has no input`);
    assert.match(html, new RegExp(`<output[^>]*data-bf-field="${field}"[^>]*>2</output>`), `${field} shows its value`);
  }
});

test('dragging a slot by px moves exactly that slot, and the others keep their place', () => {
  const parts = B.parsePresets(realText);
  const before = slots('2x2', parts);
  const target = before.find((c) => c.cell === 'B1');
  const id = B.slotGroupId(target);
  const next = B.moveSlots(parts.data, '2x2', [{ groupId: id, dx: 30, dy: -12, name: B.slotGroupName(target) }], { width: W, height: H });
  const bentParts = { ...parts, data: next };
  const after = slots('2x2', bentParts);
  for (const c of after) {
    const old = before.find((p) => p.cell === c.cell);
    // Offsets are stored as percent to six places, so a move is exact to a few millionths of a px.
    if (c.cell === 'B1') { assert.ok(Math.abs(c.x - old.x - 30) < 1e-3, 'B1 moved x'); assert.ok(Math.abs(c.ground - old.ground + 12) < 1e-3, 'B1 moved ground'); }
    else { eq(c.x, old.x, `${c.cell} x unchanged`); eq(c.ground, old.ground, `${c.cell} ground unchanged`); }
  }
});

test('dragging A1 200px left on 2x2 moves A1 to its edge clamp and no neighbour', () => {
  const parts = B.parsePresets(realText);
  const before = slots('2x2', parts);
  const a1 = before.find((c) => c.cell === 'A1');
  const next = B.moveSlots(parts.data, '2x2', [{ groupId: B.slotGroupId(a1), dx: -200, dy: 0, name: 'A1' }], { width: W, height: H });
  const after = slots('2x2', { ...parts, data: next });
  for (const c of after) {
    const old = before.find((p) => p.cell === c.cell);
    if (c.cell === 'A1') {
      // Its own clamp: the battlefield edge, where the game would otherwise shift the section's other slots.
      near(c.x, 0, 'A1 lands at its edge clamp');
      near(c.ground, old.ground, 'A1 keeps its ground');
    } else {
      near(c.x, old.x, `${c.cell} x unchanged`);
      near(c.ground, old.ground, `${c.cell} ground unchanged`);
    }
  }
});

test('an in-range drag lands the slot exactly where it was dropped, and no neighbour moves', () => {
  const parts = B.parsePresets(realText);
  const before = slots('2x2', parts);
  const a1 = before.find((c) => c.cell === 'A1');
  const next = B.moveSlots(parts.data, '2x2', [{ groupId: B.slotGroupId(a1), dx: -40, dy: 25, name: 'A1' }], { width: W, height: H });
  const after = slots('2x2', { ...parts, data: next });
  for (const c of after) {
    const old = before.find((p) => p.cell === c.cell);
    if (c.cell === 'A1') { near(c.x, a1.x - 40, 'A1 x'); near(c.ground, a1.ground + 25, 'A1 ground'); }
    else { near(c.x, old.x, `${c.cell} x unchanged`); near(c.ground, old.ground, `${c.cell} ground unchanged`); }
  }
});

test('the output of a slot move, once its anchors are refreshed, passes the presets test', async () => {
  // The same reproduction the presets test runs (tests/formation-positioning-presets.test.mjs), on the edited file's text.
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const parts = B.parsePresets(realText);
  const a1 = slots('2x2', parts).find((c) => c.cell === 'A1');
  const moved = B.refreshAnchors(B.moveSlots(parts.data, '2x2', [{ groupId: B.slotGroupId(a1), dx: -200, dy: 0, name: 'A1' }], { width: W, height: H }), '2x2', parts.data);
  const text = B.serializePresets(parts, moved);
  const dir = mkdtempSync(join(tmpdir(), 'bf-presets-'));
  try {
    const file = join(dir, 'presets.mjs');
    writeFileSync(file, text);
    const { FORMATION_POSITIONING_PRESETS } = await import(pathToFileURL(file).href);
    const { combatFormation } = await import('../../src/ui/models/CombatFormationModel.js');
    for (const [layout, source] of Object.entries(FORMATION_POSITIONING_PRESETS)) {
      for (const scale of [1, 0.5]) {
        const presentation = { ...source.presentation, formationGroups: JSON.stringify(source.presentation.formationGroups) };
        const plan = combatFormation({ width: source.battlefield.width * scale, height: source.battlefield.height * scale, presentation, friends: [], enemies: [] });
        for (const expected of source.anchors) {
          const actual = plan.cells.find((c) => c.cell === expected.cell);
          eq(actual.x, expected.left * scale, `${layout} ${expected.cell} x at ${scale}`);
          eq(actual.ground, expected.top * scale, `${layout} ${expected.cell} ground at ${scale}`);
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a slot move writes only the group it touches, and leaves the input untouched', () => {
  const parts = B.parsePresets(realText);
  const snapshot = JSON.stringify(parts.data);
  const text = B.serializePresets(parts, B.moveSlots(parts.data, '2x2', [{ groupId: 'cell-player:1:0', dx: 10, dy: 0 }], { width: W, height: H }));
  assert.equal(JSON.stringify(parts.data), snapshot, 'the input data is not mutated');
  // Line multisets: the group before the new one gains a comma (one line out, one in), and the new group adds eight lines.
  const count = (lines) => lines.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const before = count(realText.split('\n')), after = count(text.split('\n'));
  const removed = [], added = [];
  for (const [l, n] of before) if ((after.get(l) || 0) < n) removed.push(l);
  for (const [l, n] of after) if ((before.get(l) || 0) < n) added.push(l);
  assert.deepEqual(removed, [], 'the closing brace of the new group replaces the one the comma changed');
  assert.equal(added.length, 8, 'the comma line and the new group\'s other seven lines');
  assert.ok(added.includes('        },'));
  assert.equal(text.split('\n').length - realText.split('\n').length, 8);
  assert.equal(B.parsePresets(text).data['2x2'].presentation.formationGroups.at(-1).id, 'cell-player:1:0');
});

test('withGroup replaces an existing group in place and clamps its values', () => {
  const parts = B.parsePresets(realText);
  const next = B.withGroup(parts.data, '2x2', 'enemy', { x: 500, scale: 0.01 });
  const groups = next['2x2'].presentation.formationGroups;
  assert.equal(groups.length, parts.data['2x2'].presentation.formationGroups.length, 'no group is added');
  const enemy = groups.find((g) => g.id === 'enemy');
  assert.equal(enemy.x, 100);
  assert.equal(enemy.scale, 0.25);
  assert.deepEqual(groups.filter((g) => g.id !== 'enemy'), parts.data['2x2'].presentation.formationGroups.filter((g) => g.id !== 'enemy'));
});

test('withField refuses unknown fields and the presentation fields the game reads from player settings', () => {
  const parts = B.parsePresets(realText);
  for (const field of ['formationWidth', 'formationDepth', 'formationGap', 'groundTilt', 'groundSkew', 'formationPreset']) {
    assert.throws(() => B.withField(parts.data, '2x2', field, 50), /not saved in the file/, field);
  }
  assert.throws(() => B.withField(parts.data, '2x2', 'frontLayer', 3), /not a Battlefield field/);
  assert.equal(B.serializePresets(parts, parts.data), realText, 'the file is unchanged');
});

test('previewPresentation clamps preview values to the game\'s limits and never changes the data', () => {
  const parts = B.parsePresets(realText);
  const p = B.previewPresentation(parts.data, '2x2', { formationDepth: 500, formationWidth: '44.4', formationPreset: 'classic-v' });
  assert.equal(p.formationDepth, 100);
  assert.equal(p.formationWidth, 44);
  assert.equal(p.formationPreset, 'classic-v');
  assert.equal(parts.data['2x2'].presentation.formationDepth, 60, 'the stored value is untouched');
  assert.equal(B.serializePresets(parts, parts.data), realText);
  assert.throws(() => B.previewPresentation(parts.data, '2x2', { formationPreset: 'zigzag' }), /unknown preset/);
  assert.throws(() => B.previewPresentation(parts.data, '2x2', { formationColumns: 3 }), /Set by the layout key/);
});

test('a preview at other player settings changes the geometry, and no file change', () => {
  const parts = B.parsePresets(realText);
  const stored = B.battlefieldGeometry(presentationOf(parts, '2x2'), { width: W, height: H });
  const preview = B.previewPresentation(parts.data, '2x2', { formationWidth: 60 });
  const seen = B.battlefieldGeometry(preview, { width: W, height: H });
  assert.notEqual(seen.find((c) => c.cell === 'A1').x, stored.find((c) => c.cell === 'A1').x);
  assert.equal(B.serializePresets(parts, parts.data), realText);
});

test('saving after a slot move leaves every presentation field byte-identical', () => {
  const parts = B.parsePresets(realText);
  const a1 = slots('2x2', parts).find((c) => c.cell === 'A1');
  const moved = B.refreshAnchors(B.moveSlots(parts.data, '2x2', [{ groupId: B.slotGroupId(a1), dx: 30, dy: 10, name: 'A1' }], { width: W, height: H }), '2x2', parts.data);
  const text = B.serializePresets(parts, moved);
  // Everything from the first layout's presentation up to its formation groups is the file's own presentation block.
  const block = (t) => t.slice(t.indexOf('"presentation"'), t.indexOf('"formationGroups"'));
  assert.equal(block(text), block(realText));
});

test('the layout key fields are refused, and the file is unchanged', () => {
  const parts = B.parsePresets(realText);
  const before = B.serializePresets(parts, parts.data);
  for (const field of ['formationColumns', 'formationRows']) {
    assert.throws(() => B.withField(parts.data, '2x2', field, 3), /Set by the layout key/, field);
  }
  assert.equal(B.serializePresets(parts, parts.data), before);
  assert.equal(before, realText);
});

test('an edit refreshes its layout\'s anchors, so the game still reproduces them at full and half size', () => {
  const parts = B.parsePresets(realText);
  let next = B.moveSlots(parts.data, '2x2', [{ groupId: 'cell-player:1:0', dx: 40, dy: -10, name: 'B1' }], { width: W, height: H });
  next = B.refreshAnchors(next, '2x2', parts.data);
  for (const scale of [1, 0.5]) {
    const presentation = { ...next['2x2'].presentation, formationGroups: JSON.stringify(next['2x2'].presentation.formationGroups) };
    const plan = combatFormation({ width: W * scale, height: H * scale, presentation, friends: [], enemies: [] });
    for (const a of next['2x2'].anchors) {
      const c = plan.cells.find((p) => p.cell === a.cell);
      eq(c.x, a.left * scale, `${a.cell} x at ${scale}`);
      eq(c.ground, a.top * scale, `${a.cell} ground at ${scale}`);
    }
  }
  assert.equal(next['1x1'], parts.data['1x1'], 'the other layout is untouched');
});

test('refreshing an unedited layout keeps the file\'s bytes', () => {
  const parts = B.parsePresets(realText);
  assert.equal(B.refreshAnchors(parts.data, '2x2', parts.data), parts.data, 'the same data comes back');
  const same = B.moveSlots(parts.data, '2x2', [{ groupId: 'cell-player:1:0', dx: 0, dy: 0 }], { width: W, height: H });
  const text = B.serializePresets(parts, B.refreshAnchors(same, '2x2', parts.data));
  assert.equal(text, realText, 'a zero move writes nothing');
});

const cellsOf = [
  { id: 'a', x: 100, ground: 200 }, { id: 'b', x: 300, ground: 260 }, { id: 'c', x: 340, ground: 220 }, { id: 'd', x: 900, ground: 300 },
];
test('align puts every cell on the chosen edge and moves no other axis', () => {
  const left = B.alignDeltas(cellsOf, 'left');
  assert.deepEqual(left.map((m, i) => cellsOf[i].x + m.dx), [100, 100, 100, 100]);
  assert.ok(left.every((m) => m.dy === 0));
  const bottom = B.alignDeltas(cellsOf, 'bottom');
  assert.ok(bottom.every((m, i) => cellsOf[i].ground + m.dy === 300));
  assert.ok(bottom.every((m) => m.dx === 0));
  const centre = B.alignDeltas(cellsOf, 'center');
  assert.ok(centre.every((m, i) => cellsOf[i].x + m.dx === 500));
  const middle = B.alignDeltas(cellsOf, 'middle');
  assert.ok(middle.every((m, i) => cellsOf[i].ground + m.dy === 250));
  assert.throws(() => B.alignDeltas(cellsOf, 'diagonal'), /unknown edge/);
});

test('distribute spaces the cells evenly and keeps the outer two in place', () => {
  const moves = B.distributeDeltas(cellsOf, 'horizontal');
  const xs = cellsOf.map((c, i) => c.x + moves[i].dx).sort((p, q) => p - q);
  assert.equal(xs[0], 100);
  assert.equal(xs[3], 900);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), 'equal gaps');
  assert.equal(moves[0].dx, 0, 'the leftmost stays');
  assert.equal(moves[3].dx, 0, 'the rightmost stays');
  const vertical = B.distributeDeltas(cellsOf, 'vertical');
  assert.ok(vertical.every((m) => m.dx === 0));
  assert.deepEqual(B.distributeDeltas(cellsOf.slice(0, 2), 'horizontal').map((m) => m.dx), [0, 0], 'two cells have nothing to spread');
});
