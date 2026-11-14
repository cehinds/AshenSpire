import assert from 'node:assert/strict';
import test from 'node:test';
import { runActionTimeline } from '../src/ui/actionTimeline.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';
import { computeBeatSchedule, flattenTimeline } from '../src/ui/combatTimeline.js';
import { defaultTimeline } from '../src/model/combatTimelinePolicy.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { selectedWeaponProfileFor, selectedWeaponReactionFor } from '../src/model/selectedWeaponStances.js';
import { selectedWeaponSequence, selectedWeaponSequenceTiming } from '../src/model/selectedWeaponSequences.js';

class FakeClock {
  time = 0;
  nextId = 1;
  tasks = new Map();
  setTimer = (fn, ms) => {
    const id = this.nextId++;
    this.tasks.set(id, { id, at: this.time + Math.max(0, Number(ms) || 0), fn });
    return id;
  };
  clearTimer = id => this.tasks.delete(id);
  next() {
    const task = [...this.tasks.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
    assert.ok(task, 'expected a scheduled timer');
    this.tasks.delete(task.id);
    this.time = Math.max(this.time, task.at);
    task.fn();
  }
  runUntil(target) {
    while (true) {
      const next = [...this.tasks.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!next || next.at > target) break;
      this.next();
    }
    this.time = Math.max(this.time, target);
  }
  blockUntil(target) {
    // Model a blocked event loop: callbacks keep their original due times,
    // but run only after the clock has jumped to target.
    this.time = Math.max(this.time, target);
    while (true) {
      const task = [...this.tasks.values()].filter(row => row.at <= this.time).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!task) break;
      this.tasks.delete(task.id);
      task.fn();
    }
  }
}

const attack = () => ({ actorId: 'player', kind: 'attack', events: [] });
const options = clock => ({ setTimer: clock.setTimer, clearTimer: clock.clearTimer, now: () => clock.time });
const makeHooks = (clock, overrides = {}) => ({
  maxSpriteMs: () => 100,
  onSprite: () => ({ impactMs: 0, totalMs: 100, cancel() {} }),
  ...overrides,
});

// A timeline with every offset 0: the events fire together, so a beat lasts as long as its sprite.
const ZERO = { timeline: flattenTimeline(defaultTimeline()) };
// One beat reserves 100ms for its sprite: the schedule's 100ms span (contact lands on the clip's impact), four times
// the reservation for a retimed clip, the 1,000ms per-action allowance and 2,000ms fixed slack make the deadline 3,500ms.
const oneBeatDeadline = 3_500;

test('late phase callbacks cannot renew the creation-time watchdog deadline', () => {
  const clock = new FakeClock();
  let done = 0, watchdog = 0, errors = 0;
  runActionTimeline([attack()], makeHooks(clock, {
    onIntent() { throw new Error('phase fixture error'); },
    onError() { errors++; },
    onWatchdog() { watchdog++; },
    onDone() { done++; },
  }), ZERO, options(clock));
  clock.blockUntil(oneBeatDeadline + 250);
  assert.equal(done, 1, 'late phase does not renew the absolute watchdog');
  assert.equal(watchdog, 1);
  assert.equal(errors, 1, 'a throwing phase is reported without preventing watchdog completion');
});

test('the initial reservation covers every beat and is not restarted when the second sprite starts', () => {
  const clock = new FakeClock();
  let done = 0, watchdog = 0, spriteStarts = 0;
  const handle = runActionTimeline([attack(), attack()], makeHooks(clock, {
    onSprite() { spriteStarts++; return { impactMs: 0, totalMs: 100, cancel() {} }; },
    onWatchdog() { watchdog++; },
    onDone() { done++; },
  }), ZERO, options(clock));
  clock.runUntil(100);
  assert.equal(spriteStarts, 2, 'both sprite hooks started before the deliberate pause');
  handle.pauseForSkip();
  clock.runUntil(4_999);
  assert.equal(done, 0, 'both beats retain their original sprite reservation');
  clock.runUntil(5_000); // 2,000 slack + 2 x (100 span + 400 retime + 1,000 base)
  assert.equal(done, 1);
  assert.equal(watchdog, 1);
});

test('excess actor time extends only the unreserved amount, cumulatively across beats', () => {
  const clock = new FakeClock();
  let done = 0, watchdog = 0, actorCancelled = 0, spriteStarts = 0;
  let handle;
  handle = runActionTimeline([attack(), attack()], makeHooks(clock, {
    onSprite() { spriteStarts++; return { impactMs: 0, totalMs: 250, cancel() { actorCancelled++; } }; },
    onWatchdog() { watchdog++; },
    onDone() { done++; },
  }), ZERO, options(clock));
  clock.runUntil(250); // Each 250ms actor starts after the prior one's recovery.
  assert.equal(spriteStarts, 2);
  handle.pauseForSkip();
  clock.runUntil(5_299);
  assert.equal(done, 0, 'each actor contributes only 250 - 100ms beyond its reservation');
  clock.runUntil(5_300); // 5,000ms base + 2 x 150ms excess
  assert.equal(done, 1);
  assert.equal(watchdog, 1);
  assert.equal(actorCancelled, 2);
});

