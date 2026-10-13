// node --test workbench/tests/tool-group.test.mjs — a child tool the Workbench starts leads its own
// process group on POSIX, so stopping it can reach the tool's descendants.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Tool } from '../core/tools.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('a tool the Workbench spawns is the leader of its own process group on POSIX', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  if (!fs.existsSync('/proc/self/stat')) return t.skip('reads the group from /proc');
  // A port nothing listens on: the tool never answers, so it stays "starting" and runs until stopped.
  const def = { id: 'fake', name: 'Fake', blurb: '', host: '127.0.0.1', path: '/', health: '/', port: 1, command: () => ['-e', 'setInterval(() => {}, 1000)'] };
  const tool = new Tool(def, { root: process.cwd(), origin: 'http://localhost' });
  t.after(() => tool.stop());
  tool.port = 1;
  tool.spawn(1000);
  const pid = tool.child.pid;
  // /proc/<pid>/stat: "pid (comm) state ppid pgrp ..."; comm may hold spaces, so split after the last ')'.
  let pgrp = null;
  for (let i = 0; i < 100 && pgrp === null; i++) {
    try { const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); pgrp = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2]); } catch { await delay(20); }
  }
  assert.equal(pgrp, pid, 'the tool is its own group leader');
});
