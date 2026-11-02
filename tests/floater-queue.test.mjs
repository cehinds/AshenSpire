import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloaterQueue, isDamageFloater, FLOATER_QUEUE_MAX } from '../src/ui/floaterQueue.js';
import { floaterLanesFit } from '../src/ui/fx.js';

test('at most three non-damage floaters show at once', () => {
  const q = createFloaterQueue();
  const shown = ['a', 'b', 'c', 'd', 'e'].map((id) => q.push({ id }));
  assert.equal(FLOATER_QUEUE_MAX, 3);
  assert.deepEqual(shown.map((x) => x && x.id), ['a', 'b', 'c', null, null]);
  assert.equal(q.visible.length, 3);
  assert.deepEqual(q.waiting.map((x) => x.id), ['d', 'e']);
});

test('queue is FIFO and a finished floater frees its lane for the next', () => {
  const q = createFloaterQueue();
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  items.forEach((i) => q.push(i));
  assert.equal(q.release(items[1]).id, 'd');
  assert.deepEqual(q.visible.map((x) => x.id), ['a', 'c', 'd']);
  assert.equal(q.release(items[0]).id, 'e');
  assert.equal(q.release(items[2]), null);
  assert.deepEqual(q.visible.map((x) => x.id), ['d', 'e']);
  assert.equal(q.release({ id: 'ghost' }), null);
});

test('damage numbers are excluded from the queue', () => {
  for (const cls of ['dmg', 'dmg heavy', 'burst', 'crit', 'pct20 dmg', 'pct35']) assert.equal(isDamageFloater(cls), true, cls);
  for (const cls of ['blk', 'heal', 'blk small', 'ward small', 'poise small', 'barrier']) assert.equal(isDamageFloater(cls), false, cls);
});

test('a lowered max shows fewer at once and holds the rest until a lane frees', () => {
  const q = createFloaterQueue();
  q.max = 1;
  const items = ['a', 'b', 'c'].map((id) => ({ id }));
  assert.equal(q.push(items[0]).id, 'a');
  assert.equal(q.push(items[1]), null);
  assert.equal(q.push(items[2]), null);
  assert.equal(q.release(items[0]).id, 'b');
  assert.deepEqual(q.visible.map((x) => x.id), ['b']);
  q.max = 2;
  assert.equal(q.release(items[1]).id, 'c');
});

test('lane fit above a HUD: one line, then 1.35 lines per extra lane, minus the 40 px edge reserve', () => {
  assert.equal(floaterLanesFit(59, 20), 0);
  assert.equal(floaterLanesFit(60, 20), 1);
  assert.equal(floaterLanesFit(40 + 20 + 27, 20), 2);
  assert.equal(floaterLanesFit(40 + 20 + 54, 20), 3);
});
