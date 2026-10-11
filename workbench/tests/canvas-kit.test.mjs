// node --test workbench/tests/canvas-kit.test.mjs — the pure canvas model
// (workbench/ui/kit/canvas-model.mjs): snapping, align, distribute, groups,
// z-order, duplicate, marquee and hit-test, and exact undo/redo for every op.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../ui/kit/canvas-model.mjs';

const doc = (items, extra = {}) => M.createDocument({ width: 800, height: 600, items, ...extra });
const it = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const GRID = { enabled: true, size: 20, subdivisions: 1 };

function assertRestores(before, result) {
  assert.equal(typeof result.change.label, 'string');
  assert.deepStrictEqual(result.change.undo(result.doc), before, `${result.change.label}: undo`);
  assert.deepStrictEqual(result.change.redo(result.change.undo(result.doc)), result.doc, `${result.change.label}: redo`);
}

// ---------------------------------------------------------------------------
// Snapping
// ---------------------------------------------------------------------------

test('move snaps to the grid when no guide is near', () => {
  const r = M.snapRect({ x: 21, y: 39, w: 50, h: 50 }, { mode: 'move', grid: GRID, threshold: 6 });
  assert.equal(r.rect.x, 20);
  assert.equal(r.rect.y, 40);
  assert.deepEqual(r.guides, []);
});

test('grid subdivisions give a finer step', () => {
  const r = M.snapRect({ x: 11, y: 0, w: 50, h: 50 }, { mode: 'move', grid: { enabled: true, size: 20, subdivisions: 2 }, threshold: 6 });
  assert.equal(r.rect.x, 10);
});

test('move snaps to viewport edges and centre with a guide line', () => {
  const d = doc([]);
  const g = M.snapGuides(d);
  const r = M.snapRect({ x: 3, y: 300, w: 100, h: 100 }, { mode: 'move', grid: { enabled: false }, ...g, threshold: 6 });
  assert.equal(r.rect.x, 0);
  assert.ok(r.guides.some((g) => g.axis === 'x' && g.at === 0));
});

test('move snaps the centre to the viewport centre', () => {
  const g = M.snapGuides(doc([]));
  const r = M.snapRect({ x: 346, y: 0, w: 108, h: 10 }, { mode: 'move', grid: { enabled: false }, ...g, threshold: 6 });
  assert.equal(r.rect.x, 346, 'centre already 400, no move');
  assert.ok(r.guides.some((g) => g.axis === 'x' && g.at === 400));
});

test('safe-area insets become guides', () => {
  const d = doc([], { safeArea: { top: 0, right: 0, bottom: 0, left: 40 } });
  const g = M.snapGuides(d);
  assert.ok(g.guidesX.includes(40));
  const r = M.snapRect({ x: 43, y: 100, w: 30, h: 30 }, { mode: 'move', grid: { enabled: false }, ...g, threshold: 6 });
  assert.equal(r.rect.x, 40);
});

test('move snaps to another item edge, and its centre beats a grid hit', () => {
  const d = doc([it('a', 200, 0, 100, 40)]);
  const g = M.snapGuides(d, { exclude: ['b'] });
  // leading edge 246 is 4 from guide 250 (the centre of a)
  const r = M.snapRect({ x: 246, y: 300, w: 8, h: 8 }, { mode: 'move', grid: GRID, ...g, threshold: 6 });
  assert.equal(r.rect.x, 246, 'the centre hit 0 away wins over the 4-away edge');
  assert.ok(r.guides.some((x) => x.axis === 'x' && x.at === 250));
});

test('move never snaps further than threshold', () => {
  const g = M.snapGuides(doc([]));
  const r = M.snapRect({ x: 20, y: 300, w: 10, h: 10 }, { mode: 'move', grid: { enabled: false }, ...g, threshold: 6 });
  assert.equal(r.rect.x, 20);
});

test('resize snaps the moving edge to a guide', () => {
  // right edge at 198 is 2 from guide 200
  const r = M.snapRect({ x: 100, y: 100, w: 98, h: 50 }, { mode: 'e', guidesX: [200], guidesY: [], grid: { enabled: false }, threshold: 6 });
  assert.equal(r.rect.x, 100, 'the opposite edge stays put');
  assert.equal(r.rect.w, 100);
  assert.deepEqual(r.guides, [{ axis: 'x', at: 200 }]);
});

test('resize snaps the leading edge when dragging w', () => {
  const r = M.snapRect({ x: 103, y: 0, w: 97, h: 10 }, { mode: 'w', guidesX: [100], guidesY: [], grid: { enabled: false }, threshold: 6 });
  assert.equal(r.rect.x, 100);
  assert.equal(r.rect.w, 100, 'right edge stays at 200');
});