test('a hook that returns after the absolute deadline cannot restart the scheduler', () => {
  const clock = new FakeClock();
  let done = 0, watchdog = 0, spriteStarts = 0;
  runActionTimeline([attack()], makeHooks(clock, {
    onAction() { clock.time = oneBeatDeadline + 1; },
    onSprite() { spriteStarts++; return { impactMs: 0, totalMs: 100, cancel() {} }; },
    onDone() { done++; },
    onWatchdog() { watchdog++; },
  }), ZERO, options(clock));
  clock.blockUntil(oneBeatDeadline + 1);
  assert.equal(done, 1);
  assert.equal(watchdog, 1);
  assert.equal(spriteStarts, 0, 'the overdue phase does not start new work');
});

test('deadline includes time spent evaluating watchdog-budget hooks before the first beat', () => {
  const clock = new FakeClock();
  let done = 0, watchdog = 0, flushed = 0, intents = 0, actions = 0;
  runActionTimeline([attack()], makeHooks(clock, {
    maxSpriteMs() { clock.time = oneBeatDeadline + 1; return 100; },
    onIntent() { intents++; },
    onAction() { actions++; },
    onFlush() { flushed++; },
    onDone() { done++; },
    onWatchdog() { watchdog++; },
  }), ZERO, options(clock));
  assert.equal(intents, 0, 'budget hooks cannot consume the deadline and still start a beat');
  assert.equal(actions, 0);
  assert.equal(done, 1);
  assert.equal(watchdog, 1);
  assert.equal(flushed, 1);
});

test('skip and cancel still settle once and clear the watchdog', () => {
  const clock = new FakeClock();
  let done = 0, watchdog = 0;
  const handle = runActionTimeline([attack()], makeHooks(clock, {
    onDone() { done++; },
    onWatchdog() { watchdog++; },
  }), ZERO, options(clock));
  handle.skip();
  handle.cancel();
  clock.blockUntil(oneBeatDeadline + 1);
  assert.equal(done, 1, 'skip/cancel settle once and clear the watchdog');
  assert.equal(watchdog, 0);
});


test('legal slow four-hit Fell Warden reactions finish every group without watchdog recovery', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatSpeed: 0.25, animationStepDuration: 3000, combatStepPause: 2000 });
  try {
    const timing = actionPacing();
    const enemy = act1Enemies.find(row => row.id === 'fellWarden');
    const move = enemy.moves.twinDaggers;
    assert.equal(move.hits, 4, 'authored phase-unlocked four-hit move');
    assert.ok(enemy.phases.some(phase => phase.unlockMoves?.includes('twinDaggers')));
    const profile = selectedWeaponProfileFor({ classId: 'reaver', armourId: 'default', grip: { mode: 'one', right: 'greatsword', left: null } });
    assert.ok(profile, 'actual selected greatsword profile');
    const groups = Array.from({ length: move.hits }, (_, hit) => ({ hit, events: [{
      type: 'damageDealt', targetId: 'player', sourceId: enemy.id, isAttack: true,
      amount: move.damage, blocked: move.damage, resisted: 0,
    }] }));
    const reactionLife = group => selectedWeaponSequenceTiming(selectedWeaponSequence(selectedWeaponReactionFor(group.events[0], profile)), timing.spriteSpeed).totalMs;
    assert.ok(groups.every(group => selectedWeaponReactionFor(group.events[0], profile) === 'fully-defended'));
    assert.ok(reactionLife(groups[0]) > 100, 'actual authored reaction is longer than the timeline waits');
    const clock = new FakeClock(), applied = [], reactions = [];
    let done = 0, doneAt = null, watchdog = 0;
    runActionTimeline([{ actorId: enemy.id, kind: 'attack', events: groups.flatMap(group => group.events) }], {
      maxSpriteMs: speed => selectedWeaponSequenceTiming(selectedWeaponSequence('counter-guard'), speed).totalMs,
      onSprite: () => ({ impactMs: timing.spriteSpeed.lungeMs / 2, totalMs: timing.spriteSpeed.lungeMs, cancel() {} }),
      reactionGroups: () => groups,
      onReaction: group => { reactions.push(group.hit); return reactionLife(group); },
      onApply: group => applied.push(group.hit),
      onWatchdog: () => { watchdog++; },
      onDone: () => { done++; doneAt = clock.time; },
    }, timing, options(clock));
    const schedule = computeBeatSchedule(timing.timeline, { impactMs: timing.spriteSpeed.lungeMs / 2, groups: groups.length, skip: new Set(['cardPlayed']) });
    // The beat ends when its last event has fired and its own clip has finished; the long reaction pose is not waited for.
    // A later group's pose starts only after the pose still playing is over (it never replaces an unfinished clip); nothing else waits for it.
    let poseFree = 0, lastPoseStart = 0;
    for (const entry of schedule.entries.filter(row => row.id === 'reaction')) { lastPoseStart = Math.max(entry.at, poseFree); poseFree = lastPoseStart + reactionLife(groups[0]); }
    const expectedDone = Math.max(schedule.entries.find(entry => entry.id === 'end').at, schedule.starts.swing + timing.spriteSpeed.lungeMs, lastPoseStart);
    clock.runUntil(expectedDone - 1);
    assert.equal(done, 0, 'the nominal waits are all the timeline holds; the long pose is not waited for');
    clock.runUntil(expectedDone);
    assert.equal(done, 1);
    assert.equal(doneAt, expectedDone);
    assert.deepEqual(reactions, [0, 1, 2, 3]);
    assert.deepEqual(applied, [0, 1, 2, 3]);
    assert.equal(watchdog, 0, 'legal long reactions are normal completion');
    assert.equal(clock.tasks.size, 0);
  } finally { setAnimSpeed('normal'); setCombatPacing(); }
});

