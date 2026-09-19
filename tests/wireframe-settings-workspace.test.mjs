import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsNavigationPlan, stepCategory, settingsRowShowsHelp, SETTINGS_NAV_MODES } from '../src/ui/models/SettingsWorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { settingsRow, settingsRowHtml, settingsCategories, categoryHandler } from '../src/ui/screens/settings.js';

// W1a's budget is the shared W1 category-navigation budget (CategoryNavModel).
const cfg = wireframeUi.categoryNav;
// Local CSS px at 10 px/rem (text size M), tap floor 44 px, six categories.
const base = { rootFontPx: 10, itemMinHeightPx: 44, categoryCount: 6 };

test('the budget lives in wireframeUi and is frozen', () => {
  assert.ok(Object.isFrozen(cfg));
  for (const key of ['railMinHostWidthRem', 'bodyHeightFraction', 'railGapRem', 'railInsetRem', 'hysteresisRem']) {
    assert.ok(Number.isFinite(cfg[key]) && cfg[key] > 0, `${key} is a positive number`);
  }
  assert.deepEqual([...SETTINGS_NAV_MODES], ['rail', 'selector']);
});

test('a wide host with room for every category gets the rail', () => {
  const plan = settingsNavigationPlan({ ...base, hostWidthPx: 760, viewportHeightPx: 754 });
  assert.equal(plan.mode, 'rail');
  assert.ok(plan.fitsWidth && plan.fitsHeight && plan.measured);
  // 6 × 44 + 5 gaps + two insets, all from the budget.
  assert.equal(plan.railHeightPx, 6 * 44 + 5 * cfg.railGapRem * 10 + 2 * cfg.railInsetRem * 10);
  assert.equal(plan.bodyHeightPx, 754 * cfg.bodyHeightFraction);
});

test('a narrow host gets the selector, whatever its height', () => {
  const plan = settingsNavigationPlan({ ...base, hostWidthPx: 420, viewportHeightPx: 930 });
  assert.equal(plan.mode, 'selector');
  assert.equal(plan.fitsWidth, false);
});

test('a short host gets the selector when the rail cannot hold every category at the tap floor', () => {
  // A sideways phone: wide in local px, but the floor is 44 device px at a
  // 0.62 zoom, 71 local px, and the body band is 70% of a 629 px viewport.
  const plan = settingsNavigationPlan({ ...base, itemMinHeightPx: 44 / 0.62, hostWidthPx: 760, viewportHeightPx: 390 / 0.62 });
  assert.equal(plan.mode, 'selector');
  assert.equal(plan.fitsWidth, true);
  assert.equal(plan.fitsHeight, false);
});

test('larger text raises the width a rail needs', () => {
  const at = (rootFontPx) => settingsNavigationPlan({ ...base, rootFontPx, hostWidthPx: 650, viewportHeightPx: 900 }).mode;
  assert.equal(at(10), 'rail');
  assert.equal(at(12), 'selector');
});

test('hysteresis: leaving the selector needs a clear margin; staying a rail does not', () => {
  const edge = cfg.railMinHostWidthRem * 10;
  const measure = { ...base, hostWidthPx: edge + 1, viewportHeightPx: 900 };
  assert.equal(settingsNavigationPlan({ ...measure, current: 'rail' }).mode, 'rail');
  assert.equal(settingsNavigationPlan({ ...measure, current: 'selector' }).mode, 'selector');
  const clear = { ...measure, hostWidthPx: edge + cfg.hysteresisRem * 10 + 1, current: 'selector' };
  assert.equal(settingsNavigationPlan(clear).mode, 'rail');
});

test('an unmeasured host keeps what it has and says it was not measured', () => {
  assert.deepEqual({ ...settingsNavigationPlan({ ...base, hostWidthPx: 0, viewportHeightPx: 800, current: 'selector' }) },
    { mode: 'selector', measured: false });
  assert.equal(settingsNavigationPlan({}).mode, 'rail');
  assert.equal(settingsNavigationPlan({ current: 'bogus' }).mode, 'rail');
});

test('the category ring wraps at both ends and survives an unknown current', () => {
  const cats = ['Display', 'Audio', 'Accessibility', 'Advanced'];
  assert.equal(stepCategory(cats, 'Display', 1), 'Audio');
  assert.equal(stepCategory(cats, 'Advanced', 1), 'Display');
  assert.equal(stepCategory(cats, 'Display', -1), 'Advanced');
  assert.equal(stepCategory(cats, 'Lore', 1), 'Audio');
  assert.equal(stepCategory([], 'Display', 1), null);
});

test('help is drawn only where the effect is not obvious; feedback always is', () => {
  assert.equal(settingsRowShowsHelp({ note: 'Explains a subtle effect.' }), true);
  assert.equal(settingsRowShowsHelp({ note: 'Restates the label.', selfEvident: true }), false);
  assert.equal(settingsRowShowsHelp({ note: () => 'live', selfEvident: true }), true);
  assert.equal(settingsRowShowsHelp({ type: 'action', note: 'status', selfEvident: true }), true);
  assert.equal(settingsRowShowsHelp({}), false);
  assert.equal(settingsRowShowsHelp(null), false);
});

test('the real rows: a self-evident row draws no hint, a subtle one keeps it', () => {
  const obvious = settingsRow('musicVolume');
  assert.equal(obvious.selfEvident, true);
  assert.ok(!settingsRowHtml({}, obvious).includes('ls-hint'));
  const subtle = settingsRow('mapMode');
  assert.ok(settingsRowHtml({}, subtle).includes('ls-hint'));
  // Every self-evident row still carries its sentence in data, and none of them
  // is a live-feedback row.
  for (const cat of settingsCategories()) {
    for (const row of categoryHandler(cat)?.rows || []) {
      if (!row.selfEvident) continue;
      assert.equal(typeof row.note, 'string', `${row.key} keeps its note`);
      assert.notEqual(row.type, 'action', `${row.key} is not a status row`);
    }
  }
});

test('Accessibility has its own tab while General contains Display and Audio', () => {
  assert.deepEqual(settingsCategories(), ['General', 'Accessibility', 'Advanced']);
  assert.deepEqual(new Set(categoryHandler('General').rows.map(row => row.cat)), new Set(['Display', 'Audio']));
  assert.ok(categoryHandler('Accessibility').rows.length > 0);
  assert.ok(categoryHandler('Accessibility').rows.every(row => row.cat === 'Accessibility'));
});