test('resize snaps to the grid on n and s edges', () => {
  const r = M.snapRect({ x: 0, y: 41, w: 10, h: 58 }, { mode: 'n', guidesX: [], guidesY: [], grid: GRID, threshold: 6 });
  assert.equal(r.rect.y, 40);
  assert.equal(r.rect.h, 59);
});

// ---------------------------------------------------------------------------
// Move, nudge, resize
// ---------------------------------------------------------------------------

test('moveSelection skips locked items and snaps the group bounds', () => {
  const d = doc([it('a', 0, 0, 10, 10), it('b', 30, 30, 10, 10), it('lock', 60, 60, 10, 10, { locked: true })]);
  const free = M.moveSelection(d, ['a', 'b', 'lock'], 5, 5);
  assert.equal(M.byId(free.doc, 'a').x, 5);
  assert.equal(M.byId(free.doc, 'lock').x, 60, 'locked item stays');
  const snapped = M.moveSelection(d, ['a'], 21, 21, { snap: { grid: GRID, threshold: 6 } });
  assert.equal(M.byId(snapped.doc, 'a').x, 20);
  assert.equal(M.byId(snapped.doc, 'a').y, 20);
});

test('nudge moves 1 px, or 10 px with large', () => {
  const d = doc([it('a', 100, 100, 10, 10)]);
  assert.equal(M.byId(M.nudge(d, ['a'], 'left').doc, 'a').x, 99);
  assert.equal(M.byId(M.nudge(d, ['a'], 'down', { large: true }).doc, 'a').y, 110);
  assert.equal(M.byId(M.nudge(d, ['a'], 'up', { large: true }).doc, 'a').y, 90);
});

test('resizeItem by an edge handle changes one side', () => {
  const d = doc([it('a', 100, 100, 50, 50)]);
  const e = M.byId(M.resizeItem(d, 'a', 'e', 20, 0).doc, 'a');
  assert.deepEqual([e.x, e.y, e.w, e.h], [100, 100, 70, 50]);
  const w = M.byId(M.resizeItem(d, 'a', 'w', 20, 0).doc, 'a');
  assert.deepEqual([w.x, w.w], [120, 30], 'the right edge stays at 150');
});

test('resizeItem respects minSize and refuses locked items', () => {
  const d = doc([it('a', 100, 100, 50, 50), it('l', 0, 0, 10, 10, { locked: true })]);
  const tiny = M.byId(M.resizeItem(d, 'a', 'se', -500, -500).doc, 'a');
  assert.equal(tiny.w, 1);
  assert.equal(tiny.h, 1);
  const locked = M.resizeItem(d, 'l', 'se', 30, 30);
  assert.deepStrictEqual(locked.doc, d);
});

test('resizeItem with alt resizes from the centre', () => {
  const d = doc([it('a', 100, 100, 50, 50)]);
  const r = M.byId(M.resizeItem(d, 'a', 'e', 10, 0, { alt: true }).doc, 'a');
  assert.equal(r.w, 70);
  assert.equal(r.x, 90, 'centre stays at 125');
});

test('resizeItem with shift keeps the aspect ratio', () => {
  const d = doc([it('a', 100, 100, 100, 50)]);
  const corner = M.byId(M.resizeItem(d, 'a', 'se', 50, 0, { shift: true }).doc, 'a');
  assert.equal(corner.w, 150);
  assert.equal(corner.h, 75);
  const edge = M.byId(M.resizeItem(d, 'a', 'e', 50, 0, { shift: true }).doc, 'a');
  assert.equal(edge.w, 150);
  assert.equal(edge.h, 75);
});

test('resizeItem snaps a moving edge to a neighbour', () => {
  const d = doc([it('a', 100, 100, 50, 50), it('b', 300, 0, 100, 40)]);
  // right edge 150 + 47 = 197 snaps to 200 (b is at 300 — use a guide at 200 via a third item)
  const d2 = doc([it('a', 100, 100, 50, 50), it('c', 200, 300, 20, 20)]);
  const r = M.resizeItem(d2, 'a', 'e', 47, 0, { snap: { grid: { enabled: false }, threshold: 6 } });
  const a = M.byId(r.doc, 'a');
  assert.equal(a.x + a.w, 200);
  assert.ok(r.guides.some((g) => g.axis === 'x' && g.at === 200));
  void d;
});

// ---------------------------------------------------------------------------
// Align and distribute
// ---------------------------------------------------------------------------

const alignDoc = () => doc([
  it('A', 100, 100, 50, 40, { locked: true }), // anchor, stays put
  it('B', 300, 200, 20, 60),
  it('C', 500, 50, 80, 30),
]);

