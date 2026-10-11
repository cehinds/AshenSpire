// node --test workbench/tests/tool-stop.test.mjs — stopping a child tool: a tool that shuts down
// cleanly within its own grace is not SIGKILLed; one that does not is, with its whole tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Tool, TOOL_STOP_MS } from '../core/tools.mjs';
import { STOP_GRACE_MS, KILL_WAIT_MS } from '../../tools/lib/process-tree.mjs';

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
