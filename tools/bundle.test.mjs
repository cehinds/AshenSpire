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
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import vm from 'node:vm';

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
  // buildordinal.json became authored build input after this sandbox was first
  // written. Omitting it makes every real-bundler fixture refuse before it can
  // reach the property the fixture is meant to exercise.
  for (const f of ['index.html', 'buildordinal.json']) {
    if (existsSync(resolve(ROOT, f))) cpSync(resolve(ROOT, f), resolve(dir, f));
  }
  // Source-changing plants must pass through the production ordinal door, and
  // production correctly refuses to invent an ordinal without Git. Give each
  // disposable real-tree sandbox one deterministic commit so a plant can move
  // the digest and let bumpOrdinal derive its next value. This is test history,
  // not a production fallback: remove Git here and the refusal remains red.
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'bundle-selftest@family.local'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'bundle-selftest'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'bundle selftest control'], { cwd: dir });
  return dir;
}

function build(dir) {
  const r = spawnSync(process.execPath, [resolve(dir, 'tools/bundle.mjs')], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function assetMapPayload(bundleBytes, rel, mime) {
  const text = bundleBytes.toString('utf8');
  const prefix = `${JSON.stringify(rel)}: "data:${mime};base64,`;
  const start = text.indexOf(prefix);
  if (start < 0) return null;
  const payloadStart = start + prefix.length;
  const end = text.indexOf('"', payloadStart);
  return end < 0 ? null : Buffer.from(text.slice(payloadStart, end), 'base64');
}

function cssPayload(bundleBytes, selector, mime) {
  const text = bundleBytes.toString('utf8');
  const line = text.split('\n').find((s) => s.includes(selector) && s.includes(`data:${mime};base64,`));
  if (!line) return null;
  const match = new RegExp(`data:${mime.replace('/', '\\/')};base64,([^"')]+)`).exec(line);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function forceEol(dir, relPaths, eol) {
  for (const rel of relPaths) {
    const p = resolve(dir, rel);
    const lf = readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
    writeFileSync(p, eol === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf, 'utf8');
  }
}

function forceTreeEol(dir, eol) {
  const textExts = new Set(['.js', '.css', '.html', '.svg']);
  const paths = [];
  const walk = (rel) => {
    const abs = resolve(dir, rel);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (textExts.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) paths.push(child);
    }
  };
  for (const rel of ['src', 'styles', 'assets']) walk(rel);
  paths.push('index.html');
  forceEol(dir, paths, eol);
}

function runEolSelftest() {
  const lfDir = sandbox();
  const crlfDir = sandbox();
  forceTreeEol(lfDir, 'lf');
  forceTreeEol(crlfDir, 'crlf');
  const lfRun = build(lfDir);
  const crlfRun = build(crlfDir);
  const lfOut = lfRun.status === 0 ? readFileSync(resolve(lfDir, 'build/AshenSpire.html')) : null;
  const crlfOut = crlfRun.status === 0 ? readFileSync(resolve(crlfDir, 'build/AshenSpire.html')) : null;
  check('text-asset EOL: LF and CRLF sandboxes both build',
    lfRun.status === 0 && crlfRun.status === 0,
    `LF exit ${lfRun.status}; CRLF exit ${crlfRun.status}`);
  check('text-asset EOL: LF and CRLF builds are byte-identical',
    !!lfOut && !!crlfOut && lfOut.equals(crlfOut),
    `LF ${lfOut?.length ?? 0} bytes; CRLF ${crlfOut?.length ?? 0} bytes`);

  const binaryRel = 'assets/bg/bg_act1.webp';
  const lfBinary = readFileSync(resolve(lfDir, binaryRel));
  const crlfBinary = readFileSync(resolve(crlfDir, binaryRel));
  const binaryMapExact = !!lfOut && !!crlfOut && [
    assetMapPayload(lfOut, binaryRel, 'image/webp'),
    assetMapPayload(crlfOut, binaryRel, 'image/webp'),
  ].every((payload) => payload?.equals(lfBinary)) && lfBinary.equals(crlfBinary);
  const binaryCssExact = !!lfOut && !!crlfOut && [
    cssPayload(lfOut, '.backdrop.act-1', 'image/webp'),
    cssPayload(crlfOut, '.backdrop.act-1', 'image/webp'),
  ].every((payload) => payload?.equals(lfBinary));
  check('binary preservation: asset-map payload equals source bytes in LF and CRLF builds', binaryMapExact);
  check('binary preservation: CSS url payload equals source bytes in LF and CRLF builds', binaryCssExact);

  const plantedDir = sandbox();
  forceTreeEol(plantedDir, 'crlf');
  const planted = patchTool(plantedDir,
    '    const buf = readAssetBytes(abs);',
    '    const buf = readFileSync(abs);');
  const plantedRun = build(plantedDir);
  const plantedOut = plantedRun.status === 0
    ? readFileSync(resolve(plantedDir, 'build/AshenSpire.html'))
    : null;
  check('text-asset EOL known-bad: raw-byte asset-map read was planted', planted);
  check('text-asset EOL known-bad: raw CRLF payload is caught by output identity',
    plantedRun.status === 0 && !!lfOut && !!plantedOut && !lfOut.equals(plantedOut),
    `plant exit ${plantedRun.status}; canonical ${lfOut?.length ?? 0}; planted ${plantedOut?.length ?? 0}`);

  const cssPlantedDir = sandbox();
  forceTreeEol(cssPlantedDir, 'crlf');
  const cssPlanted = patchTool(cssPlantedDir,
    "  const css = inlineCssUrls(readText(cssAbs), cssAbs);",
    "  const css = inlineCssUrls(readFileSync(cssAbs, 'utf8'), cssAbs);");
  const cssPlantedRun = build(cssPlantedDir);
  const cssPlantedOut = cssPlantedRun.status === 0
    ? readFileSync(resolve(cssPlantedDir, 'build/AshenSpire.html'))
    : null;
  check('text-source EOL known-bad: raw CSS read was planted', cssPlanted);
  check('text-source EOL known-bad: raw CRLF CSS is caught by output identity',
    cssPlantedRun.status === 0 && !!lfOut && !!cssPlantedOut && !lfOut.equals(cssPlantedOut),
    `plant exit ${cssPlantedRun.status}; canonical ${lfOut?.length ?? 0}; planted ${cssPlantedOut?.length ?? 0}`);

  const binaryPlantedDir = sandbox();
  const binaryPlanted = patchTool(binaryPlantedDir,
    "const TEXT_ASSET_EXTS = new Set(['.svg']);",
    "const TEXT_ASSET_EXTS = new Set(['.svg', '.webp']);");
  const binaryPlantedRun = build(binaryPlantedDir);
  const binaryPlantedOut = binaryPlantedRun.status === 0
    ? readFileSync(resolve(binaryPlantedDir, 'build/AshenSpire.html'))
    : null;
  const binarySource = readFileSync(resolve(binaryPlantedDir, binaryRel));
  const badMap = binaryPlantedOut && assetMapPayload(binaryPlantedOut, binaryRel, 'image/webp');
  const badCss = binaryPlantedOut && cssPayload(binaryPlantedOut, '.backdrop.act-1', 'image/webp');
  check('binary preservation known-bad: a binary extension was planted as text', binaryPlanted);
  check('binary preservation known-bad: both shared embedding paths catch corrupted binary bytes',
    binaryPlantedRun.status === 0
      && !!badMap && !badMap.equals(binarySource)
      && !!badCss && !badCss.equals(binarySource),
    `plant exit ${binaryPlantedRun.status}; source ${binarySource.length}; map ${badMap?.length ?? 0}; CSS ${badCss?.length ?? 0}`);

  rmSync(lfDir, { recursive: true, force: true });
  rmSync(crlfDir, { recursive: true, force: true });
  rmSync(plantedDir, { recursive: true, force: true });
  rmSync(cssPlantedDir, { recursive: true, force: true });
  rmSync(binaryPlantedDir, { recursive: true, force: true });
}

if (process.argv.includes('--eol-selftest')) {
  console.log('bundle.test --eol-selftest — text assets through the real bundler, both checkout EOLs.\n');
  runEolSelftest();
  console.log('\nBOUNDARY: text inputs consumed by bundle.mjs only; binary assets remain byte-for-byte untouched.');
  process.exit(fails ? 1 : 0);
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

// ---- 1a. The test history is not a production fallback --------------------
{
  const dir = sandbox();
  rmSync(resolve(dir, '.git'), { recursive: true, force: true });
  appendFileSync(resolve(dir, 'src/content/balance.js'), '\n// move the canonical digest\n');
  const r = build(dir);
  check('ordinal derivation: a changed source tree without Git is refused', r.status === 1, `exit ${r.status}`);
  check('ordinal derivation: the refusal names Git and never invents a number',
    /git could not count commits|Refusing to invent one/.test(r.out), r.out.slice(-400));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 1b. Text assets are content, not checkout-EOL receipts ---------------
// PR #201 exposed the platform seam: Windows materialised the parchment SVGs
// with CRLF and bundle.mjs base64-encoded those raw bytes. The three shipped
// artifacts agreed with one another on Windows, but a fresh Linux rebuild read
// the LF Git blobs and changed only the embedded payloads. Run the REAL bundler
// in two real sandboxes and require exact output identity. Then put the raw read
// back into the CRLF sandbox and require this same comparison to catch it.
{
  runEolSelftest();
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

// ---- 2b. STRICT-ONLY faults (Bjorn's fixture gap) --------------------------
// The brace fixtures above plant faults that error in BOTH sloppy and strict
// mode, so they could never see the class he found: the gate compiled sloppy
// while the browser runs strict, and `energy: 010` built clean, exit 0, and
// handed over a blank screen with only "Octal literals are not allowed in
// strict mode" in the console. A fixture that cannot distinguish the two modes
// cannot protect the property, so these plant faults that are LEGAL sloppy and
// ILLEGAL strict — which is exactly the gap.
//
// It is invisible without help because src/ is ESM and therefore already
// strict; the transform strips the import/export that made it so.
const STRICT_ONLY = [
  ['octal literal', /^  energy: 3,$/m, '  energy: 010,', /[Oo]ctal/],
  ['duplicate parameter names', /^export const balance = \{$/m,
    'export function __dup(a, a) { return a; }\nexport const balance = {', /[Dd]uplicate parameter/],
  ['with statement', /^export const balance = \{$/m,
    'export function __w(o) { with (o) { return 1; } }\nexport const balance = {', /[Ss]trict mode code may not include a with statement/],
  ['delete of an unqualified name', /^export const balance = \{$/m,
    'export function __d(x) { delete x; }\nexport const balance = {', /[Dd]elete of an unqualified identifier/],
];
for (const [label, find, replace, expectMsg] of STRICT_ONLY) {
  const dir = sandbox();
  const p = resolve(dir, 'src/content/balance.js');
  const src = readFileSync(p, 'utf8');
  if (!find.test(src)) { check(`strict-only ${label}: fixture could plant it`, false, `no site matching ${find}`); rmSync(dir, { recursive: true, force: true }); continue; }
  const broken = src.replace(find, replace);
  writeFileSync(p, broken, 'utf8');

  // Prove the plant really is the class we mean: legal as sloppy script,
  // illegal as strict. Otherwise this is just another both-modes fixture
  // wearing a strict-sounding name. Done in-process with vm — the same parser
  // the gate uses — because doing it through `node -e` put the whole program
  // through two layers of escaping and the check failed on its own quoting
  // rather than on the code under test.
  // Strip module syntax the way bundle.mjs does — the KEYWORD, not the
  // declaration. Deleting whole `export const balance = {` lines orphaned the
  // object literal and made every plant look sloppy-illegal for a reason that
  // had nothing to do with the plant.
  const stripped = readFileSync(p, 'utf8')
    .replace(/^\s*import\b[^\n]*$/gm, '')
    .replace(/^(\s*)export\s+default\s+/gm, '$1')
    .replace(/^\s*export\s*\{[^}]*\}[^\n]*$/gm, '')
    .replace(/^(\s*)export\s+(?=(const|let|var|function|class|async)\b)/gm, '$1');
  const asFn = `(function (module, exports, require) {\n${stripped}\n})`;
  let sloppyOk = true;
  try { new vm.Script(asFn); } catch (e) { sloppyOk = false; }
  let strictBad = false;
  try { new vm.Script(`"use strict"; ${asFn}`); } catch (e) { strictBad = true; }
  check(`strict-only ${label}: legal SLOPPY, illegal STRICT (so it is the right class)`,
    sloppyOk && strictBad, `sloppyParsed=${sloppyOk} strictRejected=${strictBad}`);

  const r = build(dir);
  check(`strict-only ${label}: FAILS the build`, r.status === 1, `exit ${r.status}: ${r.out.slice(0, 160)}`);
  check(`strict-only ${label}: names balance.js and says why`,
    /src\/content\/balance\.js:\d+/.test(r.out) && expectMsg.test(r.out), r.out.slice(0, 200));
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

// ---- 5. The two second copies #77 left behind -----------------------------
// One class, not two bugs: a second copy IS an instrument that cannot fail,
// because nothing is checking the copies against each other. Every case below
// mutates the bundler ITSELF inside the sandbox, because that is the only way
// to watch a one-home guard go red — the drift it guards against is a future
// edit to this tool, not to the game.
//
// Each detector ships with its known-bad. A guard nobody has watched fail is
// `unknown`, not green, whatever it prints.

// Rewrite a fragment of the sandbox's own copy of bundle.mjs.
function patchTool(dir, find, replace) {
  const p = resolve(dir, 'tools/bundle.mjs');
  const s = readFileSync(p, 'utf8');
  // Git may materialise the sandbox source as CRLF on Windows while fixture
  // fragments in this ESM file are LF string literals. Adapt actual newline
  // characters to the copied file; leave escaped `\\n` source text alone.
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const forFile = (fragment) => fragment.replace(/\r?\n/g, eol);
  const needle = forFile(find);
  if (!s.includes(needle)) return false;
  writeFileSync(p, s.replace(needle, forFile(replace)), 'utf8');
  return true;
}

// The mutation a future hand actually makes: re-typing the runtime's opening
// lines instead of assembling them from RUNTIME_OPEN, and dropping the
// directive on the way past. This is drift the constant cannot prevent — only
// detect.
// (Anchor moved when the loader got one home in assembleRuntime(); the fixture
// FAILED to plant rather than silently passing, which is the only reason this
// was a one-line edit and not a green nobody could read.)
const RETYPE_OPEN = ['return `${RUNTIME_OPEN}  var __modules = {',
  'return `(function () {\n  var __modules = {'];
// One ordinary IIFE preamble in an ordinary content file. Legal, harmless, and
// the exact string #77's regex mistook for the runtime's own wrapper.
const CONTENT_IIFE = '\n(function () {\n  "use strict";\n  // an ordinary preamble in an ordinary file\n})();\n';

// ---- 5a. The guard reds on a re-typed, non-strict runtime opening ----------
{
  const dir = sandbox();
  const ok = patchTool(dir, ...RETYPE_OPEN);
  check('5a: fixture could re-type the runtime opening', ok);
  appendFileSync(resolve(dir, 'src/content/balance.js'), CONTENT_IIFE, 'utf8');
  const r = build(dir);
  check('5a: a non-strict runtime FAILS the build even with a strict IIFE in content',
    r.status === 1, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check('5a: the failure says which invariant broke',
    /no longer opens with RUNTIME_OPEN/.test(r.out), r.out.slice(0, 200));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5b. KNOWN-BAD: #77's regex passes that same tree ----------------------
// Without this case 5a is a green nobody has seen fail for the right reason.
// The regex searched all of `runtime` — which by that line holds all 93 module
// bodies — so content answered a question about the wrapper.
{
  const dir = sandbox();
  patchTool(dir, ...RETYPE_OPEN);
  appendFileSync(resolve(dir, 'src/content/balance.js'), CONTENT_IIFE, 'utf8');
  const ok = patchTool(dir,
    'if (!runtime.startsWith(RUNTIME_OPEN)) {',
    'if (!/\\(function \\(\\) \\{\\s*"use strict";/.test(runtime)) {');
  // Neutralise the language probe too, or it catches what the regex missed and
  // this case stops being a statement about the regex.
  patchTool(dir, 'if (!runtimeIsStrict) {', 'if (false) {');
  check('5b: fixture could restore #77\'s regex', ok);
  const r = build(dir);
  check('5b: KNOWN-BAD — #77\'s regex passes the same tree (this is the defect)',
    r.status === 0, `exit ${r.status}`);
  const out = resolve(dir, 'build/AshenSpire.html');
  check('5b: and what it passed really was a non-strict runtime',
    existsSync(out) && /<script>\s*\(function \(\) \{\s*var __modules/.test(readFileSync(out, 'utf8')));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5c. The language probe reds when the directive leaves its one home ----
// `startsWith` alone is blind here: edit RUNTIME_OPEN and the assertion agrees
// with the edit. Hoisting without this would have traded the regex's false
// pass for a blind spot the regex did not have.
{
  const dir = sandbox();
  const ok = patchTool(dir, "const STRICT_DIRECTIVE = '\"use strict\";';", "const STRICT_DIRECTIVE = '';");
  check('5c: fixture could empty the strict directive', ok);
  const r = build(dir);
  check('5c: a sloppy RUNTIME_OPEN FAILS the build (startsWith cannot see this)',
    r.status === 1, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check('5c: the failure names the language, not the text',
    /does not put module bodies in strict mode/.test(r.out), r.out.slice(0, 200));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5d. Both edges: ordinary content must NOT trip the guard --------------
// A guard that reds on a legal IIFE would be a style opinion nobody asked for,
// and it would be found by whoever writes the first one.
{
  const dir = sandbox();
  appendFileSync(resolve(dir, 'src/content/balance.js'), CONTENT_IIFE, 'utf8');
  const r = build(dir);
  check('5d: a strict IIFE in content, runtime untouched, still builds',
    r.status === 0, `exit ${r.status}: ${r.out.slice(-200)}`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5e. The factory signature: one home reaches BOTH sides ---------------
// Bjorn's probe parameter, which the two copies swallowed silently.
const arity = (s) => (s.trim() === '' ? 0 : s.split(',').length);
// Anchored on a module KEY, not on `function (`: the runtime IIFE is itself
// `(function () {` and matches first, which reported the declaration's arity
// as 0 — an instrument answering before it had found its subject.
const declOf = (html) => /"src\/[^"]+": function \(([^)]*)\) \{/.exec(html);
const callOf = (html) => /factory\(([^)]*)\);/.exec(html);
// The argument is `null`, not `__probe`. The original fixture passed an
// identifier that does not exist anywhere in the runtime, so the bundle it
// built would have thrown ReferenceError on load — and the fixture never
// noticed, because nothing executed what it built. The signature probe does
// execute it, so the fixture had to become an honest signature to keep
// testing what it claims to test (that a parameter added at the one home
// reaches both sides). Its dishonest twin is 5h below, which asserts the
// build now REFUSES it.
const PROBE_PARAM = ["  ['require', 'require'],", "  ['require', 'require'],\n  ['__probe', 'null'],"];
{
  const dir = sandbox();
  const ok = patchTool(dir, ...PROBE_PARAM);
  check('5e: fixture could add a probe parameter at the one home', ok);
  const r = build(dir);
  check('5e: the build still succeeds with a fourth parameter', r.status === 0, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  const html = readFileSync(resolve(dir, 'build/AshenSpire.html'), 'utf8');
  const d = declOf(html), c = callOf(html);
  check('5e: a parameter added at the one home reaches the DECLARATION',
    d && arity(d[1]) === 4, d ? `declared: ${d[1]}` : 'no factory declaration found');
  check('5e: and the CALL SITE — the arities agree',
    d && c && arity(d[1]) === arity(c[1]),
    d && c ? `declared ${arity(d[1])} (${d[1]}) vs called ${arity(c[1])} (${c[1]})` : 'not found');
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5f. KNOWN-BAD: the #77 shape, with the call site hardcoded again ------
// Proves 5e's arity check can go red. At 18aab6f this was the shipped state:
// MODULE_FN gained `__probe`, the emitted bundle declared four parameters and
// was called with three, exit 0, and nothing said so.
{
  const dir = sandbox();
  patchTool(dir, ...PROBE_PARAM);
  const ok = patchTool(dir, '    ${MODULE_CALL}', '    factory(module, module.exports, require);');
  check('5f: fixture could re-hardcode the call site', ok);
  const r = build(dir);
  check('5f: the build still succeeds — the disagreement is SILENT, which is the point',
    r.status === 0, `exit ${r.status}`);
  const html = readFileSync(resolve(dir, 'build/AshenSpire.html'), 'utf8');
  const d = declOf(html), c = callOf(html);
  check('5f: KNOWN-BAD — declared 4, called 3, arity check goes red (this is the defect)',
    d && c && arity(d[1]) === 4 && arity(c[1]) === 3,
    d && c ? `declared ${arity(d[1])} vs called ${arity(c[1])}` : 'not found');
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5g. The control, unmutated: the two sides agree today ----------------
{
  const dir = sandbox();
  build(dir);
  const html = readFileSync(resolve(dir, 'build/AshenSpire.html'), 'utf8');
  const d = declOf(html), c = callOf(html);
  check('5g: on an untouched tree the declaration and the call site agree',
    d && c && arity(d[1]) === arity(c[1]) && arity(d[1]) === 3,
    d && c ? `declared ${arity(d[1])} vs called ${arity(c[1])}` : 'not found');
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5h. The ASYMMETRIC #77 shape: gate strict, runtime sloppy -------------
// Bjorn ran this by hand at 7a03c6e and it worked, and nothing in the tree said
// so — which makes it `unknown` the next time anyone asks. It is NOT 5c. 5c
// empties STRICT_DIRECTIVE, so gate and runtime go sloppy TOGETHER; the real
// #77 shape is one side moving. Here RUNTIME_OPEN is re-typed past its one home
// while STRICT_DIRECTIVE stays exactly where it is, so the gate keeps compiling
// strict and only the shipped runtime goes sloppy. It is the case the whole
// design is for.
const RETYPE_RUNTIME_OPEN = ['const RUNTIME_OPEN = `(function () {\\n  ${STRICT_DIRECTIVE}\\n`;',
  'const RUNTIME_OPEN = `(function () {\\n`;'];
{
  const dir = sandbox();
  const ok = patchTool(dir, ...RETYPE_RUNTIME_OPEN);
  check('5h: fixture could re-type RUNTIME_OPEN past its one home', ok);
  check('5h: and STRICT_DIRECTIVE is UNTOUCHED — this is the asymmetric shape, not 5c',
    readFileSync(resolve(dir, 'tools/bundle.mjs'), 'utf8').includes(`const STRICT_DIRECTIVE = '"use strict";';`));
  const r = build(dir);
  check('5h: a sloppy runtime with a strict gate FAILS the build', r.status === 1, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check('5h: the failure names the language, and points at RUNTIME_OPEN',
    /does not put module bodies in strict mode/.test(r.out) && /RUNTIME_OPEN/.test(r.out), r.out.slice(0, 240));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5i. KNOWN-BAD: only the language probe catches 5h ---------------------
// Without this, 5h is a green that could be coming from the position assertion
// and nobody would know. `startsWith` is blind here BY CONSTRUCTION — the
// runtime is assembled FROM RUNTIME_OPEN, so it agrees with whatever
// RUNTIME_OPEN now says, including a sloppy opening.
{
  const dir = sandbox();
  patchTool(dir, ...RETYPE_RUNTIME_OPEN);
  const ok = patchTool(dir, 'if (!runtimeIsStrict) {', 'if (false) {');
  check('5i: fixture could neutralise the language probe', ok);
  const r = build(dir);
  check('5i: KNOWN-BAD — with only the probe gone the build passes, so startsWith never saw it',
    r.status === 0, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  const out = resolve(dir, 'build/AshenSpire.html');
  check('5i: and what it passed really was a non-strict runtime',
    existsSync(out) && /<script>\s*\(function \(\) \{\s*var __modules/.test(readFileSync(out, 'utf8')));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5j. The asymmetry itself, observed ------------------------------------
// #77 in the mirror: there the gate was sloppy and the browser strict, so a
// strict-only fault built clean and blanked the screen. Here the gate is strict
// and the browser sloppy — the fault is still CAUGHT, and the danger is the
// silent half: the runtime that would have shipped is not the language the gate
// checked. This case is what makes 5h a statement about asymmetry rather than
// about strictness in general.
{
  const dir = sandbox();
  patchTool(dir, ...RETYPE_RUNTIME_OPEN);
  patchTool(dir, 'if (!runtimeIsStrict) {', 'if (false) {');
  const p = resolve(dir, 'src/content/balance.js');
  writeFileSync(p, readFileSync(p, 'utf8').replace(/^  energy: 3,$/m, '  energy: 010,'), 'utf8');
  const r = build(dir);
  check('5j: the GATE is still strict — a strict-only fault reds even with the probe off',
    r.status === 1 && /[Oo]ctal/.test(r.out), `exit ${r.status}: ${r.out.slice(0, 200)}`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5k. ARGUMENT IDENTITY, not just arity ---------------------------------
// Bjorn's second card, and his own line turned on my fix: a consistency check
// is not a correctness check. MODULE_SIGNATURE proves the declaration and the
// call site AGREE about the count; it cannot notice them agreeing on a wrong
// answer. He planted ['exports', 'module'] at the one home: build exit 0,
// shipped `factory(module, module, require);`, all 44 cases green. Latent only
// because no module body reads bare `exports` today — the silent kind.
const WRONG_ARG = ["  ['exports', 'module.exports'],", "  ['exports', 'module'],"];
{
  const dir = sandbox();
  const ok = patchTool(dir, ...WRONG_ARG);
  check('5k: fixture could plant Bjorn\'s wrong argument at the one home', ok);
  const r = build(dir);
  check('5k: a signature whose arguments lie FAILS the build', r.status === 1, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check('5k: and it says which promise was broken',
    /exports is not module\.exports/.test(r.out), r.out.slice(0, 300));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5l. KNOWN-BAD: the arity check is blind to it, exactly as shipped -----
// Proves 5k reds for the NEW assertion and not for something the tree already
// had. With the signature probe neutralised this reproduces Bjorn's finding
// byte for byte: exit 0, `factory(module, module, require);`, and 5e/5g's
// arity comparison still perfectly green.
{
  const dir = sandbox();
  patchTool(dir, ...WRONG_ARG);
  const ok = patchTool(dir, 'if (probeScope.__signatureProbeOK !== true) {', 'if (false) {');
  check('5l: fixture could neutralise the signature probe', ok);
  const r = build(dir);
  check('5l: KNOWN-BAD — without the probe it builds clean (this is the defect)', r.status === 0, `exit ${r.status}`);
  const html = readFileSync(resolve(dir, 'build/AshenSpire.html'), 'utf8');
  const d = declOf(html), c = callOf(html);
  check('5l: KNOWN-BAD — it shipped factory(module, module, require)',
    /factory\(module, module, require\);/.test(html), (callOf(html) || ['none'])[0]);
  check('5l: KNOWN-BAD — and the ARITY check stays green, which is why it was silent',
    d && c && arity(d[1]) === arity(c[1]) && arity(d[1]) === 3,
    d && c ? `declared ${arity(d[1])} vs called ${arity(c[1])}` : 'not found');
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5m. An argument that names nothing ------------------------------------
// This was 5e's own plant until this commit: ['__probe', '__probe'] passes an
// identifier that exists nowhere in the runtime, so the bundle it built would
// have thrown ReferenceError on load. The fixture never noticed because nothing
// executed what it built. It does now.
{
  const dir = sandbox();
  const ok = patchTool(dir, "  ['require', 'require'],", "  ['require', 'require'],\n  ['__probe', '__probe'],");
  check('5m: fixture could plant an argument naming nothing', ok);
  const r = build(dir);
  check('5m: an argument the runtime cannot supply FAILS the build', r.status === 1, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check('5m: and it names the identifier', /__probe is not defined/.test(r.out), r.out.slice(0, 300));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 5n. Both edges: a DIFFERENT but correct signature still builds --------
// The probe must check what the loader does, not match a remembered string. A
// reordered signature is a legal one, and a golden-text check would red on it.
{
  const dir = sandbox();
  const ok = patchTool(dir,
    "  ['module', 'module'],\n  ['exports', 'module.exports'],",
    "  ['exports', 'module.exports'],\n  ['module', 'module'],");
  check('5n: fixture could reorder the signature', ok);
  const r = build(dir);
  check('5n: a reordered — but honest — signature still builds', r.status === 0, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  const html = readFileSync(resolve(dir, 'build/AshenSpire.html'), 'utf8');
  check('5n: and both sides moved together',
    /"src\/[^"]+": function \(exports, module, require\) \{/.test(html)
    && /factory\(module\.exports, module, require\);/.test(html),
    (declOf(html) || ['none'])[0] + ' / ' + (callOf(html) || ['none'])[0]);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 6. REFUSAL COMPLETENESS ----------------------------------------------
// #77's property 3 in Marina's own words: "a refused write must not leave a
// stale bundle silently in place." It shipped on the parse path only. Measured
// at d51b8e0: SEVEN of eight refusal paths exited 1 and left the previous good
// bundle standing at the output, byte-identical (d7373dde…) before and after —
// and the dangling-asset check, which ran after the write, printed
// `bundle.mjs: OK`, wrote a full playable game, and then exited 1.
//
// The property is "EVERY refusal path replaces the output", so the cases below
// are the ones that exist today AND two that do not: a refusal path invented
// after the fix, and a refusal that never calls fail() at all. Pinning only
// today's seven would fix the instance and leave the class open.
const goodBundleOf = (dir) => {
  const p = resolve(dir, 'build/AshenSpire.html');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};
// Each plant is a DIFFERENT refusal path in bundle.mjs. Content edits are the
// ones Constantine can cause; tool edits are the ones we can.
const REFUSALS = [
  ['strictness: the directive left its one home', (dir) =>
    patchTool(dir, `const STRICT_DIRECTIVE = '"use strict";';`, `const STRICT_DIRECTIVE = '';`)],
  ['language probe: RUNTIME_OPEN re-typed sloppy', (dir) =>
    patchTool(dir, 'const RUNTIME_OPEN = `(function () {\\n  ${STRICT_DIRECTIVE}\\n`;',
      'const RUNTIME_OPEN = `(function () {\\n`;')],
  ['unresolved import in content', (dir) => {
    const p = resolve(dir, 'src/content/statuses.js');
    writeFileSync(p, `import { nope } from './does-not-exist.js';\n` + readFileSync(p, 'utf8'), 'utf8');
    return true;
  }],
  ['non-relative import in content', (dir) => {
    const p = resolve(dir, 'src/content/statuses.js');
    writeFileSync(p, `import { nope } from 'lodash';\n` + readFileSync(p, 'utf8'), 'utf8');
    return true;
  }],
  ['dangling literal asset reference', (dir) => {
    appendFileSync(resolve(dir, 'src/content/balance.js'), `\nexport const __ghost = 'assets/nope/ghost.webp';\n`, 'utf8');
    return true;
  }],
  ['unhandled export form', (dir) => {
    appendFileSync(resolve(dir, 'src/content/balance.js'), `\nexport default 1;\n`, 'utf8');
    return true;
  }],
  ['missing stylesheet', (dir) => {
    const p = resolve(dir, 'index.html');
    writeFileSync(p, readFileSync(p, 'utf8').replace('<head>', '<head>\n  <link rel="stylesheet" href="styles/nope.css">'), 'utf8');
    return true;
  }],
  ['a refusal path invented AFTER this fix', (dir) =>
    patchTool(dir, `writeFileSync(OUT_PATH, html, 'utf8');`,
      `fail('a refusal path invented after the fix');\nwriteFileSync(OUT_PATH, html, 'utf8');`)],
  ['a refusal that never calls fail() — a bare throw', (dir) =>
    patchTool(dir, `writeFileSync(OUT_PATH, html, 'utf8');`,
      `throw new Error('a refusal that never calls fail()');\nwriteFileSync(OUT_PATH, html, 'utf8');`)],
];
for (const [label, plant] of REFUSALS) {
  const dir = sandbox();
  build(dir); // establish a GOOD bundle at the output first — that is the thing
  const before = goodBundleOf(dir); // a stale-bundle failure would leave behind
  const planted = plant(dir);
  const r = build(dir);
  const after = goodBundleOf(dir);
  check(`6 ${label}: fixture could plant it`, planted !== false);
  check(`6 ${label}: the build refuses`, r.status !== 0, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check(`6 ${label}: the output is the refusal page`,
    after.includes('This build did not happen') && !after.includes('id="app"'),
    after ? after.slice(0, 90) : '(no output file)');
  check(`6 ${label}: and it is NOT the previous good bundle`,
    after !== before && before.length > 500000, `changed=${after !== before} hadGoodBundle=${before.length > 500000}`);
  rmSync(dir, { recursive: true, force: true });
}

// A refusal with no reason recorded must say so, not invent one. This is the
// throw case's own edge: the page is standing where the game was, and it is
// honest that it cannot name the fault.
{
  const dir = sandbox();
  patchTool(dir, `writeFileSync(OUT_PATH, html, 'utf8');`,
    `throw new Error('a refusal that never calls fail()');\nwriteFileSync(OUT_PATH, html, 'utf8');`);
  build(dir);
  const page = goodBundleOf(dir);
  check('6: a refusal that named no reason says exactly that on the page',
    /without naming a reason/.test(page), page.slice(0, 120));
  rmSync(dir, { recursive: true, force: true });
}

// The dangling check used to run AFTER the write: `bundle.mjs: OK`, a full
// playable game on disk, then exit 1. Both edges of one run were true.
//
// EXTENDED ON THE UNION (2026-08-07). This used to plant the dangling reference
// only, and that made the assertion a statement about ONE refusal path's
// position. The signature probe arrived on the other branch and sits above the
// write for the same reason — and I proved the gap rather than asserting it:
// with the probe moved below the write and nothing else changed, this whole
// file printed `0 failing case(s)` while a real refusal printed `bundle.mjs: OK`
// above its own error. A hand-kept ordering is not a checked one. Every plant
// below is a DIFFERENT check that must sit above the write.
const NO_OK_BEFORE_ERROR = [
  ['dangling literal asset reference', (dir) =>
    appendFileSync(resolve(dir, 'src/content/balance.js'), `\nexport const __ghost = 'assets/nope/ghost.webp';\n`, 'utf8')],
  ['module signature probe', (dir) =>
    patchTool(dir, "  ['exports', 'module.exports'],", "  ['exports', 'module'],")],
];
for (const [label, plant] of NO_OK_BEFORE_ERROR) {
  const dir = sandbox();
  check(`6 ordering — ${label}: fixture could plant it`, plant(dir) !== false);
  const r = build(dir);
  check(`6 ordering — ${label}: the build refuses`, r.status === 1, `exit ${r.status}: ${r.out.slice(0, 200)}`);
  check(`6 ordering — ${label}: and never prints "bundle.mjs: OK" above the error`,
    !r.out.includes('bundle.mjs: OK'), r.out.slice(0, 200));
  rmSync(dir, { recursive: true, force: true });
}

// ---- 6z. KNOWN-BAD: disable the exit hook and the stale bundle comes back ---
// Without this, case 6 is a green nobody has watched fail. The hook is the ONLY
// writer of the refusal page now, so neutralising its one guard clause restores
// exactly the d51b8e0 behaviour.
{
  const dir = sandbox();
  build(dir);
  const before = goodBundleOf(dir);
  const ok = patchTool(dir, '  if (code === 0) return;', '  return;');
  check('6z: fixture could disable the refusal writer', ok);
  patchTool(dir, `const STRICT_DIRECTIVE = '"use strict";';`, `const STRICT_DIRECTIVE = '';`);
  const r = build(dir);
  const after = goodBundleOf(dir);
  check('6z: KNOWN-BAD — with the writer disabled the build still refuses', r.status === 1, `exit ${r.status}`);
  check('6z: KNOWN-BAD — and the previous good bundle is still standing (this is the defect)',
    after === before && before.length > 500000 && !after.includes('This build did not happen'),
    `identical=${after === before}`);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 6y. The other edge: success must NOT write the refusal page ------------
// Bjorn's card, taken here. This case used to prove "it wrote the game" with
// `includes('id="app"')`, and he fed that predicate a TRUNCATED 600 KB bundle:
// the string is at byte 136400, so it survives any cut past that, and the case
// passed on a file with no closing </script> at all. A string test on a 1.9 MiB
// artifact cannot tell a game from a fragment of one — and a success-check that
// a fragment satisfies is the mirror of 6z's stale bundle, which is why it
// belongs beside it rather than in a card of its own.
//
// So ask the parser about the FILE ON DISK. Not a golden string: it compares
// against nothing, and any complete, parsable script passes whatever it holds.
// It is also not a second copy of the tool's own gate — that compiles module
// bodies and the runtime it holds in memory; this compiles what was written.
const wholeGame = (html) => {
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return { ok: false, why: 'no complete <script> block in the output' };
  try { new vm.Script(m[1], { filename: 'built-bundle' }); } catch (err) { return { ok: false, why: err.message }; }
  return { ok: true, why: '' };
};
{
  const dir = sandbox();
  const r = build(dir);
  const out = goodBundleOf(dir);
  check('6y: a successful build writes the game, never the refusal page',
    r.status === 0 && out.includes('id="app"') && !out.includes('This build did not happen'),
    `exit ${r.status}, ${out.length} bytes`);
  const w = wholeGame(out);
  check('6y: and what it wrote is a WHOLE program, not a fragment that contains id="app"',
    w.ok, w.why);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 6v. KNOWN-BAD for 6y: a fragment must fail the check that a game passes -
// Two truncations, because they fail for two different reasons and only the
// second proves the PARSER is doing the work. Both keep `id="app"`, so both
// satisfy the predicate 6y used to rely on — which is the finding, stated as a
// fixture instead of as a sentence.
{
  const dir = sandbox();
  build(dir);
  const good = goodBundleOf(dir);
  const close = good.indexOf('</script>');
  const open = good.indexOf('<script>') + '<script>'.length;
  check('6v: the good build is a whole program', wholeGame(good).ok);

  // (a) Bjorn's cut: 600 KB, no closing tag at all.
  const cut = good.slice(0, 600 * 1024);
  check('6v: a 600 KB truncation still contains id="app" (this is why the old check passed)',
    cut.includes('id="app"'));
  const a = wholeGame(cut);
  check('6v: KNOWN-BAD — and it is rejected as not a whole program', !a.ok, a.why);

  // (b) The harder one: script body halved, closing tag and page tail intact,
  //     so there IS a <script> block and only the parser can tell it is broken.
  const half = good.slice(0, open) + good.slice(open, close).slice(0, (close - open) >> 1) + good.slice(close);
  check('6v: (b) has a complete <script> block and id="app"',
    /<script>[\s\S]*<\/script>/.test(half) && half.includes('id="app"'));
  const b = wholeGame(half);
  check('6v: KNOWN-BAD — a half-written script body is rejected BY THE PARSER',
    !b.ok && b.why !== 'no complete <script> block in the output', b.why);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 7. The tool prints its own boundary on SUCCESS -------------------------
// SPEC §8 clause 5 — Marina's audit law, which was hers and unpaid in the tool
// we hardened: bundle.mjs printed nine lines of what it did and nothing on what
// it did not. This test exists because a boundary nothing checks rots the way
// the required-coverage list in §8 rotted.
{
  const dir = sandbox();
  const r = build(dir);
  check('7: a successful build prints a BOUNDARY block', r.status === 0 && /^BOUNDARY:/m.test(r.out), r.out.slice(-200));
  check('7: and it names the biggest hole — compiled, never run',
    /COMPILED, never RUN/.test(r.out), r.out.slice(-300));
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${fails} failing case(s).`);
console.log('BOUNDARY: this proves the bundler REFUSES and names the fault. It does not');
console.log('prove the game is correct — only that a build which cannot parse never ships,');
console.log('and never leaves a previous build standing where the new one should be.');
console.log('BOUNDARY (case 6): refusal completeness is proven for nine paths, two of which');
console.log('did not exist before the fix. It is NOT proven for a failure that never reaches');
console.log('the exit hook: a syntax error in bundle.mjs itself (node never runs the file), or');
console.log('a kill signal. In both of those the previous bundle is still standing.');
console.log('BOUNDARY (case 5): the one-home guards are proven against edits to THIS TOOL,');
console.log('mutated in a sandbox. Nothing here says the shipped game plays correctly, and');
console.log('no browser ran: strictness is asserted through the same parser the gate uses.');
console.log('BOUNDARY (5k-5n): the signature probe runs ONE synthetic module through the real');
console.log('loader. It proves the arguments are what their parameter names promise; it says');
console.log('nothing about circular requires, load ORDER, or a factory that throws — no game');
console.log('module is executed here. 5m covers an argument naming nothing; an argument that');
console.log('names the WRONG existing thing is caught only where the probe touches it.');
console.log('BOUNDARY (6v/6y): "a whole program" here means the written <script> COMPILES.');
console.log('It is a real answer to "is this a game or a fragment of one" and it is not an');
console.log('answer to "does this game run": nothing executed the 93 modules, so a bundle');
console.log('that parses and throws on load passes 6y exactly as it passes the tool.');
console.log('BOUNDARY (6 ordering): two refusal checks are pinned above the write by name.');
console.log('A THIRD check added below the write would print OK above its own error and');
console.log('nothing here would say so — this is a list, not a derived property.');
process.exit(fails ? 1 : 0);
