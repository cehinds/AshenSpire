import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Layout-backed doubles: scroll size follows font/width, while the containing
// bay follows the fitter's real percentage-height and max-height writes.
function fixture({ chars = 500, width = 110, top = 0, height = 26, full = true, hidden = false, titleBottom = 0, railBottom = 0, printedRows = 1 } = {}) {
  const state = { width, chars, fontWrites: [], scrollReads: 0 };
  const faceHeight = 200;
  const layer = { style: { top: `${top / 2}%`, height: `${height / 2}%` },
    get clientHeight() { return parseFloat(this.style.height) / 100 * faceHeight; },
    get offsetTop() { return parseFloat(this.style.top) / 100 * faceHeight; } };
  const text = { style: new Proxy({}, { set(target, key, value) {
      if (key === 'fontSize') state.fontWrites.push(value);
      target[key] = value; return true;
    } }), parentElement: layer,
    dataset: { cardBinding: 'rules', minFont: '22', maxFont: '30', maxLines: full ? '5' : '3' },
    get clientWidth() { return state.width * .7; },
    get scrollWidth() { return this.clientWidth; },
    get scrollHeight() {
      state.scrollReads++;
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

test('overflow at identical font bounds skips redundant probes but retains the readable floor and inspection cue', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 500, width: 110, height: 26, full: false });
  const geometry = { ...f.layer.style };
  f.fit();
  assert.deepEqual(f.state.fontWrites, ['11px', '11px'], 'one initial probe and the native final font write suffice');
  assert.ok(f.state.scrollReads > 1, 'initial fitting and final geometric overflow still measure the text');
  assert.equal(f.face.textContent.length, 500, 'overflow retains all inspection text');
  assert.equal(f.text.dataset.fittedFont, '36');
  assert.equal(f.text.dataset.rulesComplete, 'false');
  assert.equal(f.face.dataset.rulesOverflow, 'true');
  assert.equal(f.text.style.maxHeight, 'calc(100% - 9px)');
  assert.equal(f.text.clientHeight + f.cue.offsetHeight, 26);
  assert.equal(f.layer.style.justifyContent, 'flex-start');
  assert.deepEqual({ top: f.layer.style.top, height: f.layer.style.height }, geometry, 'the authored bay never grows');
}));

test('nondegenerate bounds retain the native seven-pass shrink result', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const f = fixture({ chars: 40, width: 180, height: 45, full: false });
  f.fit();
  assert.equal(f.state.fontWrites.length, 9, 'initial probe, seven binary probes and final font write');
  assert.equal(f.text.style.fontSize, '14.59375px', 'the established search result remains unchanged');
  assert.equal(f.text.dataset.rulesComplete, 'true');
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  assert.equal(f.text.style.maxHeight, '100%');
  assert.equal(f.layer.clientHeight, 45);
}));

test('a mixed batch fits floor, shrink and already-fitting rows while applying all final layouts', () => withKitDom(() => {
  invalidateLayoutMetrics();
  const floor = fixture({ chars: 500, width: 110, height: 26, full: false });
  const shrink = fixture({ chars: 40, width: 180, height: 45, full: false });
  const short = fixture({ chars: 3, width: 110, height: 26, full: false });
  const faces = [floor, shrink, short], layers = [];
  for (const f of faces) {
    const layer = { style: {}, dataset: { cardLayer: '4' } }, original = f.face.querySelectorAll;
    layers.push(layer);
    f.face.querySelectorAll = selector => selector === '[data-card-layer]' ? [layer] : original(selector);
  }
  fitIllustratedCards(faces.map(f => ({ querySelector: () => f.face })));
  assert.deepEqual(faces.map(f => f.state.fontWrites.length), [2, 9, 2]);
  assert.deepEqual(faces.map(f => f.text.style.fontSize), ['11px', '14.59375px', '11px']);
  assert.deepEqual(faces.map(f => f.text.dataset.rulesComplete), ['false', 'true', 'true']);
  assert.deepEqual(faces.map(f => f.text.style.maxHeight), ['calc(100% - 9px)', '100%', '100%']);
  assert.deepEqual(faces.map(f => f.layer.clientHeight), [26, 45, 26]);
  assert.ok(layers.every(layer => layer.style.zIndex), 'native applyCardLayouts visits every row owner');
}));
