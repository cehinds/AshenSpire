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

// Review on #2835: an older saved offer whose rank-up was taken as the single plain pick must not allow an extra card pick.
test('an older offer whose rank-up was taken as its plain pick leaves no card pick', () => {
  const offer = { options: [{ kind: 'combatCards', id: 'a' }, { kind: 'combatCards', id: 'b' }, { kind: 'rankUps' }], takeCount: 1, taken: [2], claimed: null };
  assert.equal(OfferPicksLeft(offer), 0);
  assert.equal(OfferPicksLeft({ ...offer, taken: [] }), 2, 'untaken it is still its own step');
  // A new offer flags its rank-up: taking it first leaves the card pick.
  assert.equal(OfferPicksLeft({ ...offer, options: [...offer.options.slice(0, 2), { kind: 'rankUps', bonus: true }] }), 1);
});
