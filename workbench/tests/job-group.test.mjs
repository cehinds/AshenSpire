// node --test workbench/tests/job-group.test.mjs — a job's slot and build lock are held until its whole
// process group is gone, not just the step's direct child (POSIX process groups).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobRunner, JOBS, GENERATED } from '../core/jobs.mjs';
import { groupAlive } from '../../tools/lib/process-tree.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, ms = 8000) {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await delay(20);
  }
}

let seq = 0;
/** A one-step job whose step (child) starts a grandchild that ignores SIGTERM and exits after grandMs.
 *  stay: the child keeps running until SIGTERM (a stop); otherwise it exits 0 on its own, leaving the grandchild behind. */
function fixture(t, { stay, grandMs }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-job-group-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = Object.fromEntries(['stepPid', 'grandReady', 'grandDone', 'ready'].map((k) => [k, path.join(dir, k)]));
  const grand = `const fs = require('node:fs'); process.on('SIGTERM', () => {});
fs.writeFileSync(${JSON.stringify(files.grandReady)}, 'x');
setTimeout(() => { fs.writeFileSync(${JSON.stringify(files.grandDone)}, 'x'); process.exit(0); }, ${grandMs});`;
  const step = `const { spawn } = require('node:child_process'); const fs = require('node:fs');
${stay ? "process.on('SIGTERM', () => process.exit(0));" : ''}
const g = spawn(process.execPath, ['-e', ${JSON.stringify(grand)}], { stdio: 'ignore' });
${stay ? '' : 'g.unref();'}
fs.writeFileSync(${JSON.stringify(files.stepPid)}, String(process.pid));
const poll = setInterval(() => { if (fs.existsSync(${JSON.stringify(files.grandReady)})) { clearInterval(poll); fs.writeFileSync(${JSON.stringify(files.ready)}, 'x'); } }, 10);
${stay ? 'setInterval(() => {}, 1000);' : ''}`;
  fs.writeFileSync(path.join(dir, 'step.cjs'), step);
  const id = `test-group-${++seq}`;
  JOBS[id] = { lock: GENERATED, label: 'Fixture', description: '', steps: () => [{ args: ['step.cjs'] }] };
  t.after(() => { delete JOBS[id]; });
  const runner = new JobRunner({ root: dir, stateFile: path.join(dir, 'state', 'jobs.json') });
  return { dir, files, id, runner };
}

test('a stop keeps the lock until a grandchild that ignores SIGTERM has exited', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const { files, id, runner } = fixture(t, { stay: true, grandMs: 1500 });
  runner.start(id);
  await waitFor(() => fs.existsSync(files.ready));
  const child = runner.active.get(id).child;
  const stopped = runner.stopAll();
  await waitFor(() => child.exitCode !== null || child.signalCode !== null);
  assert.ok(runner.locks.has(GENERATED), 'the lock is still held while the group lives');
  assert.equal(fs.existsSync(files.grandDone), false);
  await stopped;
  assert.ok(fs.existsSync(files.grandDone), 'the grandchild exited before stopAll resolved');
  assert.equal(runner.locks.has(GENERATED), false, 'the lock is released after the group is empty');
  assert.equal(runner.active.has(id), false);
});

test('a step that exits on its own holds the lock until its leftover group is gone', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const { files, id, runner } = fixture(t, { stay: false, grandMs: 1500 });
  runner.start(id);
  await waitFor(() => fs.existsSync(files.ready));
  await waitFor(() => !runner.active.has(id));
  assert.ok(fs.existsSync(files.grandDone), 'the grandchild finished before the slot was freed');
  assert.equal(runner.locks.has(GENERATED), false);
});

test('a grandchild that never exits is SIGKILLed by stopAll, which then resolves', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const { files, id, runner } = fixture(t, { stay: true, grandMs: 60000 });
  runner.start(id);
  await waitFor(() => fs.existsSync(files.ready));
  const stepPid = Number(fs.readFileSync(files.stepPid, 'utf8'));
  await runner.stopAll({ graceMs: 300 });
  assert.equal(groupAlive(stepPid), false, 'nothing is left in the process group');
  assert.equal(runner.locks.has(GENERATED), false);
  assert.equal(runner.active.has(id), false);
});
