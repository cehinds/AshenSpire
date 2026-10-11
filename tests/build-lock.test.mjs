// node --test tests/build-lock.test.mjs — the cross-process lock on the
// generated trees (tools/lib/build-lock.mjs) that the Workbench, the editor and
// UI Studio share.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tryAcquire, acquire, lockPath, pidAlive, procStartOf, LOCK_NAME, testHooks } from '../tools/lib/build-lock.mjs';

const HOUR = 60 * 60 * 1000;
const LINUX = process.platform === 'linux';

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

test('a lock from a live process is not stale, however old its startedAt', (t) => {
  const root = tmpRoot(t);
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: foreign(t), holder: 'Long build', startedAt: twoHoursAgo, token: 'x' }));
  assert.equal(typeof tryAcquire(root, 'me'), 'object', 'a live owner keeps the lock, whatever its age');
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'Long build', 'left as it was');
});

test('the lock records the owner\'s process start identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-lock-'));
  try {
    const release = tryAcquire(root, 'me');
    const info = JSON.parse(fs.readFileSync(lockPath(root), 'utf8'));
    assert.equal(info.procStart, procStartOf(process.pid), 'procStart is this process\'s start identity');
    if (LINUX) assert.match(info.procStart, /^\d+$/);
    else assert.equal(info.procStart, null);
    release();
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a lock whose pid was reused by another process (start identity differs) is stale', { skip: !LINUX && 'needs /proc' }, (t) => {
  const root = tmpRoot(t);
  // This process is alive, but its start identity is not the one the lock recorded: the pid was reused.
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: process.pid, holder: 'Crashed build', startedAt: Date.now(), token: 'x', procStart: '1' }));
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'a reused pid is not the owner');
  release();
});

test('a lock whose start identity matches is not stale, however old its startedAt', { skip: !LINUX && 'needs /proc' }, (t) => {
  const root = tmpRoot(t);
  const pid = foreign(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'Verified long build', startedAt: Date.now() - 7 * HOUR, token: 'x', procStart: procStartOf(pid) }));
  assert.equal(typeof tryAcquire(root, 'me'), 'object', 'a verified live owner never expires');
});

test('an unverified lock (procStart null) is stale past 6 h, and not before', (t) => {
  const root = tmpRoot(t);
  const pid = foreign(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'Unverified build', startedAt: Date.now() - 7 * HOUR, token: 'x', procStart: null }));
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'the 6 h ceiling breaks an unverifiable lock');
  release();
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'Unverified build', startedAt: Date.now() - HOUR, token: 'x', procStart: null }));
  assert.equal(typeof tryAcquire(root, 'me'), 'object', 'an hour-old unverifiable lock still holds');
});

test('a lock whose pid is dead is stale, however fresh its startedAt', (t) => {
  const root = tmpRoot(t);
  const dead = deadPid();
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: dead, holder: 'Crashed build', startedAt: Date.now() - 2 * 60 * 60 * 1000, token: 'x' }));
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'a dead owner is stale');
  release();
});

/** Read the /proc state of `pid` as `state` (other /proc files are read as usual), for the lock's owner check. */
function procStateReads(t, pid, state) {
  testHooks.readProcStat = (file, enc) => (file === `/proc/${pid}/stat`
    ? `${pid} (node) ${state} 1 ${pid} ${pid} 0 -1 0 0 0 0 0 0 0 0 20 0 1 0 555 0 0`
    : fs.readFileSync(file, enc));
  t.after(() => { testHooks.readProcStat = null; });
}

test('a lock whose owner is an unreaped zombie is stale and taken, though kill still reaches it', { skip: !LINUX && 'needs /proc' }, (t) => {
  const root = tmpRoot(t);
  const pid = foreign(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'Orphaned build', startedAt: Date.now(), token: 'x', procStart: procStartOf(pid) }));
  procStateReads(t, pid, 'Z');
  assert.equal(pidAlive(pid), false, 'a zombie owner is not alive');
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'a zombie owner\'s lock is stale and taken');
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'me');
  release();
  assert.deepEqual(fs.readdirSync(root), [], 'nothing left behind');
});

test('a dead (X) lock owner is stale too', { skip: !LINUX && 'needs /proc' }, (t) => {
  const root = tmpRoot(t);
  const pid = foreign(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'Dying build', startedAt: Date.now(), token: 'x', procStart: procStartOf(pid) }));
  procStateReads(t, pid, 'X');
  assert.equal(typeof tryAcquire(root, 'me'), 'function');
});

test('a live lock owner in state S or R stays held', { skip: !LINUX && 'needs /proc' }, (t) => {
  const root = tmpRoot(t);
  const pid = foreign(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid, holder: 'Running build', startedAt: Date.now(), token: 'x', procStart: procStartOf(pid) }));
  for (const state of ['S', 'R']) {
    procStateReads(t, pid, state);
    assert.equal(pidAlive(pid), true, `state ${state} is alive`);
    const held = tryAcquire(root, 'me');
    assert.equal(held.heldBy.holder, 'Running build', `state ${state} keeps the lock`);
    assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'Running build', 'left as it was');
  }
});

