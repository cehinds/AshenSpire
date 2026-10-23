import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Layout-backed doubles: scroll size follows font/width, while the containing
// bay follows the fitter's real percentage-height and max-height writes.
function fixture({ chars = 500, width = 110, top = 0, height = 26, full = true, hidden = false, titleBottom = 0, railBottom = 0, printedRows = 1, key = '' } = {}) {
  document.documentElement ??= document.createElement('html');
  const state = { width, chars, reads: 0, writes: 0, order: [], descendants: [] };
  const faceHeight = 200;
  const layer = { style: { top: `${top / 2}%`, height: `${height / 2}%` },
    get clientHeight() { return state.boxHeight ?? parseFloat(this.style.height) / 100 * faceHeight; },
    get offsetTop() { return parseFloat(this.style.top) / 100 * faceHeight; } };
  const text = { style: new Proxy({}, { set(target, property, value) {
      if (property === 'fontSize') { state.writes++; state.order.push('font'); }
      target[property] = value; return true;
    } }), parentElement: layer,
    dataset: { cardBinding: 'rules', minFont: '22', maxFont: '30', maxLines: full ? '5' : '3' },
    get innerHTML() { return state.markup ?? 'x'.repeat(state.chars); },
    querySelectorAll() { return state.descendants; },
    get clientWidth() { state.order.push('width'); return state.textWidth ?? state.width * .7; },
    get scrollWidth() { return this.clientWidth; },
    get scrollHeight() {
      state.reads++;
      const font = parseFloat(this.style.fontSize) || 10;
      return Math.max(printedRows, Math.ceil(state.chars / Math.max(1, Math.floor(this.clientWidth / (font * .5))))) * font * (parseFloat(this.style.lineHeight) || 1.25);
    },
    get clientHeight() {
      let cap = Infinity;
      if (this.style.maxHeight === '100%') cap = layer.clientHeight;
      else if (this.style.maxHeight?.startsWith('calc')) cap = layer.clientHeight - parseFloat(this.style.maxHeight.match(/- ([\d.]+)/)[1]);
      if (this.style.display === '-webkit-box' && this.style.webkitLineClamp !== 'unset') {
        cap = Math.min(cap, Number(this.style.webkitLineClamp) * parseFloat(this.style.fontSize) * 1.25);
      }
      return Math.min(this.scrollHeight, cap);
    } };
  const cue = { offsetHeight: 9 };
  const face = { className: key, parentElement: { className: '' },
    dataset: { designWidth: '360', fullRules: String(full), rulesHidden: String(hidden) },
    get clientWidth() { return state.width; }, clientHeight: faceHeight,
    get textContent() { return 'x'.repeat(state.chars); },
    querySelector(selector) {
      if (selector === '.card-rules-inspect-cue') return cue;
      if (selector === '[data-card-binding="name"]' && titleBottom) return { parentElement: { offsetTop: 0, clientHeight: titleBottom }, offsetTop: 0, offsetHeight: titleBottom };
      if (selector === '.card-tag-rail' && railBottom) return { offsetTop: 0, offsetHeight: railBottom };
      return null;
    },
    querySelectorAll(selector) { return selector === '.ic-text[data-auto-fit="true"]' ? [text] : []; } };
  const card = { querySelector: () => face };
  return { state, face, text, layer, cue, fit: () => fitIllustratedCards([card]) };
}

const fitted = f => ({ font: f.text.style.fontSize, clamp: f.text.style.webkitLineClamp,
  fittedFont: f.text.dataset.fittedFont, complete: f.text.dataset.rulesComplete,
  overflow: f.face.dataset.rulesOverflow, cap: f.text.style.maxHeight,
  justify: f.layer.style.justifyContent, top: f.layer.style.top, height: f.layer.style.height });

test('unfit inspection rules keep full text but reserve an in-bay cue and report incomplete', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture();
  f.fit();
  assert.ok(f.text.scrollHeight > f.layer.clientHeight, 'the readable floor still cannot fit this content');
  assert.equal(f.text.dataset.rulesComplete, 'false');
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.layer.style.justifyContent, 'flex-start', 'clipped text cannot center above its bay');
  assert.equal(f.text.clientHeight + f.cue.offsetHeight, f.layer.clientHeight);
  assert.equal(f.face.textContent.length, 500, 'full rules remain available to the Rules tooltip');
}));

