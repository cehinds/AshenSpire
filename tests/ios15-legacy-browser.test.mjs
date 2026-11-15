// src/ui/legacyBrowser.js: the one door that decides whether a page gets the iOS 15 repairs. docs/qa/IOS15-COMPAT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { InstallLegacyBrowser, InstallLegacyBrowserSafely, LegacyFlags } from '../src/ui/legacyBrowser.js';
import { ForceColorMixFallback } from '../src/ui/colorMixCompat.js';
import { ForceCqFallback } from '../src/ui/cqCompat.js';

const supportsEverything = () => true;
function fakeWindow({ search = '', supports = supportsEverything, sheets = [] } = {}) {
  const styles = sheets.map((css) => ({ tagName: 'STYLE', textContent: css }));
  const html = { name: 'html', matches: (s) => s.split(',').map((x) => x.trim()).includes('html'), querySelectorAll: () => [], getAttribute: () => null, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, style: { setProperty() {} }, nodeType: 1, isConnected: true };
  const observers = [];
  return {
    styles, html, observers,
    location: { search }, URLSearchParams,
    CSS: { supports },
    document: {
      documentElement: html,
      querySelectorAll: (sel) => (sel.startsWith('link') ? [] : styles),
      createElement: () => ({ setAttribute() {}, appendChild() {} }),
    },
    ResizeObserver: class { constructor() { observers.push(this); } observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    getComputedStyle: () => ({ width: '400px', height: '800px', boxSizing: 'content-box', fontSize: '10px' }),
    requestAnimationFrame: (f) => { f(); return 1; },
    addEventListener() {}, removeEventListener() {}, innerWidth: 400, innerHeight: 800,
  };
}

test('a browser with every feature is not touched', () => {
  const css = '.a{color:color-mix(in srgb,red,blue)}@container (max-width:1px){.b{width:3cqw}}';
  const win = fakeWindow({ sheets: [css] });
  assert.equal(InstallLegacyBrowser(win), null);
  assert.equal(win.styles[0].textContent, css, 'the stylesheet text is the same string');
  assert.equal(win.observers.length, 0, 'no observer started');
});

test('?legacy=ios15 forces every repair but the native popover; ?legacy=off forces none', () => {
  const forced = LegacyFlags(fakeWindow({ search: '?shot=combat&legacy=ios15' }));
  assert.deepEqual(Object.entries(forced).filter(([, on]) => !on).map(([name]) => name), ['popover']);
  assert.equal(Object.values(LegacyFlags(fakeWindow({ search: '?legacy=off', supports: () => false }))).some(Boolean), false);
});

test('feature detection: a browser lacking color-mix and container queries gets repaired sheets', () => {
  const lacks = (prop, value) => !/color-mix|cqw|container-type|selector/.test(`${prop} ${value}`);
  const css = ':root{--gold:#c9a227}.a{border-color:color-mix(in srgb,var(--gold) 50%,transparent);font-size:2cqw}@container game-viewport (max-width:600px){.b{width:1px}}html{container:game-viewport/size}.plain{color:red}';
  const win = fakeWindow({ supports: lacks, sheets: [css, '.untouched{color:blue}'] });
  try {
    const result = InstallLegacyBrowser(win);
    assert.ok(result.flags.colorMix && result.flags.containers && result.flags.cqUnits);
    assert.equal(result.flags.overflowClip, false);
    const [first, second] = win.styles.map((s) => s.textContent);
    assert.match(first, /border-color:rgba\(201, 162, 39, 0\.5\)/);
    assert.match(first, /font-size:calc\(2 \* var\(--cqw, 1%\)\)/);
    assert.match(first, /:where\(\[data-cq~="0"\]\) \.b\{width:1px\}/);
    assert.doesNotMatch(first, /container/);
    assert.equal(second, '.untouched{color:blue}', 'a sheet with nothing to repair is not rewritten');
    assert.equal(win.observers.length, 1, 'the container shim started');
    assert.deepEqual(result.context.containers.map((c) => c.selector), ['html']);
  } finally { ForceCqFallback(false); ForceColorMixFallback(false); }
});

test('a page without a document is left alone', () => {
  assert.equal(InstallLegacyBrowser({}), null);
});

test('only the -webkit- prefix gaps (current Safari): InstallLegacyBrowser is a no-op', () => {
  const css = '.a{user-select:none;backdrop-filter:blur(2px)}';
  const win = fakeWindow({ supports: (prop) => !/^(user-select|backdrop-filter)$/.test(prop), sheets: [css] });
  assert.equal(InstallLegacyBrowser(win), null);
  assert.equal(win.styles[0].textContent, css);
  assert.equal(win.observers.length, 0);
});

test('a repair that throws is logged and the page boots unrepaired', () => {
  const win = fakeWindow({ supports: () => false, sheets: ['.a{width:1cqw}'] });
  win.document.querySelectorAll = () => { throw new Error('boom'); };
  const logged = [];
  try { assert.equal(InstallLegacyBrowserSafely(win, { error: (...a) => logged.push(a) }), null); } finally { ForceCqFallback(false); ForceColorMixFallback(false); }
  assert.equal(logged.length, 1);
  assert.match(String(logged[0][0]), /booting without them/);
});
