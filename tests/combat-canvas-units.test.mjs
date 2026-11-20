// The combat stage measures in scaled real px under the combat canvas, but every authored px in its models is a
// canvas px (owner, 2026-11-14: "each should have it's own configuration that's relative"). These pin the unit
// plumbing: planning in canvas px and scaling the plan by the fit equals the canvas plan scaled, and the authored
// margins follow `unit`, so two windows of one form factor get the same layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeFormation, ScaleFormationPlan } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { separateRow } from '../src/ui/models/CombatViewportSizeModel.js';

const planAt = (width, height) => alternativeFormation(combatFormation({ width, height,
  presentation: { perspectiveGrid: true, formationPreset: 'straight' }, friends: ['p'], enemies: ['a', 'b', 'c'] }),
  width, height, false, { formFactor: 'tablet' });
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);

test('ScaleFormationPlan scales every length and leaves fractions alone', () => {
  const canvas = planAt(1180, 424), k = 844 / 1180 * 0.665;
  const scaled = ScaleFormationPlan(planAt(1180, 424), k);
  near(scaled.ground, canvas.ground * k, 'ground');
  near(scaled.rowSpacing ?? 0, (canvas.rowSpacing ?? 0) * k, 'rowSpacing');
  canvas.cells.forEach((cell, i) => {
    const out = scaled.cells[i];
    for (const key of ['x', 'ground', 'width', 'artWidth', 'miniHudLeft', 'miniHudWidth', 'miniHudTop']) near(out[key], cell[key] * k, `cell ${i} ${key}`);
    for (const key of ['left', 'top', 'width', 'height']) near(out.box[key], cell.box[key] * k, `cell ${i} box.${key}`);
    assert.equal(out.box.skew, cell.box.skew, 'skew is a fraction');
    assert.equal(out.lane, cell.lane);
  });
  scaled.visualBands.forEach((band, i) => near(band.top, canvas.visualBands[i].top * k, `band ${i}`));
  assert.equal(ScaleFormationPlan(canvas, 1), canvas, 'a unit fit is a no-op');
});

test('the canvas plan differs from a plan made on the scaled real px (the defect this fixes)', () => {
  // A tablet canvas field (1180 x 424) shown at 0.476 is 561 x 202 real px: below the short-strip threshold, so a
  // plan made on real px picks another profile. Planning on canvas px and scaling keeps the canvas picture.
  const fit = 0.4756;
  const canvasScaled = ScaleFormationPlan(planAt(1180, 424), fit);
  const realPlan = planAt(1180 * fit, 424 * fit);
  const diff = Math.max(...canvasScaled.cells.map((cell, i) => Math.abs(cell.ground - realPlan.cells[i].ground)));
  assert.ok(diff > 1, `the real-px plan should differ (max ground diff ${diff})`);
});

test('separateRow keeps its authored edge margin in the caller units', () => {
  const row = k => [{ x: 5 * k, width: 40 * k }, { x: 30 * k, width: 40 * k }];
  const unit = row(1), scaled = row(2.5);
  separateRow(unit, 300);
  separateRow(scaled, 300 * 2.5, undefined, 2.5);
  unit.forEach((r, i) => near(scaled[i].x, r.x * 2.5, `row ${i}`));
});

test('the band plan takes the canvas zoom: one canvas plans the same bands at every fit scale', async () => {
  const { planCombatLayout } = await import('./helpers/combat-layout-plan.mjs');
  const base = { formFactor: 'desktop', width: 1200, height: 750, zoom: 1.2 };
  const plain = planCombatLayout({ ...base, canvasScale: 1 });
  for (const canvasScale of [0.62, 1.36, 2.39]) {
    const scaled = planCombatLayout({ ...base, canvasScale });
    for (const key of ['hud', 'hand', 'footer', 'battlefield']) near(scaled[key], plain[key], `${key} at fit ${canvasScale}`);
    assert.equal(scaled.arrangement, plain.arrangement);
  }
});

test('the hand plan takes the canvas zoom: one canvas lays the same fan at every fit scale', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const { handLayout, responsiveHandLayout, handGeometryKey, holdPlaySlots, HAND_PLAY_SETTLE } = await import('../src/ui/models/HandLayout.js');
  const { desktopHandLayout } = await import('../src/ui/models/DesktopCombatFooter.js');
  const { CanvasRect } = await import('../src/ui/viewViewport.js');
  const source = readFileSync(new URL('../src/ui/components/hand.js', import.meta.url), 'utf8');
  const start = source.indexOf('  let publishedGeometry ='), end = source.indexOf('\n  // Re-derive when the measured facts move:', start);
  const style = () => { const values = new Map(); return { setProperty: (k, v) => values.set(k, v), getPropertyValue: k => values.get(k) || '' }; };
  const fan = fit => {
    const root = { dataset: { formFactor: 'desktop', viewPreset: 'desktop', viewScale: String(fit), viewLeft: '0', viewTop: '0' } };
    const win = { document: { documentElement: root } };
    const combat = { dataset: { compactCombat: 'false', desktopFooter: 'true' } };
    // Local box 1200 x 300 under body zoom 1.2, drawn at the canvas fit: the rect carries both.
    const handEl = { style: style(), dataset: {}, isConnected: true, clientWidth: 1200, clientHeight: 300, closest: () => combat,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200 * 1.2 * fit, height: 300 * 1.2 * fit }), dispatchEvent() {} };
    const card = id => ({ dataset: { instanceId: id }, parentNode: handEl, style: style(), lane: null,
      querySelector(selector) { return selector === '.card-upcast-controls' ? null : this.lane; }, appendChild(node) { this.lane = node; } });
    const cards = [card('a'), card('b'), card('c')];
    const scope = { handEl, handEls: cards, fitFan: true, handLayout, responsiveHandLayout, handGeometryKey, desktopHandLayout, holdPlaySlots, HAND_PLAY_SETTLE,
      CanvasRect: rect => CanvasRect(rect, win), setTimeout, clearTimeout, layoutMetrics: () => ({ fontSize: '10px' }), upcastMeasurements: new WeakMap(),
      measureHandUpcastHeight: () => 0, document: { documentElement: root, createElement: () => ({ setAttribute() {} }) }, Event: class { constructor(type) { this.type = type; } } };
    runInNewContext(source.slice(start, end) + '\napplyHandLayout', scope)();
    return cards.map(c => ['--hand-card-width', '--hand-card-x', '--hand-card-y'].map(k => parseFloat(c.style.getPropertyValue(k))));
  };
  const plain = fan(1);
  for (const fit of [0.62, 1.36, 2.39]) fan(fit).forEach((row, i) => row.forEach((value, j) => near(value, plain[i][j], `card ${i} value ${j} at fit ${fit}`)));
});