test('a later fit of shorter copy clears its previous cap and geometric overflow', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 80 });
  f.fit();
  assert.equal(f.text.dataset.rulesComplete, 'false');
  f.state.width = 180;
  f.state.chars = 3;
  f.fit();
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.equal(f.face.dataset.rulesOverflow, 'false', 'computed overflow is not treated as authored hidden rules');
  assert.equal(f.text.style.maxHeight, '100%');
  assert.equal(f.layer.style.justifyContent, '');
  const settled = { ...f.text.style };
  f.fit();
  assert.deepEqual(f.text.style, settled, 'unchanged inputs retain the settled fit');
}));

test('compact hidden rules retain their cue even when visible copy fits', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 3, full: false, hidden: true });
  f.fit();
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.text.dataset.rulesComplete, 'false');
  assert.equal(f.text.style.maxHeight, 'calc(100% - 9px)');
}));

test('long rules shrink inside a fixed bay, preserving parchment and artwork geometry', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 40, width: 180, top: 80, height: 45, full: false });
  const geometry = { ...f.layer.style };
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) < 15, 'preferred font does not fit');
  assert.ok(parseFloat(f.text.style.fontSize) >= 11, 'readable floor');
  assert.deepEqual({ top: f.layer.style.top, height: f.layer.style.height }, geometry);
  assert.equal(f.face.dataset.rulesExpanded, 'false');
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
  f.state.chars = 300;
  f.fit();
  assert.equal(f.face.dataset.rulesOverflow, 'true', 'unfit copy offers inspection without growing');
  assert.equal(f.layer.clientHeight, 45);
  assert.ok(parseFloat(f.text.style.fontSize) >= 11);
  f.state.chars = 3;
  f.fit();
  assert.equal(parseFloat(f.text.style.fontSize), 15, 'short copy restores preferred font');
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.equal(f.layer.clientHeight, 45);
}));

test('two live Counter rows shrink below design minimum within the native hand bay', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 20, width: 180, top: 80, height: 28, full: false, printedRows: 2 });
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) < 15);
  assert.ok(parseFloat(f.text.style.fontSize) >= 11);
  assert.ok(Math.abs(f.layer.clientHeight - 28) < .001);
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  assert.equal(f.text.style.maxHeight, '100%', 'no inspection cue reserves space when both rows fit');
}));

test('a fresh equivalent face reuses only its font search and still recomputes final overflow and layout', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const options = { key: 'memo-hit', chars: 40, width: 180, height: 45, full: false };
  const first = fixture(options); first.fit();
  const next = fixture(options); next.fit();
  assert.deepEqual(fitted(next), fitted(first), 'all native fit outputs match a cold search');
  assert.ok(first.state.writes >= 8, 'the cold fixture needs the full font search');
  assert.equal(next.state.writes, 1, 'a fresh face writes its final font without high/mid probes');
  assert.ok(next.state.reads > 0, 'final geometric overflow is still measured');
  assert.ok(next.state.reads < first.state.reads);
  assert.equal(next.face.dataset.rulesExpanded, 'false');
  assert.equal(next.face.dataset.rulesNarrowFit, 'false');
  // Native applyCardLayouts still visits layers even for a numeric cache hit.
  const layer = { style: {}, dataset: { cardLayer: '4' } };
  const withLayout = fixture(options), original = withLayout.face.querySelectorAll;
  withLayout.face.querySelectorAll = selector => selector === '[data-card-layer]' ? [layer] : original(selector);
  withLayout.fit();
  assert.equal(withLayout.state.writes, 1);
  assert.ok(layer.style.zIndex, 'the ordinary final layout pass runs on a cache hit');
  const hiddenOptions = { ...options, key: 'memo-hit-cue', hidden: true };
  fixture(hiddenOptions).fit();
  const changedCue = fixture(hiddenOptions); changedCue.cue.offsetHeight = 12; changedCue.fit();
  assert.equal(changedCue.state.writes, 1, 'cue height is a final overflow input, not a font-search input');
  assert.equal(changedCue.text.style.maxHeight, 'calc(100% - 12px)', 'a cached font cannot replay an obsolete inspection cue cap');
}));

