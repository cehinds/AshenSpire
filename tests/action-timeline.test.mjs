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
  const expected = ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution'];
  assert.deepEqual(trace.slice(0, 9).map(row => row[0]), expected);
  assert.deepEqual(trace.slice(9, 18).map(row => row[0]), expected);
  // D11: a 1000 ms gap at each boundary (action, animation, result, reaction, damage, reset, next).
  assert.deepEqual(trace.slice(0, 9).map(row => row[2]), [0, 0, 1000, 1195, 2390, 3390, 4390, 4390, 5390]);
  assert.equal(trace[9][2], 6390, 'the next actor starts one gap after the reset');
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
  assert.equal(instant.gapMs + instant.wordMs + instant.afterSpriteMs + instant.resultMs + instant.reactionMs + instant.damageMs + instant.resetMs, 0);
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

test('a lost pointer release retains a bounded completion fallback', () => {
  const { c, trace, handle } = run(); c.advance(1100); handle.pauseForSkip(); c.advance(100000);
  assert.equal(handle.finished, true); assert.equal(c.pending, 0);
  assert.equal(trace.filter(row => row[0] === 'flush').length, 1);
  assert.equal(trace.filter(row => row[0] === 'done').length, 1);
  assert.ok(!trace.some(row => row[0] === 'hud'), 'a paused timeline cannot resume stale stages');
});

test('auto-combat runs at its own multiplier, default ×1.5, and manual play keeps combatSpeed', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatSpeed: 2 }); const manual = actionPacing().scale;
  setCombatPacing({ combatSpeed: 2, autoCombat: true }); const auto = actionPacing().scale;
  setCombatPacing({ autoCombat: true, autoCombatSpeed: 99 }); const clamped = actionPacing().scale;
  setCombatPacing({ autoCombat: true, autoCombatSpeed: 0 }); const floor = actionPacing().scale;
  setCombatPacing();
  assert.equal(manual, 1 / 2); assert.equal(auto, 1 / 1.5); assert.equal(clamped, 1 / 3); assert.equal(floor, 1);
});

test('D11: the default gap is 1 s at every stage boundary and the active speed scales it', () => {
  setAnimSpeed('normal'); setCombatPacing();
  const gaps = t => [t.wordMs, t.afterSpriteMs, t.resultMs, t.reactionMs, t.damageMs, t.resetMs];
  const normal = actionPacing();
  assert.equal(normal.gapMs, 1000); assert.equal(normal.intentMs, 0);
  assert.deepEqual(gaps(normal), [1000, 1000, 1000, 1000, 1000, 1000]);
  setCombatPacing({ combatSpeed: 2 }); assert.deepEqual(gaps(actionPacing()), Array(6).fill(500));
  setCombatPacing({ autoCombat: true }); assert.ok(Math.abs(actionPacing().gapMs - 1000 / 1.5) < 1e-9, 'auto-combat defaults to ×1.5');
  setCombatPacing({ combatActionDelay: 250 }); assert.equal(actionPacing().gapMs, 250);
  setCombatPacing({ combatActionDelay: 2000 }); assert.equal(actionPacing().gapMs, 2000);
  setCombatPacing({ combatActionDelay: 60000 }); assert.equal(actionPacing().gapMs, 2000, 'capped at 2 s');
  setCombatPacing({ combatActionDelay: 10 }); assert.equal(actionPacing().gapMs, 250, 'floored at 0.25 s');
  setCombatPacing();
});

test('D11: the watchdog budget follows the real gaps, so 1 s gaps and a multi-hit beat never trip it', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatActionDelay: 2000 });
  const c = clock(), trace = [], timing = actionPacing();
  const beat = { actorId: 'player', kind: 'attack', events: [{ type: 'damageDealt' }, { type: 'damageDealt' }, { type: 'damageDealt' }] };
  runActionTimeline([beat, { ...beat, actorId: 'enemy' }], {
    reactionGroups: b => b.events.map(event => ({ ...b, events: [event] })),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onStage: (stage, b) => trace.push([stage, b.actorId, c.now]),
    onFlush: () => trace.push(['flush', '', c.now]), onDone: () => trace.push(['done', '', c.now]),
  }, timing, c);
  c.advance(300000); setCombatPacing();
  assert.ok(!trace.some(row => row[0] === 'flush'), 'the watchdog never forced a flush');
  assert.equal(trace.at(-1)[0], 'done'); assert.equal(c.pending, 0);
  assert.equal(trace.filter(row => row[0] === 'resolution').length, 2, 'every beat reached its reset');
  const first = trace.filter(row => row[1] === 'player').map(row => row[0]);
  assert.deepEqual(first.slice(0, 5), ['intent', 'action', 'sprite', 'contact', 'result']);
});
