// Playtest 2026-11-17 (item 34): at the start of a turn the last hand is visibly discarded, then the new hand is drawn;
// a retained card stays, and the draw is quicker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ApplyTurnReturn } from '../src/ui/models/CombatPlaybackModel.js';

const card = (instanceId) => ({ instanceId, cardId: instanceId });

test('a turn-start shuffle drops every shown card the new turn did not keep, a card drawn again included', () => {
  const shuffle = { type: 'deckShuffled', reason: 'configuredRoundRefresh' };
  const playbackEvents = [{ type: 'enemyTurnEnd' }, shuffle, { type: 'cardDrawn', cardInstanceId: 'b' },
    { type: 'cardDrawn', cardInstanceId: 'd' }, { type: 'playerTurnStart' }, { type: 'cardDrawn', cardInstanceId: 'later' }];
  const disp = { hand: ['a', 'b', 'c', 'kept'].map(card) };
  const combat = { piles: { hand: ['kept', 'b', 'd'].map(card) } };
  ApplyTurnReturn(disp, shuffle, { combat, playbackEvents });
  assert.deepEqual(disp.hand.map((c) => c.instanceId), ['kept'], 'only the retained card stays shown');
  assert.deepEqual([...disp.turnRefresh.drawnIds], ['b', 'd'], 'the new hand is the draws up to the turn start');
});

test('a turn-end discard marks the refresh but leaves its own card to the discard receipt', () => {
  const discard = { type: 'cardDiscarded', reason: 'turnEnd', cardInstanceId: 'a' };
  const disp = { hand: ['a', 'kept'].map(card) };
  ApplyTurnReturn(disp, discard, { combat: { piles: { hand: [card('kept')] } }, playbackEvents: [discard, { type: 'cardDrawn', cardInstanceId: 'n' }] });
  assert.deepEqual(disp.hand.map((c) => c.instanceId), ['a', 'kept']);
  assert.deepEqual([...disp.turnRefresh.drawnIds], ['n']);
});

test('the hand strip discards the leaving cards before the arrivals, and the draw is quicker', () => {
  const hand = readFileSync(new URL('../src/ui/components/hand.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const visuals = readFileSync(new URL('../styles/combat-visuals.css', import.meta.url), 'utf8');
  assert.match(hand, /if \(refresh && record\.el\.isConnected\) discardOut\(record\.el\); else record\.el\.remove\(\);/);
  assert.match(hand, /const refresh = turnRefresh && animateArrival && !reducedMotionRequested\(\)/, 'reduced motion skips it');
  assert.match(css, /--hand-draw-ms: 160ms; --hand-discard-ms: 200ms;/);
  assert.match(css, /\.hand \.card\.card-drawn \{ animation: card-arrive var\(--hand-draw-ms\) ease-out; \}/);
  assert.match(visuals, /\.card\.card-drawn\.card-drawn-after-discard \{ animation: card-arrive-turn var\(--hand-draw-ms, 160ms\) ease-out var\(--hand-discard-ms, 200ms\) backwards; \}/,
    'the new hand waits for the discard');
});
