import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { bindCardInspection } from '../src/ui/components/cardInspection.js';
import { beatsSpent, clearSelection, resetSelection, spendSelectingBeat } from '../src/ui/components/cardSelection.js';

// A completed hand hold can repaint the selected card. Exercise the real
// bindings across that replacement: the rebuilt card keeps the selection and
// still opens its own reading (right-click), with no (i) badge anywhere.
function card(document, identity, open = () => {}) {
  const node = document.createElement('article');
  node.dataset.instanceId = identity;
  bindCardInspection(node, { title: identity, open });
  return node;
}

test('a selected replacement keeps the selection and opens its own reading', () => {
  withKitDom(({ document, Event }) => {
    resetSelection();
    try {
      let opens = 0, selections = 0;
      document.body.addEventListener('cardinspectionselect', () => { selections++; });
      const original = card(document, 'strike'); document.body.append(original);
      original.dispatchEvent(new Event('cardholdstart'));
      spendSelectingBeat('strike');
      original.remove();
      const replacement = card(document, 'strike', () => { opens++; }); document.body.append(replacement);
      assert(replacement.classList.contains('inspection-selected'));
      assert.equal(replacement.querySelector('.card-info-button'), null, 'no (i) badge is built');
      assert.equal(beatsSpent('strike'), 1, 'the replacement keeps the selecting beat');
      assert.equal(selections, 1, 'adoption cannot dispatch another host selection or repaint');
      replacement.dispatchEvent(new Event('contextmenu', { cancelable: true }));
      assert.equal(opens, 1, 'a right-click opens the replacement\'s own reading');
      assert.equal(beatsSpent('strike'), 1, 'reading spends the beat rather than resetting it');
    } finally { clearSelection(); resetSelection(); }
  });
});

test('the I key on a focused card opens its reading; other keys do not', () => {
  withKitDom(({ document, Event }) => {
    resetSelection();
    try {
      let opens = 0;
      const node = card(document, 'keyed', () => { opens++; }); document.body.append(node);
      node.dispatchEvent(new Event('keydown', { key: 'x', target: node }));
      assert.equal(opens, 0);
      node.dispatchEvent(new Event('keydown', { key: 'i', target: node, cancelable: true }));
      assert.equal(opens, 1);
    } finally { clearSelection(); resetSelection(); }
  });
});
