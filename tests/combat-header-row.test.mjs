import test from 'node:test';
import assert from 'node:assert/strict';
import { wireCombatLayout } from '../src/ui/components/combatLayout.js';
import { uiConfig } from '../src/config/generated/ui.js';

// Drives wireCombatLayout through a fake DOM and reads back what it publishes:
// data-header-row (the single / stacked choice) and --w4-band-hud (the header
// band). Both come from combatLayout.js's desktopHeader branch, so each test
// fails if that branch is reverted to the measured band.

const header = uiConfig.scenes.w4a.sizing.desktopHeader;
const GLOBALS = ['document', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver'];
const ORIGINAL = {};
let frames = [];

function fixture({ width, height, formFactor, appearance = 'alternative', sharedHud, layout }) {
  const props = {};
  const topbar = { querySelectorAll: () => [], getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0 }) };
  const combat = {
    isConnected: true,
    dataset: layout ? { layout } : {},
    clientWidth: width,
    clientHeight: height,
    props,
    style: { setProperty(key, value) { props[key] = value; } },
    getBoundingClientRect: () => ({ width, height }),
    querySelector(selector) {
      if (selector === ':scope > .combat-hud.shared-hud') return sharedHud ? {} : null;
      if (selector === ':scope > .topbar') return sharedHud ? null : topbar;
      return null;
    },
  };
  return { combat, documentElement: { dataset: { formFactor, displayAppearance: appearance } } };
}

function run(options) {
  for (const key of GLOBALS) ORIGINAL[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  const { combat, documentElement } = fixture(options);
  const define = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, value });
  define('document', { documentElement });
  define('getComputedStyle', () => ({ fontSize: '16px', paddingLeft: '0px', paddingRight: '0px' }));
  define('requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
  define('cancelAnimationFrame', () => {});
  define('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  define('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return []; } });
  try {
    const layout = wireCombatLayout(combat);
    const pending = frames; frames = [];
    for (const fn of pending) fn(0);
    layout.release();
    return { row: combat.dataset.headerRow, hud: parseFloat(combat.props['--w4-band-hud']) };
  } finally {
    for (const key of GLOBALS) {
      if (ORIGINAL[key]) Object.defineProperty(globalThis, key, ORIGINAL[key]); else delete globalThis[key];
    }
    frames = [];
  }
}

const tablet = (width, extra = {}) => run({ width, height: 800, formFactor: 'tablet', sharedHud: true, ...extra });

test('the authored header heights and the single-row breakpoint are the values under test', () => {
  assert.deepEqual([header.heightPx, header.stackedHeightPx, header.singleRowMinWidthPx], [56, 76, 640]);
});

test('a host 639px wide takes the stacked header at its authored 76px', () => {
  const result = tablet(header.singleRowMinWidthPx - 1);
  assert.equal(result.row, 'stacked');
  assert.equal(result.hud, header.stackedHeightPx);
});

test('a host 640px wide takes the single-row header at its authored 56px', () => {
  const result = tablet(header.singleRowMinWidthPx);
  assert.equal(result.row, 'single');
  assert.equal(result.hud, header.heightPx);
});

test('the desktop split always takes the single row, however narrow the host', () => {
  const result = run({ width: 500, height: 400, formFactor: 'desktop', layout: 'formation', sharedHud: true });
  assert.equal(result.row, 'single');
  // Owner (2026-10-31): the desktop split's band is 20% shorter than the shared single row (splitHeightPx).
  assert.equal(result.hud, header.splitHeightPx);
});

test('the classic appearance keeps the measured band and writes no header row', () => {
  const result = tablet(700, { appearance: 'classic' });
  assert.equal(result.row, '');
  assert.ok(result.hud < header.heightPx, `classic hud ${result.hud}`);
});