test('align left, center, right, top, middle, bottom against a locked anchor', () => {
  const d = alignDoc();
  const A = M.byId(d, 'A');
  const get = (r, id) => M.byId(r.doc, id);
  const check = (edge, fnB, fnC) => {
    const r = M.align(d, ['A', 'B', 'C'], edge, { anchor: 'A' });
    assert.deepEqual([get(r, 'A').x, get(r, 'A').y], [A.x, A.y], `${edge}: locked anchor stays`);
    fnB(get(r, 'B')); fnC(get(r, 'C'));
    assertRestores(d, r);
  };
  check('left', (b) => assert.equal(b.x, 100), (c) => assert.equal(c.x, 100));
  check('right', (b) => assert.equal(b.x, 150 - 20), (c) => assert.equal(c.x, 150 - 80));
  check('center', (b) => assert.equal(b.x, 125 - 10), (c) => assert.equal(c.x, 125 - 40));
  check('top', (b) => assert.equal(b.y, 100), (c) => assert.equal(c.y, 100));
  check('bottom', (b) => assert.equal(b.y, 140 - 60), (c) => assert.equal(c.y, 140 - 30));
  check('middle', (b) => assert.equal(b.y, 120 - 30), (c) => assert.equal(c.y, 120 - 15));
});

test('align without an anchor uses the selection bounds, and a locked item still stays', () => {
  const d = alignDoc();
  const r = M.align(d, ['A', 'B', 'C'], 'right');
  assert.equal(M.byId(r.doc, 'A').x, 100, 'locked item in the set does not move');
  assert.equal(M.byId(r.doc, 'B').x, 580 - 20);
  assert.equal(M.byId(r.doc, 'C').x, 580 - 80);
});

test('align a single item to the viewport', () => {
  const d = doc([it('a', 0, 0, 100, 100)]);
  assert.equal(M.byId(M.align(d, ['a'], 'center').doc, 'a').x, 350);
});

test('distribute spaces the middle items with equal gaps', () => {
  const d = doc([it('a', 0, 0, 10, 10), it('b', 20, 0, 10, 10), it('c', 100, 0, 10, 10), it('d', 200, 0, 10, 10)]);
  const r = M.distribute(d, ['a', 'b', 'c', 'd'], 'horizontal');
  const s = ['a', 'b', 'c', 'd'].map((id) => M.byId(r.doc, id));
  assert.equal(s[0].x, 0, 'outer item fixed');
  assert.equal(s[3].x, 200, 'outer item fixed');
  const gaps = [1, 2, 3].map((i) => s[i].x - (s[i - 1].x + s[i - 1].w));
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 1e-9 && Math.abs(gaps[1] - gaps[2]) < 1e-9, `gaps ${gaps}`);
  assertRestores(d, r);
});

test('distribute vertically and keep a locked middle item in place', () => {
  const d = doc([it('a', 0, 0, 10, 10), it('b', 0, 15, 10, 10, { locked: true }), it('c', 0, 40, 10, 10), it('d', 0, 100, 10, 10)]);
  const r = M.distribute(d, ['a', 'b', 'c', 'd'], 'vertical');
  assert.equal(M.byId(r.doc, 'b').y, 15, 'locked stays');
  const c = M.byId(r.doc, 'c');
  const gapBC = c.y - (15 + 10);
  const gapCD = 100 - (c.y + 10);
  assert.ok(Math.abs(gapBC - gapCD) < 1e-9 && gapBC > 0, 'the run between locked b and d is evenly spaced');
  assertRestores(d, r);
});

test('distribute with fewer than three items changes nothing', () => {
  const d = doc([it('a', 0, 0, 10, 10), it('b', 50, 0, 10, 10)]);
  assert.deepStrictEqual(M.distribute(d, ['a', 'b'], 'horizontal').doc, d);
});

// ---------------------------------------------------------------------------
// Groups and z-order
// ---------------------------------------------------------------------------

test('group then ungroup round-trips the exact doc', () => {
  const d = doc([it('a', 0, 0, 10, 10), it('b', 20, 0, 10, 10), it('c', 40, 0, 10, 10)]);
  const g = M.group(d, ['a', 'b']);
  assert.equal(M.byId(g.doc, 'a').group, g.groupId);
  assert.equal(M.byId(g.doc, 'c').group, undefined);
  const u = M.ungroup(g.doc, ['a']);
  assert.deepStrictEqual(u.doc, d);
  assertRestores(g.doc, u);
  assertRestores(d, g);
});

