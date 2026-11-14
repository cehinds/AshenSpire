import test from 'node:test';
import assert from 'node:assert/strict';
import { runActionTimeline } from '../src/ui/actionTimeline.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';
import { defaultTimeline, moveTimelineEvent, setTimelineEvent } from '../src/model/combatTimelinePolicy.js';

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
  // The default timeline (actionPacing.json timeline): word and stance +100, swing +100, contact on the impact frame,
  // result +100, reaction +100 with the numbers and bars, end +100. Only the sprite clip scales with speed.
  assert.deepEqual(trace.slice(0, 9).map(row => row[2]), [0, 100, 110, 385, 485, 585, 585, 585, 685]);
  assert.equal(trace[9][2], 685, 'the next actor starts when the first action ends');
  assert.equal(trace.at(-1)[0], 'done'); assert.equal(c.pending, 0);
});
test('× speed scales every action stage and sprite while retaining receipt order', () => {
  const normal = run(), fast = run(2); normal.c.advance(20000); fast.c.advance(20000);
  // The fixed 100 ms stages do not scale; the order and the sprite clip do.
  assert.deepEqual(fast.trace.map(row => [row[0], row[1]]), normal.trace.map(row => [row[0], row[1]]));
  assert.ok(fast.trace.at(-1)[2] < normal.trace.at(-1)[2], 'a faster speed finishes the beats sooner');
  setCombatPacing();
});
test('cancel and repeated skips flush once and leave no late mutation or next action', () => {
  const { c, trace, handle } = run(); c.advance(250); handle.cancel(); handle.skip(); c.advance(20000);
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
  assert.equal(instant.gapMs + instant.telegraphHoldMs + instant.telegraphResetMs, 0);
  assert.ok(instant.timeline.every(row => row.offsetMs === 0), 'every offset is 0 and the order is kept');
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
  const { c, trace, handle } = run(); c.advance(450); handle.pauseForSkip(); c.advance(100000);
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

test('D11: the pause between steps (0.5 s, scaled by speed) is the auto-combat gap; the timeline stages ignore it', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const normal = actionPacing();
  assert.equal(normal.gapMs, 500);
  assert.equal(normal.timeline.find(row => row.id === 'actionWord').offsetMs, 100, 'a stage offset is not the pause');
  setCombatPacing({ combatSpeed: 2 }); assert.equal(actionPacing().gapMs, 250);
  assert.equal(actionPacing().timeline.find(row => row.id === 'actionWord').offsetMs, 100, 'nor does speed scale it');
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
  assert.equal(measured.default, 3 * 685, 'three actors at 685 ms each: the default timeline ends 685 ms after the beat starts, after the 550 ms clip');
  assert.ok(measured['auto x1.5'] < measured.default, 'auto combat divides the clip by x1.5');
  assert.equal(measured['gap 2000'], measured.default, 'the pause setting no longer moves a timeline: every stage is fixed');
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
  c.advance(4000);
  const stages = ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution'];
  assert.deepEqual(trace.slice(0, 9).map(row => row[0]), stages);
  assert.deepEqual(trace.slice(9, 18).map(row => row[0]), stages);
  assert.equal(trace[3][2], 385, 'contact waits the fixed action-word and animation stages plus the sprite impact');
  assert.equal(trace[9][2], 685, 'the counter waits for the timeline end');
  assert.equal(trace.at(-1)[0], 'done');
  assert.equal(trace.some(row => row[0] === 'flush'), false);
  assert.equal(handle.finished, true); assert.equal(c.pending, 0);
  setCombatPacing();
});

test('a telegraph beat plays its whole clip, shows no result, number or bar, then waits the hold and the reset', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, combatStepPause: 2000 });
  const c = clock(), trace = [], timing = actionPacing();
  let cancelledAt = null;
  runActionTimeline([{ actorId: 'enemy', kind: 'attack', telegraph: true }, { actorId: 'enemy2', kind: 'attack' }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    // A long clip: 2000 ms of it remains after contact.
    onSprite: () => ({ impactMs: 300, totalMs: 2300, cancel() { cancelledAt ??= c.now; } }),
    maxSpriteMs: () => 2300,
    onFlush: () => trace.push(['flush', '', c.now]), onDone: () => trace.push(['done', '', c.now]),
  }, timing, timerOptions(c));
  c.advance(60000); setCombatPacing();
  const at = (stage, actor) => trace.find(row => row[0] === stage && row[1] === actor)[2];
  const enemy = trace.filter(row => row[1] === 'enemy').map(row => row[0]);
  assert.equal(enemy.join(' '), 'intent action sprite contact resolution', 'no result, reaction, damage or hud before the prompt');
  assert.equal(timing.telegraphHoldMs, 0, 'the hold after the clip defaults to 0');
  assert.equal(cancelledAt, 110 + 2300 + timing.telegraphHoldMs, 'the clip is never cut: it is cancelled only after it completes');
  assert.equal(at('resolution', 'enemy'), 110 + 2300, 'the prompt opens when the clip is done');
  assert.equal(at('intent', 'enemy2') - at('resolution', 'enemy'), 100, 'resolution to the next beat is telegraphResetMs');
  assert.ok(!trace.some(row => row[0] === 'flush'), 'the watchdog never fires early');
  assert.equal(trace.at(-1)[0], 'done');
});

