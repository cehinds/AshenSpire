import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { bindCardInspection } from '../src/ui/components/cardInspection.js';
import { beatsSpent, clearSelection, resetSelection, spendSelectingBeat } from '../src/ui/components/cardSelection.js';

// A completed hand hold can repaint the selected card before Information's
// authored delay expires. Exercise the real bindings across that replacement.
function card(document, identity, open = () => {}) {
  const node = document.createElement('article');
  node.dataset.instanceId = identity;
  node.style.getPropertyValue = key => key === '--card-info-delay' ? '40ms' : '';
  bindCardInspection(node, { title: identity, open });
  return node;
}

test('a selected replacement reveals Information without a second selection gesture', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom(({ document, Event }) => {
    resetSelection();
    try {
      let opens = 0, selections = 0;
      document.body.addEventListener('cardinspectionselect', () => { selections++; });
      const original = card(document, 'strike'); document.body.append(original);
      original.dispatchEvent(new Event('cardholdstart'));
      spendSelectingBeat('strike');
      t.mock.timers.tick(20);
      original.remove();
      const replacement = card(document, 'strike', () => { opens++; }); document.body.append(replacement);
      assert(replacement.classList.contains('inspection-selected'));
      assert(!replacement.classList.contains('inspection-info-visible'));
      assert.equal(beatsSpent('strike'), 1, 'the replacement keeps the selecting beat');
      t.mock.timers.tick(40);
      assert(replacement.classList.contains('inspection-info-visible'), 'Information appears on the live replacement');
      assert(!original.classList.contains('inspection-info-visible'), 'the detached card never reveals');
      assert.equal(selections, 1, 'adoption cannot dispatch another host selection or repaint');
      replacement.querySelector('.card-info-button').click();
      assert.equal(opens, 1, 'the replacement Information control opens its own reading');
    } finally { clearSelection(); resetSelection(); }
  });
});

test('dousing a replacement cancels its pending Information reveal', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom(({ document, Event }) => {
    resetSelection();
    try {
      const original = card(document, 'settle'); document.body.append(original);
      original.dispatchEvent(new Event('cardholdstart'));
      original.remove();
      const replacement = card(document, 'settle'); document.body.append(replacement);
      clearSelection();
      t.mock.timers.tick(80);
      assert(!replacement.classList.contains('inspection-selected'));
      assert(!replacement.classList.contains('inspection-info-visible'));
      assert(!original.classList.contains('inspection-info-visible'));
    } finally { clearSelection(); resetSelection(); }
  });
});
