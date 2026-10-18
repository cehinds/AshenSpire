import test from 'node:test';
import assert from 'node:assert/strict';
import { runActionTimeline } from '../src/ui/actionTimeline.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

function clock() {
  let now = 0, id = 0;
  const timers = new Map();
  return { get now() { return now; }, setTimer(fn, ms) { timers.set(++id, { fn, at: now + ms }); return id; },
    clearTimer(key) { timers.delete(key); },
    advance(ms) { const end = now + ms; for (;;) { const next = [...timers.entries()].sort((a,b) => a[1].at - b[1].at || a[0] - b[0])[0]; if (!next || next[1].at > end) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); } now = end; },
    get pending() { return timers.size; } };
}
function run(multiplier = 1) {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: multiplier });
  const c = clock(), trace = [], timing = actionPacing();
  const handle = runActionTimeline([{ actorId: 'player', kind: 'attack' }, { actorId: 'enemy', kind: 'counter' }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onFlush: () => trace.push(['flush', '', c.now]), onDone: () => trace.push(['done', '', c.now]),
  }, timing, c);
  return { c, trace, handle };
}
test('ordered actions and counters finish every stage before the next actor begins', () => {
  const { c, trace } = run(); c.advance(20000);
  const expected = ['intent', 'action', 'sprite', 'contact', 'reaction', 'damage', 'hud', 'resolution'];
  assert.deepEqual(trace.slice(0, 8).map(row => row[0]), expected);
  assert.deepEqual(trace.slice(8, 16).map(row => row[0]), expected);
  assert.deepEqual(trace.slice(0, 8).map(row => row[2]), [0, 500, 1000, 1195, 1890, 2390, 2390, 2390]);
  assert.equal(trace.at(-1)[0], 'done'); assert.equal(c.pending, 0);
});
test('× speed scales every action stage and sprite while retaining receipt order', () => {
  const normal = run(), fast = run(2); normal.c.advance(20000); fast.c.advance(20000);
  assert.deepEqual(fast.trace.map(row => [row[0], row[1], row[2] * 2]), normal.trace);
  setCombatPacing();
});
test('cancel and repeated skips flush once and leave no late mutation or next action', () => {
  const { c, trace, handle } = run(); c.advance(1100); handle.cancel(); handle.skip(); c.advance(20000);
  assert.deepEqual(trace.map(row => row[0]), ['intent', 'action', 'sprite', 'flush', 'done']);
  assert.equal(c.pending, 0); assert.equal(handle.finished, true);
});
test('instant and reduced motion retain semantic event order with zero waits', () => {
  setAnimSpeed('instant'); const instant = actionPacing();
  assert.equal(instant.intentMs + instant.wordMs + instant.afterSpriteMs + instant.reactionMs, 0);
  setAnimSpeed('normal'); assert.equal(actionPacing({ reduced: true }).scale, 0);
});

test('watchdog extends to the real authored handle when its estimate is too short', () => {
  const c = clock(), trace = [];
  const timing = { intentMs: 500, wordMs: 500, afterSpriteMs: 500, reactionMs: 500, stepMs: 0, bannerMs: 0, spriteSpeed: {} };
  runActionTimeline([{ actorId: 'p', kind: 'attack' }], {
    maxSpriteMs: () => 1,
    onSprite: () => ({ impactMs: 5000, totalMs: 10000, cancel() {} }),
    onFlush: () => trace.push('flush'), onDone: () => trace.push('done'),
  }, timing, c);
  c.advance(6000); assert.deepEqual(trace, [], 'the underestimated watchdog cannot finish a live clip');
  c.advance(10000); assert.deepEqual(trace, ['done']); assert.equal(c.pending, 0);
});
