// docs/RELEASE-CHECKLIST.md is the written release gate (docs/FINISH.md §13).
// This keeps it honest: it must list at least five runnable gate commands,
// every script a gate names must exist in this repository, and the owner
// sign-off (agents never tag or publish) must stay in the file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const docPath = join(root, 'docs', 'RELEASE-CHECKLIST.md');

// A gate is a Markdown table row whose second cell is a backticked `node …`
// command: | G<n> | `node tools/x.mjs --check` | expected result | … |
function gates(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*G(\d+)\s*\|\s*`(node [^`]+)`/.exec(line);
    if (m) out.push({ id: `G${m[1]}`, cmd: m[2], line });
  }
  return out;
}

// Every repo-relative script a command runs (tools/…, tests/…).
function scripts(cmd) {
  return [...cmd.matchAll(/(?:^|\s)((?:tools|tests)\/[\w./-]+\.(?:mjs|js|cjs))/g)].map((m) => m[1]);
}

test('docs/RELEASE-CHECKLIST.md exists', () => {
  assert.ok(existsSync(docPath), 'docs/RELEASE-CHECKLIST.md is missing');
});

test('the release checklist lists at least 5 runnable gates whose scripts exist', () => {
  const md = readFileSync(docPath, 'utf8');
  const gs = gates(md);
  const distinct = new Set(gs.map((g) => g.cmd));
  assert.ok(distinct.size >= 5, `expected >= 5 distinct gate commands, found ${distinct.size}`);
  const ids = gs.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate gate ids: ${ids.join(', ')}`);
  for (const g of gs) {
    const ss = scripts(g.cmd);
    assert.ok(ss.length > 0, `${g.id} names no tools/ or tests/ script: ${g.cmd}`);
    for (const s of ss) assert.ok(existsSync(join(root, s)), `${g.id} runs ${s}, which does not exist`);
    const cells = g.line.split('|').map((c) => c.trim()).filter(Boolean);
    assert.ok(cells.length >= 3 && cells[2].length > 0, `${g.id} has no expected result`);
  }
});

test('the release checklist keeps the owner sign-off and the agent boundary', () => {
  const md = readFileSync(docPath, 'utf8');
  assert.match(md, /^## Owner sign-off/m, 'no "## Owner sign-off" section');
  assert.match(md, /agents never (?:cut|tag|publish)/i, 'the agent boundary sentence is missing');
});
