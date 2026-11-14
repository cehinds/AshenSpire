import test from 'node:test';
import assert from 'node:assert/strict';
import { fitIllustratedCards as fitCards } from '../src/ui/components/illustratedCardFitter.js';
import { invalidateLayoutMetrics } from '../src/ui/layoutMetrics.js';
import { withKitDom } from './helpers/dom.mjs';

const fitIllustratedCards = cards => withKitDom(() => { invalidateLayoutMetrics(); fitCards(cards); });

// Deterministic layout fixture: each character has a fixed em advance and
// the line box follows the line height the fitter writes (1.05 compact). This exercises
// the fitter's measurements and mutations; browser QA validates actual fonts.
function faceFixture(lengths, { width = 120, height = 25.66 } = {}) {
  const clauses = lengths.map(length => ({ style: {}, length }));
  const layer = { style: { top: '60%', height: '20%' }, get clientHeight() { return height; } };
  const text = { style: {}, parentElement: layer,
    dataset: { cardBinding: 'rules', faceLines: 'true', maxLines: '3', minFont: '18', maxFont: '24' },
    querySelectorAll: selector => selector === '[data-face-clause]' ? clauses : [],
    querySelector: () => null,
    get clientWidth() { return width * 5 / 6; },
    get scrollWidth() { return this.clientWidth; },
    get scrollHeight() {
      const size = parseFloat(this.style.fontSize) || 8;
      const count = clauses.filter(node => node.style.display !== 'none')
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
  return { card, face, text, clauses, layer,
    resize: (nextWidth, nextHeight) => { width = nextWidth; height = nextHeight; } };
}

// Owner 2026-11-02: no Inspect replacement. Every clause stays on the face; the font shrinks to the floor.
// Wave 2 (sizes): the floor is 13 px (rulesText.minPx), so a face that cannot fit its words at 13 px keeps them all, at 13 px,
// and says so (rulesOverflow) for the Inspect cue instead of shrinking to an unreadable size.
test('an overflowing primary keeps every clause and shrinks down to the 13px floor, never under it', () => {
  const f = faceFixture([80, 10]);
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === ''), 'no clause is hidden');
  assert.equal(parseFloat(f.text.style.fontSize), 13, 'shrinks to the configured 13px floor and stops there');
  assert.equal(f.face.dataset.rulesOverflow, 'true', 'it does not fit at the floor, so the face says so');
  assert.equal(f.text.dataset.rulesComplete, 'false');
});

test('a primary that fits at the 13px floor keeps every clause and reports no overflow', () => {
  const f = faceFixture([20, 10], { width: 240, height: 80 });
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === ''));
  assert.ok(parseFloat(f.text.style.fontSize) >= 13, 'never under the 13px floor');
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  assert.equal(f.text.dataset.rulesComplete, 'true');
});

test('three physical lines in a short bay keep their words', () => {
  const f = faceFixture([45], { width: 124, height: 27.61 });
  fitIllustratedCards([f.card]);
  assert.equal(f.clauses[0].style.display, '');
});

test('a secondary clause stays when the font can shrink to fit both', () => {
  const f = faceFixture([15, 15], { width: 240, height: 60 });
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === ''));
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  assert.ok(f.text.scrollHeight <= f.layer.clientHeight + 1);
});

test('resizing a face re-fits it and never swaps in the Inspect text', () => {
  const f = faceFixture([40, 10]);
  fitIllustratedCards([f.card]);
  f.resize(240, 80);
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === ''));
  assert.equal(f.face.dataset.rulesOverflow, 'false');
  f.resize(120, 25.66);
  fitIllustratedCards([f.card]);
  assert.ok(f.clauses.every(clause => clause.style.display === ''));
});
