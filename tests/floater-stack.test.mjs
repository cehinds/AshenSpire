// The per-combatant floater sequencer (ui/floaterStack.js), driven by a fake clock: spawn times, order, the
// vertical column, the cap and the drop rules. The DOM side is tests/floater-column.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloaterStack, columnTop, FLOATER_STACK } from '../src/ui/floaterStack.js';

// A manual clock and timer list: advance(ms) runs every due timer in order.
function clock() {
  let t = 0, id = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimer: (fn, ms) => { timers.set(++id, { fn, at: t + ms }); return id; },
    clearTimer: (h) => timers.delete(h),
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn();
      }
      t = end;
    },
  };
}
function make({ stagger = 320, max = 4, life = 1650 } = {}) {
  const c = clock();
  const spawned = [], faded = [], layouts = [];
  const opts = { stagger, max, life };
  const stack = createFloaterStack({
    ...c, staggerMs: () => opts.stagger, maxVisible: () => opts.max,
    show: (item, entry) => { spawned.push({ id: item.id, at: c.now(), slot: entry.slot }); return item.id; },
    fadeEarly: (entry) => faded.push({ id: entry.item.id, at: c.now() }),
    layout: (entries) => layouts.push(entries.map((e) => [e.item.id, e.slot])),
  });
  const push = (id, extra = {}) => stack.push({ id, lifeMs: opts.life, ...extra });
  return { c, stack, spawned, faded, layouts, opts, push };
}

test('the defaults come from content/config floaterStack.json', () => {
  assert.equal(FLOATER_STACK.floaterStaggerMs, 320);
  assert.equal(FLOATER_STACK.floaterMaxVisible, 4);
  assert.equal(FLOATER_STACK.floaterFontPx, 28);
  assert.ok(FLOATER_STACK.floaterLineGapPx > 0);
});

test('floaters spawn one at a time, one stagger apart, in the order they were queued', () => {
  const f = make();
  assert.ok(f.push('a'), 'the first spawns at once');
  assert.equal(f.push('b'), null, 'a floater queued meanwhile waits its turn');
  f.push('c'); f.push('d');
  f.c.advance(319);
  assert.deepEqual(f.spawned.map((s) => s.id), ['a'], 'nothing spawns before the stagger');
  f.c.advance(1);
  assert.deepEqual(f.spawned.map((s) => [s.id, s.at]), [['a', 0], ['b', 320]]);
  f.c.advance(1000);
  assert.deepEqual(f.spawned.map((s) => [s.id, s.at]), [['a', 0], ['b', 320], ['c', 640], ['d', 960]]);
  const times = f.spawned.map((s) => s.at);
  assert.ok(times.every((at, i) => i === 0 || at - times[i - 1] >= 320), 'never two on one frame');
});

test('a floater pushed after a quiet spell spawns at once, and one pushed inside the stagger waits for it', () => {
  const f = make();
  f.push('a');
  f.c.advance(100);
  f.push('b');
  assert.equal(f.spawned.length, 1);
  f.c.advance(220);
  assert.deepEqual(f.spawned.map((s) => [s.id, s.at]), [['a', 0], ['b', 320]]);
  f.c.advance(2000);
  assert.ok(f.push('c'), 'long after the last spawn there is nothing to wait for');
  assert.equal(f.spawned.at(-1).at, 2320);
});

test('the stagger is read on every spawn, so a speed change applies to the next gap', () => {
  const f = make();
  f.push('a'); f.push('b'); f.push('c');
  f.opts.stagger = 100; // b was already due at 320 (the gap read when a spawned); c's gap is read when b spawns
  f.c.advance(320);
  f.c.advance(100);
  assert.deepEqual(f.spawned.map((s) => s.at), [0, 320, 420]);
});

test('column: a newer floater is slot 0 and every earlier visible one is a slot higher', () => {
  const f = make();
  ['a', 'b', 'c'].forEach((id) => f.push(id));
  f.c.advance(640);
  assert.deepEqual(f.layouts.at(-1), [['a', 2], ['b', 1], ['c', 0]]);
  // Strictly decreasing y, oldest highest: every floater is the same size, so the step is one line plus the gap.
  const step = 28 + FLOATER_STACK.floaterLineGapPx, base = 300;
  const ys = f.layouts.at(-1).map(([, slot]) => columnTop(base, slot, step));
  assert.deepEqual(ys, [base - 2 * step, base - step, base]);
  assert.ok(ys.every((y, i) => i === 0 || y > ys[i - 1]), 'y grows from the oldest to the newest');
});

