import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
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

// Unarmed, the player's figure shows the last confirmed kind; an armed card wins.
test('an unarmed player shows the last confirmed kind, an armed card its own', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('  function armSelf(', begin);
  const actions = [];
  const leading = { querySelector: () => null, append: action => actions.push(action) };
  const context = {
    combat: {}, upcastRanksByCard: new Map(), resolveCombatCard: () => ({ id: 'shieldBash' }), combatProfileFor, selfArm: null,
    playerActionIntent: profile => ({ profile }), playCard() {}, selectCombatant() {},
    combatEl: { dispatchEvent() {} }, CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const sync = runInNewContext(`${source.slice(begin, end)}\nsyncPlayerActionIntent`, context);
  sync({ querySelector: () => leading }, null, kindForCard({ id: 'defend' }));
  assert.equal(actions.at(-1).profile.maneuver, 'defend', 'the held kind shows while nothing is armed');
  sync({ querySelector: () => leading }, { instanceId: 'x', cardId: 'shieldBash' }, kindForCard({ id: 'defend' }));
  assert.equal(actions.at(-1).profile.maneuver, 'smash', 'the armed card wins over the held kind');
});

// Owner (2026-10-11): the figure shows its intent glyph with nothing played.
// Before a card is confirmed, the neutral resting mark is what it shows.
test('with nothing confirmed or armed, the figure shows the neutral resting mark', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('  function armSelf(', begin);
  const actions = [];
  const leading = { querySelector: () => null, append: action => actions.push(action) };
  const context = {
    combat: {}, upcastRanksByCard: new Map(), resolveCombatCard: () => ({ id: 'shieldBash' }), combatProfileFor, selfArm: null,
    RESTING_PLAYER_ACTION: { maneuver: 'ready' },
    playerActionIntent: profile => ({ profile }), playCard() {}, selectCombatant() {},
    combatEl: { dispatchEvent() {} }, CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const sync = runInNewContext(`${source.slice(begin, end)}\nsyncPlayerActionIntent`, context);
  sync({ querySelector: () => leading }, null, null);
  assert.equal(actions.length, 1, 'a glyph is appended with nothing played');
  assert.equal(actions[0].profile.maneuver, 'ready');
  sync({ querySelector: () => leading }, null);
  assert.equal(actions.length, 2, 'a turn-start clear (no held kind) still shows the mark');
  const overhead = readFileSync(new URL('../src/ui/components/combatantOverhead.js', import.meta.url), 'utf8');
  assert.match(overhead, /ready: 'prepare'/, 'the resting mark draws the neutral prepare sigil');
  assert.match(overhead, /export const RESTING_PLAYER_ACTION = Object\.freeze\(\{ maneuver: 'ready' \}\);/);
});
