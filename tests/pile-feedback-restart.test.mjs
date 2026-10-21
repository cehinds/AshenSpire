import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the shipped private feedback functions and animationend registration,
// without mounting combat or copying their logic into the test.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = source.indexOf('  function clearCardFeedback()');
const end = source.indexOf('\n  // Fly only accepted plays', start);
assert.ok(start >= 0 && end > start);
function fixture({ reduced = false } = {}) {
  const classes = new Set(), calls = [], handlers = new Map(), attrs = new Map();
  const pile = {
    dataset: {},
    classList: {
      contains: name => classes.has(name),
      add(name) { calls.push('add'); classes.add(name); },
      remove(name) { calls.push('remove'); classes.delete(name); },
    },
    setAttribute(name, value) { attrs.set(name, value); },
    addEventListener(name, callback) { handlers.set(name, callback); },
    get offsetWidth() { calls.push('measure'); return 44; },
  };
  let cancelled = 0;
  const cardFlights = new Set([{ cancel() { cancelled++; } }]);
  const api = runInNewContext(`${source.slice(start, end)}\n({ showPileFeedback, clearCardFeedback });`, {
    $: () => pile, combat: { piles: { discard: [{ instanceId: 'c1' }] } },
    reducedMotionRequested: () => reduced, cardFlights, app: { querySelectorAll: () => [] },
  });
  return { ...api, pile, calls, attrs, handlers, cardFlights, cancelled: () => cancelled };
}
const discarded = [{ type: 'cardPlayed', cardInstanceId: 'c1' }];

test('first discard starts its animation without a forced layout', () => {
  const f = fixture(); f.showPileFeedback(discarded);
  assert.deepEqual(f.calls, ['add']);
  assert.equal(f.pile.dataset.cardOutcome, 'discard');
  assert.equal(f.attrs.get('aria-description'), '1 discarded');
});

test('an overlapping receipt still removes, measures, and re-adds to restart', () => {
  const f = fixture(); f.showPileFeedback(discarded); f.calls.length = 0;
  f.showPileFeedback([{ type: 'cardExhausted', cardInstanceId: 'c2' }]);
  assert.deepEqual(f.calls, ['remove', 'measure', 'add']);
  assert.equal(f.pile.dataset.cardOutcome, 'exhaust');
  assert.equal(f.attrs.get('aria-description'), '1 exhausted');
});

test('only the pile animation end clears its class, allowing a later cold start', () => {
  const f = fixture(); f.showPileFeedback(discarded);
  const end = f.handlers.get('animationend');
  end({ target: {}, currentTarget: f.pile });
  assert.equal(f.pile.classList.contains('pile-received'), true, 'a child animation cannot clear pile feedback');
  end({ target: f.pile, currentTarget: f.pile }); f.calls.length = 0;
  f.showPileFeedback(discarded);
  assert.deepEqual(f.calls, ['add']);
});

test('skipped playback clears feedback and records outcomes without restarting', () => {
  const f = fixture(); f.showPileFeedback(discarded); f.calls.length = 0;
  f.clearCardFeedback(); f.showPileFeedback(discarded, false);
  assert.deepEqual(f.calls, ['remove']);
  assert.equal(f.pile.classList.contains('pile-received'), false);
  assert.equal(f.cardFlights.size, 0); assert.equal(f.cancelled(), 1);
  assert.equal(f.attrs.get('aria-description'), '1 discarded');
});

test('reduced motion and non-discarded plays never request animation layout', () => {
  const reduced = fixture({ reduced: true }); reduced.showPileFeedback(discarded);
  assert.deepEqual(reduced.calls, []);
  assert.equal(reduced.attrs.get('aria-description'), '1 discarded');
  const power = fixture(); power.showPileFeedback([{ type: 'cardPlayed', cardInstanceId: 'power' }]);
  assert.deepEqual(power.calls, []); assert.deepEqual(power.pile.dataset, {});
});
