import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/dom.mjs';

// Layout-backed doubles: scroll size follows font/width, while the containing
// bay follows the fitter's real percentage-height and max-height writes.
function fixture({ chars = 500, width = 110, top = 0, height = 26, full = true, hidden = false, titleBottom = 0, railBottom = 0, printedRows = 1 } = {}) {
  const state = { width, chars };
  const faceHeight = 200;
  const layer = { style: { top: `${top / 2}%`, height: `${height / 2}%` },
    get clientHeight() { return parseFloat(this.style.height) / 100 * faceHeight; },
    get offsetTop() { return parseFloat(this.style.top) / 100 * faceHeight; } };
  const text = { style: {}, parentElement: layer,
    dataset: { cardBinding: 'rules', minFont: '22', maxFont: '30', maxLines: full ? '5' : '3' },
    get clientWidth() { return state.width * .7; },
    get scrollWidth() { return this.clientWidth; },
    get scrollHeight() {
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
  const face = { className: '', parentElement: { className: '' },
    dataset: { designWidth: '360', fullRules: String(full), rulesHidden: String(hidden) },
    get clientWidth() { return state.width; }, clientHeight: faceHeight,
    get textContent() { return 'x'.repeat(state.chars); },
    querySelector(selector) {
      if (selector === '[data-card-binding="name"]' && titleBottom) return { parentElement: { offsetTop: 0, clientHeight: titleBottom }, offsetTop: 0, offsetHeight: titleBottom };
      if (selector === '.card-tag-rail' && railBottom) return { offsetTop: 0, offsetHeight: railBottom };
      return null;
    },
    querySelectorAll(selector) { return selector === '.ic-text[data-auto-fit="true"]' ? [text] : []; } };
  const card = { querySelector: () => face };
  return { state, face, text, layer, fit: () => fitIllustratedCards([card]) };
}

test('unfit inspection rules keep full text, reserve no cue and report incomplete', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture();
  f.fit();
  assert.ok(f.text.scrollHeight > f.layer.clientHeight, 'the readable floor still cannot fit this content');
  assert.equal(f.text.dataset.rulesComplete, 'false');
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.layer.style.justifyContent, 'flex-start', 'clipped text cannot center above its bay');
  assert.equal(f.text.clientHeight, f.layer.clientHeight, 'no Inspect cue takes space from the words');
  assert.equal(f.face.textContent.length, 500, 'full rules remain available to the Rules tooltip');
}));

test('a later fit of shorter copy clears its previous cap and geometric overflow', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 400 });
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

test('compact hidden rules still report incomplete even when visible copy fits', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 3, full: false, hidden: true });
  f.fit();
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.text.dataset.rulesComplete, 'false');
  assert.equal(f.text.style.maxHeight, '100%', 'no cue reserves space');
}));

test('long rules shrink inside a fixed bay, preserving parchment and artwork geometry', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 40, width: 180, top: 80, height: 45, full: false });
  const geometry = { ...f.layer.style };
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) < 15, 'preferred font does not fit');
  assert.ok(parseFloat(f.text.style.fontSize) >= 6, 'configured minimum');
  assert.deepEqual({ top: f.layer.style.top, height: f.layer.style.height }, geometry);
  assert.equal(f.face.dataset.rulesExpanded, 'false');
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
  f.state.chars = 900;
  f.fit();
  assert.equal(f.face.dataset.rulesOverflow, 'true', 'unfit copy offers inspection without growing');
  assert.equal(f.layer.clientHeight, 45);
  assert.ok(parseFloat(f.text.style.fontSize) >= 6);
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
  assert.ok(parseFloat(f.text.style.fontSize) >= 6);
  assert.ok(Math.abs(f.layer.clientHeight - 28) < .001);
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  assert.equal(f.text.style.maxHeight, '100%', 'no inspection cue reserves space when both rows fit');
}));

test('a one-liner that needs shrinking to fit shows its rules with no Inspect cue', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 20, width: 180, top: 80, height: 28, full: false });
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) < 15, 'the font shrank first');
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  assert.equal(f.text.dataset.rulesComplete, 'true');
}));

test('rules that need three lines at 11px shrink until they fit the glance, with every word kept', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 60, width: 180, top: 80, height: 45, full: false });
  f.fit();
  const font = parseFloat(f.text.style.fontSize);
  assert.ok(font < 11 && font >= 6, 'shrunk past 11px, above the configured minimum');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1, 'the words sit inside the parchment');
  assert.equal(f.face.dataset.rulesOverflow, 'false');
}));

test('rules that cannot fit even at the minimum tighten the line height, then clip with an ellipsis', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 5000, width: 180, top: 80, height: 45, full: false });
  f.fit();
  assert.equal(parseFloat(f.text.style.fontSize) >= 6, true);
  assert.equal(parseFloat(f.text.style.lineHeight) < 1.05, true, 'line height was tightened');
  assert.equal(f.text.style.textOverflow, 'ellipsis');
  assert.equal(f.text.style.overflow, 'hidden');
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.text.dataset.rulesComplete, 'false');
}));

test('two face lines that each render on one line show no cue', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 10, width: 180, top: 80, height: 45, full: false, printedRows: 2 });
  f.fit();
  assert.equal(f.face.dataset.rulesOverflow, 'false');
}));
