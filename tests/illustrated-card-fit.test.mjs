import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Layout-backed doubles: scroll size follows font/width, while the containing
// bay follows the fitter's real percentage-height and max-height writes.
function fixture({ chars = 500, width = 110, top = 0, height = 26, full = true, hidden = false, titleBottom = 0, railBottom = 0 } = {}) {
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

test('compact effects wrap into the artwork bay instead of losing printed rows', () => withKitDom(() => {
  invalidateLayoutMetrics();
  // At 180px the authored 26px bay fits fewer than three wrapped effects;
  // the 80px above it is available artwork, exactly as on a resting hand card.
  const f = fixture({ chars: 90, width: 180, top: 80, height: 26, full: false });
  f.fit();
  assert.ok(f.text.scrollHeight > 3 * parseFloat(f.text.style.fontSize) * 1.25);
  assert.equal(f.face.dataset.rulesExpanded, 'true');
  assert.equal(f.text.style.webkitLineClamp, 'unset');
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
}));

test('narrow dense rules preserve a readable floor and recover when widened', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 300, width: 110, top: 80 });
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) >= 11, 'never solve overflow with 7px rules');
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  const smallFont = parseFloat(f.text.style.fontSize);
  f.state.width = 360;
  f.state.chars = 60;
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) > smallFont);
  assert.equal(f.text.dataset.rulesComplete, 'true');
}));

test('preferred rules font borrows artwork before searching smaller fonts', () => withKitDom(() => {
  invalidateLayoutMetrics();
  // At 180px the preferred authored 30/360 font is 15px. These rules need
  // 75px, exceeding the original 26px bay but fitting its 104px grown bay.
  const f = fixture({ chars: 80, width: 180, top: 80, height: 26, full: false });
  f.fit();
  assert.equal(parseFloat(f.text.style.fontSize), 15, 'keep the preferred font when borrowing artwork suffices');
  assert.ok(f.text.scrollHeight > 26, 'original bay cannot hold the preferred font');
  assert.ok(f.layer.clientHeight > 26, 'parchment grows rather than shrinking the font');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
  assert.equal(f.face.dataset.rulesExpanded, 'true');
  assert.equal(f.text.dataset.rulesComplete, 'true');
  f.state.width = 110;
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) >= 11, 'a smaller shelf still respects the readable floor');
  f.state.width = 180;
  f.fit();
  assert.equal(parseFloat(f.text.style.fontSize), 15, 'widening restores the preferred font without geometric drift');
}));


test('preferred font search respects the title and tag rail expansion boundary', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 40, width: 180, top: 80, height: 26, full: false, titleBottom: 20, railBottom: 65 });
  f.fit();
  assert.ok(parseFloat(f.text.style.fontSize) < 15, 'shrink only when preferred text cannot fit even after legal growth');
  assert.ok(parseFloat(f.text.style.fontSize) >= 11);
  assert.ok(f.layer.offsetTop >= 67 - .01, 'retain the tag rail plus its two-pixel margin');
  assert.equal(f.text.dataset.rulesComplete, 'true');
}));
