// docs/RELEASE-CHECKLIST.md is the written release gate (docs/FINISH.md §13).
// This keeps it honest: it must list at least five runnable gate commands,
// every script a gate names must exist in this repository, every --flag a
// gate passes must appear in that script's source, and the owner
// sign-off (agents never tag or publish) must stay in the file, outside
// the tested commit. The FINISH.md release criteria that have no gate command
// yet (G14–G17) must each keep a row, and one whose tool does not exist yet
// must stay marked RED.

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

// Each `--flag` a command passes, paired with the script it follows, so a
// typo such as `--gat` is caught. The bare `--` separator is not a flag.
function flags(cmd) {
  const out = [];
  let script = null;
  for (const tok of cmd.split(/\s+/)) {
    if (/^(?:tools|tests)\/[\w./-]+\.(?:mjs|js|cjs)$/.test(tok)) script = tok;
    else if (script && /^--[\w-]+$/.test(tok)) out.push({ script, flag: tok.split('=')[0] });
  }
  return out;
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
    for (const { script, flag } of flags(g.cmd)) {
      const src = readFileSync(join(root, script), 'utf8');
      assert.ok(src.includes(flag), `${g.id} passes ${flag} to ${script}, which never mentions it`);
    }
    const cells = g.line.split('|').map((c) => c.trim()).filter(Boolean);
    assert.ok(cells.length >= 3 && cells[2].length > 0, `${g.id} has no expected result`);
  }
});

test('the release checklist keeps the owner sign-off and the agent boundary', () => {
  const md = readFileSync(docPath, 'utf8');
  assert.match(md, /^## Owner sign-off/m, 'no "## Owner sign-off" section');
  assert.match(md, /agents never (?:cut|tag|publish)/i, 'the agent boundary sentence is missing');
});

// Every table row G<n>, whatever its command cell holds.
function rows(md) {
  const out = new Map();
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*(G\d+)\s*\|/.exec(line);
    if (m) out.set(m[1], line);
  }
  return out;
}

test('the release checklist gates every FINISH.md release criterion (G14–G17)', () => {
  const md = readFileSync(docPath, 'utf8');
  const rs = rows(md);
  const cites = {
    G14: /FINISH\.md §3, line 46/, // headless fixed-seed full runs
    G15: /FINISH\.md §3, line 47/, // browser full run to Victory or Death
    G16: /FINISH\.md §4, line 53/, // balance target band, spread <= 20
    G17: /FINISH\.md §4, line 54/, // Mana-aware A/B run
  };
  for (const [id, re] of Object.entries(cites)) {
    const line = rs.get(id);
    assert.ok(line, `${id} row is missing`);
    assert.match(line, re, `${id} does not cite its FINISH.md criterion`);
    const cmd = line.split('|')[2].trim();
    if (!cmd.startsWith('`node ')) assert.match(line, /\*\*RED: not yet runnable\.\*\*/, `${id} has no command but is not marked RED: not yet runnable`);
  }
  // G16 has a command, but it exits 0 whatever the win rates are.
  assert.match(rs.get('G16'), /\*\*RED: no verdict yet\.\*\*/, 'G16 must stay RED until a tool gates the band');
  // G17 stays not-runnable until runsim.mjs grows the flag it needs.
  const runsim = readFileSync(join(root, 'tools', 'runsim.mjs'), 'utf8');
  if (!runsim.includes('--mana-ab')) {
    assert.match(rs.get('G17'), /\*\*RED: not yet runnable\.\*\*/, 'runsim.mjs has no --mana-ab, so G17 must be RED');
    assert.doesNotMatch(rs.get('G17').split('|')[2], /`node /, 'G17 names a command that does not run yet');
  }
});

test('the release checklist never asks for a sign-off inside the file', () => {
  const md = readFileSync(docPath, 'utf8');
  assert.doesNotMatch(md, /bottom of this file/i, 'the opening still points the sign-off into this file');
  assert.match(md, /sign(?:s|ed)? off outside\s+this file/i, 'the opening must say the sign-off is recorded outside this file');
});
