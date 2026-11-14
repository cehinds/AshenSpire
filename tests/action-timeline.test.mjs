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
    get pending() { return timers.size; }, get callbacks() { return [...timers.values()].map(timer => timer.fn); } };
}
const timerOptions = c => ({ setTimer: c.setTimer, clearTimer: c.clearTimer, now: () => c.now });
function run(multiplier = 1) {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: multiplier });
  const c = clock(), trace = [], timing = actionPacing();
  const handle = runActionTimeline([{ actorId: 'player', kind: 'attack' }, { actorId: 'enemy', kind: 'counter' }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onWatchdog: () => trace.push(['watchdog', '', c.now]),
    onFlush: () => trace.push(['flush', '', c.now]), onDone: () => trace.push(['done', '', c.now]),
  }, timing, timerOptions(c));
  return { c, trace, handle };
}
test('ordered actions and counters finish every stage before the next actor begins', () => {
  const { c, trace } = run(); c.advance(20000);
  const expected = ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution'];
  assert.deepEqual(trace.slice(0, 9).map(row => row[0]), expected);
  assert.deepEqual(trace.slice(9, 18).map(row => row[0]), expected);
  // D11: a 500 ms gap at each boundary (action, animation, result, reaction, damage, reset, next).
  assert.deepEqual(trace.slice(0, 9).map(row => row[2]), [0, 500, 1000, 1275, 2050, 2550, 3050, 3050, 3550]);
  assert.equal(trace[9][2], 4050, 'the next actor starts one gap after the reset');
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
for (const exit of ['normal', 'cancel', 'skip']) test(`${exit} completion does not report a watchdog, even through a late timeout callback`, () => {
  const { c, trace, handle } = run();
  const lateTimeout = c.callbacks[0];
  if (exit === 'normal') c.advance(20000); else handle[exit]();
  const completed = [...trace];
  lateTimeout(); handle.cancel(); handle.skip(); c.advance(100000);
  assert.deepEqual(trace, completed, 'cleared timeout and repeated exits cannot mutate a finished timeline');
  assert.equal(trace.filter(row => row[0] === 'watchdog').length, 0);
  assert.equal(trace.filter(row => row[0] === 'flush').length, exit === 'normal' ? 0 : 1);
  assert.equal(trace.filter(row => row[0] === 'done').length, 1);
});
for (const advance of [0, 600]) test(`watchdog expiration ${advance ? 'after' : 'before'} the sprite reports once and preserves flush/done order`, () => {
  const c = clock(), trace = [];
  let handle;
  handle = runActionTimeline([{ actorId: 'player', kind: 'attack' }], {
    onSprite: () => ({ impactMs: 1000, totalMs: 2000, cancel() {} }),
    onWatchdog: () => { assert.equal(handle.finished, true); trace.push('watchdog'); handle.skip(); },
    onFlush: () => trace.push('flush'), onDone: () => trace.push('done'),
  }, { wordMs: 500 }, timerOptions(c));
  c.advance(advance);
  const lateCallbacks = c.callbacks;
  handle.pauseForSkip();
  assert.deepEqual(trace, [], 'pausing alone is not a timeout');
  c.advance(100000);
  assert.deepEqual(trace, ['watchdog', 'flush', 'done']);
  for (const callback of lateCallbacks) callback();
  handle.cancel(); handle.skip(); c.advance(100000);
  assert.deepEqual(trace, ['watchdog', 'flush', 'done'], 'late callbacks and exits cannot count or finish twice');
  assert.equal(c.pending, 0);
});
test('a failing watchdog hook reports its error and still flushes and completes once', () => {
  const c = clock(), trace = [];
  const handle = runActionTimeline([{ actorId: 'player', kind: 'attack' }], {
    onWatchdog: () => { trace.push('watchdog'); throw Error('diagnostic failed'); },
    onError: error => trace.push(error.message), onFlush: () => trace.push('flush'), onDone: () => trace.push('done'),
  }, { wordMs: 500 }, timerOptions(c));
  handle.pauseForSkip(); c.advance(100000);
  assert.deepEqual(trace, ['watchdog', 'diagnostic failed', 'flush', 'done']);
  assert.equal(handle.finished, true); assert.equal(c.pending, 0);
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
  }, timing, timerOptions(c));
  c.advance(6000); assert.deepEqual(trace, [], 'the underestimated watchdog cannot finish a live clip');
  c.advance(10000); assert.deepEqual(trace, ['done']); assert.equal(c.pending, 0);
});

