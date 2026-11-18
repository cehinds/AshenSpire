import test from 'node:test';
import assert from 'node:assert/strict';
import { OfferPicksLeft, IsBonusOption } from '../src/model/gameProfileRewards.js';

// Owner 2026-11-18: "Rank up a card" is its own step after the card pick, never one of the card picks.
test('a rank-up option, flagged or not, never uses a card pick', () => {
  assert.equal(IsBonusOption({ kind: 'rankUps' }), true);
  assert.equal(IsBonusOption({ kind: 'rankUps', bonus: true }), true);
  assert.equal(IsBonusOption({ kind: 'combatCards', id: 'x' }), false);
  // An older saved offer: the rank-up has no bonus flag and sits among the cards.
  const offer = { options: [{ kind: 'combatCards', id: 'a' }, { kind: 'combatCards', id: 'b' }, { kind: 'rankUps' }], takeCount: 1, taken: [], claimed: null };
  assert.equal(OfferPicksLeft(offer), 2, 'one card pick plus the rank-up step');
  assert.equal(OfferPicksLeft({ ...offer, taken: [1] }), 1, 'the card is taken; the rank-up step is still owed');
  assert.equal(OfferPicksLeft({ ...offer, taken: [1, 2] }), 0);
});
