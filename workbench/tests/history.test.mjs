// node --test workbench/tests/history.test.mjs — the shared undo/redo kit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../ui/kit/history.mjs';

// A tiny document: each gesture changes doc.value and records how to undo/redo it.
function doc(h, start = 0) {
  const d = { value: start };
  d.set = (label, next) => {
    const before = d.value;
    d.value = next;
    h.push({ label, before, after: next, undo: () => { d.value = before; }, redo: () => { d.value = next; } });
  };
  return d;
}

test('push, undo and redo move one gesture at a time', () => {
  const h = new History();
  const d = doc(h);
  d.set('one', 1); d.set('two', 2);
  assert.equal(h.canUndo, true); assert.equal(h.canRedo, false);
  h.undo(); assert.equal(d.value, 1);
  h.undo(); assert.equal(d.value, 0);
  assert.equal(h.canUndo, false); assert.equal(h.canRedo, true);
  h.redo(); assert.equal(d.value, 1);
  h.redo(); assert.equal(d.value, 2);
  assert.equal(h.redo(), null, 'nothing left to redo');
});

test('a new change after an undo drops the redo branch', () => {
  const h = new History();
  const d = doc(h);
  d.set('a', 1); d.set('b', 2); h.undo();
  d.set('c', 5);
  assert.equal(h.canRedo, false);
  assert.deepEqual(h.list().map((e) => e.label), ['a', 'c']);
});

test('no-op entries (equal before and after, or missing undo/redo) are ignored', () => {
  const h = new History();
  assert.equal(h.push({ label: 'drag', before: { x: 1 }, after: { x: 1 }, undo() {}, redo() {} }), false);
  assert.equal(h.push({ label: 'half', undo() {} }), false, 'redo is required');
  assert.equal(h.canUndo, false);
  assert.equal(h.list().length, 0);
  assert.equal(h.push({ label: 'real', before: 1, after: 2, undo() {}, redo() {} }), true);
  assert.equal(h.list().length, 1);
});

test('group merges several pushes into one undo step, undone and redone in order', () => {
  const h = new History();
  const d = doc(h);
  const log = [];
  h.group('move three', () => {
    h.push({ label: 'a', undo: () => log.push('undo a'), redo: () => log.push('redo a') });
    h.push({ label: 'b', undo: () => log.push('undo b'), redo: () => log.push('redo b') });
    h.push({ label: 'c', undo: () => log.push('undo c'), redo: () => log.push('redo c') });
  });
  assert.deepEqual(h.list(), [{ label: 'move three', done: true }]);
  h.undo();
  assert.deepEqual(log, ['undo c', 'undo b', 'undo a']);
  h.redo();
  assert.deepEqual(log.slice(3), ['redo a', 'redo b', 'redo c']);
  d.set('x', 1);
  assert.equal(h.list().length, 2);
});

test('nested groups become one step; an empty group records nothing', () => {
  const h = new History();
  h.group('outer', () => {
    h.push({ label: 'a', undo() {}, redo() {} });
    h.group('inner', () => { h.push({ label: 'b', undo() {}, redo() {} }); });
  });
  assert.deepEqual(h.list(), [{ label: 'outer', done: true }]);
  h.group('nothing', () => {});
  assert.equal(h.list().length, 1);
});

test('a throwing group still closes and keeps the pushes it made', () => {
  const h = new History();
  assert.throws(() => h.group('broken', () => { h.push({ label: 'a', undo() {}, redo() {} }); throw Error('boom'); }), /boom/);
  assert.deepEqual(h.list(), [{ label: 'broken', done: true }]);
  h.push({ label: 'after', undo() {}, redo() {} });
  assert.equal(h.list().length, 2, 'later pushes are top-level again');
});

test('a callback that pushes during undo or redo cannot corrupt the stacks', () => {
  const h = new History();
  let pushed = null;
  h.push({ label: 'a', undo() {}, redo() {} });
  h.push({ label: 'b', undo() { pushed = h.push({ label: 'nested', undo() {}, redo() {} }); }, redo() { pushed = h.push({ label: 'nested2', undo() {}, redo() {} }); } });
  assert.equal(h.undo().label, 'b');
  assert.equal(pushed, false, 'push is ignored while undo runs');
  assert.deepEqual(h.list(), [{ label: 'a', done: true }, { label: 'b', done: false }]);
  h.redo();
  assert.equal(pushed, false, 'push is ignored while redo runs');
  assert.deepEqual(h.list(), [{ label: 'a', done: true }, { label: 'b', done: true }]);
});

test('a throwing undo keeps the entry where it was', () => {
  const h = new History();
  h.push({ label: 'bad', undo() { throw Error('nope'); }, redo() {} });
  assert.throws(() => h.undo(), /nope/);
  assert.deepEqual(h.list(), [{ label: 'bad', done: true }]);
  assert.equal(h.canRedo, false);
});

test('the history is limited to 200 steps by default and drops the oldest', () => {
  const h = new History();
  for (let i = 0; i < 205; i += 1) h.push({ label: `s${i}`, undo() {}, redo() {} });
  const list = h.list();
  assert.equal(list.length, 200);
  assert.equal(list[0].label, 's5');
  const small = new History({ limit: 2 });
  for (let i = 0; i < 4; i += 1) small.push({ label: `t${i}`, undo() {}, redo() {} });
  assert.deepEqual(small.list().map((e) => e.label), ['t2', 't3']);
});

test('list() shows undone steps after the applied ones, nearest first', () => {
  const h = new History();
  for (const label of ['a', 'b', 'c']) h.push({ label, undo() {}, redo() {} });
  h.undo(); h.undo();
  assert.deepEqual(h.list(), [{ label: 'a', done: true }, { label: 'b', done: false }, { label: 'c', done: false }]);
});

test('onChange fires on push, undo, redo and clear, and can unsubscribe', () => {
  const h = new History();
  let calls = 0;
  const off = h.onChange(() => { calls += 1; });
  h.push({ label: 'a', undo() {}, redo() {} });
  h.undo(); h.redo(); h.clear();
  assert.equal(calls, 4);
  assert.equal(h.canUndo, false);
  off();
  h.push({ label: 'b', undo() {}, redo() {} });
  assert.equal(calls, 4);
});
