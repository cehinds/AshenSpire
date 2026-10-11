// node --test editor/tests/process-tree.test.mjs — stopping a process group: the stop resolves
// only once a grandchild that ignores SIGTERM has exited, and SIGKILL follows the grace period.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { groupAlive, stopGroup } from '../../tools/lib/process-tree.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  assert.throws(() => process.kill(grandchildPid, 0), (e) => e.code === 'ESRCH', 'the grandchild is gone');
});

test('stopGroup sends SIGKILL to a group that outlives the grace period', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-tree-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { leader, grandchildPid } = await leaderWithGrandchild(dir, { lifeMs: 60000 });
  await stopGroup(leader.pid, { graceMs: 300 });
  assert.equal(groupAlive(leader.pid), false, 'the group was forced empty');
  assert.throws(() => process.kill(grandchildPid, 0), (e) => e.code === 'ESRCH');
});
