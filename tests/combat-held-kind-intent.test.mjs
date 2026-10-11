import test from 'node:test';
import assert from 'node:assert/strict';
import { createStanceLedger, kindForCard, stanceForCard } from '../src/model/alternativeStance.js';

// The player's at-rest intent glyph reads the last confirmed card's authored
// kind (smash, counter, defend, sweep, spell), not the broad stance family.
test('a confirmed card keeps its authored kind until the next player turn', () => {
  const kinds = createStanceLedger(kindForCard);
  assert.equal(kinds.get(), null);
  assert.equal(kinds.accept({ type: 'cardPlayed', cardId: 'defend' }).maneuver, 'defend');
  assert.equal(kinds.get().maneuver, 'defend');
  kinds.accept({ type: 'cardPlayed', cardId: 'shieldBash' });
  assert.equal(kinds.get().maneuver, 'smash', 'the later confirmed card replaces the kind');
  kinds.accept({ type: 'playerTurnStart' });
  assert.equal(kinds.get(), null);
});

test('the default ledger still records the broad stance family', () => {
  const stances = createStanceLedger();
  assert.equal(stances.accept({ type: 'cardPlayed', cardId: 'defend' }), 'defensive');
  assert.equal(stanceForCard({ id: 'strike' }), 'offensive');
  assert.equal(kindForCard({ id: 'strike' }).maneuver, 'attack');
});