test('expandSelection pulls in every member of a group', () => {
  const d = doc([it('a', 0, 0, 10, 10, { group: 'g1' }), it('b', 20, 0, 10, 10, { group: 'g1' }), it('c', 40, 0, 10, 10)]);
  assert.deepEqual(M.expandSelection(d, ['a']), ['a', 'b']);
  assert.deepEqual(M.expandSelection(d, ['c']), ['c']);
});

test('group needs two or more items', () => {
  const d = doc([it('a', 0, 0, 10, 10)]);
  assert.deepStrictEqual(M.group(d, ['a']).doc, d);
});

test('z-order: front, back, forward, backward keep the z set', () => {
  const d = doc([it('a', 0, 0, 1, 1, { z: 0 }), it('b', 0, 0, 1, 1, { z: 1 }), it('c', 0, 0, 1, 1, { z: 2 }), it('d', 0, 0, 1, 1, { z: 3 })]);
  const order = (r) => M.sortedByZ(r.doc).map((i) => i.id).join('');
  assert.equal(order(M.reorder(d, ['a'], 'front')), 'bcda');
  assert.equal(order(M.reorder(d, ['c'], 'back')), 'cabd');
  assert.equal(order(M.reorder(d, ['b'], 'forward')), 'acbd');
  assert.equal(order(M.reorder(d, ['c'], 'backward')), 'acbd');
  assert.equal(order(M.reorder(d, ['d'], 'forward')), 'abcd', 'already on top');
  const z = M.reorder(d, ['a'], 'front').doc.items.map((i) => i.z).sort();
  assert.deepEqual(z, [0, 1, 2, 3]);
  assertRestores(d, M.reorder(d, ['a'], 'front'));
});

test('stackMove places an item above or below a target', () => {
  const d = doc([it('a', 0, 0, 1, 1, { z: 0 }), it('b', 0, 0, 1, 1, { z: 1 }), it('c', 0, 0, 1, 1, { z: 2 })]);
  const order = (r) => M.sortedByZ(r.doc).map((i) => i.id).join('');
  assert.equal(order(M.stackMove(d, 'a', 'c', 'above')), 'bca');
  assert.equal(order(M.stackMove(d, 'c', 'a', 'below')), 'cab');
  assertRestores(d, M.stackMove(d, 'a', 'c', 'above'));
});

// ---------------------------------------------------------------------------
// Duplicate, delete, update
// ---------------------------------------------------------------------------

test('duplicate copies offset on top with new ids', () => {
  const d = doc([it('a', 0, 0, 10, 10, { z: 0 }), it('b', 20, 0, 10, 10, { z: 5 })]);
  const r = M.duplicate(d, ['a', 'b'], { dx: 10, dy: 10 });
  assert.deepEqual(r.ids, ['a-copy', 'b-copy']);
  const a = M.byId(r.doc, 'a-copy');
  assert.deepEqual([a.x, a.y], [10, 10]);
  assert.ok(a.z > 5, 'copies sit on top');
  assert.equal(M.byId(r.doc, 'a').x, 0, 'source unchanged');
  assertRestores(d, r);
});

test('duplicate remaps a fully copied group and drops a partial one', () => {
  const d = doc([it('a', 0, 0, 10, 10, { group: 'g1' }), it('b', 20, 0, 10, 10, { group: 'g1' }), it('c', 40, 0, 10, 10, { group: 'g2' }), it('e', 60, 0, 10, 10, { group: 'g2' })]);
  const r = M.duplicate(d, ['a', 'b', 'c'], { dx: 0, dy: 20 });
  const ga = M.byId(r.doc, 'a-copy').group, gb = M.byId(r.doc, 'b-copy').group;
  assert.equal(ga, gb);
  assert.notEqual(ga, 'g1');
  assert.equal(M.byId(r.doc, 'c-copy').group, undefined, 'partial group g2 is not copied as a group');
  assertRestores(d, r);
});

test('removeItems deletes the ids', () => {
  const d = doc([it('a', 0, 0, 1, 1), it('b', 0, 0, 1, 1)]);
  const r = M.removeItems(d, ['a']);
  assert.deepEqual(r.doc.items.map((i) => i.id), ['b']);
  assertRestores(d, r);
});

test('updateItems: locked geometry is refused, flags and data apply', () => {
  const d = doc([it('a', 0, 0, 10, 10, { locked: true }), it('b', 0, 0, 10, 10)]);
  const r = M.updateItems(d, ['a', 'b'], { x: 99, locked: false, data: { tint: 'red' } }, { label: 'Edit' });
  assert.equal(M.byId(r.doc, 'a').x, 0, 'locked geometry ignored');
  assert.equal(M.byId(r.doc, 'a').locked, false, 'flag applies');
  assert.equal(M.byId(r.doc, 'b').x, 99);
  assert.equal(M.byId(r.doc, 'b').data.tint, 'red');
  assert.throws(() => M.updateItems(d, ['a'], { nope: 1 }));
  assertRestores(d, r);
});