test('an empty lock file is stale only once it is older than 10 s', (t) => {
  const root = tmpRoot(t);
  fs.writeFileSync(lockPath(root), '');
  assert.equal(typeof tryAcquire(root, 'me'), 'object', 'a just-created lock may still be being written');
  const old = new Date(Date.now() - 60 * 1000);
  fs.utimesSync(lockPath(root), old, old);
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'an old unwritten lock is abandoned');
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

test('a fresh lock that takes the slot after the stale one is judged is not removed', (t) => {
  const root = tmpRoot(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: deadPid(), holder: 'Crashed build', startedAt: Date.now(), token: 'x' }));
  const fresh = JSON.stringify({ pid: foreign(t), holder: 'Live build', startedAt: Date.now(), token: 'live' });
  // Between the judgement and the break, another writer removes the stale lock and creates its own.
  testHooks.beforeRecheck = (file) => { testHooks.beforeRecheck = null; fs.unlinkSync(file); fs.writeFileSync(file, fresh); };
  t.after(() => { testHooks.beforeRecheck = null; });
  const got = tryAcquire(root, 'me');
  assert.equal(typeof got, 'object', 'the live holder keeps the lock');
  assert.equal(got.heldBy.holder, 'Live build');
  assert.equal(fs.readFileSync(lockPath(root), 'utf8'), fresh, 'the fresh lock is left in place');
});

test('a stale lock is broken and acquired, leaving no break mutex behind', (t) => {
  const root = tmpRoot(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: deadPid(), holder: 'Crashed build', startedAt: Date.now(), token: 'x' }));
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'the stale lock is broken and taken');
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'me');
  release();
  assert.deepEqual(fs.readdirSync(root), [], 'no lock and no .break left behind');
});

test('a fresh break mutex blocks breaking: the stale lock stays until the break is over', (t) => {
  const root = tmpRoot(t);
  const stale = JSON.stringify({ pid: deadPid(), holder: 'Crashed build', startedAt: Date.now(), token: 'x' });
  fs.writeFileSync(lockPath(root), stale);
  fs.writeFileSync(`${lockPath(root)}.break`, 'other-breaker');
  const got = tryAcquire(root, 'me');
  assert.equal(typeof got, 'object', 'a break in progress is not taken over');
  assert.equal(fs.readFileSync(lockPath(root), 'utf8'), stale, 'the stale lock is not removed by this run');
  assert.equal(fs.readFileSync(`${lockPath(root)}.break`, 'utf8'), 'other-breaker', 'the other breaker\'s mutex is left alone');
  fs.rmSync(`${lockPath(root)}.break`);
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'once the break is over, the stale lock is broken');
  release();
});

test('a leftover break mutex older than 30 s is cleared, and the stale lock is broken', (t) => {
  const root = tmpRoot(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: deadPid(), holder: 'Crashed build', startedAt: Date.now(), token: 'x' }));
  fs.writeFileSync(`${lockPath(root)}.break`, 'crashed-breaker');
  const old = new Date(Date.now() - 60 * 1000);
  fs.utimesSync(`${lockPath(root)}.break`, old, old);
  const release = tryAcquire(root, 'me');
  assert.equal(typeof release, 'function', 'a crashed breaker does not block forever');
  release();
  assert.deepEqual(fs.readdirSync(root), [], 'the leftover mutex is cleared');
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

test('acquire with an aborted signal rejects at once with the reason, and never creates the lock', async (t) => {
  const root = tmpRoot(t);
  const ctl = new AbortController();
  ctl.abort(new Error('The Workbench is closing'));
  const started = Date.now();
  await assert.rejects(acquire(root, 'me', { timeoutMs: 5000, signal: ctl.signal }), /The Workbench is closing/);
  assert.ok(Date.now() - started < 500, 'rejects promptly');
  assert.equal(fs.existsSync(lockPath(root)), false, 'no lock was created');
});

test('an abort while acquire waits for a foreign holder rejects at once and leaves that holder\'s lock alone', async (t) => {
  const root = tmpRoot(t);
  const first = tryAcquire(root, 'Engine export (Workbench)');
  t.after(first);
  const ctl = new AbortController();
  const waiting = acquire(root, 'me', { timeoutMs: 5000, pollMs: 5000, signal: ctl.signal });
  setTimeout(() => ctl.abort(new Error('The Workbench is closing')), 50);
  const started = Date.now();
  await assert.rejects(waiting, /The Workbench is closing/);
  assert.ok(Date.now() - started < 1000, 'the wait ends at the abort, not at the poll');
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'Engine export (Workbench)', 'their lock stands');
});

