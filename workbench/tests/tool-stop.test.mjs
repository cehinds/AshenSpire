// node --test workbench/tests/tool-stop.test.mjs — stopping a child tool: a tool that shuts down
// cleanly within its own grace is not SIGKILLed; one that does not is, with its whole tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Tool, TOOL_STOP_MS } from '../core/tools.mjs';
import { STOP_GRACE_MS, KILL_WAIT_MS, processAlive } from '../../tools/lib/process-tree.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toolWithChild(child) {
  const def = { id: 'fake', name: 'Fake', blurb: '', host: '127.0.0.1', path: '/', health: '/', port: 1, command: () => [] };
  const tool = new Tool(def, { root: process.cwd(), origin: 'http://localhost' });
  tool.child = child;
  return tool;
}

// A exits by itself 4 s after SIGTERM, so a SIGKILL before that would be a bug.
const SLOW_EXIT = `process.on('SIGTERM', () => setTimeout(() => process.exit(0), 4000)); setInterval(() => {}, 1000);`;

test('the wrapper does not SIGKILL a tool that exits cleanly 4 s after SIGTERM', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX signals');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-tool-stop-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const readyFile = path.join(dir, 'ready');
  // The ready file is written only after the SIGTERM handler is installed; before that SIGTERM would kill it outright.
  const child = spawn(process.execPath, ['-e', `${SLOW_EXIT} require('node:fs').writeFileSync(${JSON.stringify(readyFile)}, 'ready');`], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 200; i++) {
    if (fs.existsSync(readyFile)) break;
    await delay(20);
  }
  assert.ok(fs.existsSync(readyFile), 'the tool is ready');
  const tool = toolWithChild(child);
  const started = Date.now();
  await tool.stop();
  assert.equal(child.exitCode, 0, 'it exited by itself, with status 0');
  assert.equal(child.signalCode, null, 'it was not killed by a signal');
  assert.ok(Date.now() - started >= 3800, 'the stop waited for the tool to finish its shutdown');
  assert.equal(tool.child, null);
});

test('the stop deadline leaves room for the Editor shutdown: grace, kill wait and a margin', () => {
  assert.ok(TOOL_STOP_MS >= STOP_GRACE_MS + KILL_WAIT_MS + 1000, `deadline ${TOOL_STOP_MS} ms`);
});

test('past the deadline the wrapper SIGKILLs the whole tree and waits for it', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-tool-stop-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pidFile = path.join(dir, 'grandchild.pid');
  // The tool and its grandchild ignore SIGTERM, so only the deadline's SIGKILL can end them.
  const grandchild = `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`;
  const tool = `process.on('SIGTERM', () => {}); require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ['-e', tool], { stdio: 'ignore', detached: true });
  const toolInstance = toolWithChild(child);
  let grandchildPid = null;
  for (let i = 0; i < 200 && grandchildPid === null; i++) {
    try { grandchildPid = Number(fs.readFileSync(pidFile, 'utf8')); } catch { await delay(20); }
  }
  assert.ok(grandchildPid, 'the tool started');
  await toolInstance.stop({ deadlineMs: 300 });
  assert.equal(child.signalCode, 'SIGKILL', 'the tool was SIGKILLed past the deadline');
  // The grandchild is gone, or an unreaped zombie that can no longer run.
  let state = 'gone';
  try { state = /\) Z /.test(fs.readFileSync(`/proc/${grandchildPid}/stat`, 'utf8')) ? 'zombie' : 'running'; } catch { state = 'gone'; }
  assert.notEqual(state, 'running', 'the grandchild was killed with the tree');
});

test('on win32 stop asks the tree to close with taskkill /T, and escalates to /T /F past the deadline', async (t) => {
  // A fake taskkill: the first call (no /F) does not end the process, so the escalation has to.
  const child = spawn(process.execPath, ['-e', `setInterval(() => {}, 1000);`], { stdio: 'ignore' });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const calls = [];
  const run = (cmd, args) => { calls.push({ cmd, args }); if (args.includes('/F')) child.kill('SIGKILL'); return { status: 0 }; };
  const tool = toolWithChild(child);
  await tool.stop({ deadlineMs: 200, platform: 'win32', run });
  const pid = String(child.pid);
  assert.deepEqual(calls, [
    { cmd: 'taskkill', args: ['/pid', pid, '/T'] },
    { cmd: 'taskkill', args: ['/pid', pid, '/T', '/F'] },
  ]);
  assert.equal(child.signalCode, 'SIGKILL', 'the escalation ended the process');
  assert.equal(tool.child, null);
});

test('stop waits for a descendant that outlives a leader which exits on the first SIGTERM', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-tool-stop-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'out');
  const readyFile = path.join(dir, 'ready');
  const pidFile = path.join(dir, 'grandchild.pid');
  const grandReady = path.join(dir, 'grandchild.ready');
  // The grandchild ignores SIGTERM and writes to `out` from 700 ms on, every 200 ms.
  const grandchild = `const fs = require('node:fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(${JSON.stringify(grandReady)}, 'ready'); setTimeout(() => { fs.appendFileSync(${JSON.stringify(out)}, 'w'); setInterval(() => fs.appendFileSync(${JSON.stringify(out)}, 'w'), 200); }, 700); setInterval(() => {}, 1000);`;
  // The leader exits 0 at once on SIGTERM and leaves the grandchild running in its group.
  const leader = `const fs = require('node:fs'); const cp = require('node:child_process'); process.on('SIGTERM', () => process.exit(0)); const g = cp.spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); fs.writeFileSync(${JSON.stringify(pidFile)}, String(g.pid)); fs.writeFileSync(${JSON.stringify(readyFile)}, 'ready'); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ['-e', leader], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 200 && !fs.existsSync(readyFile); i++) await delay(20);
  for (let i = 0; i < 200 && !fs.existsSync(grandReady); i++) await delay(20);
  assert.ok(fs.existsSync(grandReady), 'the grandchild is ready, with its SIGTERM handler installed');
  const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
  const tool = toolWithChild(child);
  const started = Date.now();
  await tool.stop({ deadlineMs: 1500 });
  assert.ok(Date.now() - started >= 1400, 'stop did not resolve before the group was killed at the deadline');
  assert.equal(processAlive(grandchildPid), false, 'the grandchild is dead when stop resolves');
  const atResolve = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').length : 0;
  await delay(700);
  const later = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').length : 0;
  assert.equal(later, atResolve, 'no write lands after stop resolves');
});