test('telegraphHoldMs is the wait after the clip completes', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const c = clock(), trace = [], timing = { ...actionPacing(), telegraphHoldMs: 150 };
  runActionTimeline([{ actorId: 'enemy', kind: 'attack', telegraph: true }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    onSprite: () => ({ impactMs: 300, totalMs: 340, cancel() {} }),
    onDone: () => trace.push(['done', '', c.now]),
  }, timing, timerOptions(c));
  c.advance(60000); setCombatPacing();
  const at = stage => trace.find(row => row[0] === stage)[2];
  assert.equal(at('resolution'), 110 + 340 + 150);
});

test('a long reaction pose does not delay the next beat beyond the damage numbers wait', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const c = clock(), trace = [], timing = actionPacing();
  runActionTimeline([{ actorId: 'enemy', kind: 'attack' }, { actorId: 'player', kind: 'attack' }], {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now]),
    onSprite: (_beat, speed) => ({ impactMs: speed.lungeMs / 2, totalMs: speed.lungeMs, cancel() {} }),
    maxSpriteMs: speed => speed.lungeMs,
    onReaction: () => 1500,
    onWatchdog: () => trace.push(['watchdog', '', c.now]),
    onDone: () => trace.push(['done', '', c.now]),
  }, timing, timerOptions(c));
  c.advance(20000);
  const at = (stage, actor) => trace.find(row => row[0] === stage && row[1] === actor)[2];
  assert.equal(at('resolution', 'enemy') - at('hud', 'enemy'), 100, 'the action ends 100 ms after the numbers, not after the 1500 ms pose');
  assert.equal(at('intent', 'player') - at('resolution', 'enemy'), 0, 'the next beat starts at the end event');
  assert.ok(!trace.some(row => row[0] === 'watchdog'), 'no watchdog flush');
  assert.equal(trace.at(-1)[0], 'done');
});

