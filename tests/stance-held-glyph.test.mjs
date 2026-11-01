import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdsChosenStance, createStanceLedger } from '../src/model/alternativeStance.js';

// Owner bug 2026-11-01: a Smash glyph stayed over the player at turn start while a Poise break had ended the real
// stance, so Sundering Art showed its full 2 SP. The held glyph must not outlive the engine's stance.
test('only a chosen engine stance counts as held', () => {
  assert.equal(holdsChosenStance({ combatStance: { maneuver: 'smash', camp: 'physical' } }), true);
  assert.equal(holdsChosenStance({ combatStance: { maneuver: 'casting', camp: 'spell' } }), true);
  for (const entity of [undefined, {}, { combatStance: { maneuver: 'staggered' } }, { combatStance: { maneuver: 'neutral' } }]) {
    assert.equal(holdsChosenStance(entity), false);
  }
});

test('a ledger reset returns the glyph to nothing held', () => {
  const ledger = createStanceLedger(card => card);
  ledger.accept({ type: 'cardPlayed', sourceId: 'player' }, { maneuver: 'smash' });
  assert.equal(ledger.get('player').maneuver, 'smash');
  ledger.reset('player');
  assert.equal(ledger.get('player'), null);
});

test('the combat screen clears the held glyph, pose and card at a player turn start with no engine stance', () => {
  const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(src, /event\.type === 'playerTurnStart' && !holdsChosenStance\(combat\.player\)\) \{ heldStances\.reset\('player'\); heldKinds\.reset\('player'\); heldCards\.reset\('player'\); \}/);
});
