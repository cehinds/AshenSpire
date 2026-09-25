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

const finishPath = join(root, 'docs', 'FINISH.md');

// Every release criterion in docs/FINISH.md §1–§13: a `- [ ]`, `- [~]` or
// `- [x]` line under a numbered section. `text` drops the checkbox and the
// bold marks, so a criterion is named by the words it starts with.
function criteria(md) {
  const out = [];
  let sec = null;
  md.split(/\r?\n/).forEach((l, i) => {
    const h = /^## (\d+)\. /.exec(l);
    if (h) { sec = Number(h[1]); return; }
    if (/^## /.test(l)) { sec = null; return; }
    const c = /^- \[([ x~])\] (.*)$/.exec(l);
    if (sec && c) out.push({ line: i + 1, sec, mark: c[1], text: c[2].replace(/\*\*/g, '') });
  });
  return out;
}

// The *Criterion map* table: | §N | criterion | G<n> or "waived: reason" |.
function criterionMap(md) {
  const at = md.indexOf('## Criterion map');
  assert.ok(at >= 0, 'no "## Criterion map" section');
  const body = md.slice(at).split(/\n## /)[0];
  const out = [];
  for (const l of body.split(/\r?\n/)) {
    const m = /^\|\s*§(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(l);
    if (m) out.push({ sec: Number(m[1]), key: m[2], target: m[3], row: l });
  }
  return out;
}

// Gate ids the checklist defines: its table rows, plus G13, which is prose.
function gateIds(md) {
  const ids = new Set(rows(md).keys());
  for (const m of md.matchAll(/^Gate (G\d+) /gm)) ids.add(m[1]);
  return ids;
}

test('FINISH.md still has release criteria to map (the parser is not reading nothing)', () => {
  const cs = criteria(readFileSync(finishPath, 'utf8'));
  assert.ok(cs.length >= 20, `only ${cs.length} FINISH.md criteria parsed`);
  assert.deepEqual([...new Set(cs.map((c) => c.sec))], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
});

test('every FINISH.md release criterion maps to a gate row or a waiver, and every map row to a live criterion', () => {
  const md = readFileSync(docPath, 'utf8');
  const cs = criteria(readFileSync(finishPath, 'utf8'));
  const map = criterionMap(md);
  const ids = gateIds(md);
  for (const c of cs) {
    const hits = map.filter((m) => c.text.startsWith(m.key));
    assert.ok(hits.length > 0,
      `FINISH.md line ${c.line} (§${c.sec}) has no gate row or waiver in the *Criterion map*: ${c.text.slice(0, 90)}`);
    assert.equal(hits.length, 1,
      `FINISH.md line ${c.line} is claimed by ${hits.length} map rows: ${hits.map((h) => h.key).join(' / ')}`);
    assert.equal(hits[0].sec, c.sec, `map row "${hits[0].key}" says §${hits[0].sec}, FINISH.md line ${c.line} is in §${c.sec}`);
  }
  for (const m of map) {
    assert.ok(cs.some((c) => c.text.startsWith(m.key)),
      `the *Criterion map* cites "${m.key}" (§${m.sec}), which no FINISH.md criterion starts with any more`);
    if (/^waived:/i.test(m.target)) {
      assert.ok(m.target.replace(/^waived:/i, '').trim().length >= 20, `waiver for "${m.key}" gives no reason`);
    } else {
      assert.match(m.target, /^G\d+$/, `map row "${m.key}" names neither a gate nor a waiver: ${m.target}`);
      assert.ok(ids.has(m.target), `map row "${m.key}" points at ${m.target}, which the checklist does not define`);
    }
  }
});

test('a release-criterion gate (G14 up) with an open criterion is marked RED', () => {
  const md = readFileSync(docPath, 'utf8');
  const rs = rows(md);
  const cs = criteria(readFileSync(finishPath, 'utf8'));
  const map = criterionMap(md);
  for (const [id, line] of rs) {
    if (Number(id.slice(1)) < 14) continue;
    const mine = map.filter((m) => m.target === id);
    assert.ok(mine.length > 0, `${id} gates no FINISH.md criterion in the *Criterion map*`);
    const open = cs.filter((c) => c.mark !== 'x' && mine.some((m) => c.text.startsWith(m.key)));
    if (open.length) {
      assert.match(line, /\*\*RED\b/,
        `${id} is not marked RED, but its criterion is still open: FINISH.md line ${open[0].line}`);
    }
    const cmd = line.split('|')[2].trim();
    if (!cmd.startsWith('`node ') && id !== 'G20') {
      assert.match(line, /\*\*RED: not yet runnable\.\*\*/, `${id} has no command but is not marked RED: not yet runnable`);
    }
  }
  // Pinned by the owner (#1300 review), whatever FINISH.md's ticks say.
  const runNode = readFileSync(join(root, 'tests', 'run-node.mjs'), 'utf8');
  if (!runNode.includes('runsim.mjs')) {
    assert.match(rs.get('G14'), /\*\*RED\b/, 'tests/run-node.mjs does not run runsim.mjs, so G14 must be RED');
  }
  assert.match(rs.get('G16'), /\*\*RED: no verdict yet\.\*\*/, 'G16 must stay RED until a tool gates the band');
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