test('post-contact hit-stop and remainingMs holds finish without consuming the watchdog', () => {
  for (const row of [{ hold: 5000, remaining: 0, expected: 5100 }, { hold: 0, remaining: 6000, expected: 6050 }]) {
    const clock = new FakeClock(), stages = [];
    let done = 0, doneAt = null, watchdog = 0, contacts = 0, cancelled = 0;
    runActionTimeline([attack()], makeHooks(clock, {
      onStage: stage => stages.push(stage),
      onSprite: () => ({ impactMs: 50, totalMs: 100, remainingMs: () => row.remaining, cancel() { cancelled++; } }),
      onContact: () => { contacts++; return row.hold; },
      onWatchdog: () => { watchdog++; },
      onDone: () => { done++; doneAt = clock.time; },
    }), ZERO, options(clock));
    clock.runUntil(row.expected - 1);
    assert.equal(done, 0, 'the legitimate contact hold stays visible');
    clock.runUntil(row.expected);
    assert.equal(done, 1);
    assert.equal(doneAt, row.expected);
    assert.equal(watchdog, 0);
    assert.equal(contacts, 1);
    assert.equal(cancelled, 1);
    assert.deepEqual(stages, ['intent', 'action', 'sprite', 'contact', 'result', 'reaction', 'damage', 'hud', 'resolution']);
    assert.equal(clock.tasks.size, 0);
  }
});


test('hooks that return after expiry cannot buy a fresh deadline with excess duration', () => {
  for (const phase of ['sprite', 'contact', 'reaction']) {
    const clock = new FakeClock(), stages = [];
    let done = 0, watchdog = 0;
    const crossDeadline = () => { clock.time = 10_000; return 20_000; };
    runActionTimeline([attack()], makeHooks(clock, {
      onStage: stage => stages.push(stage),
      onSprite: () => ({ impactMs: 0, totalMs: phase === 'sprite' ? crossDeadline() : 100, cancel() {} }),
      onContact: () => phase === 'contact' ? crossDeadline() : 0,
      onReaction: () => phase === 'reaction' ? crossDeadline() : 0,
      onWatchdog: () => { watchdog++; },
      onDone: () => { done++; },
    }), ZERO, options(clock));
    clock.runUntil(10_000);
    assert.equal(done, 1, phase + ': overdue hook must not renew the watchdog');
    assert.equal(watchdog, 1, phase + ': overdue hook is watchdog recovery');
    assert.equal(stages.at(-1), phase, phase + ': no subsequent phase starts');
    assert.equal(clock.tasks.size, 0);
  }
});


test('a delayed CSS contact does not replay animation recovery that already elapsed', () => {
  for (const reported of [undefined, Infinity, NaN]) {
    const clock = new FakeClock();
    let done = 0, watchdog = 0, contacts = 0;
    runActionTimeline([attack()], makeHooks(clock, {
      onSprite: () => ({ impactMs: 40, totalMs: 100, remainingMs: () => reported, cancel() {} }),
      onContact: () => { contacts++; },
      onDone: () => { done++; },
      onWatchdog: () => { watchdog++; },
    }), ZERO, options(clock));
    clock.runUntil(0); // Start the actor, but leave its 40ms contact pending.
    clock.blockUntil(300);
    assert.equal(contacts, 1);
    assert.equal(done, 1, 'elapsed CSS recovery is not replayed for another 60ms');
    assert.equal(watchdog, 0);
    assert.equal(clock.tasks.size, 0);
  }
});

test('a delayed contact-cued actor retains its finite reported recovery and hold', () => {
  const clock = new FakeClock();
  let contacted = false, done = 0, watchdog = 0;
  runActionTimeline([attack()], makeHooks(clock, {
    onSprite: () => ({ impactMs: 40, totalMs: 100,
      contact() { contacted = true; },
      remainingMs() { assert.equal(contacted, true); return 250; }, cancel() {} }),
    onContact: () => 80,
    onDone: () => { done++; },
    onWatchdog: () => { watchdog++; },
  }), ZERO, options(clock));
  clock.runUntil(0);
  clock.blockUntil(300);
  assert.equal(done, 0, 'contact-cued recovery starts at actual contact');
  clock.runUntil(549);
  assert.equal(done, 0);
  clock.runUntil(550);
  assert.equal(done, 1);
  assert.equal(watchdog, 0);
  assert.equal(clock.tasks.size, 0);
});
