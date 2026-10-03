import test from 'node:test';
import assert from 'node:assert/strict';
import { spentPileView, SPENT_PILES } from '../src/ui/models/PileViewerModel.js';

const piles = {
  discard: [{ instanceId: 'a', cardId: 'strike' }, { instanceId: 'b', cardId: 'guard' }],
  exhaust: [],
};

test('the rail names both piles with their counts; one is selected', () => {
  const view = spentPileView(piles);
  assert.deepEqual(view.tabs.map((t) => [t.id, t.label, t.selected]), [['discard', 'Discard (2)', true], ['exhaust', 'Exhaust (0)', false]]);
  assert.deepEqual([...SPENT_PILES], ['discard', 'exhaust']);
});

test('the reading follows the selection and starts on the first card', () => {
  assert.equal(spentPileView(piles).detail.instanceId, 'a');
  assert.equal(spentPileView(piles, 'discard', 'b').detail.instanceId, 'b');
  // A selection from the other pile is not carried over.
  assert.equal(spentPileView(piles, 'discard', 'zz').detail.instanceId, 'a');
});

test('an empty pile says so and reads nothing; an unknown pile is refused', () => {
  const view = spentPileView(piles, 'exhaust');
  assert.equal(view.empty, true);
  assert.equal(view.detail, null);
  assert.throws(() => spentPileView(piles, 'draw'), /Unknown pile/);
});

test('viewing never changes the piles it reads', () => {
  const before = JSON.stringify(piles);
  spentPileView(piles, 'discard', 'b');
  assert.equal(JSON.stringify(piles), before);
});
