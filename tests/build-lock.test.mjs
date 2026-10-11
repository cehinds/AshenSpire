// node --test tests/build-lock.test.mjs — the cross-process lock on the
// generated trees (tools/lib/build-lock.mjs) that the Workbench, the editor and
// UI Studio share.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { tryAcquire, acquire, lockPath, pidAlive, STALE_MS, LOCK_NAME } from '../tools/lib/build-lock.mjs';

function tmpRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-lock-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** A live process that is not this one, for a lock "held by another process". */
function foreign(t) {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => child.kill());
  return child.pid;
}

const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

test('two holders: the second is refused with the first one\'s name until it releases', (t) => {
  const root = tmpRoot(t);
  const first = tryAcquire(root, 'Config build (Workbench)');
  assert.equal(typeof first, 'function');
  assert.equal(path.basename(lockPath(root)), LOCK_NAME);
  const info = JSON.parse(fs.readFileSync(lockPath(root), 'utf8'));
  assert.equal(info.pid, process.pid);
  assert.equal(info.holder, 'Config build (Workbench)');
  const second = tryAcquire(root, 'Editor content build');
  assert.equal(typeof second, 'object');
  assert.equal(second.heldBy.holder, 'Config build (Workbench)');
  first();
  assert.equal(fs.existsSync(lockPath(root)), false);
  const third = tryAcquire(root, 'Editor content build');
  assert.equal(typeof third, 'function');
  third();
});

test('a lock from a live foreign process holds; one whose pid is gone is taken over', (t) => {
  const root = tmpRoot(t);
  const pid = foreign(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'UI Studio config compile', startedAt: Date.now(), token: 'x' }));
  assert.equal(tryAcquire(root, 'me').heldBy.holder, 'UI Studio config compile');
  const dead = deadPid();
  assert.equal(pidAlive(dead), false);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: dead, holder: 'Crashed build', startedAt: Date.now(), token: 'x' }));
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'a dead holder is stale');
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'me');
  release();
  assert.deepEqual(fs.readdirSync(root), [], 'nothing left behind');
});

test('a lock older than the stale limit is taken over even if its pid is alive', (t) => {
  const root = tmpRoot(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: foreign(t), holder: 'Hung', startedAt: Date.now() - STALE_MS - 1000, token: 'x' }));
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function');
  release();
});

test('release removes only our own lock', (t) => {
  const root = tmpRoot(t);
  const release = tryAcquire(root, 'me');
  // Our lock was broken (say, judged stale) and another process took the slot.
  const theirs = JSON.stringify({ pid: foreign(t), holder: 'Someone else', startedAt: Date.now(), token: 'theirs' });
  fs.writeFileSync(lockPath(root), theirs);
  release();
  assert.equal(fs.readFileSync(lockPath(root), 'utf8'), theirs, 'their lock stands');
});

test('acquire waits for the holder, and gives up naming it after the timeout', async (t) => {
  const root = tmpRoot(t);
  const first = tryAcquire(root, 'Engine export (Workbench)');
  await assert.rejects(acquire(root, 'me', { timeoutMs: 120, pollMs: 20 }), (e) => e.status === 409 && /Engine export \(Workbench\) is running/.test(e.message));
  setTimeout(first, 80);
  const release = await acquire(root, 'me', { timeoutMs: 2000, pollMs: 20 });
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'me');
  release();
});
