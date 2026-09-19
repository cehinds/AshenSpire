// node --test ui-studio/tests/model.test.mjs — the pure half of UI Studio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../model.mjs';
import { readConfigTree } from '../../tools/config-build.mjs';
import { canvasSvg, rulerStep } from '../canvas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readConfig = (rel) => JSON.parse(readFileSync(resolve(ROOT, 'content/config', rel), 'utf8'));

test('default settings pass their own validator, and each refusal names its field', () => {
  assert.deepEqual(M.settingsProblems(M.DEFAULT_SETTINGS), []);
  const bad = M.mergeSettings(M.DEFAULT_SETTINGS, { grid: { sizePx: 0 } });
  bad.devices.push({ id: 'Bad Id', label: '', width: 10, height: 100 });
  bad.breakpoints.push({ id: 'narrow', minWidth: 900, maxWidth: 100 });
  bad.wireframes.push({ id: 'x', file: '../../etc/passwd' });
  const problems = M.settingsProblems(bad);
  for (const needle of ['grid.sizePx', 'devices[13].id', 'devices[13].width', 'devices[13].label', 'breakpoints[3].id "narrow" is used twice', 'breakpoints[3] has minWidth above maxWidth', 'wireframes[10].file']) {
    assert.ok(problems.some((p) => p.includes(needle)), `expected a problem naming ${needle}; got ${problems.join(' | ')}`);
  }
});

test('mergeSettings replaces arrays whole and merges objects deep', () => {
  const merged = M.mergeSettings(M.DEFAULT_SETTINGS, { grid: { sizePx: 16 }, devices: [{ id: 'one', label: 'One', width: 300, height: 300 }] });
  assert.equal(merged.grid.sizePx, 16);
  assert.equal(merged.grid.subdivisions, M.DEFAULT_SETTINGS.grid.subdivisions);
  assert.equal(merged.devices.length, 1);
  assert.equal(M.DEFAULT_SETTINGS.devices.length, 13, 'the defaults are not mutated');
});

test('viewportFor turns a phone and keeps the notch on the long side', () => {
  const phone = M.DEFAULT_DEVICES.find((d) => d.id === 'iphone-14');
  const portrait = M.viewportFor(phone, 'portrait');
  assert.deepEqual([portrait.width, portrait.height, portrait.safeArea.top, portrait.safeArea.bottom], [390, 844, 47, 34]);
  const landscape = M.viewportFor(phone, 'landscape');
  assert.deepEqual([landscape.width, landscape.height, landscape.safeArea.left, landscape.safeArea.right], [844, 390, 47, 47]);
  assert.equal(M.naturalOrientation(phone), 'portrait');
  assert.equal(M.naturalOrientation(M.DEFAULT_DEVICES[0]), 'landscape');
});

test('the game layout port answers what src/main.js documents', () => {
  const z = M.DEFAULT_SETTINGS.gameLayout;
  // main.js: "at 390x844 the narrow fit is 0.907 ... flooring" → 0.90; 1280x800 → 1.07 wide.
  assert.deepEqual([M.gameLayoutFor({ width: 390, height: 844 }, z).zoom, M.gameLayoutFor({ width: 390, height: 844 }, z).mode], [0.9, 'narrow']);
  assert.deepEqual([M.gameLayoutFor({ width: 1280, height: 800 }, z).zoom, M.gameLayoutFor({ width: 1280, height: 800 }, z).mode], [1.07, 'wide']);
  // 844x390: below gateBelowH, wide baseline fits at the narrow-fit zoom → short-wide (compact) composition.
  const turned = M.gameLayoutFor({ width: 844, height: 390 }, z);
  assert.equal(turned.mode, 'short-wide');
  assert.equal(turned.short, false);
  // 844x300: under shortWideMinH → short (the upright gate).
  assert.equal(M.gameLayoutFor({ width: 844, height: 300 }, z).short, true);
});

test('breakpointFor picks the first matching range', () => {
  const bps = M.DEFAULT_BREAKPOINTS;
  assert.equal(M.breakpointFor(bps, { width: 390, height: 844 }).id, 'narrow');
  assert.equal(M.breakpointFor(bps, { width: 600, height: 800 }).id, 'compact');
  assert.equal(M.breakpointFor(bps, { width: 1280, height: 800 }).id, 'wide');
  assert.equal(M.breakpointFor([{ id: 'tall', minHeight: 2000 }], { width: 390, height: 844 }), null);
});

test('snapping: grid step, guides win over the grid, threshold respected', () => {
  assert.equal(M.snapToStep(13, 4, Infinity), 12);
  assert.equal(M.snapToStep(13, 4, 0.5), 13);
  assert.deepEqual(M.snapToGuides(101, [100, 200], 6), { value: 100, guide: 100 });
  assert.deepEqual(M.snapToGuides(150, [100, 200], 6), { value: 150, guide: null });
  const grid = { snap: true, sizePx: 8, subdivisions: 2, thresholdPx: 6 };
  const moved = M.snapRect({ x: 97, y: 51, w: 100, h: 50 }, { grid, guidesX: [100], guidesY: [], mode: 'move' });
  assert.deepEqual(moved.rect, { x: 100, y: 52, w: 100, h: 50 });
  assert.deepEqual(moved.guides, [{ axis: 'x', at: 100 }]);
  const resized = M.snapRect({ x: 100, y: 100, w: 97, h: 50 }, { grid, guidesX: [200], guidesY: [], mode: 'e' });
  assert.deepEqual(resized.rect, { x: 100, y: 100, w: 100, h: 50 });
  const off = M.snapRect({ x: 97, y: 51, w: 100, h: 50 }, { grid: { ...grid, snap: false }, mode: 'move' });
  assert.deepEqual(off.rect, { x: 97, y: 51, w: 100, h: 50 });
});

