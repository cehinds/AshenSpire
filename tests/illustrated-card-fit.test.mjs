import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Layout-backed doubles: scroll size follows font/width, while the containing
// bay follows the fitter's real percentage-height and max-height writes.
function fixture({ chars = 500, width = 110, top = 0, height = 26, full = true, hidden = false } = {}) {
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
      return Math.ceil(state.chars / Math.max(1, Math.floor(this.clientWidth / (font * .5)))) * font * 1.25;
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
  const face = { className: '', parentElement: { className: '' },
    dataset: { designWidth: '360', fullRules: String(full), rulesHidden: String(hidden) },
    get clientWidth() { return state.width; }, clientHeight: faceHeight,
    get textContent() { return 'x'.repeat(state.chars); },
    querySelector(selector) { return selector === '.card-rules-inspect-cue' ? cue : null; },
    querySelectorAll(selector) { return selector === '.ic-text[data-auto-fit="true"]' ? [text] : []; } };
  const card = { querySelector: () => face };
  return { state, face, text, layer, cue, fit: () => fitIllustratedCards([card]) };
}

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

test('expanded rules measure their final bay after borrowing artwork height', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 90, width: 180, top: 80, height: 26 });
  f.fit();
  assert.equal(f.face.dataset.rulesExpanded, 'true');
  assert.ok(f.layer.clientHeight > 26);
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
  assert.equal(f.text.dataset.rulesComplete, 'true');
}));

test('compact hidden rules retain their cue even when visible copy fits', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 3, full: false, hidden: true });
  f.fit();
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.text.dataset.rulesComplete, 'false');
  assert.equal(f.text.style.maxHeight, 'calc(100% - 9px)');
}));