// ---------------------------------------------------------------------------
// Hit-test and marquee
// ---------------------------------------------------------------------------

test('hitTest returns the topmost visible item, skipping hidden ones', () => {
  const d = doc([it('low', 0, 0, 100, 100, { z: 0 }), it('high', 0, 0, 50, 50, { z: 2 }), it('gone', 0, 0, 100, 100, { z: 9, hidden: true })]);
  assert.equal(M.hitTest(d, { x: 10, y: 10 }), 'high');
  assert.equal(M.hitTest(d, { x: 70, y: 70 }), 'low');
  assert.equal(M.hitTest(d, { x: 500, y: 500 }), null);
});

test('hitTest hits locked items unless includeLocked is false, and scope drills into a group', () => {
  const d = doc([it('lock', 0, 0, 100, 100, { locked: true, z: 5 }), it('m', 200, 0, 50, 50, { group: 'g', z: 1 }), it('o', 200, 0, 50, 50, { z: 0 })]);
  assert.equal(M.hitTest(d, { x: 10, y: 10 }), 'lock');
  assert.equal(M.hitTest(d, { x: 10, y: 10 }, { includeLocked: false }), null);
  assert.equal(M.hitTest(d, { x: 210, y: 10 }), 'm');
  assert.equal(M.hitTest(d, { x: 210, y: 10 }, { scope: 'g' }), 'm');
  assert.equal(M.hitTest(d, { x: 10, y: 10 }, { scope: 'g' }), null);
});

test('marquee: intersect and contain, hidden skipped, locked selected', () => {
  const d = doc([
    it('inside', 10, 10, 20, 20),
    it('across', 90, 10, 40, 20),
    it('outside', 500, 500, 10, 10),
    it('locked', 15, 15, 5, 5, { locked: true }),
    it('hidden', 12, 12, 5, 5, { hidden: true }),
  ]);
  const rect = { x: 0, y: 0, w: 100, h: 40 };
  assert.deepEqual(M.marqueeHit(d, rect).sort(), ['across', 'inside', 'locked']);
  assert.deepEqual(M.marqueeHit(d, rect, { mode: 'contain' }).sort(), ['inside', 'locked']);
  assert.deepEqual(M.marqueeHit(d, { x: 100, y: 40, w: -100, h: -40 }).sort(), ['across', 'inside', 'locked'], 'negative size normalises');
});

// ---------------------------------------------------------------------------
// Exact undo/redo for every op
// ---------------------------------------------------------------------------

test('every mutating op restores the exact doc on undo and redo', () => {
  const base = doc([
    it('a', 0, 0, 40, 40, { z: 0, group: 'g' }),
    it('b', 60, 10, 40, 30, { z: 1, group: 'g' }),
    it('c', 150, 0, 20, 20, { z: 2 }),
    it('d', 200, 120, 30, 30, { z: 3, locked: true }),
  ]);
  const ops = [
    M.moveSelection(base, ['a', 'c'], 7, 3, { snap: { grid: GRID, threshold: 6 } }),
    M.nudge(base, ['a'], 'up', { large: true }),
    M.resizeItem(base, 'c', 'se', 13, 9, { shift: true, snap: { grid: GRID } }),
    M.resizeItem(base, 'c', 'w', 5, 0, { alt: true }),
    M.align(base, ['a', 'b', 'c'], 'middle'),
    M.distribute(base, ['a', 'b', 'c', 'd'], 'horizontal'),
    M.group(base, ['c', 'd']),
    M.ungroup(base, ['a']),
    M.reorder(base, ['a'], 'front'),
    M.reorder(base, ['c'], 'backward'),
    M.stackMove(base, 'a', 'd', 'above'),
    M.duplicate(base, ['a', 'c'], { dx: 4, dy: 4 }),
    M.removeItems(base, ['b']),
    M.updateItems(base, ['c'], { label: 'Renamed', data: { tone: 'warm' } }),
  ];
  for (const r of ops) assertRestores(base, r);
});

// The DOM view loads headless: nothing touches `document` until a canvas is created.
test('canvas view and panels import without a DOM', async () => {
  const kit = await import('../ui/kit/canvas.mjs');
  assert.equal(typeof kit.createCanvas, 'function');
  assert.equal(typeof kit.createLayersPanel, 'function');
  assert.equal(typeof kit.createInspector, 'function');
});