test('viewport and box guides include edges, centres and the safe area', () => {
  const vp = { width: 400, height: 800, safeArea: { top: 40, bottom: 30, left: 0, right: 0 } };
  assert.deepEqual(M.viewportGuides(vp), { x: [0, 200, 400], y: [0, 400, 800, 40, 770] });
  assert.deepEqual(M.viewportGuides(vp, { safeArea: false }).y, [0, 400, 800]);
  assert.deepEqual(M.boxGuides([{ x: 10, y: 20, w: 100, h: 50 }]), { x: [10, 60, 110], y: [20, 45, 70] });
});

test('bands stay at 100 whichever edge moves, and never go negative', () => {
  const bands = { hud: 10, scene: 55, context: 30, footer: 5 };
  assert.deepEqual(M.moveBandEdge(bands, 0, 7.4, { step: 1 }), { hud: 17, scene: 48, context: 30, footer: 5 });
  assert.deepEqual(M.moveBandEdge(bands, 2, 40, { step: 1 }), { hud: 10, scene: 55, context: 35, footer: 0 });
  assert.deepEqual(M.moveBandEdge(bands, 2, -20, { step: 1, minPercent: 0 }), { hud: 10, scene: 55, context: 10, footer: 25 });
  assert.deepEqual(M.moveBandEdge(bands, 3, 10), bands, 'the last band has no lower edge');
  assert.deepEqual(M.setBand(bands, 'hud', 20), { hud: 20, scene: 45, context: 30, footer: 5 });
  assert.deepEqual(M.setBand(bands, 'footer', 15), { hud: 10, scene: 55, context: 20, footer: 15 });
  for (const b of [M.moveBandEdge(bands, 1, 99), M.setBand(bands, 'scene', 200)]) assert.equal(Object.values(b).reduce((a, v) => a + v, 0), 100);
  // A "$name" band is edited by hand: neither it nor the band that would take
  // its slack moves from a drag or a slider, and the rest still do.
  const referenced = { hud: '$hudShare', scene: 55, context: 30, footer: 5 };
  assert.deepEqual(M.moveBandEdge(referenced, 0, 5), referenced);
  assert.deepEqual(M.setBand(referenced, 'hud', 20), referenced);
  assert.deepEqual(M.setBand(referenced, 'scene', 60), { hud: '$hudShare', scene: 60, context: 25, footer: 5 }, 'scene pairs with context, both numbers');
  assert.equal(M.bandPartner(referenced, 'footer').id, 'context', 'the last band pairs with the previous one');
  assert.equal(M.bandPartner(referenced, 'hud').id, 'scene');
  assert.equal(M.bandPartner(referenced, 'nope'), null);
  assert.equal(M.bandPairEditable({ id: 'a', percent: 10 }, { id: 'b', percent: '$x' }), false);
  assert.equal(M.bandPairEditable({ id: 'a', percent: 10 }, null), false);
  assert.equal(M.bandPairEditable({ id: 'a', percent: 10 }, { id: 'b', percent: 20 }), true);
});

test('paths get, set and delete without touching the input', () => {
  const src = { sizing: { bands: { hud: 10 }, list: [1, 2] } };
  const next = M.setPath(src, 'sizing.bands.hud', 12);
  assert.equal(next.sizing.bands.hud, 12);
  assert.equal(src.sizing.bands.hud, 10);
  assert.equal(M.getPath(next, 'sizing.list.1'), 2);
  assert.deepEqual(M.setPath({}, 'a.b.0', 'x'), { a: { b: ['x'] } });
  assert.deepEqual(M.deletePath(src, 'sizing.list.0').sizing.list, [2]);
  assert.deepEqual(M.deletePath(src, 'sizing.bands').sizing, { list: [1, 2] });
});

test('leaf kinds, flattening and units', () => {
  assert.equal(M.leafKind('$targetPx'), 'ref');
  assert.equal(M.leafKind({ numerator: 5, denominator: 8 }), 'fraction');
  assert.equal(M.leafKind([0.9, 1]), 'list');
  assert.equal(M.leafKind([{ id: 'a' }]), 'array');
  const leaves = M.flattenConfig({ vars: { a: 1 }, sizing: { hand: { minimumHeightPx: 208, ratio: { numerator: 5, denominator: 8 } }, depth: [1, 2] }, layering: { layers: [{ id: 'x', z: 1 }] } });
  assert.deepEqual(leaves.map((l) => l.path), ['vars.a', 'sizing.hand.minimumHeightPx', 'sizing.hand.ratio', 'sizing.depth', 'layering.layers.0.id', 'layering.layers.0.z']);
  assert.equal(leaves[1].kind, 'number');
  assert.equal(M.unitOf('sizing.hand.minimumHeightPx'), 'px');
  assert.equal(M.unitOf('sizing.bands.hud'), 'percent');
  assert.equal(M.unitOf('positioning.hand.fanAngleDegrees'), 'degrees');
  assert.equal(M.unitOf('components.footer.actions'), '');
});

test('formatJson round-trips every content/config file byte for byte', () => {
  const entries = readConfigTree(resolve(ROOT, 'content'));
  assert.ok(entries.length > 30);
  for (const e of entries) {
    assert.equal(M.formatJson(JSON.parse(e.text), { original: e.text }), e.text.replace(/\r\n/g, '\n'), e.rel);
  }
});

