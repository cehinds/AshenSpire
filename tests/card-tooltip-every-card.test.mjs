import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { cardDetailHtml } from '../src/ui/components/card.js';

// A maneuver word ('attack'/'defend') has no stance row; opening such a card's
// tooltip threw "Unknown stance id 'attack'" and broke the inspect door.
test('every authored card and its upgrade opens a tooltip without throwing', () => {
  const registries = createRegistries(contentBundle);
  const failures = [];
  for (const card of registries.cards.all()) {
    for (const upgraded of [false, true]) {
      try { cardDetailHtml(registries, { cardId: card.id, upgraded }); }
      catch (error) { failures.push(`${card.id}${upgraded ? '+' : ''}: ${error.message}`); }
    }
  }
  assert.deepEqual(failures, []);
});