test('a lost pointer release retains a bounded completion fallback', () => {
  const { c, trace, handle } = run(); c.advance(600); handle.pauseForSkip(); c.advance(100000);
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

test('D11: the default gap is 0.5 s at every stage boundary and the active speed scales it', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const gaps = t => [t.wordMs, t.afterSpriteMs, t.resultMs, t.reactionMs, t.damageMs, t.resetMs];
  const normal = actionPacing();
  assert.equal(normal.gapMs, 500); assert.equal(normal.intentMs, 500, 'the stance follows the intent word by one gap');
  assert.deepEqual(gaps(normal), [500, 500, 500, 500, 500, 500]);
  setCombatPacing({ combatSpeed: 2 }); assert.deepEqual(gaps(actionPacing()), Array(6).fill(250));
  setCombatPacing({ combatSpeed: 1, autoCombat: true }); assert.ok(Math.abs(actionPacing().gapMs - 500 / 1.5) < 1e-9, 'auto-combat defaults to ×1.5');
  setCombatPacing({ combatSpeed: 1, combatStepPause: 250 }); assert.equal(actionPacing().gapMs, 250);
  setCombatPacing({ combatSpeed: 1, combatStepPause: 2000 }); assert.equal(actionPacing().gapMs, 2000);
  setCombatPacing({ combatSpeed: 1, combatStepPause: 60000 }); assert.equal(actionPacing().gapMs, 2000, 'capped at 2 s');
  setCombatPacing({ combatSpeed: 1, combatStepPause: 10 }); assert.equal(actionPacing().gapMs, 10, 'short pauses remain configurable');
  setCombatPacing();
});

test('D11: the watchdog budget follows the real gaps, so 1 s gaps and a multi-hit beat never trip it', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, combatStepPause: 2000 });
  const c = clock(), trace = [], timing = actionPacing();
  const beat = { actorId: 'player', kind: 'attack', events: [{ type: 'damageDealt' }, { type: 'damageDealt' }, { type: 'damageDealt' }] };
  runActionTimeline([beat, { ...beat, actorId: 'enemy' }], {
    reactionGroups: b => b.events.map(event => ({ ...b, events: [event] })),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onStage: (stage, b) => trace.push([stage, b.actorId, c.now]),
    onFlush: () => trace.push(['flush', '', c.now]), onDone: () => trace.push(['done', '', c.now]),
  }, timing, timerOptions(c));
  c.advance(300000); setCombatPacing();
  assert.ok(!trace.some(row => row[0] === 'flush'), 'the watchdog never forced a flush');
  assert.equal(trace.at(-1)[0], 'done'); assert.equal(c.pending, 0);
  assert.equal(trace.filter(row => row[0] === 'resolution').length, 2, 'every beat reached its reset');
  const first = trace.filter(row => row[1] === 'player').map(row => row[0]);
  assert.deepEqual(first.slice(0, 5), ['intent', 'action', 'sprite', 'contact', 'result']);
});

// One enemy turn of three enemies, as the combat screen runs it. A watchdog
// flush here would mean the budget is shorter than the real gaps.
function enemyTurn(settings) {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, ...settings });
  const c = clock(), trace = [], timing = actionPacing();
  runActionTimeline(['e1', 'e2', 'e3'].map(actorId => ({ actorId, kind: 'attack' })), {
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onFlush: () => trace.push('flush'), onDone: () => trace.push(['done', c.now]),
  }, timing, timerOptions(c));
  c.advance(10 * 60 * 1000); setCombatPacing();
  return trace;
}
test('D11: three enemies finish by themselves at every pause and speed, with no watchdog flush', () => {
  const measured = {};
  for (const [name, settings] of [['default', {}], ['auto x1.5', { autoCombat: true }], ['gap 2000', { combatStepPause: 2000 }],
    ['gap 2000 auto x3', { combatStepPause: 2000, autoCombat: true, autoCombatSpeed: 3 }], ['gap 250', { combatStepPause: 250 }]]) {
    const trace = enemyTurn(settings);
    assert.ok(!trace.includes('flush'), `${name}: the watchdog must not fire`);
    measured[name] = trace.find(row => row[0] === 'done')[1];
  }
  assert.equal(measured.default, 3 * 4050, 'three actors at 4050 ms each (seven 500 ms gaps plus the 550 ms clip), the last reset included');
  assert.ok(Math.abs(measured['auto x1.5'] * 1.5 - measured.default) < 1, 'auto combat divides every gap and clip by x1.5');
  assert.ok(measured['gap 2000'] > measured.default && measured['gap 250'] < measured.default, 'the pause setting moves the whole turn');
});


