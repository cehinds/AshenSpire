import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATEGORY_NAV_MODES, categoryNavPlan, categoryNavKey, categoryNavLanding, categoryNavAfterPick, categoryNavFace,
} from '../src/ui/models/CategoryNavModel.js';
import { settingsNavigationPlan, SETTINGS_NAV_MODES } from '../src/ui/models/SettingsWorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const cfg = wireframeUi.categoryNav;
// Local CSS px at 10 px/rem (text size M) and the 44 px tap floor, divided by
// the zoom each viewport resolves to (measured on dev: 1440×860 1.18,
// 1280×800 1.07, 390×844 0.90, 375×667 0.85, 844×390 0.62). The host is the
// W1 frame, 95% of the viewport width.
const host = (w, h, zoom, categoryCount) => ({
  hostWidthPx: (w * 0.95) / zoom, viewportHeightPx: h / zoom, rootFontPx: 10, itemMinHeightPx: 44 / zoom, categoryCount,
});
const VIEWPORTS = { desk: [1440, 860, 1.18], laptop: [1280, 800, 1.07], phone: [390, 844, 0.9], se: [375, 667, 0.85], sideways: [844, 390, 0.62] };
// The five surfaces' category counts: Settings six, Shop seven (with Sell),
// Armoury four views, Compendium's armament kinds (six at most), Profile two,
// the pile viewer two.
const SURFACES = { settings: 6, shop: 7, armoury: 4, compendium: 6, profile: 2, piles: 2 };

test('one budget, frozen, and no top-level key of wireframeUi is declared twice', () => {
  assert.ok(Object.isFrozen(cfg));
  for (const key of ['railMinHostWidthRem', 'bodyHeightFraction', 'railGapRem', 'railInsetRem', 'hysteresisRem']) {
    assert.ok(Number.isFinite(cfg[key]) && cfg[key] > 0, `${key} is a positive number`);
  }
  assert.equal(wireframeUi.settings, undefined, 'W1a has no second copy of the budget');
  // A duplicate key in an object literal silently keeps the last one, so the
  // source is read: every two-space-indented `key:` at the top level, once.
  const source = readFileSync(new URL('../src/content/wireframeUi.js', import.meta.url), 'utf8');
  const keys = [...source.matchAll(/^ {2}([A-Za-z]\w*):/gm)].map((m) => m[1]);
  assert.ok(keys.includes('categoryNav'));
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), [], 'top-level keys are unique');
  assert.deepEqual(Object.keys(wireframeUi).sort(), [...new Set(keys)].sort());
});

test('Settings asks the same model: one function, one pair of modes', () => {
  assert.equal(settingsNavigationPlan, categoryNavPlan);
  assert.equal(SETTINGS_NAV_MODES, CATEGORY_NAV_MODES);
  assert.deepEqual([...CATEGORY_NAV_MODES], ['rail', 'selector']);
});

test('every surface: a rail on the wide hosts, the selector on the phones', () => {
  for (const [surface, count] of Object.entries(SURFACES)) {
    for (const name of ['desk', 'laptop']) {
      assert.equal(categoryNavPlan(host(...VIEWPORTS[name], count)).mode, 'rail', `${surface} at ${name}`);
    }
    for (const name of ['phone', 'se']) {
      const plan = categoryNavPlan(host(...VIEWPORTS[name], count));
      assert.equal(plan.mode, 'selector', `${surface} at ${name}`);
      assert.equal(plan.fitsWidth, false, `${surface} at ${name} is too narrow for rail plus pane`);
    }
  }
});

test('a sideways phone keeps a short rail and turns a long one into the selector', () => {
  const sideways = (count) => categoryNavPlan(host(...VIEWPORTS.sideways, count));
  assert.equal(sideways(SURFACES.piles).mode, 'rail', 'two piles fit the body band at the tap floor');
  assert.equal(sideways(SURFACES.armoury).mode, 'rail', 'four views fit');
  for (const surface of ['settings', 'shop', 'compendium']) {
    const plan = sideways(SURFACES[surface]);
    assert.equal(plan.mode, 'selector', surface);
    assert.equal(plan.fitsWidth, true);
    assert.equal(plan.fitsHeight, false, `${surface}: every category at the floor does not fit 70% of 390 px`);
  }
});

test('the rail height is the budget: items at the floor, gaps and two insets', () => {
  const plan = categoryNavPlan({ hostWidthPx: 800, viewportHeightPx: 900, rootFontPx: 10, itemMinHeightPx: 44, categoryCount: 7 });
  assert.equal(plan.railHeightPx, 7 * 44 + 6 * cfg.railGapRem * 10 + 2 * cfg.railInsetRem * 10);
  assert.equal(plan.bodyHeightPx, 900 * cfg.bodyHeightFraction);
  assert.equal(plan.minWidthPx, cfg.railMinHostWidthRem * 10);
});

test('hysteresis and an unmeasured host', () => {
  const edge = cfg.railMinHostWidthRem * 10;
  const measure = { hostWidthPx: edge + 1, viewportHeightPx: 900, rootFontPx: 10, itemMinHeightPx: 44, categoryCount: 4 };
  assert.equal(categoryNavPlan({ ...measure, current: 'rail' }).mode, 'rail');
  assert.equal(categoryNavPlan({ ...measure, current: 'selector' }).mode, 'selector');
  assert.equal(categoryNavPlan({ ...measure, hostWidthPx: edge + cfg.hysteresisRem * 10 + 1, current: 'selector' }).mode, 'rail');
  assert.deepEqual({ ...categoryNavPlan({ hostWidthPx: 0, viewportHeightPx: 800, rootFontPx: 10, current: 'selector' }) },
    { mode: 'selector', measured: false });
  assert.equal(categoryNavPlan({ current: 'strip' }).mode, 'rail');
});

test('Escape closes only an open compact list; the router keeps the arrows', () => {
  assert.equal(categoryNavKey('Escape', { mode: 'selector', open: true }), 'close');
  assert.equal(categoryNavKey('Escape', { mode: 'selector', open: false }), null, 'a closed list leaves Escape to the door');
  assert.equal(categoryNavKey('Escape', { mode: 'rail', open: true }), null, 'a rail has no list to close');
  assert.equal(categoryNavKey('Home', { mode: 'rail' }), 'first');
  assert.equal(categoryNavKey('End', { mode: 'selector', open: true }), 'last');
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Tab']) {
    assert.equal(categoryNavKey(key, { mode: 'selector', open: true }), null, `${key} is the input router's`);
  }
});

test('the cursor lands on the selector when compact and on the selection when wide', () => {
  assert.equal(categoryNavLanding({ mode: 'selector', open: false }), 'selector');
  assert.equal(categoryNavLanding({ mode: 'selector', open: true }), 'selected');
  assert.equal(categoryNavLanding({ mode: 'rail' }), 'selected');
  assert.deepEqual({ ...categoryNavAfterPick({ mode: 'selector', open: true }) }, { close: true, focus: 'selector' });
  assert.deepEqual({ ...categoryNavAfterPick({ mode: 'rail', open: false }) }, { close: false, focus: null });
});

test('the selector face is the label and its status, one space apart', () => {
  assert.equal(categoryNavFace(['Cards', '5 for sale']), 'Cards 5 for sale');
  assert.equal(categoryNavFace(['  Swords\n', '3/9']), 'Swords 3/9');
  assert.equal(categoryNavFace(['Display', '', null]), 'Display');
  assert.equal(categoryNavFace('Discard (4)'), 'Discard (4)');
});