test('font searches miss for changed copy, markup, measured constraints, budgets, hidden rules and context', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const options = { key: 'memo-invalidation', chars: 40, width: 180, height: 45, full: false };
  fixture(options).fit();
  const changes = [
    f => { f.state.chars++; },
    f => { f.state.markup = '<b>' + 'x'.repeat(40) + '</b>'; },
    f => { f.state.width++; },
    f => { f.state.textWidth = 125; },
    f => { f.state.boxHeight = 44; },
    f => { f.text.dataset.maxLines = '4'; },
    f => { f.text.dataset.maxFont = '31'; },
    f => { f.text.dataset.cardBinding = 'name'; },
    f => { f.face.dataset.rulesHidden = 'true'; },
    f => { f.text.style.fontFamily = 'serif'; },
  ];
  for (const change of changes) {
    const f = fixture(options); change(f); f.fit();
    assert.ok(f.state.writes > 1, 'each distinct constraint performs a new search');
  }
  for (const [node, property] of [[document.documentElement, 'formFactor'], [document.documentElement, 'layout']]) {
    node.dataset[property] = 'changed';
    const f = fixture(options); f.fit(); assert.ok(f.state.writes > 1);
    delete node.dataset[property];
  }
  document.body.className = 'changed-font-context';
  const changedBody = fixture(options); changedBody.fit(); assert.ok(changedBody.state.writes > 1);
}));

test('resolved descendant typography is keyed and non-text descendants bypass the font cache', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const original = globalThis.getComputedStyle;
  let weight = '400';
  globalThis.getComputedStyle = node => ({ ...original(node), fontWeight: node.tagName === 'SPAN' ? weight : '400' });
  try {
    const options = { key: 'memo-descendants', chars: 40, width: 180, height: 45, full: false };
    const make = tagName => { const f = fixture(options); f.state.descendants = [{ tagName }]; return f; };
    make('SPAN').fit();
    const hit = make('SPAN'); hit.fit(); assert.equal(hit.state.writes, 1);
    weight = '700';
    const changed = make('SPAN'); changed.fit(); assert.ok(changed.state.writes > 1);
    const image = make('IMG'); image.fit();
    const secondImage = make('IMG'); secondImage.fit(); assert.ok(secondImage.state.writes > 1);
  } finally { globalThis.getComputedStyle = original; }
}));

test('font loading invalidates equivalent fresh rows and row measurements precede every probe write', () => withKitDom(() => {
  invalidateLayoutMetrics();
  let loaded;
  document.fonts = { addEventListener(type, listener) { assert.equal(type, 'loadingdone'); loaded = listener; } };
  const options = { key: 'memo-font-loading', chars: 40, width: 180, height: 45, full: false };
  fixture(options).fit();
  const hit = fixture(options); hit.fit(); assert.equal(hit.state.writes, 1);
  loaded();
  const afterLoad = fixture(options); afterLoad.fit(); assert.ok(afterLoad.state.writes > 1);
  const a = fixture({ ...options, key: 'memo-batch-a' }), b = fixture({ ...options, key: 'memo-batch-b' });
  const order = [];
  const original = globalThis.getComputedStyle;
  try {
    globalThis.getComputedStyle = () => { order.push('style-read'); return {}; };
    for (const f of [a, b]) f.text.style = new Proxy({}, { set(target, key, value) { if (key === 'fontSize') order.push('probe-write'); target[key] = value; return true; } });
    fitIllustratedCards([a, b].map(f => ({ querySelector: () => f.face })));
    assert.equal(order.filter(item => item === 'style-read').length, 2);
    assert.ok(order.lastIndexOf('style-read') < order.indexOf('probe-write'), 'all rows are read before the first font probe');
  } finally { globalThis.getComputedStyle = original; }
}));

test('the shared numeric-font memo evicts old entries after 128 distinct rows', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const options = { key: 'memo-evict-original', chars: 40, width: 180, height: 45, full: false };
  fixture(options).fit();
  const hit = fixture(options); hit.fit(); assert.equal(hit.state.writes, 1);
  for (let index = 0; index < 128; index++) fixture({ ...options, key: 'memo-evict-' + index }).fit();
  const evicted = fixture(options); evicted.fit(); assert.ok(evicted.state.writes > 1);
}));
