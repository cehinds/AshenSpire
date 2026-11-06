// Owner 2026-11-06: every enemy-turn beat (move word, hit/miss, reaction, damage) completes before the Player Turn
// ribbon. A reaction answered during the enemy's turn lets the dispatch finish that turn at once (the engine is then in
// the player's phase), so the screen must keep enemyPlayback on until the resumed playback ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = source.indexOf('  function answerReaction('), end = source.indexOf('\n  }', start);
assert.ok(start >= 0 && end > start, 'answerReaction is in the screen');
const shipped = source.slice(start, end + 4);

function answer(phaseBefore, { cursor = null } = {}) {
  const combat = { phase: phaseBefore, reactionCursor: cursor, pendingReaction: { id: 'offer', ownerId: 'player', options: [] } };
  const context = {
    combat, combatEl: { isConnected: true }, enemyPlayback: false, disp: null, console,
    takeSnapshot: () => ({}), reactionKind: () => null, recordManualReaction() {}, run: {}, ownSeat: () => 'player',
    // The resumed dispatch finishes the enemy's turn: the engine is in the player's phase when it returns.
    dispatch: () => { combat.phase = 'player'; combat.reactionCursor = null; combat.pendingReaction = null; return { events: [] }; },
    setBusy() {}, afterDispatch() {}, render() {}, showPendingReaction() {},
  };
  runInNewContext(`${shipped}\nanswerReaction({ offerId: 'offer', optionId: null }, false);\nglobalThis.result = enemyPlayback;`, context);
  return context.result;
}

test('answering a reaction offered in the enemy turn keeps the enemy playback (Enemy Turn ribbon) until its beats end', () => {
  assert.equal(answer('enemy'), true);
  assert.equal(answer('player', { cursor: { index: 0 } }), true, 'a reaction cursor also marks the enemy turn');
});

test('a reaction in the player turn does not start an enemy playback', () => {
  assert.equal(answer('player'), false);
});