// A planted checkout whose tools/ holds the real lock helper and framework-data-build
// (the smallest writer CLI), so the CLI's own lock is exercised end to end.
function plantBuilder(t) {
  const root = tmpRoot(t);
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.mkdirSync(path.join(root, 'tools/lib'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tools/lib/build-lock.mjs'), path.join(root, 'tools/lib/build-lock.mjs'));
  fs.copyFileSync(path.join(repo, 'tools/lib/process-tree.mjs'), path.join(root, 'tools/lib/process-tree.mjs'));
  fs.copyFileSync(path.join(repo, 'tools/framework-data-build.mjs'), path.join(root, 'tools/framework-data-build.mjs'));
  fs.mkdirSync(path.join(root, 'content/framework'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/framework/probe.json'), '{"a": 1}\n');
  return root;
}

function runCli(root, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'tools/framework-data-build.mjs'), ...args], { cwd: root, env: { ...process.env, ASHEN_BUILD_LOCK_TOKEN: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

const generated = (root) => path.join(root, 'src/framework/data/probe.js');

test('a writer CLI run directly takes the lock and frees it when it exits', async (t) => {
  const root = plantBuilder(t);
  const r = await runCli(root, []);
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(generated(root)));
  assert.equal(fs.existsSync(lockPath(root)), false, 'released on exit');
});

test('a writer CLI waits for a foreign holder, then gives up naming it', async (t) => {
  const root = plantBuilder(t);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: foreign(t), holder: 'UI Studio config compile', startedAt: Date.now(), token: 'theirs' }));
  const r = await runCli(root, [], { ASHEN_BUILD_LOCK_WAIT_MS: '300' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /waiting for UI Studio config compile/);
  assert.match(r.out, /gave up after/);
  assert.equal(fs.existsSync(generated(root)), false, 'wrote nothing');
  // Released meanwhile: the waiting CLI goes ahead.
  const waiting = runCli(root, [], { ASHEN_BUILD_LOCK_WAIT_MS: '10000' });
  setTimeout(() => fs.rmSync(lockPath(root)), 400);
  const ok = await waiting;
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /waiting for UI Studio config compile/);
  assert.ok(fs.existsSync(generated(root)));
});

test('a nested writer CLI runs under its parent\'s hold when given the lock token', async (t) => {
  const root = plantBuilder(t);
  const release = tryAcquire(root, 'Engine export (Workbench)');
  t.after(release);
  const started = Date.now();
  const r = await runCli(root, [], { ASHEN_BUILD_LOCK_TOKEN: release.token, ASHEN_BUILD_LOCK_WAIT_MS: '5000' });
  assert.equal(r.code, 0, r.out);
  assert.ok(Date.now() - started < 4000, 'did not wait');
  assert.doesNotMatch(r.out, /waiting for/);
  assert.equal(JSON.parse(fs.readFileSync(lockPath(root), 'utf8')).holder, 'Engine export (Workbench)', 'the parent still holds it');
  // A wrong token is no pass.
  const wrong = await runCli(root, [], { ASHEN_BUILD_LOCK_TOKEN: 'not-it', ASHEN_BUILD_LOCK_WAIT_MS: '200' });
  assert.equal(wrong.code, 1, wrong.out);
});

test('a --check run only reads and takes no lock', async (t) => {
  const root = plantBuilder(t);
  assert.equal((await runCli(root, [])).code, 0);
  fs.writeFileSync(lockPath(root), JSON.stringify({ pid: foreign(t), holder: 'Someone', startedAt: Date.now(), token: 'x' }));
  const r = await runCli(root, ['--check'], { ASHEN_BUILD_LOCK_WAIT_MS: '200' });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /waiting for/);
});

test('every writer CLI takes the lock, and every server wrapper passes its token on', () => {
  const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const p of ['tools/content-build.mjs', 'tools/config-build.mjs', 'tools/framework-data-build.mjs', 'tools/engine-export.mjs', 'tools/launch.mjs']) assert.match(read(p), /await holdForCli\(/, p);
  for (const p of ['workbench/core/jobs.mjs', 'workbench/server.mjs', 'editor/server.mjs', 'ui-studio/server.mjs']) assert.match(read(p), /lockEnv\(/, p);
});

test('the workbench workflow runs this suite and triggers on the lock and its tests', () => {
  const yml = fs.readFileSync(new URL('../.github/workflows/workbench.yml', import.meta.url), 'utf8');
  const run = yml.split('\n').find((l) => /run: node --test workbench\/tests/.test(l)) || '';
  assert.match(run, /tests\/build-lock\.test\.mjs/, 'the test step runs tests/build-lock.test.mjs');
  const shared = ['tools/lib/build-lock.mjs', 'tests/build-lock.test.mjs', 'tools/lib/process-tree.mjs', 'tools/lib/build-steps.mjs', 'tools/lib/write-atomic.mjs', 'tools/lib/shot-match.mjs', 'tools/launch.mjs', 'tests/build-steps.test.mjs', 'tests/write-atomic.test.mjs', 'tests/shot-match.test.mjs'];
  for (const file of shared) {
    assert.equal(yml.split(`- '${file}'`).length - 1, 2, `${file} is in both the push and pull_request paths filters`);
  }
});