test('formatJson changes only the edited line and keeps a changed object in its shape', () => {
  const text = readFileSync(resolve(ROOT, 'content/config/ui/scenes/w4a-combat.json'), 'utf8');
  const data = JSON.parse(text);
  const next = M.setPath(data, 'sizing.bands', M.moveBandEdge(data.sizing.bands, 0, 2));
  const out = M.formatJson(next, { original: text });
  const a = text.split('\n'), b = out.split('\n');
  assert.equal(a.length, b.length);
  assert.deepEqual(b.filter((l, i) => l !== a[i]), ['    "bands": { "hud": 12, "scene": 53, "context": 30, "footer": 5 },']);
  // A many-line object that changes stays many-line; a one-line one stays one-line.
  const map = readFileSync(resolve(ROOT, 'content/config/ui/scenes/w4b-map.json'), 'utf8');
  const edited = M.formatJson(M.setPath(JSON.parse(map), 'behavior.tray.slideMs', 260), { original: map });
  assert.match(edited, /"tray": \{\n\s+"openDelayMs": 150,\n\s+"slideMs": 260,/);
  // Without an original, the house rule: flat objects inline when they fit.
  assert.equal(M.formatJson({ a: { b: 1, c: [1, 2] }, d: [{ e: 1 }] }), '{\n  "a": { "b": 1, "c": [1, 2] },\n  "d": [\n    { "e": 1 }\n  ]\n}\n');
});

test('regionsFor draws the combat plan the game draws: physical minimums, the hand, and rails on a short host', () => {
  const w4a = readConfig('ui/scenes/w4a-combat.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars, card = readConfig('ui/components/card.json');
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4a');
  const configs = { 'ui/components/card.json': card };
  const regs = M.regionsFor(wf, w4a, { width: 1280, height: 800 }, { parent: w4, tokens, layoutMode: 'wide', zoom: 1.07, rootFontPx: 10, configs });
  const bands = regs.filter((r) => r.band);
  // hud 10% = 80; the footer's 5% (40) rises to the W4 56 px minimum; the hand keeps 30% (240 > 208); the field takes the rest.
  assert.deepEqual(bands.map((r) => [r.band, r.h]), [['hud', 80], ['scene', 800 - 80 - 240 - 56], ['context', 240], ['footer', 56]]);
  assert.equal(bands[0].edit.kind, 'bandEdge');
  assert.equal(bands[3].edit, null);
  assert.match(bands[3].note, /raised to the W4 minimum 56px/);
  const floor = regs.find((r) => r.id === 'floor');
  assert.equal(M.round(floor.y, 6), M.round(80 + bands[1].h * 0.8, 6));
  const hand = regs.find((r) => r.id === 'hand');
  assert.equal(M.round(hand.w, 6), M.round(75 * 10 * 1.07, 6), 'wide hand width is wideWidthRem × rootFontPx × zoom');
  const narrow = M.regionsFor(wf, w4a, { width: 390, height: 844 }, { parent: w4, tokens, layoutMode: 'narrow', zoom: 0.9, rootFontPx: 10, configs }).find((r) => r.id === 'hand');
  assert.equal(narrow.w, 22 * 10 * 0.9);
  // 844x390 at zoom 0.62: the stacked plan leaves 87 px of field under the 114 px one readable combatant needs,
  // so the footer folds into rails, the hand keeps its 208 px physical minimum and the field takes the rest.
  // combatPlan reads "$name" through the resolver regionsFor hands it; here the tokens stand in.
  const resolve = (v) => (typeof v === 'string' && v.startsWith('$') ? tokens[v.slice(1)] : v);
  const plan = M.combatPlan(w4a, w4, { width: 844, height: 390, zoom: 0.62, rem: 6.2, cardRatio: 5 / 7, resolve });
  assert.equal(plan.arrangement, 'rails');
  assert.deepEqual([plan.hud, plan.hand, plan.footer, plan.battlefield], [39, 208, 0, 390 - 39 - 208]);
  assert.equal(plan.supported, true);
  const short = M.regionsFor(wf, w4a, { width: 844, height: 390 }, { parent: w4, tokens, layoutMode: 'short-wide', zoom: 0.62, rootFontPx: 10, configs });
  assert.equal(short.find((r) => r.band === 'footer'), undefined, 'no footer band under rails');
  // Drawn with the allocator's floored rem (16 px, not 6.2): the battlefield keeps its 148 px floor and the hand gives up 5 px, as the game does.
  assert.equal(short.find((r) => r.band === 'context').h, 203);
  assert.equal(short.find((r) => r.band === 'scene').h, 148);
  assert.ok(short.some((r) => r.id === 'rail.left') && short.some((r) => r.id === 'rail.right'));
  assert.match(short.find((r) => r.band === 'scene').note, /rails/);
  // regionsFor measures combat with the rem floored at 16 physical px, as the
  // live allocator does (Math.max(16 / zoom, rootFontPx) local px): at 780x360
  // (zoom 0.62, root rem 6.2 px) the battlefield keeps its 148 px floor where
  // the unfloored rem would leave 116 px.
  assert.equal(M.combatRem(6.2), 16); assert.equal(M.combatRem(17), 17);
  const floored = M.combatPlan(w4a, w4, { width: 780, height: 360, zoom: 0.62, rem: M.combatRem(6.2), resolve });
  assert.deepEqual([floored.battlefield, floored.hand], [148, 176]);
  const drawn = M.regionsFor(wf, w4a, { width: 780, height: 360 }, { parent: w4, tokens, layoutMode: 'short-wide', zoom: 0.62, rootFontPx: 10, configs });
  assert.equal(drawn.find((r) => r.band === 'scene').h, 148);
  assert.equal(drawn.find((r) => r.band === 'context').h, 176);
  // A draft that is not an object (raw JSON `null`) draws nothing rather than throwing.
  assert.doesNotThrow(() => M.combatPlan(null, w4, { width: 780, height: 360, resolve }));
  assert.doesNotThrow(() => M.regionsFor(wf, null, { width: 780, height: 360 }, { parent: w4, tokens, configs }));
  // With rails switched off in behavior, the stacked plan stands and is reported unsupported.
  const noRails = M.combatPlan({ ...w4a, behavior: { ...w4a.behavior, shortHostRails: false } }, w4, { width: 844, height: 390, zoom: 0.62, rem: 6.2, resolve });
  assert.deepEqual([noRails.arrangement, noRails.supported], ['stacked', false]);
});

test('regionsFor draws every catalogued wireframe without throwing', () => {
  const tokens = readConfig('ui/tokens.json').vars;
  for (const wf of M.DEFAULT_WIREFRAMES) {
    const data = readConfig(wf.file);
    const parent = wf.parent ? readConfig(wf.parent) : null;
    for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      const regs = M.regionsFor(wf, data, vp, { parent, tokens, layoutMode: vp.width < 520 ? 'narrow' : 'wide' });
      assert.ok(regs.length >= 1, wf.id);
      for (const r of regs) assert.ok(Number.isFinite(r.x + r.y + r.w + r.h), `${wf.id} ${r.id} has finite geometry`);
    }
  }
});

test('applyRegionDrag moves a band edge by the snapped percent and edits path values by unit', () => {
  const w4a = readConfig('ui/scenes/w4a-combat.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4a');
  const vp = { width: 1280, height: 800 };
  const regs = M.regionsFor(wf, w4a, vp, { parent: w4, tokens });
  const hud = regs.find((r) => r.band === 'hud');
  const next = M.applyRegionDrag(w4a, hud, 40, vp, { grid: { bandStepPercent: 1 }, regions: regs });
  assert.deepEqual(next.sizing.bands, { hud: 15, scene: 50, context: 30, footer: 5 });
  const floor = regs.find((r) => r.id === 'floor');
  assert.equal(M.applyRegionDrag(w4a, floor, 44, vp, { grid: { bandStepPercent: 1 }, regions: regs }).sizing.floorPercent, 90);
  // A $ref is never dragged over.
  const map = readConfig('ui/scenes/w4b-map.json');
  const mapWf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4b');
  const header = M.regionsFor(mapWf, map, vp, { tokens }).find((r) => r.id === 'header');
  assert.equal(M.applyRegionDrag(map, header, 80, vp, { grid: { bandStepPercent: 1 } }).sizing.header.heightFraction, 0.2);
  const shop = readConfig('ui/screens/shop.json');
  const shopWf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w1-shop');
  const rail = M.regionsFor(shopWf, shop, vp, { tokens }).find((r) => r.id === 'rail');
  assert.equal(M.applyRegionDrag(shop, rail, 128, vp, { grid: { bandStepPercent: 1 } }).sizing.railFraction, M.round(shop.sizing.railFraction.numerator / shop.sizing.railFraction.denominator + 0.1, 3) === 0.327 ? shop.sizing.railFraction : shop.sizing.railFraction, 'a fraction value is left for the inspector');
});

test('sketches validate, resolve overrides, convert units, align and reorder', () => {
  const s = M.newSketch({ name: 'Test' });
  assert.deepEqual(M.sketchProblems(s), []);
  const box = M.newBox({ x: 10, y: 10, w: 30, h: 20, label: 'A' });
  s.boxes.push(box, M.newBox({ x: 50, y: 50, w: 20, h: 20, label: 'B' }));
  assert.deepEqual(M.sketchProblems(s), []);
  const bad = M.clone(s); bad.boxes[0].w = 0; bad.boxes[1].id = bad.boxes[0].id; bad.boxes[0].overrides = { nope: {} };
  const problems = M.sketchProblems(bad);
  assert.ok(problems.some((p) => p.includes('positive width')) && problems.some((p) => p.includes('used twice')) && problems.some((p) => p.includes('"nope"')), problems.join(' | '));
  assert.ok(M.sketchProblems({ schema: 'other' }).length);
  const vp = { width: 1000, height: 500 };
  const overridden = M.updateBoxGeometry(s, box.id, { x: 0, w: 100 }, { breakpointId: 'narrow', scope: 'breakpoint' });
  assert.deepEqual([M.resolveBox(overridden.boxes[0], 'narrow').x, M.resolveBox(overridden.boxes[0], 'narrow').w, M.resolveBox(overridden.boxes[0], 'narrow').overridden], [0, 100, true]);
  assert.deepEqual([M.resolveBox(overridden.boxes[0], 'wide').x, M.resolveBox(overridden.boxes[0], 'wide').overridden], [10, false]);
  assert.equal(M.resolveBox(M.clearOverride(overridden, box.id, 'narrow').boxes[0], 'narrow').overridden, false);
  assert.deepEqual(M.boxToPx(box, 'percent', vp), { x: 100, y: 50, w: 300, h: 100 });
  assert.deepEqual(M.pxToBox({ x: 100, y: 50, w: 300, h: 100 }, 'percent', vp), { x: 10, y: 10, w: 30, h: 20 });
  assert.deepEqual(M.pxToBox({ x: 1.4, y: 2.6, w: 3, h: 4 }, 'px', vp), { x: 1, y: 3, w: 3, h: 4 });
  const right = M.alignBoxes(s, [box.id], 'right', vp);
  assert.equal(right.boxes[0].x, 70);
  const both = M.alignBoxes(s, s.boxes.map((b) => b.id), 'left', vp);
  assert.deepEqual(both.boxes.map((b) => b.x), [10, 10]);
  // A locked box anchors an alignment and stays put, as it does under a drag or a nudge.
  const lockedSecond = { ...s, boxes: [s.boxes[0], { ...s.boxes[1], locked: true }] };
  const anchored = M.alignBoxes(lockedSecond, lockedSecond.boxes.map((b) => b.id), 'right', vp);
  assert.equal(anchored.boxes[1].x, s.boxes[1].x, 'the locked box did not move');
  assert.equal(anchored.boxes[0].x + anchored.boxes[0].w, Math.max(s.boxes[0].x + s.boxes[0].w, s.boxes[1].x + s.boxes[1].w), 'the other aligned to the shared right edge');
  assert.deepEqual(M.reorderBox(s, box.id, Infinity).boxes.map((b) => b.label), ['B', 'A']);
  assert.deepEqual(M.reorderBox(s, s.boxes[1].id, -1).boxes.map((b) => b.label), ['B', 'A']);
});

test('History records distinct states only and replays undo/redo', () => {
  const h = new M.History({ a: 1 });
  assert.equal(h.canUndo, false);
  h.push({ a: 1 });
  assert.equal(h.canUndo, false, 'an equal state is not a step');
  h.push({ a: 2 }); h.push({ a: 3 });
  assert.deepEqual(h.undo(), { a: 2 });
  assert.deepEqual(h.undo(), { a: 1 });
  assert.deepEqual(h.undo(), { a: 1 });
  assert.deepEqual(h.redo(), { a: 2 });
  h.push({ a: 9 });
  assert.equal(h.canRedo, false, 'a new step clears the redo stack');
  h.replace({ a: 10 });
  assert.deepEqual(h.present, { a: 10 });
  assert.deepEqual(h.undo(), { a: 2 }, 'replace leaves no step of its own');
});

test('canvasSvg writes hit targets for bands, edges, boxes and grips, and escapes labels', () => {
  const w4a = readConfig('ui/scenes/w4a-combat.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4a');
  const vp = { width: 1280, height: 800, safeArea: { top: 0, bottom: 0 } };
  const regs = M.regionsFor(wf, w4a, vp, { tokens });
  const svg = canvasSvg({ viewport: vp, scale: 0.5, grid: M.DEFAULT_SETTINGS.grid, canvas: {}, regions: regs, boxes: [{ id: 'b<1>', label: '<b>&', x: 10, y: 10, w: 100, h: 50 }], selection: new Set(['b<1>']) });
  assert.match(svg, /data-hit="bandEdge:0:band.hud"/);
  assert.match(svg, /data-hit="edge:floor:h"/);
  assert.match(svg, /data-hit="box:b&lt;1&gt;"/);
  assert.match(svg, /data-hit="grip:b&lt;1&gt;:se"/);
  assert.match(svg, /&lt;b&gt;&amp;/);
  assert.doesNotMatch(svg, /<b>&/);
  // Handles come after every region, so a later band's fill cannot cover an earlier edge.
  assert.ok(svg.lastIndexOf('data-hit="region:band.footer"') < svg.indexOf('data-hit="bandEdge:0:band.hud"'));
  assert.match(svg, /data-ruler="20" data-scale="0.5"/);
  const thumb = canvasSvg({ viewport: vp, scale: 0.1, grid: M.DEFAULT_SETTINGS.grid, canvas: {}, regions: regs, compact: true });
  assert.doesNotMatch(thumb, /data-hit="bandEdge/);
  assert.match(thumb, /data-ruler="0"/);
  assert.equal(rulerStep(0.5), 20);
  assert.equal(rulerStep(2), 5);
});

test('a file variable shadows a token, as the compiler resolves it', () => {
  const w4c = readConfig('ui/scenes/w4c-dialogue.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4c');
  const shadowed = { ...w4c, vars: { ...w4c.vars, gutterVw: 10 } };
  const vp = { width: 1000, height: 800 };
  const inset = (data) => M.regionsFor(wf, data, vp, { parent: w4, tokens }).find((r) => r.id === 'portrait.player').x;
  assert.equal(inset(w4c), tokens.gutterVw * 10);
  assert.equal(inset(shadowed), 100);
});

test('the dialogue folds its bands on a short OR narrow host and its slot on a narrow one, as DialogueModel does', () => {
  const w4c = readConfig('ui/scenes/w4c-dialogue.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4c');
  const at = (width, height) => {
    const regs = M.regionsFor(wf, w4c, { width, height }, { parent: w4, tokens, layoutMode: 'wide' });
    return { hud: regs.find((r) => r.band === 'hud').percent, slot: regs.find((r) => r.id === 'portrait.player').edit.path, bands: regs.find((r) => r.band === 'hud').edit.path };
  };
  assert.deepEqual(at(1280, 800), { hud: 10, slot: 'sizing.portraitSlot.widthVw', bands: 'sizing.bands' });
  // 600 wide is below the parent's 768: compact bands and the compact slot, whatever the game's zoom mode says.
  assert.deepEqual(at(600, 800), { hud: 12, slot: 'sizing.portraitSlot.compactWidthVw', bands: 'sizing.bandsCompact' });
  // 844x390 is short (below hud.compactBelowHeightPx 500) but not narrow: compact bands, wide slot.
  assert.deepEqual(at(844, 390), { hud: 12, slot: 'sizing.portraitSlot.widthVw', bands: 'sizing.bandsCompact' });
});

test('the shop stacks below wideMinRem with the rail on top, as ShopWorkspaceModel does', () => {
  const shop = readConfig('ui/screens/shop.json'), tokens = readConfig('ui/tokens.json').vars, nav = readConfig('ui/components/categoryNav.json');
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w1-shop');
  const configs = { 'ui/components/categoryNav.json': nav };
  // 1280x800: the game zooms 1.07, so one rem is 10.7 physical px.
  const rem = 10 * 1.07;
  const wide = M.regionsFor(wf, shop, { width: 1280, height: 800 }, { tokens, zoom: 1.07, rootFontPx: 10, configs });
  const rail = wide.find((r) => r.id === 'rail');
  assert.equal(rail.w, Math.round(Math.min(Math.max(1280 * 21.6 / 95, 11 * rem), 28 * rem)));
  assert.equal(rail.h, 800);
  const offers = wide.find((r) => r.id === 'offers'), detail = wide.find((r) => r.id === 'detail');
  assert.equal(offers.w, detail.w, 'offersFraction 0.5 splits the rest evenly');
  // 390x844 at zoom 0.9: 60rem is 540 physical px, so the rail spans the top, the panes stack, the detail takes at most half the height.
  const phone = M.regionsFor(wf, shop, { width: 390, height: 844 }, { tokens, zoom: 0.9, rootFontPx: 10, configs });
  const top = phone.find((r) => r.id === 'rail');
  assert.deepEqual([top.x, top.y, top.w], [0, 0, 390]);
  const stacked = phone.find((r) => r.id === 'detail');
  assert.equal(stacked.w, 390);
  assert.equal(stacked.h, Math.floor((844 - (44 + 2 * 0.6 * 9) - 9) * 0.5), 'the top row is the selector: one tap target plus its margins');
  assert.equal(stacked.y + stacked.h, 844);
  // 844x390 at zoom 0.62 is wide by width (372 px is 60rem) but seven 44 px items plus gaps and insets
  // (348 px) do not fit 70% of 390 (273): the category rail folds into a selector row above the columns.
  const short = M.regionsFor(wf, shop, { width: 844, height: 390 }, { tokens, zoom: 0.62, rootFontPx: 10, configs, screens: { shopCategoryCount: 7, railItemMinPx: 44 } });
  assert.equal(short.find((r) => r.id === 'rail'), undefined);
  const row = short.find((r) => r.id === 'selector');
  assert.deepEqual([row.x, row.y, row.w], [0, 0, 844]);
  assert.equal(row.h, 44 + 2 * 0.6 * 6.2, 'the selector row is one physical tap target plus its 0.6rem margins');
  assert.equal(short.find((r) => r.id === 'offers').y, row.h);
  const fit = M.categoryRailFits(nav, { width: 844, height: 390, rem: 6.2, count: 7, itemMinPx: 44 });
  assert.deepEqual([fit.fitsWidth, fit.fitsHeight, fit.fits], [true, false, false]);
});

test('a centred region moves its value twice the drag; a bottom-anchored one the other way', () => {
  const w4c = readConfig('ui/scenes/w4c-dialogue.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4c');
  const vp = { width: 1280, height: 800 };
  const regs = M.regionsFor(wf, w4c, vp, { parent: w4, tokens });
  const ctx = regs.find((r) => r.id === 'context.text');
  assert.equal(M.applyRegionDrag(w4c, ctx, -64, vp, { grid: { bandStepPercent: 1 }, regions: regs }).sizing.context.widthVw, 85, '64 px of 1280 is 5vw, on both sides');
  const authored = readConfig('ui/components/choiceBody.json');
  const cwf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w1-choice');
  const aregs = M.regionsFor(cwf, authored, vp, { tokens });
  assert.equal(M.applyRegionDrag(authored, aregs.find((r) => r.id === 'footer'), -40, vp, { grid: { bandStepPercent: 1 }, regions: aregs }), authored, 'a $ref is never dragged over');
  const choice = { ...authored, sizing: { ...authored.sizing, footerMinVh: 10 } };
  const cregs = M.regionsFor(cwf, choice, vp, { tokens });
  const footer = cregs.find((r) => r.id === 'footer');
  assert.equal(M.applyRegionDrag(choice, footer, -40, vp, { grid: { bandStepPercent: 1 }, regions: cregs }).sizing.footerMinVh, 15, 'dragging the footer\'s top edge up by 5vh grows it');
});

test('an edge already on a guide is a hit, and settings and sketches refuse the shapes the app cannot survive', () => {
  const grid = { snap: true, sizePx: 8, subdivisions: 2, thresholdPx: 6 };
  const onGuide = M.snapRect({ x: 100, y: 50, w: 97, h: 50 }, { grid, guidesX: [100, 200], guidesY: [], mode: 'move' });
  assert.equal(onGuide.rect.x, 100);
  assert.deepEqual(onGuide.guides, [{ axis: 'x', at: 100 }]);
  assert.ok(M.settingsProblems({ ...M.DEFAULT_SETTINGS, wireframes: [] }).some((p) => p.includes('wireframes must be a non-empty array')));
  const s = M.newSketch(); s.boxes.push({ ...M.newBox(), id: 'a:b' });
  assert.ok(M.sketchProblems(s).some((p) => p.includes('may not contain ":"')));
});

test('the Armoury stacks at or below its own breakpoint, whatever the game zoom mode says', () => {
  const armoury = readConfig('ui/screens/armoury.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w1-armoury');
  const at = (width) => M.regionsFor(wf, armoury, { width, height: 800 }, { tokens, layoutMode: 'wide', screens: { armouryBreakpointPx: 760 } }).find((r) => r.id === 'collection');
  assert.equal(at(600).edit.path, 'sizing.compactCollectionShare');
  assert.equal(at(600).w, 600, 'stacked: the collection spans the width');
  assert.equal(at(760).edit.path, 'sizing.compactCollectionShare', 'at the breakpoint is phone (<=)');
  assert.equal(at(761).edit.path, 'sizing.collectionShare');
  assert.equal(at(761).h, 800, 'columns: the collection spans the height');
});

test('applyResolvedRect moves the base by the change and leaves an override\'s own coordinates alone', () => {
  const vp = { width: 1000, height: 500 };
  const s = M.newSketch();
  const box = M.newBox({ x: 10, y: 10, w: 30, h: 20 });
  box.overrides = { narrow: { w: 50 } };
  s.boxes.push(box);
  // Shown at narrow: x10 y10 w50 h20 → moved 10% right in base scope.
  const shown = M.boxToPx(M.resolveBox(box, 'narrow'), 'percent', vp);
  const moved = M.applyResolvedRect(s, box.id, { ...shown, x: shown.x + 100 }, vp, { breakpointId: 'narrow', scope: 'base' });
  assert.deepEqual([moved.boxes[0].x, moved.boxes[0].w, moved.boxes[0].overrides.narrow.w], [20, 30, 50], 'base x moved; base w and the override untouched');
  // The same drag in breakpoint scope lands whole in the override.
  const over = M.applyResolvedRect(s, box.id, { ...shown, x: shown.x + 100 }, vp, { breakpointId: 'narrow', scope: 'breakpoint' });
  assert.deepEqual([over.boxes[0].x, over.boxes[0].overrides.narrow], [10, { x: 20, y: 10, w: 50, h: 20 }]);
  // alignBoxes goes the same way: aligning right at narrow keeps the base width.
  const right = M.alignBoxes(s, [box.id], 'right', vp, { breakpointId: 'narrow', scope: 'base' });
  assert.deepEqual([right.boxes[0].x, right.boxes[0].w], [10 + (50 - 50) + (100 - 50 - 10), 30]);
});

test('the Smith folds its candidate rail into a selector row under the category rail minimum host width', () => {
  const smith = readConfig('ui/screens/smith.json'), nav = readConfig('ui/components/categoryNav.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w1-smith');
  assert.equal(wf.parent, 'ui/components/categoryNav.json');
  const at = (width, height) => { const z = M.gameLayoutFor({ width, height }, M.DEFAULT_SETTINGS.gameLayout).zoom; return M.regionsFor(wf, smith, { width, height }, { parent: nav, tokens, zoom: z, rootFontPx: 10 }); };
  const wide = at(1280, 800);
  const rem = 10 * 1.07;
  assert.equal(wide.find((r) => r.id === 'candidates').w, Math.min(Math.max(1280 * 0.44, 14 * rem), 60 * rem));
  // A phone at zoom 0.9 sees a 433 px local host against the 600 px (60rem) rail minimum: the selector row.
  const phone = at(390, 844);
  assert.equal(phone.find((r) => r.id === 'candidates'), undefined);
  const row = phone.find((r) => r.id === 'selector');
  assert.deepEqual([row.x, row.y, row.w, row.h], [0, 0, 390, 44 + 2 * 0.6 * 9]);
  assert.equal(phone.find((r) => r.id === 'detail').y, 44 + 2 * 0.6 * 9);
  // An iPad at 768x1024 zooms to 0.64: a 1200 px local host keeps the rail, as the live categoryNav does.
  assert.equal(M.gameLayoutFor({ width: 768, height: 1024 }, M.DEFAULT_SETTINGS.gameLayout).zoom, 0.64);
  assert.ok(at(768, 1024).some((r) => r.id === 'candidates'));
  // 844x390 at 0.62 is wide enough (372 px) but six 44 px items do not fit 70% of 390: the height rule folds the rail.
  const short = M.regionsFor(wf, smith, { width: 844, height: 390 }, { parent: nav, tokens, zoom: 0.62, rootFontPx: 10, screens: { smithCandidateCount: 6, railItemMinPx: 44 } });
  assert.ok(short.some((r) => r.id === 'selector'));
  assert.match(short.find((r) => r.id === 'selector').label, /items need/);
});

test('sketchProblems refuses a breakpoint that is not an object, unnamed, duplicated or non-numeric', () => {
  const s = M.newSketch();
  s.breakpoints = [null, { label: 'x' }, { id: 'narrow', maxWidth: '520' }, { id: 'narrow' }];
  const problems = M.sketchProblems(s);
  for (const needle of ['breakpoints[0] must be an object', 'breakpoints[1].id is required', 'breakpoints[2].maxWidth must be a number', 'breakpoints[3].id "narrow" is used twice']) {
    assert.ok(problems.some((p) => p.includes(needle)), `${needle} in ${problems.join(' | ')}`);
  }
  assert.deepEqual(M.sketchProblems(M.newSketch()), []);
});

test('sketchProblems refuses an override that is not an object or carries non-finite or non-positive geometry', () => {
  const s = M.newSketch();
  const box = M.newBox(); box.overrides = { narrow: { x: 'oops', w: -5 }, wide: 7, compact: { h: 0, hidden: 'yes' } };
  s.boxes.push(box);
  const problems = M.sketchProblems(s);
  for (const needle of ['overrides.narrow.x must be a finite number', 'overrides.narrow.w must be positive', 'overrides.wide must be an object', 'overrides.compact.h must be positive', 'overrides.compact.hidden must be true or false']) {
    assert.ok(problems.some((p) => p.includes(needle)), `${needle} in ${problems.join(' | ')}`);
  }
  box.overrides = { narrow: { x: 0, w: 100, hidden: true } };
  assert.deepEqual(M.sketchProblems(s), []);
});

test('variables resolve through variables and inside fractions, as the compiler does; a cycle falls back', () => {
  const card = readConfig('ui/components/card.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'card');
  const vp = { width: 1280, height: 2000 }; // tall enough that the 90% height cap never clips the card
  const ratioOf = (data) => { const r = M.regionsFor(wf, data, vp, { tokens }).find((x) => x.id === 'card'); return r.h / r.w; };
  assert.equal(M.round(ratioOf(card), 4), M.round(7 / 5, 4));
  const viaToken = { ...card, sizing: { ...card.sizing, ratio: { numerator: '$targetRem', denominator: 7 } } };
  assert.equal(M.round(ratioOf(viaToken), 4), M.round(7 / tokens.targetRem, 4), 'a fraction operand may be a reference');
  const viaAlias = { ...card, vars: { alias: '$targetRem' }, sizing: { ...card.sizing, ratio: { numerator: '$alias', denominator: 7 } } };
  assert.equal(M.round(ratioOf(viaAlias), 4), M.round(7 / tokens.targetRem, 4), 'a local variable may alias a token');
  const cyclic = { ...card, vars: { a: '$b', b: '$a' }, sizing: { ...card.sizing, ratio: '$a' } };
  const r = M.regionsFor(wf, cyclic, vp, { tokens }).find((x) => x.id === 'card');
  assert.ok(Number.isFinite(r.w) && Number.isFinite(r.h), 'a cycle draws the fallback, never NaN');
});

test('settings refuse a hollowed group and a stored null cannot replace one', () => {
  assert.ok(M.settingsProblems({ ...M.DEFAULT_SETTINGS, canvas: null }).some((p) => p === 'canvas must be an object'));
  // A breakpoint bound that is present must be a finite number, as a sketch's must: "oops" would make breakpointFor skip the check and match everything.
  assert.ok(M.settingsProblems({ ...M.DEFAULT_SETTINGS, breakpoints: [{ id: 'a', minWidth: 'oops' }] }).some((p) => p === 'breakpoints[0].minWidth must be a number'));
  assert.ok(M.settingsProblems({ ...M.DEFAULT_SETTINGS, breakpoints: [{ id: 'a', maxHeight: NaN }] }).some((p) => p === 'breakpoints[0].maxHeight must be a number'));
  assert.ok(M.settingsProblems({ ...M.DEFAULT_SETTINGS, breakpoints: [{ id: 'a', minHeight: 700, maxHeight: 400 }] }).some((p) => p.includes('minHeight above maxHeight')));
  assert.deepEqual(M.settingsProblems({ ...M.DEFAULT_SETTINGS, breakpoints: [{ id: 'a', minWidth: 0, maxHeight: 900 }] }), []);
  assert.ok(M.settingsProblems(M.mergeSettings(M.DEFAULT_SETTINGS, { gameLayout: { rootFontPx: 0 } })).some((p) => p.includes('gameLayout.rootFontPx')));
  const merged = M.mergeSettings(M.DEFAULT_SETTINGS, { canvas: null, grid: 7 });
  assert.deepEqual(merged.canvas, M.DEFAULT_SETTINGS.canvas);
  assert.deepEqual(merged.grid, M.DEFAULT_SETTINGS.grid);
  assert.deepEqual(M.settingsProblems(merged), []);
});

test('a key with a dot in it survives the path round trip', () => {
  const data = { motion: { entrance: { holdDurations: { '0.3s': 300, plain: 1 } } } };
  const leaves = M.flattenConfig(data);
  const dotted = leaves.find((l) => l.value === 300);
  assert.equal(dotted.path, 'motion.entrance.holdDurations.0\\.3s');
  assert.deepEqual(M.splitPath(dotted.path), ['motion', 'entrance', 'holdDurations', '0.3s']);
  assert.equal(M.getPath(data, dotted.path), 300);
  const next = M.setPath(data, dotted.path, 400);
  assert.deepEqual(next.motion.entrance.holdDurations, { '0.3s': 400, plain: 1 }, 'the dotted key is written, not split');
  assert.equal(M.unitOf(dotted.path), '');
  assert.deepEqual(M.splitPath(['a', 'b.c']), ['a', 'b.c'], 'an array path is taken as given');
});

test('a band that reads a variable is drawn from the resolved number and not dragged', () => {
  const w4c = readConfig('ui/scenes/w4c-dialogue.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4c');
  const viaVar = { ...w4c, vars: { ...w4c.vars, hudShare: 10 }, sizing: { ...w4c.sizing, bands: { ...w4c.sizing.bands, hud: '$hudShare' } } };
  const vp = { width: 1280, height: 800 };
  const regs = M.regionsFor(wf, viaVar, vp, { parent: w4, tokens });
  const hud = regs.find((r) => r.band === 'hud');
  assert.equal(hud.h, 80);
  assert.equal(hud.percent, '$hudShare', 'the authored value stays on the region');
  assert.match(hud.label, /\$hudShare = 10%/);
  for (const r of regs) assert.ok(Number.isFinite(r.y + r.h), `${r.id} has finite geometry`);
  assert.deepEqual(M.applyRegionDrag(viaVar, hud, 40, vp, { grid: { bandStepPercent: 1 }, regions: regs }), viaVar, 'a "$name" band is edited by hand, never dragged over');
});

test('settingsProblems names a device that is not an object instead of throwing', () => {
  const problems = M.settingsProblems({ ...M.DEFAULT_SETTINGS, devices: [null, 7] });
  assert.deepEqual(problems.filter((p) => p.startsWith('devices[')), ['devices[0] must be an object', 'devices[1] must be an object']);
});

test('the dialogue footer keeps the W4 physical minimum and the scene gives up the difference', () => {
  const w4c = readConfig('ui/scenes/w4c-dialogue.json'), w4 = readConfig('ui/scenes/w4.json'), tokens = readConfig('ui/tokens.json').vars;
  const wf = M.DEFAULT_WIREFRAMES.find((w) => w.id === 'w4c');
  // Galaxy S23 landscape, 780x360: short, so the compact split (hud 12, scene 40, context 33, footer 15);
  // 15% of 360 is 54, under the 56 px footer minimum, so the footer is 56 and the scene 144 - 2.
  const regs = M.regionsFor(wf, w4c, { width: 780, height: 360 }, { parent: w4, tokens });
  const band = (id) => regs.find((r) => r.band === id);
  assert.equal(band('footer').h, 56);
  assert.equal(band('scene').h, 360 * 0.4 - 2);
  assert.match(band('footer').note, /raised to the W4 minimum 56px; the scene gives up 2px/);
  assert.equal(band('hud').h + band('scene').h + band('context').h + band('footer').h, 360);
  // At 1280x800 nothing is raised and the bands are their shares.
  const wide = M.regionsFor(wf, w4c, { width: 1280, height: 800 }, { parent: w4, tokens });
  assert.deepEqual(wide.filter((r) => r.band).map((r) => r.h), [80, 320, 280, 120]);
  assert.equal(wide.find((r) => r.band === 'footer').note, undefined);
  const plan = M.sceneBandsPlan({ hud: 10, scene: 40, context: 35, footer: 15 }, 300, { footerMinPx: 56 });
  assert.deepEqual([plan.hud, plan.context, plan.footer, plan.scene, plan.footerRaised], [30, 105, 56, 109, true]);
});