// ---- the combat timeline drives the events (owner, 2026-11-13) ----
const withTimeline = (timeline, extra = {}) => ({ ...actionPacing(), timeline, ...extra });
function play(beats, timing, hooks = {}) {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const c = clock(), trace = [];
  const spriteCalls = [];
  runActionTimeline(beats, {
    onStage: (stage, beat) => trace.push([stage, beat.actorId, c.now, beat.hit]),
    onActionWord: beat => trace.push(['word', beat.actorId, c.now]),
    onSprite: (_beat, speed) => { spriteCalls.push(speed.lungeMs); return { impactMs: 275, totalMs: 550, cancel() {} }; },
    maxSpriteMs: () => 550,
    onDone: () => trace.push(['done', '', c.now]),
    ...hooks,
  }, timing, timerOptions(c));
  c.advance(60000); setCombatPacing();
  return { trace, c, spriteCalls };
}
const names = trace => trace.map(row => row[0]).join(' ');
test('the default timeline fires the action word with the cost 100 ms later, numbers and bars with the reaction', () => {
  const { trace } = play([{ actorId: 'p', kind: 'attack' }], actionPacing());
  assert.equal(names(trace), 'intent word action sprite contact result reaction damage hud resolution done');
  const t = Object.fromEntries(trace.map(row => [row[0], row[2]]));
  assert.deepEqual([t.intent, t.word, t.action, t.sprite, t.contact, t.result, t.reaction, t.damage, t.hud, t.resolution], [0, 100, 100, 110, 385, 485, 585, 585, 585, 685]);
});
test('a reordered timeline fires its hooks in the new order, at the new times', () => {
  const list = moveTimelineEvent(moveTimelineEvent(defaultTimeline(), 'numbers', -1), 'numbers', -1); // numbers right after contact
  const { trace } = play([{ actorId: 'p', kind: 'attack' }], withTimeline(list));
  assert.equal(names(trace), 'intent word action sprite contact damage result reaction hud resolution done');
  const t = Object.fromEntries(trace.map(row => [row[0], row[2]]));
  assert.deepEqual([t.contact, t.damage, t.result, t.reaction, t.hud], [385, 385, 485, 585, 585]);
});
test('numbers and bars can be offset from the reaction, before or after it', () => {
  const list = setTimelineEvent(setTimelineEvent(defaultTimeline(), 'numbers', { offsetMs: -50 }), 'bars', { with: 'numbers', offsetMs: 80 });
  const { trace } = play([{ actorId: 'p', kind: 'attack' }], withTimeline(list));
  const t = Object.fromEntries(trace.map(row => [row[0], row[2]]));
  assert.deepEqual([t.damage, t.reaction, t.hud], [535, 585, 615]);
  assert.equal(names(trace.filter(row => ['damage', 'reaction', 'hud'].includes(row[0]))), 'damage reaction hud');
});
test('contact moved later retimes the clip for that beat only and still fires on time', () => {
  const list = setTimelineEvent(defaultTimeline(), 'contact', { offsetMs: 275 });
  const { trace, spriteCalls } = play([{ actorId: 'p', kind: 'attack' }, { actorId: 'q', kind: 'attack' }], withTimeline(list));
  const contact = trace.find(row => row[0] === 'contact');
  assert.equal(contact[2], 660, 'contact fires at the scheduled time');
  assert.equal(spriteCalls.length, 4, 'each beat makes its clip and remakes it once at the new speed');
  assert.equal(spriteCalls[1] / spriteCalls[0], (660 - 110) / 275);
});
test('the reaction timeline is used for playback after a reaction answer', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, combatTimeline: { reaction: setTimelineEvent(defaultTimeline(), 'end', { offsetMs: 400 }) } });
  assert.equal(actionPacing().timeline.find(row => row.id === 'end').offsetMs, 100);
  assert.equal(actionPacing({ reaction: true }).timeline.find(row => row.id === 'end').offsetMs, 400);
  const { trace } = play([{ actorId: 'p', kind: 'attack' }], actionPacing({ reaction: true }));
  assert.equal(trace.find(row => row[0] === 'resolution')[2], 985);
  setCombatPacing();
});
test('several reaction groups repeat the result, reaction, numbers and bars before the beat ends', () => {
  const groups = [{ actorId: 'p', hit: 0, kind: 'attack' }, { actorId: 'p', hit: 1, kind: 'attack' }];
  const { trace } = play([{ actorId: 'p', kind: 'attack' }], actionPacing(), { reactionGroups: () => groups });
  assert.equal(names(trace.filter(row => ['result', 'reaction', 'damage', 'hud'].includes(row[0]))), 'result reaction damage hud result reaction damage hud');
  assert.deepEqual(trace.filter(row => row[0] === 'result').map(row => [row[2], row[3]]), [[485, 0], [685, 1]]);
  assert.equal(trace.find(row => row[0] === 'resolution')[2], 885);
});
test('Reduced motion keeps the order with every event together', () => {
  setAnimSpeed('normal');
  const timing = actionPacing({ reduced: true });
  const { trace } = play([{ actorId: 'p', kind: 'attack' }], timing, { onSprite: () => null });
  assert.equal(names(trace), 'intent word action sprite contact result reaction damage hud resolution done');
  assert.ok(trace.every(row => row[2] === 0));
});

