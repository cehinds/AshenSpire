// Playtest 2026-11-17 (item 34): at the start of a turn the last hand is visibly discarded, then the new hand is drawn;
// a retained card stays, and the draw is quicker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ApplyTurnReturn } from '../src/ui/models/CombatPlaybackModel.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountHand } from '../src/ui/components/hand.js';
import { withModalDom } from './helpers/dom.mjs';

const registries = createRegistries(contentBundle);
globalThis.MutationObserver ??= class { observe() {} disconnect() {} takeRecords() { return []; } };

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

test('the draw is quicker and the new hand waits for the discard', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const visuals = readFileSync(new URL('../styles/combat-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /--hand-draw-ms: 160ms; --hand-discard-ms: 200ms;/);
  assert.match(css, /\.hand \.card\.card-drawn \{ animation: card-arrive var\(--hand-draw-ms\) ease-out; \}/);
  assert.match(visuals, /\.card\.card-drawn\.card-drawn-after-discard \{ animation: card-arrive-turn var\(--hand-draw-ms, 160ms\) ease-out var\(--hand-discard-ms, 200ms\) backwards; \}/);
});

// Review on #2814: the discarding faces stay in the strip for their animation, but the new hand's fan, keys and slots
// count only the cards that stay, and the refresh holds no slot of the old fan.
test('five out, five in: the new hand fans as five while the old five drop away', () => withModalDom(() => {
  document.documentElement ??= { dataset: { handLayout: 'paging' }, getAttribute: () => null };
  const make = document.createElement.bind(document);
  document.createElement = (...args) => {
    const el = make(...args), values = new Map();
    Object.assign(el.style, { setProperty: (k, v) => values.set(k, v), getPropertyValue: k => values.get(k) || '', removeProperty: k => values.delete(k) });
    return el;
  };
  const strip = () => {
    const handEl = document.createElement('div');
    Object.defineProperties(handEl, { clientWidth: { get: () => 390 }, clientHeight: { get: () => 250 } });
    handEl.getBoundingClientRect = () => ({ left: 0, top: 500, width: 390, height: 250 });
    document.body.append(handEl);
    return handEl;
  };
  const entries = list => list.map(id => ({ inst: { cardId: 'bashingBlow', instanceId: id }, preview: null, affordable: true, selected: false, surface: 'combat', availability: {} }));
  const oldHand = ['a', 'b', 'c', 'd', 'e'], newHand = ['f', 'g', 'h', 'i', 'j'];
  const slots = el => ['--hand-card-width', '--hand-card-x', '--hand-card-y', '--hand-card-angle'].map(k => el.style.getPropertyValue(k));

  const reference = strip();
  const fresh = mountHand(reference, { registries, reuseCards: true, fitFan: true, animateArrival: true });
  fresh.render({ cards: entries(newHand) });
  const expected = [...reference.children].map(slots);
  fresh.teardown();

  const handEl = strip();
  const hand = mountHand(handEl, { registries, reuseCards: true, fitFan: true, animateArrival: true });
  hand.render({ cards: entries(oldHand) });
  hand.render({ cards: entries(newHand), turnRefresh: { drawnIds: new Set(newHand) } });
  const leaving = [...handEl.children].filter(el => 'discarding' in el.dataset);
  const staying = [...handEl.children].filter(el => !('discarding' in el.dataset));
  assert.equal(leaving.length, 5, 'the old five are still dropping away');
  assert.deepEqual(staying.map(el => el.dataset.instanceId), newHand);
  assert.deepEqual(staying.map(slots), expected, 'the new five take the slots of a five-card fan');
  assert.deepEqual(staying.map(el => el.querySelector(':scope > .key-hint')?.textContent), ['1', '2', '3', '4', '5']);
  assert.ok(staying.every(el => el.classList.contains('card-drawn-after-discard')), 'each new card waits for the discard');
  hand.teardown();
}));
