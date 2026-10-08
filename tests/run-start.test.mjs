import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunStartOwner } from '../src/model/runStart.js';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('a blocked profile start accepts one creation and shares its result across repeated Begin requests', async () => {
  const owner = createRunStartOwner(), gate = deferred();
  let prepares = 0, creations = 0;
  const request = () => owner.start({ prepare: () => { prepares++; return gate.promise; }, isCurrent: () => true,
    adopt: () => { creations++; }, onFailure: error => { throw error; } });
  const first = request(), second = request();
  assert.equal(first, second); assert.equal(prepares, 1); assert.equal(creations, 0);
  gate.resolve({ ok: true });
  assert.deepEqual(await first, { ok: true }); assert.equal(creations, 1);
});

test('leaving the start screen or changing the current run cancels late profile adoption', async () => {
  for (const change of ['surface', 'run']) {
    const owner = createRunStartOwner(), gate = deferred(), surface = {}, run = {};
    let currentSurface = surface, currentRun = run, creations = 0, notices = 0;
    const pending = owner.start({ prepare: () => gate.promise, isCurrent: () => currentSurface === surface && currentRun === run,
      adopt: () => { creations++; }, onFailure: () => { notices++; } });
    if (change === 'surface') currentSurface = {}; else currentRun = {};
    gate.resolve({ ok: true });
    assert.deepEqual(await pending, { ok: false, cancelled: true });
    assert.equal(creations, 0); assert.equal(notices, 0);
  }
});

test('profile refusal or rejection is surfaced once, preserves the run and releases the owner for retry', async () => {
  for (const failure of [() => ({ ok: false, reason: 'quota exceeded' }), () => Promise.reject(new Error('storage closed'))]) {
    const owner = createRunStartOwner(); let creations = 0; const notices = [];
    const common = { isCurrent: () => true, adopt: () => { creations++; }, onFailure: error => notices.push(error.message) };
    assert.equal((await owner.start({ ...common, prepare: failure })).ok, false);
    assert.equal(creations, 0); assert.equal(notices.length, 1);
    assert.deepEqual(await owner.start({ ...common, prepare: () => ({ ok: true }) }), { ok: true });
    assert.equal(creations, 1);
  }
});
