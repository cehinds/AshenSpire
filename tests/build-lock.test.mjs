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

// A planted checkout whose tools/ holds the real lock helper and framework-data-build
// (the smallest writer CLI), so the CLI's own lock is exercised end to end.
function plantBuilder(t) {
  const root = tmpRoot(t);
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.mkdirSync(path.join(root, 'tools/lib'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tools/lib/build-lock.mjs'), path.join(root, 'tools/lib/build-lock.mjs'));
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
  for (const file of ['tools/lib/build-lock.mjs', 'tests/build-lock.test.mjs']) {
    assert.equal(yml.split(`- '${file}'`).length - 1, 2, `${file} is in both the push and pull_request paths filters`);
  }
});
