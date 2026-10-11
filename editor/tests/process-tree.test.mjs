// node --test editor/tests/process-tree.test.mjs — stopping a process group: the stop resolves
// only once a grandchild that ignores SIGTERM has exited, and SIGKILL follows the grace period.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { groupAlive, procGroupMembers, stopGroup } from '../../tools/lib/process-tree.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A process that has exited is gone, or an unreaped zombie that can no longer run or write.
function exitedOrZombie(pid) {
  try { process.kill(pid, 0); } catch (e) { return e.code === 'ESRCH'; }
  try { return /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return true; }
}

// A group leader that ignores nothing and spawns one grandchild, which writes its pid and
// ignores SIGTERM for `lifeMs` before exiting on its own.
async function leaderWithGrandchild(dir, { lifeMs }) {
  const pidFile = path.join(dir, 'grandchild.pid');
  const grandchild = `process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => process.exit(0), ${lifeMs});`;
  const leader = spawn(process.execPath, ['-e', `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); setInterval(() => {}, 1000);`], { detached: true, stdio: 'ignore' });
  for (let i = 0; i < 200; i++) {
    try { return { leader, grandchildPid: Number(await fs.readFile(pidFile, 'utf8')) }; } catch { await delay(20); }
  }
  throw new Error('the grandchild did not start');
}

test('stopGroup resolves only after a SIGTERM-ignoring grandchild has exited', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-tree-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { leader, grandchildPid } = await leaderWithGrandchild(dir, { lifeMs: 1000 });
  const started = Date.now();
  await stopGroup(leader.pid, { graceMs: 5000 });
  assert.ok(Date.now() - started >= 500, 'it waited for the grandchild instead of returning at the leader exit');
  assert.equal(groupAlive(leader.pid), false, 'the group is empty');
  assert.equal(exitedOrZombie(grandchildPid), true, 'the grandchild is gone or an unreaped zombie');
});

test('stopGroup sends SIGKILL to a group that outlives the grace period', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-tree-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { leader, grandchildPid } = await leaderWithGrandchild(dir, { lifeMs: 60000 });
  await stopGroup(leader.pid, { graceMs: 300 });
  assert.equal(groupAlive(leader.pid), false, 'the group was forced empty');
  assert.equal(exitedOrZombie(grandchildPid), true, 'the grandchild was killed');
});

test('stopGroup resolves within its bound when SIGKILLed members linger, and reports them', async () => {
  // Elsewhere kill(-pgid, 0) keeps succeeding for zombies, so the group never looks empty.
  const sent = [];
  const kill = (target, signal) => { if (signal !== 0) sent.push(signal); };
  const started = Date.now();
  const result = await stopGroup(7, { graceMs: 100, killWaitMs: 200, pollMs: 10, kill, platform: 'darwin' });
  const took = Date.now() - started;
  assert.ok(took >= 280 && took < 1500, `resolved after grace + killWait, took ${took} ms`);
  assert.deepEqual(sent, ['SIGTERM', 'SIGKILL']);
  assert.deepEqual(result, { forced: true, stillAlive: true, zombies: [] });
});

test('stopGroup on Linux reports the unreaped zombies a SIGKILL left behind', async () => {
  let killed = false;
  const members = () => (killed ? [{ pid: 50, state: 'Z' }] : [{ pid: 49, state: 'S' }]);
  const kill = (target, signal) => { if (signal === 'SIGKILL') killed = true; };
  const result = await stopGroup(7, { graceMs: 50, killWaitMs: 2000, pollMs: 10, kill, platform: 'linux', members });
  assert.deepEqual(result, { forced: true, stillAlive: false, zombies: [50] });
});

test('on Linux a group whose only members are zombies counts as empty', () => {
  const zombiesOnly = () => [{ pid: 40, state: 'Z' }, { pid: 41, state: 'X' }];
  const kill = () => {}; // kill(-pgid, 0) still succeeds while zombies hold the group id
  assert.equal(groupAlive(7, kill, { platform: 'linux', members: zombiesOnly }), false, 'zombies are not live');
  assert.equal(groupAlive(7, kill, { platform: 'linux', members: () => [{ pid: 40, state: 'Z' }, { pid: 42, state: 'S' }] }), true, 'one sleeping member is live');
  assert.equal(groupAlive(7, kill, { platform: 'linux', members: () => [] }), false, 'no members in /proc: empty');
  assert.equal(groupAlive(7, () => { throw Object.assign(Error('gone'), { code: 'ESRCH' }); }, { platform: 'darwin', members: zombiesOnly }), false, 'elsewhere kill(-pgid, 0) decides');
});

test('procGroupMembers reads pgrp and state from /proc, even when comm holds spaces and parentheses', () => {
  const files = {
    '/proc/10/stat': '10 (node) S 1 7 7 0 -1',
    '/proc/11/stat': '11 (my (odd) name) Z 10 7 7 0 -1',
    '/proc/12/stat': '12 (other) S 1 8 8 0 -1',
  };
  const readdir = () => ['10', '11', '12', 'self'];
  const readFile = (file) => { if (!(file in files)) throw Object.assign(Error('gone'), { code: 'ENOENT' }); return files[file]; };
  assert.deepEqual(procGroupMembers(7, { readdir, readFile }), [{ pid: 10, state: 'S' }, { pid: 11, state: 'Z' }]);
  assert.equal(procGroupMembers(7, { readdir: () => { throw Object.assign(Error('no proc'), { code: 'ENOENT' }); } }), null, 'no /proc: unknown');
});