// ---- cardPlayed first, and the stance event only on a stance change (owner, 2026-11-13) ----
const cardBeat = { actorId: 'p', kind: 'attack', events: [{ type: 'cardPlayed' }] };
test('cardPlayed fires first, then cost +100, the action word +100, and the swing', () => {
  const cards = [];
  const { trace } = play([cardBeat], actionPacing(), { onCardPlayed: () => cards.push('card'), stanceChanges: () => true });
  assert.deepEqual(cards, ['card']);
  assert.equal(names(trace), 'intent word action sprite contact result reaction damage hud resolution done');
  const t = Object.fromEntries(trace.map(row => [row[0], row[2]]));
  assert.deepEqual([t.intent, t.word, t.action, t.sprite], [100, 200, 200, 210]);
});
test('a beat with no card played has no cardPlayed event and starts at once', () => {
  const calls = [];
  const { trace } = play([{ actorId: 'e', kind: 'attack', events: [] }], actionPacing(), { onCardPlayed: () => calls.push('card'), stanceChanges: () => true });
  assert.deepEqual(calls, []);
  assert.equal(trace.find(row => row[0] === 'intent')[2], 0);
});
test('the stance event is skipped on a beat that repeats the stance and fires on a change', () => {
  const same = play([cardBeat], actionPacing(), { stanceChanges: () => false });
  assert.equal(same.trace.some(row => row[0] === 'action'), false, 'no stance stage');
  const change = play([cardBeat], actionPacing(), { stanceChanges: () => true });
  assert.equal(change.trace.some(row => row[0] === 'action'), true);
  const swing = trace => trace.find(row => row[0] === 'sprite')[2], word = trace => trace.find(row => row[0] === 'word')[2];
  assert.equal(swing(same.trace) - word(same.trace), 0, 'the swing follows the action word directly');
  assert.equal(swing(change.trace) - word(change.trace), 10, 'a stance change adds the 10 ms stance lead');
});

test('onSwingEnd fires when the swing clip completes, not at contact', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const c = clock(), marks = {};
  runActionTimeline([{ actorId: 'p', kind: 'attack', events: [] }], {
    onStage: stage => { if (stage === 'contact') marks.contact = c.now; },
    onSprite: () => ({ impactMs: 275, totalMs: 550, cancel() {} }),
    maxSpriteMs: () => 550,
    onSwingEnd: () => { marks.end = c.now; },
  }, actionPacing(), timerOptions(c));
  c.advance(10000); setCombatPacing();
  assert.equal(marks.contact, 385, 'contact on the impact frame (swing at 110)');
  assert.equal(marks.end, 660, 'the clip ends 550 ms after the swing started');
});

test('onSwingStart reports the clip length as the swing begins', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const c = clock(), seen = [];
  runActionTimeline([{ actorId: 'p', kind: 'attack', events: [] }], {
    onSprite: () => ({ impactMs: 275, totalMs: 550, cancel() {} }), maxSpriteMs: () => 550,
    onSwingStart: (beat, ms) => seen.push([beat.actorId, ms, c.now]),
  }, actionPacing(), timerOptions(c));
  c.advance(10000); setCombatPacing();
  assert.deepEqual(seen, [['p', 550, 110]]);
});
