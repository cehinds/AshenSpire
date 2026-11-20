// tests/tools-readme.test.mjs — tools/README.md names every tracked tool, and only tracked ones.
//
// The index is written by hand (no generator), so it rotted: the 2026-11-06 code review
// found 16 .mjs and 21 of 25 .py tools missing. This gate reads `git ls-files` and checks
// both directions:
//   - every tracked top-level tools/<name>.{mjs,cjs,py,sh,ps1,bat} is a backticked name in
//     the first column of a table row of the main section;
//   - every tracked tools/attic/<name> tool is named in a row of the Attic section;
//   - every tracked top-level tools/<dir>/ has a `<dir>/` row (tools/attic/ has its section);
//   - every backticked name in a first column exists, tracked, where its section says.
// A row may name several tools: "| `a.mjs`, `b.mjs` | ... |".

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const TOOL_EXT = /\.(mjs|cjs|py|sh|ps1|bat)$/;

// Parse a tools/README.md into the names its table first columns hold.
// Rows under a heading containing "Attic" go to `attic`; all other rows to `main`.
export function parseReadme(text) {
  const main = new Set();
  const attic = new Set();
  let inAttic = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) { inAttic = /attic/i.test(line); continue; }
    if (!line.startsWith('|')) continue;
    const cell = line.split('|')[1] ?? '';
    for (const m of cell.matchAll(/`([^`]+)`/g)) (inAttic ? attic : main).add(m[1]);
  }
  return { main, attic };
}

// Compare the parsed README with tracked paths; returns a list of problem strings.
export function checkReadme(readmeText, files) {
  const { main, attic } = parseReadme(readmeText);
  const tracked = new Set(files);
  const problems = [];
  const top = new Set(); // tracked top-level tool files
  const dirs = new Set(); // tracked top-level subfolders other than attic
  const atticTools = new Set();
  for (const f of files) {
    if (!f.startsWith('tools/')) continue;
    const parts = f.slice('tools/'.length).split('/');
    if (parts.length === 1) { if (TOOL_EXT.test(parts[0])) top.add(parts[0]); }
    else if (parts[0] === 'attic') { if (parts.length === 2 && TOOL_EXT.test(parts[1])) atticTools.add(parts[1]); }
    else dirs.add(parts[0] + '/');
  }
  for (const n of [...top].sort()) if (!main.has(n)) problems.push(`tools/${n} is tracked but has no row in tools/README.md`);
  for (const d of [...dirs].sort()) if (!main.has(d)) problems.push(`tools/${d} is a tracked folder but has no row in tools/README.md`);
  for (const n of [...atticTools].sort()) if (!attic.has(n)) problems.push(`tools/attic/${n} is tracked but not in the README Attic section`);
  for (const n of [...main].sort()) {
    const found = n.endsWith('/') ? files.some((f) => f.startsWith(`tools/${n}`)) : tracked.has(`tools/${n}`);
    if (!found) problems.push(`README row names \`${n}\`, which is not tracked under tools/`);
  }
  for (const n of [...attic].sort()) if (!tracked.has(`tools/attic/${n}`)) problems.push(`README Attic row names \`${n}\`, which is not tracked under tools/attic/`);
  return problems;
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z', '--', 'tools'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0').filter(Boolean);
  } catch { return null; }
}

test('parseReadme: multi-name rows, attic section, first column only', () => {
  const md = [
    '# tools/',
    '## Tools', '| Tool | What |', '| --- | --- |',
    '| `a.mjs`, `b.mjs` | (no header) mentions `c.mjs` |',
    '| `lib/` (7 files) | x |',
    '## Attic (1 file)', '| Tool | First |', '| `old.mjs` | y |',
  ].join('\n');
  const { main, attic } = parseReadme(md);
  assert.deepEqual([...main].sort(), ['a.mjs', 'b.mjs', 'lib/']);
  assert.deepEqual([...attic], ['old.mjs']);
});

test('checkReadme: reports missing, stale and attic entries', () => {
  const md = '## Tools\n| `a.mjs` | x |\n| `gone.py` | x |\n| `d/` | x |\n## Attic\n| `o.mjs` | x |\n';
  const files = ['tools/a.mjs', 'tools/b.py', 'tools/README.md', 'tools/d/x.txt', 'tools/e/y.txt', 'tools/attic/o.mjs', 'tools/attic/p.mjs'];
  assert.deepEqual(checkReadme(md, files), [
    'tools/b.py is tracked but has no row in tools/README.md',
    'tools/e/ is a tracked folder but has no row in tools/README.md',
    'tools/attic/p.mjs is tracked but not in the README Attic section',
    'README row names `gone.py`, which is not tracked under tools/',
  ]);
  const ok = '## T\n| `a.mjs` | x |\n| `d/` | x |\n## Attic\n| `o.mjs` | x |';
  assert.deepEqual(checkReadme(ok, ['tools/a.mjs', 'tools/d/q', 'tools/attic/o.mjs']), []);
});

test('tools/README.md lists every tracked tool and no stale name', (t) => {
  const files = trackedFiles();
  if (!files || !files.length) return t.skip('git or tracked tools/ not available');
  const problems = checkReadme(readFileSync(new URL('../tools/README.md', import.meta.url), 'utf8'), files);
  assert.deepEqual(problems, [], `tools/README.md is out of date:\n${problems.join('\n')}`);
});
