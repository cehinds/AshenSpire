import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards as fitCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const fitIllustratedCards = cards => withKitDom(() => { invalidateLayoutMetrics(); fitCards(cards); });

// Deterministic layout fixture: each character has a fixed em advance and
// the line box follows the line height the fitter writes (1.05 compact). This exercises
// the fitter's measurements and mutations; browser QA validates actual fonts.
function faceFixture(lengths, { width = 120, height = 25.66 } = {}) {
  const clauses = lengths.map(length => ({ style: {}, length }));
  const fallback = { style: { display: 'none' }, length: 'Inspect full effect.'.length };
  const fallbackShort = { style: { display: 'none' }, length: 'Inspect.'.length };
  const layer = { style: { top: '60%', height: '20%' }, get clientHeight() { return height; } };
  const text = { style: {}, parentElement: layer,
    dataset: { cardBinding: 'rules', faceLines: 'true', maxLines: '3', minFont: '18', maxFont: '24' },
    querySelectorAll: selector => selector === '[data-face-clause]' ? clauses : [],
    querySelector: selector => selector === '[data-face-fallback]' ? fallback : selector === '[data-face-fallback-short]' ? fallbackShort : null,
    get clientWidth() { return width * 5 / 6; },
    get scrollWidth() { return this.clientWidth; },
    get scrollHeight() {
      const size = parseFloat(this.style.fontSize) || 8;
      const count = [...clauses, fallback, fallbackShort].filter(node => node.style.display !== 'none')
        .reduce((sum, node) => sum + node.length, 0);
      return Math.ceil(count / Math.floor(this.clientWidth / (size * 0.55))) * size * (parseFloat(this.style.lineHeight) || 1.25);
    },
  };
  const face = { dataset: { designWidth: '360' },
    get textContent() { return lengths.join(','); },
    get clientWidth() { return width; },
    querySelectorAll: selector => selector === '.ic-text[data-auto-fit="true"]' ? [text] : [],
    querySelector: () => null,
  };
  const card = { querySelector: () => face };
  return { card, face, text, clauses, fallback, fallbackShort, layer,
    resize: (nextWidth, nextHeight) => { width = nextWidth; height = nextHeight; } };
}

test('an overflowing primary switches whole to Information at the readable floor', () => {
  const f = faceFixture([80, 10]);
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === 'none'));
  // The full fallback renders in two lines at the floor, so it is chosen over "Inspect.".
  assert.equal(f.fallback.style.display, 'inline');
  assert.equal(f.fallbackShort.style.display, 'none');
  assert.equal(f.face.dataset.rulesFallback, 'true');
  assert.equal(f.face.dataset.rulesExpanded, 'false');
  assert.equal(parseFloat(f.text.style.fontSize), 11);
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
});

test('three physical lines that exceed a short rules bay also switch whole', () => {
  const f = faceFixture([45], { width: 124, height: 27.61 });
  fitIllustratedCards([f.card]);
  assert.equal(f.fallback.style.display, 'inline');
  assert.equal(f.face.dataset.rulesFallback, 'true');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
});

test('dropping a secondary keeps the complete primary when it fits', () => {
  const f = faceFixture([15, 65]);
  fitIllustratedCards([f.card]);
  assert.equal(f.clauses[0].style.display, '');
  assert.equal(f.clauses[1].style.display, 'none');
  assert.equal(f.fallback.style.display, 'none');
  assert.equal(f.face.dataset.rulesFallback, 'false');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
});

test('120 to 240 to 120 restores both clauses and then the whole Information fallback', () => {
  const f = faceFixture([40, 10]);
  fitIllustratedCards([f.card]);
  assert.equal(f.fallback.style.display, 'inline');
  f.resize(240, 80);
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === ''));
  assert.equal(f.fallback.style.display, 'none');
  assert.equal(f.fallbackShort.style.display, 'none');
  assert.equal(f.face.dataset.rulesFallback, 'false');
  assert.ok(f.text.scrollHeight <= Math.min(f.layer.clientHeight, parseFloat(f.text.style.fontSize) * 1.05 * 2) + 1);
  f.resize(120, 25.66);
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === 'none'), 'no selected first-clause fragment remains clipped');
  assert.equal(f.fallback.style.display, 'inline');
  assert.equal(f.face.dataset.rulesFallback, 'true');
  assert.ok(f.text.scrollHeight <= Math.min(f.layer.clientHeight, parseFloat(f.text.style.fontSize) * 1.05 * 2) + 1);
});