test('zero pauses preserve complete ordered actions and counters without watchdog cleanup', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, combatStepPause: 0 });
  const c = clock(), trace = [], timing = actionPacing();
  const handle = runActionTimeline([{ actorId: 'player', kind: 'attack' }, { actorId: 'enemy', kind: 'counter' }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onFlush: () => trace.push(['flush', '', c.now]), onDone: () => trace.push(['done', '', c.now]),
  }, timing, timerOptions(c));
  c.advance(2000);
  const stages = ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution'];
  assert.deepEqual(trace.slice(0, 9).map(row => row[0]), stages);
  assert.deepEqual(trace.slice(9, 18).map(row => row[0]), stages);
  assert.equal(trace[3][2], 275, 'contact retains the sprite impact duration');
  assert.equal(trace[9][2], 550 + timing.stepMs, 'the counter waits for the completed sprite and existing queue interval');
  assert.equal(trace.at(-1)[0], 'done');
  assert.equal(trace.some(row => row[0] === 'flush'), false);
  assert.equal(handle.finished, true); assert.equal(c.pending, 0);
  setCombatPacing();
});

// The enemies' turn: a beat may run on its own pacing (hooks.timingFor), and a wind-up is held for its telegraph length.
function runMixed({ telegraphMs = 0 } = {}) {
  setAnimSpeed('normal'); setCombatPacing();
  const c = clock(), trace = [], player = actionPacing(), enemy = { ...actionPacing({ enemy: true }), telegraphMs };
  runActionTimeline([{ actorId: 'player', kind: 'attack' }, { actorId: 'enemy', kind: 'attack', telegraph: true }, { actorId: 'enemy', kind: 'attack', prepared: true }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId + (beat.telegraph ? '*' : ''), c.now]),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: () => 1000,
    timingFor: beat => beat.actorId === 'enemy' ? enemy : null,
  }, player, timerOptions(c));
  c.advance(30000);
  return { trace, player, enemy };
}
test('a beat runs on the pacing timingFor gives it; the other beats keep the timeline pacing', () => {
  const { trace, player, enemy } = runMixed();
  const at = (actor, stage) => trace.find(row => row[1] === actor && row[0] === stage)[2];
  assert.equal(at('player', 'action') - at('player', 'intent'), player.intentMs, 'the player beat waits the player gap');
  const enemyStart = at('enemy*', 'intent');
  assert.equal(at('enemy*', 'action') - enemyStart, enemy.intentMs, 'the enemy beat waits the (shorter) enemy gap');
  assert.ok(enemy.intentMs < player.intentMs);
});
test('a telegraph beat is held for at most the pacing\'s telegraph length', () => {
  const held = runMixed({ telegraphMs: 40 }), whole = runMixed();
  const span = ({ trace }) => trace.find(row => row[1] === 'enemy*' && row[0] === 'resolution')[2] - trace.find(row => row[1] === 'enemy*' && row[0] === 'contact')[2];
  assert.equal(span(held), 40, 'the wind-up ends at its telegraph length');
  assert.ok(span(whole) > 40, 'with no telegraph length the whole clip plays');
});

test('chained attacks hand over at the damage stage, keep their numbers 250 ms apart, and unlock after the tail', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const c = clock(), trace = [], base = { ...actionPacing(), stepMs: 0 };
  const beats = [{ actorId: 'e1', kind: 'attack' }, { actorId: 'e2', kind: 'attack' }];
  const chained = { ...base, resultMs: 10, reactionMs: 10, damageMs: 10, resetMs: 10, afterSpriteMs: 10, wordMs: 0, intentMs: 0, chain: true, damageGapMs: 250 };
  runActionTimeline(beats, {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    onSprite: () => ({ impactMs: 0, totalMs: 0, cancel() {} }), maxSpriteMs: () => 0,
    onReaction: () => 400, // a long hurt reaction must not hold the next action
    timingFor: beat => beat === beats[0] ? { ...chained, tailMs: 0 } : { ...chained, tailMs: 150 },
    onDone: () => trace.push(['done', '', c.now]),
  }, base, timerOptions(c));
  c.advance(20000);
  const at = (stage, actor) => trace.find(row => row[0] === stage && row[1] === actor)[2];
  assert.equal(at('intent', 'e2') - at('damage', 'e1') <= 5, true, 'the second action starts as the first damage is shown');
  assert.equal(at('damage', 'e2') - at('damage', 'e1') >= 250, true, 'two damage numbers at least 250 ms apart');
  assert.equal(trace.at(-1)[2] - at('damage', 'e2') <= 160, true, 'the hand unlocks within the tail of the last damage');
});