test('an expired floater leaves the column without moving the newer ones', () => {
  const f = make({ life: 1000 });
  f.push('a'); f.push('b');
  f.c.advance(320);
  assert.deepEqual(f.layouts.at(-1), [['a', 1], ['b', 0]]);
  f.c.advance(700);
  assert.deepEqual(f.stack.visible.map((e) => e.item.id), ['b']);
  assert.equal(f.stack.visible[0].slot, 0);
});

test('the cap: the oldest fades early, nothing queued is dropped', () => {
  const f = make({ max: 3, life: 10000 });
  ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => f.push(id));
  f.c.advance(5 * 320);
  assert.deepEqual(f.spawned.map((s) => s.id), ['a', 'b', 'c', 'd', 'e', 'f'], 'every queued floater spawns');
  assert.deepEqual(f.faded.map((s) => [s.id, s.at]), [['a', 960], ['b', 1280], ['c', 1600]], 'the oldest leaves as each extra one spawns');
  assert.deepEqual(f.stack.visible.map((e) => e.item.id), ['d', 'e', 'f']);
  assert.equal(f.stack.visible.length, 3, 'never more than the cap');
});

test('the cap can shrink between spawns (little room above the HUD) and it never goes below one', () => {
  const f = make({ max: 4, life: 10000 });
  f.push('a'); f.push('b'); f.push('c');
  f.c.advance(640);
  f.opts.max = 1;
  f.push('d');
  f.c.advance(320);
  assert.deepEqual(f.stack.visible.map((e) => e.item.id), ['d']);
  assert.deepEqual(f.faded.map((s) => s.id), ['a', 'b', 'c']);
  f.opts.max = 0;
  f.push('e'); f.c.advance(320);
  assert.deepEqual(f.stack.visible.map((e) => e.item.id), ['e']);
});

test('words waiting together spawn by priority, numbers keep their place, ties keep arrival order', () => {
  const f = make();
  f.push('first');                       // spawns now
  f.push('n1');                          // a number: no rank
  f.push('w-low', { rank: 1 });
  f.push('n2');
  f.push('w-high', { rank: 6 });
  f.push('w-low2', { rank: 1 });
  f.c.advance(5 * 320);
  // The ranked slots (2nd, 4th, 5th waiting) trade places among themselves: high, then the two lows in arrival order.
  assert.deepEqual(f.spawned.map((s) => s.id), ['first', 'n1', 'w-high', 'n2', 'w-low', 'w-low2']);
});

test('dropWaiting keeps the visible floaters and a later push starts from the last spawn', () => {
  const f = make();
  f.push('a'); f.push('b'); f.push('c');
  f.stack.dropWaiting();
  f.c.advance(2000);
  assert.deepEqual(f.spawned.map((s) => s.id), ['a']);
  f.c.advance(100); f.push('d');
  assert.deepEqual(f.spawned.map((s) => s.id), ['a', 'd']);
});

test('drop(pred, { visible: true }) removes matching floaters from the waiting list and the column', () => {
  const f = make({ life: 10000 });
  f.push('a', { word: true }); f.push('b'); f.push('c', { word: true });
  f.c.advance(320);
  f.stack.drop((item) => item.word === true, { visible: true });
  assert.deepEqual(f.stack.visible.map((e) => e.item.id), ['b']);
  assert.deepEqual(f.stack.waiting, []);
  assert.equal(f.stack.has((item) => item.id === 'b'), true);
  assert.equal(f.stack.has((item) => item.id === 'a'), false);
});

test('a combatant that went away drops every waiting floater', () => {
  const c = clock();
  const spawned = [];
  let gone = false;
  const stack = createFloaterStack({
    ...c, staggerMs: () => 320, maxVisible: () => 4, alive: () => !gone,
    show: (item) => { spawned.push(item.id); },
  });
  stack.push({ id: 'a', lifeMs: 1000 }); stack.push({ id: 'b', lifeMs: 1000 });
  gone = true;
  c.advance(2000);
  assert.deepEqual(spawned, ['a']);
  assert.deepEqual(stack.waiting, []);
});

test('clear empties the stack and cancels its timers', () => {
  const f = make();
  f.push('a'); f.push('b');
  f.stack.clear();
  f.c.advance(5000);
  assert.deepEqual(f.spawned.map((s) => s.id), ['a']);
  assert.deepEqual(f.stack.visible, []);
});
