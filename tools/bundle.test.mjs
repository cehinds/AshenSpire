#!/usr/bin/env node
// tools/bundle.test.mjs — the parse gate's own fixtures (#77 property 4).
//
// The defect these pin was reproduced live on dev (Bjorn, at 8993d60): one
// dropped brace in a content file produced `bundle.mjs: OK`, exit 0,
// `verify-shipped: OK — 4 checks passed`, and a game whose #app had ZERO
// children. Law 1 clause 5 had already named that failure in its own words and
// nothing enforced it.
//
// Each case runs the REAL bundler against a REAL temporary checkout, because a
// gate tested against a mock is a gate tested against my idea of the bundler.
//
// Run:  node tools/bundle.test.mjs
// Exit 0 = every case behaved. Exit 1 = at least one did not, and it says which.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// A disposable copy of the repo's source, so a fixture can break a file without
// touching the working tree.
function sandbox() {
  const dir = mkdtempSync(resolve(tmpdir(), 'ashen-bundle-'));
  for (const d of ['src', 'styles', 'tools', 'assets', 'content']) {
    if (existsSync(resolve(ROOT, d))) cpSync(resolve(ROOT, d), resolve(dir, d), { recursive: true });
  }
  for (const f of ['index.html']) {
    if (existsSync(resolve(ROOT, f))) cpSync(resolve(ROOT, f), resolve(dir, f));
  }
  return dir;
}

function build(dir) {
  const r = spawnSync(process.execPath, [resolve(dir, 'tools/bundle.mjs')], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// ---- 1. The control: an untouched tree still builds -------------------------
{
  const dir = sandbox();
  const r = build(dir);
  check('control: an unmodified tree builds and exits 0', r.status === 0, `exit ${r.status}: ${r.out.slice(-200)}`);
  const outPath = resolve(dir, 'build/AshenSpire.html');
  check('control: it wrote a real bundle, not a stub',
    existsSync(outPath) && readFileSync(outPath, 'utf8').length > 500000);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 2. Bjorn's defect: a dropped brace in a content file -------------------
// Planted in two different files, because the original report was reproduced in
// both statuses.js and balance.js and the gate must not be keyed to one.
for (const target of ['src/content/statuses.js', 'src/content/balance.js']) {
  const dir = sandbox();
  const p = resolve(dir, target);
  const src = readFileSync(p, 'utf8');
  const at = src.indexOf('\n  },');
  if (at < 0) { check(`${target}: fixture could plant a brace`, false, 'no "  }," to remove'); rmSync(dir, { recursive: true, force: true }); continue; }
  const broken = src.slice(0, at) + '\n  ,' + src.slice(at + 5);
  const expectLine = broken.slice(0, at).split('\n').length + 1;
  writeFileSync(p, broken, 'utf8');

  const r = build(dir);
  check(`${target}: a dropped brace FAILS the build`, r.status === 1, `exit ${r.status}`);
  check(`${target}: the failure NAMES the file`, r.out.includes(target), r.out.slice(0, 200));
  check(`${target}: the failure names a line, and it is the right one`,
    new RegExp(`${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:${expectLine}\\b`).test(r.out),
    `expected ${target}:${expectLine}, got: ${(/[\w/.]+\.js:\d+/.exec(r.out) || ['none'])[0]}`);

  // PROPERTY 3: the refused write must not leave a stale bundle in place.
  const outPath = resolve(dir, 'build/AshenSpire.html');
  const after = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  check(`${target}: the output is a build-failed page, not a stale game`,
    after.includes('This build did not happen') && !after.includes('id="app"'),
    after ? after.slice(0, 80) : '(no output file)');
  // Scoped to the failed page on purpose: a STALE game bundle also contains
  // this path (module ids are baked into it), so an unscoped `includes` passed
  // at the base ref where the defect was live — a check that can pass for the
  // wrong reason is not a check.
  check(`${target}: the build-failed page itself names the file`,
    after.includes('This build did not happen') && after.includes(target));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 3. Vira's edge: ugly is not broken ------------------------------------
// The gate must red for a PARSE failure and stay green for a bundle that is
// merely unpleasant — otherwise it becomes a style opinion nobody asked for.
{
  const dir = sandbox();
  const p = resolve(dir, 'src/content/statuses.js');
  const src = readFileSync(p, 'utf8');
  // Legal, hideous, and semantically identical: no blank lines, doubled
  // semicolons, an unused binding, deep nesting in a dead branch.
  const ugly = src
    .replace(/\n\n+/g, '\n')
    .replace(/;\n/g, ';;\n')
    + '\nconst __unused = ((((1))));\nif (false) { if (false) { if (false) { /* nothing */ } } }\n';
  writeFileSync(p, ugly, 'utf8');
  const r = build(dir);
  check('ugly-but-valid source still builds (the gate is not a style check)',
    r.status === 0, `exit ${r.status}: ${r.out.slice(-200)}`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 4. A multi-line import must not shift the reported line ---------------
// rewriteImport collapses a multi-line import to one line; without padding,
// every line below it shifts and the reported number points at the wrong place.
// A check that names the WRONG line is worse than one that names none.
{
  const dir = sandbox();
  const p = resolve(dir, 'src/content/statuses.js');
  let src = readFileSync(p, 'utf8');
  src = `import {\n  balance,\n} from './balance.js';\n` + src;
  const at = src.indexOf('\n  },');
  const broken = src.slice(0, at) + '\n  ,' + src.slice(at + 5);
  const expectLine = broken.slice(0, at).split('\n').length + 1;
  writeFileSync(p, broken, 'utf8');
  const r = build(dir);
  check('a 3-line import above the fault does not shift the reported line',
    new RegExp(`statuses\\.js:${expectLine}\\b`).test(r.out),
    `expected statuses.js:${expectLine}, got: ${(/statuses\.js:\d+/.exec(r.out) || ['none'])[0]}`);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${fails} failing case(s).`);
console.log('BOUNDARY: this proves the bundler REFUSES and names the fault. It does not');
console.log('prove the game is correct — only that a build which cannot parse never ships,');
console.log('and never leaves a previous build standing where the new one should be.');
process.exit(fails ? 1 : 0);
