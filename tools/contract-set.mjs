#!/usr/bin/env node
// tools/contract-set.mjs — WHAT CHECKS DOES THIS REPO OWN, AND WHICH ONES DID
// THIS RUN NOT REACH?
//
// Vira, 2026-08-15, on Marina's MR-61. The finding is Viki's and her sentence is
// the whole reason this file exists: NOTHING IN CI RUNS ANY OF THESE TOOLS, AND
// NO MANIFEST GLOBS tools/*.mjs — *a wake nobody runs never wakes*. This is the
// PREREQUISITE to the CI workflow and deliberately not the workflow: **you
// cannot put a set in CI that you cannot enumerate**, and until this file
// existed not even a person could reliably run "all of them", because the set
// had no home. The workflow itself is carded at the top of the infra backlog
// under SOP 3's own four requirements. Nothing here is that card.
//
// ── THE ENUMERATION RULE — DERIVED, NEVER A LIST ────────────────────────────
//
// Law 1 clause 7 / Law 0 clause 1: an entry DESCRIBES, the machinery DERIVES. A
// hand-typed manifest is the second copy this house is named for — it goes
// stale the first time somebody adds a tool and forgets, which is the disease,
// not the cure. So the population is a glob and the classification is read out
// of each file's own source:
//
//   POPULATION   `git ls-files 'tools/*.mjs'` — every tracked tool, always.
//                Nothing opts in. There is no list to forget to edit. Where
//                there is no git index (a doorplant copy, a tarball) it falls
//                back to a readdir and SAYS SO in the run's output: "tracked"
//                and "on disk" are two different populations and a reader must
//                never have to infer which one produced a count.
//
//   A tool is a CONTRACT CHECK when both of these are true of its own bytes:
//     1. IT RUNS AS A PROGRAM — a `#!` shebang, or an
//        `import.meta.url === pathToFileURL(process.argv[1])` main guard, or
//        nothing tracked in this repo imports it. (A file nobody imports that
//        executes on load IS a program.)
//     2. IT RESERVES A FAILING EXIT — its source sets its own exit status to
//        something other than the literal `0`: `process.exit(<not 0>)` or
//        `process.exitCode = <not 0>`. **A tool that can only ever exit 0
//        renders no verdict.** This is the declaration, and it is one every
//        check in this tree already makes, because a check that cannot fail is
//        not a check — the instrument rule, stated as a predicate.
//
//   A tool is a MODULE when something tracked imports it and it reserves no
//   failing exit of its own. (serve.mjs, doorplant.mjs, webaudio-stub.mjs …)
//
//   ANYTHING ELSE IS `UNCLASSIFIED`, AND UNCLASSIFIED IS RED, BY NAME. A
//   program nobody imports that reserves no failing exit is either a check that
//   lost its verdict or an actor that never said it was one. It is never
//   silently dropped: a set that can quietly shrink is the defect.
//
// ── THE OVERRIDE, AND WHICH WAY FORGETTING POINTS ───────────────────────────
//
// Derivation is a default and an override is data (Law 0 clause 3) — but the
// override lives in the TOOL'S OWN FILE, one line, never in a central table,
// because a central table is the manifest again wearing a hat:
//
//   // CONTRACT-SET: actor — <why this run is not a verdict on the tree>
//   // CONTRACT-SET: check <argv…> — <why the bare run is not the verdict>
//   // CONTRACT-SET: needs <instrument> — <what it needs that this box lacks>
//
// **The default points at inclusion.** A tool nobody classified is RUN, not
// skipped; a mistyped verb is UNCLASSIFIED and red. Forgetting makes noise
// here, never silence — which is the entire subject of the finding this answers.
// Every override is printed by name with its own stated reason, so an
// `actor` line can shrink the run set but can never do it quietly.
//
// ── WHAT A RUN PRINTS, AND THE SECOND BLOCK IS THE POINT ────────────────────
//
// A runner that reports only what it ran is the aggregate-observation failure:
// nine greens handed over as though they covered a thing no green touched. So
// the run prints THREE blocks and the middle one is why this file was written:
//
//   RAN              pass / fail, per check, with wall time.
//   DID NOT REACH    every enumerated check this run produced no verdict for,
//                    BY NAME, with the derived reason — declared an actor · no
//                    browser on this box · timed out at Ns · crashed before
//                    rendering a verdict · deselected by --only · unclassified.
//   CENSUS           the plant grade of the whole set, and the drifted count.
//
// `unknown` is never green (SOP 2's silence guard), so the exit code says so:
//   0  every enumerated check was reached and passed
//   1  a check ran and FAILED
//   2  nothing failed, but the run did not reach everything — unknown, blocks
//
// There is no flag that turns a `2` into a `0`. The absence of a red is not a
// green, and a switch that pretended otherwise would be the whole defect.
//
// A CRASH IS NOT A FAILURE. A check that dies before printing anything did not
// rule on the tree; calling that "FAIL" is the misattributed red Marina named
// in MR-63 — the reader does the wrong repair confidently. A nonzero exit with
// no stdout at all resolves to NOT REACHED, not to a verdict.
//
// ── GRADES: MEMBERSHIP AND WORTH ARE TWO DIFFERENT QUESTIONS ────────────────
//
// Whether a tool is in the set and whether its green is worth anything are
// separate facts and this file keeps them separate. The grade is derived too:
//   planted        it imports tools/doorplant.mjs — its known-bad enters by the
//                  same door the real input enters (the instrument rule's
//                  same-door clause).
//   selftest-only  it declares a --selftest/--mutate door of its own making.
//   unplanted      no plant door at all. **Its green is `unknown`, not green**,
//                  and it is counted here rather than argued about.
// The grade decides NOTHING about membership. rebuild-matches.mjs is unplanted
// and is the check that caught a comment-only change moving the bundle by
// eleven lines — an importance ranking would have been wrong about it. This
// file has no importance ranking. It has a citability census.
//
// `--plants` runs each declared plant door and counts the ones whose plant SITE
// has drifted out from under them (doorplant's own `PLANT SITE DRIFTED` line —
// this file does not invent a vocabulary, it counts the harness's). That count
// is the useful output, not a repair: player-poise-threshold.mjs is one plant
// short at 1ab9777 and its NORMAL run is green 21/21, which is precisely the
// shape it warns about. Count them; fix none.
//
// ── ITS OWN DOOR ────────────────────────────────────────────────────────────
//
// `--selftest` plants known-bads as FILE BYTES in a copied real tree through
// tools/doorplant.mjs and runs this file WHOLE from that copy — the same
// readFileSync/git/spawn road a real tool change travels. It is stated in the
// harness's own output. A third red is not planted because it is already real:
// see `--plants --only player-poise-threshold`.
//
// ── BOUNDARY, SAID BEFORE IT IS CITED ───────────────────────────────────────
//
//  · This says WHICH checks exist and WHETHER THEY RAN. It says nothing about
//    whether any of them is a good check. A green here is not a green tree.
//  · "Rendered a verdict" is approximated by "wrote something to stdout". A
//    check that prints its findings only to stderr and fails would be reported
//    NOT REACHED rather than FAIL. That is the safe direction — both resolve to
//    a nonzero exit and unknown blocks — but it is an approximation, and it is
//    said here rather than discovered.
//  · The predicates are read off source text, not an AST. A verdict written in
//    a way this regex cannot see reads as MODULE, which is why UNCLASSIFIED is
//    red rather than a warning and why the override line exists.
//  · One box, one Node, one browser. Requirement 2's platform claims are
//    untouched here and stay `unknown`.
//  · "Needs a browser" is read off the file MENTIONING a browser, so it
//    OVER-declares: tools/surfaces.mjs is flagged and boots nothing (95ms,
//    measured). That inflates the unreached count under --no-browser and never
//    deflates it — the safe direction, since the cost is a false `unknown` and
//    never a false green. Said here rather than found later.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day CI runs the set from
// its own workflow and prints the unreached list itself — then this file is a
// second copy of that job. Not removed for being red; a red here is the point.

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const TIMEOUT_S = Number(valOf('--timeout', '240'));
const ONLY = valOf('--only', null);
const NO_BROWSER = has('--no-browser');

// Browser paths: the same list tools/shotguard-probe.mjs and the CI workflow
// name, read here only to answer "is the instrument on this box".
const BROWSERS = [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
  '/usr/bin/chromium-browser', '/snap/bin/chromium',
];
const BROWSER = BROWSERS.find((p) => existsSync(p)) || null;

// ── derivation ──────────────────────────────────────────────────────────────

function git(args) {
  // stderr ignored: the ONE expected failure here is "not a git repository",
  // which is a population-source fact handled below, not an error to shout.
  return execFileSync('git', args, {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// THE POPULATION HAS TWO POSSIBLE SOURCES AND THEY ARE NOT THE SAME POPULATION.
// `git ls-files` means TRACKED. A doorplant copy, a tarball or an export has no
// index, and a readdir there means ON DISK — which silently includes untracked
// files. Both are usable; conflating them is not, so the source is printed in
// the run's own output and never inferred by the reader.
let POP_SOURCE = 'git ls-files (tracked)';
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p.slice(ROOT.length + 1).split('\\').join('/'));
  }
  return out;
}
let DISK = null;
function globToRe(g) {
  return new RegExp('^' + g.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
}
function listFiles(glob) {
  if (POP_SOURCE.startsWith('git')) {
    try { return git(['ls-files', glob]).trim().split('\n').filter(Boolean); }
    catch { POP_SOURCE = 'readdir (NO GIT INDEX — this is every file ON DISK, tracked or not)'; }
  }
  DISK ||= walk(ROOT);
  const re = globToRe(glob);
  return DISK.filter((f) => re.test(f) || (!glob.includes('/') && re.test(f.split('/').pop())));
}

// Comments are stripped before the CODE predicates are read, so a header
// sentence about `process.exit(1)` cannot classify a file. The DECLARATION is
// read from the raw bytes, because it lives in a comment on purpose.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"\\`])\/\/.*$/, '$1'))
    .join('\n');
}

const DECL = /^[ \t]*\/\/[ \t]*CONTRACT-SET:[ \t]*(\S+)[ \t]*(.*)$/m;

function classify() {
  const tools = listFiles('tools/*.mjs').sort();
  // REFERENT GUARD (SOP 2's ⚙ clause): an empty result and a result with
  // nothing to find are identical and mean the opposite. Prove the query had
  // a referent before believing any count derived from it.
  if (tools.length === 0) {
    console.error(`RED  population is empty — 'tools/*.mjs' matched nothing via ${POP_SOURCE}.`);
    console.error('     That is a dead query, not a repo without tools. Nothing below is a number.');
    process.exit(1);
  }

  const sources = [...listFiles('*.mjs'), ...listFiles('*.js')];
  const importedBy = new Map(tools.map((t) => [basename(t), 0]));
  let edges = 0;
  for (const f of sources) {
    const src = stripComments(readFileSync(resolve(ROOT, f), 'utf8'));
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+\.mjs)['"]/g)) {
      const base = m[1].split('/').pop();
      if (!importedBy.has(base) || f.endsWith('/' + base)) continue;
      importedBy.set(base, importedBy.get(base) + 1);
      edges++;
    }
  }
  // SECOND REFERENT GUARD, and it is the one that would have hidden a real
  // defect: if the import scan finds NO edges it is dead, and every module in
  // the tree then classifies as a check and gets RUN. A scanner that returns
  // zero looks exactly like a repo with no imports.
  if (edges === 0) {
    console.error(`RED  the import scan found 0 edges across ${sources.length} source files (${POP_SOURCE}).`);
    console.error('     A repo whose tools import nothing and a dead scanner print the same 0.');
    process.exit(1);
  }

  const rows = [];
  for (const path of tools) {
    const name = basename(path);
    const raw = readFileSync(resolve(ROOT, path), 'utf8');
    const code = stripComments(raw);

    const imported = importedBy.get(name) > 0;
    const shebang = raw.startsWith('#!');
    const mainGuard = /import\.meta\.url\s*===/.test(code) || /process\.argv\[1\]/.test(code);
    // READ THE VALUE, DO NOT LOOK PAST IT. This started life as
    // `/process\.exitCode\s*=\s*(?!0\s*[;\n])/` and the selftest's first plant
    // went NOT CAUGHT against it: `\s*` backtracks to width zero, the lookahead
    // then sees " 0;" instead of "0;", and every `= 0` read as a verdict. The
    // plant found it, which is the entire argument for planting.
    const exitValues = [...code.matchAll(/process\.exit(?:Code)?\s*[(=]\s*([^;)\n]*)/g)]
      .map((m) => m[1].trim());
    const verdict = exitValues.some((v) => v !== '' && v !== '0');
    const runsAsProgram = shebang || mainGuard || !imported;

    // grade — worth, not membership
    const planted = /(?:from|import)\s*\(?\s*['"][^'"]*doorplant\.mjs['"]/.test(code);
    const selftestDoor = /--selftest|--mutate/.test(code);
    const grade = planted ? 'planted' : selftestDoor ? 'selftest-only' : 'unplanted';

    // instruments the file declares it needs, by its own imports and argv
    const needsServer = /from\s+['"]\.\/serve\.mjs['"]/.test(code);
    const needsBrowser = /--remote-debugging-port/.test(code) || /google-chrome|chromium/.test(code);

    // derived class
    let klass = 'UNCLASSIFIED';
    let why = 'nothing imports it and it reserves no failing exit — a check that lost its verdict, or an actor that never said so';
    if (imported && !verdict) { klass = 'MODULE'; why = `imported by ${importedBy.get(name)} tracked file(s), reserves no failing exit of its own`; }
    else if (verdict && runsAsProgram) { klass = 'CHECK'; why = 'runs as a program and reserves a failing exit'; }
    else if (imported) { klass = 'MODULE'; why = `imported by ${importedBy.get(name)} tracked file(s), not runnable on its own`; }

    // the override, from the file's own header
    let argvExtra = [];
    let declared = null;
    const m = raw.match(DECL);
    if (m) {
      const verb = m[1];
      const rest = (m[2] || '').trim().replace(/^—\s*/, '');
      declared = `${verb} ${rest}`.trim();
      if (verb === 'actor') { klass = 'ACTOR'; why = rest || '(no reason given)'; }
      else if (verb === 'check') {
        klass = 'CHECK';
        // everything before the em-dash is argv; the em-dash starts the prose
        argvExtra = rest.split('—')[0].trim().split(/\s+/).filter(Boolean);
        why = rest || 'declared a check by its own header';
      } else if (verb === 'needs') {
        klass = 'CHECK';
        why = `declares it needs ${rest}`;
      } else {
        klass = 'UNCLASSIFIED';
        why = `malformed CONTRACT-SET verb "${verb}" — expected actor | check | needs`;
      }
    }

    rows.push({
      path, name, klass, why, grade, imported, verdict, runsAsProgram,
      needsBrowser, needsServer, argvExtra, declared,
      declaredNeeds: m && m[1] === 'needs' ? (m[2] || '').trim() : null,
    });
  }
  return { rows, edges, sources: sources.length };
}

// ── running ─────────────────────────────────────────────────────────────────

function runOne(row) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [row.path, ...row.argvExtra], {
    cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_S * 1000, maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env },
  });
  const ms = Date.now() - started;
  const out = r.stdout || '';
  const err = r.stderr || '';
  if (r.error && r.error.code === 'ETIMEDOUT') return { verdict: 'unreached', ms, reason: `timed out at ${TIMEOUT_S}s` };
  if (r.signal) return { verdict: 'unreached', ms, reason: `killed by signal ${r.signal} — no verdict rendered` };
  // AN UNCAUGHT EXCEPTION IS NOT A VERDICT, and it is not a verdict even when
  // the tool printed twenty PASS lines first. Node's fatal path — and only its
  // fatal path — signs off with its own version banner on stderr; that banner
  // is the discriminator, not a guess about what the text means. A tool that
  // died holding the pen ruled on nothing, and calling it FAIL sends the reader
  // to repair the game when the instrument is what broke (MR-63).
  if (/\n\s*Node\.js v\d+\.\d+\.\d+\s*$/.test(err.trimEnd() + '\n')) {
    const thrown = err.split('\n').find((l) => /Error\b/.test(l))?.trim() || '(no Error line)';
    const got = out.trim() ? `after ${out.trim().split('\n').length} line(s) of output` : 'before any output';
    return { verdict: 'unreached', ms, reason: `DIED ON AN UNCAUGHT EXCEPTION ${got} — not a verdict: ${thrown.slice(0, 120)}` };
  }
  if (r.status !== 0 && out.trim() === '') {
    const tail = err.trim().split('\n').filter(Boolean).slice(-1)[0] || '(no stderr)';
    return { verdict: 'unreached', ms, reason: `exited ${r.status} with zero stdout — no verdict rendered: ${tail.slice(0, 110)}` };
  }
  return { verdict: r.status === 0 ? 'pass' : 'fail', ms, code: r.status, out, err };
}

function selected(rows) {
  return ONLY ? rows.filter((r) => r.name.includes(ONLY) || r.path.includes(ONLY)) : rows;
}

// ── output ──────────────────────────────────────────────────────────────────

function printEnumeration({ rows, edges, sources }) {
  const by = (k) => rows.filter((r) => r.klass === k);
  console.log(`CONTRACT SET — derived from \`git ls-files 'tools/*.mjs'\` at this tree, nothing typed.`);
  console.log(`  population source: ${POP_SOURCE}`);
  console.log(`  population ${rows.length} tools · import scan ${edges} edge(s) across ${sources} sources`);
  console.log(`  CHECK ${by('CHECK').length} · MODULE ${by('MODULE').length} · ACTOR ${by('ACTOR').length} · UNCLASSIFIED ${by('UNCLASSIFIED').length}`);
  console.log('');
  console.log('RULE: a tool is a CHECK when it runs as a program (shebang | main guard | nothing');
  console.log('      imports it) AND reserves a failing exit (process.exit(<not 0>) / exitCode).');
  console.log('      A tool that can only ever exit 0 renders no verdict. Overrides are one line');
  console.log('      in the tool\'s own header; the default is CHECK, so forgetting makes noise.');
  console.log('');
  for (const k of ['CHECK', 'ACTOR', 'MODULE', 'UNCLASSIFIED']) {
    const set = by(k);
    if (!set.length) continue;
    console.log(`── ${k} (${set.length})`);
    for (const r of set) {
      const g = k === 'CHECK' ? `[${r.grade}]`.padEnd(16) : ''.padEnd(16);
      const inst = [r.needsBrowser ? 'browser' : null, r.needsServer ? 'server' : null].filter(Boolean).join('+');
      console.log(`   ${r.name.padEnd(36)} ${g} ${inst.padEnd(15)} ${r.declared ? 'DECLARED: ' + r.why : ''}`);
    }
    console.log('');
  }
  const unc = by('UNCLASSIFIED');
  if (unc.length) {
    console.log(`RED  ${unc.length} tool(s) landed in no class. A set that can quietly shrink is the defect:`);
    for (const r of unc) console.log(`   UNCLASSIFIED  ${r.name} — ${r.why}`);
    console.log('');
  }
  return unc.length;
}

// ── WHAT THIS ENUMERATION'S OWN GLOB LEAVES OUT ─────────────────────────────
//
// The population above is `tools/*.mjs`, and that glob is a PARTITION with a
// remainder nobody enumerated. Every predicate in this file reads JavaScript
// comment and exit syntax; a `.py`, `.sh`, `.yml` or `.html` file in this tree
// is not merely unclassified by it, it is UNREADABLE BY IT. That is the same
// defect Bjorn found in Saga's scanner surviving inside the extensions she was
// confident enough to enumerate — carried here, not built here.
//
// It is named in the run's own output because it is a DEPENDENCY of the CI
// card, unmet: `.github/workflows/ci.yml` is one of the files this enumeration
// cannot read, and the workflow is the artifact the card exists to write. A
// dependency stated in a doc is a dependency nobody meets.
// The comment-carrying, non-JS syntaxes. Named as globs and not as a set this
// file computes, because the claim being made is about THESE classes: they are
// the ones Bjorn found red in the ledger's scanner, and `.yml` is the one the
// CI card's own artifact is written in.
const UNREADABLE_GLOBS = ['*.py', '*.sh', '*.yml', '*.yaml', '*.html', '*.css', '*.bat'];

const ls = (glob) => listFiles(glob);

function printOutOfReach() {
  // (a) this enumeration's OWN remainder: tools/ is not only .mjs
  const inTools = ls('tools/*');
  const remainder = inTools.filter((f) => !f.endsWith('.mjs'));
  const remExt = [...new Set(remainder.map((f) => (f.match(/\.([A-Za-z0-9]+)$/) || [, '?'])[1]))].sort();
  // (b) the syntax classes the dependency names, repo-wide
  const byExt = new Map();
  for (const g of UNREADABLE_GLOBS) {
    for (const f of ls(g)) {
      const ext = (f.match(/\.([A-Za-z0-9]+)$/) || [, '?'])[1].toLowerCase();
      if (!byExt.has(ext)) byExt.set(ext, []);
      if (!byExt.get(ext).includes(f)) byExt.get(ext).push(f);
    }
  }
  const total = [...byExt.values()].reduce((a, b) => a + b.length, 0);

  console.log('── OUT OF REACH OF THIS ENUMERATION — carried, not built');
  console.log(`   my own glob's remainder: ${remainder.length} of ${inTools.length} tracked files under tools/ are not .mjs`);
  console.log(`     extensions present: ${remExt.map((e) => '.' + e).join(' ')}`);
  console.log('     Every predicate in this file reads JavaScript comment and exit syntax, so these');
  console.log('     are not unclassified by it — they are UNREADABLE by it. "A tool is a .mjs file"');
  console.log('     is this classifier\'s own confident entry, and this is the count of what it costs.');
  console.log(`   the syntax classes the dependency names: ${total} tracked file(s) across ${byExt.size} class(es)`);
  for (const [ext, files] of [...byExt.entries()].sort()) {
    console.log(`     .${ext.padEnd(5)} ${String(files.length).padStart(3)}   ${files.slice(0, 4).join(' · ')}${files.length > 4 ? ` · +${files.length - 4} more` : ''}`);
  }
  const workflow = [...byExt.values()].flat().find((f) => /\.github\/workflows\/.*\.ya?ml$/.test(f));
  console.log('   .py / .sh / .yml STRIPPING IS A DEPENDENCY OF THE CI CARD AND IT IS UNMET. Nobody');
  console.log('   builds it in this act. It is printed here so the gap is in a run\'s output rather');
  console.log('   than in a doc — a dependency stated in a doc is a dependency nobody meets.');
  console.log(`   THE ONE THAT MATTERS TO THE CARD: ${workflow || 'NONE FOUND — worse, not better: the CI card has no artifact in this tree'}`);
  return total;
}

// ── CELL CENSUS (MR-69, answered as a count) ────────────────────────────────
//
// Marina asked whether Bjorn's finding is MR-48 on a partition instead of a
// threshold. I take the root and refuse the equivalence, and the refusal is the
// useful half:
//
//   SHARED ROOT — the region nobody sampled is the region everybody was
//   confident about. A threshold's neighbourhood and a partition's interior
//   cells are both invisible for the same reason: confidence is what stops
//   anyone sampling them, and the honest bucket (UNKNOWN / UNCLASSIFIED) is
//   the half that fails loud by design and therefore proves nothing about the
//   others.
//
//   WHERE THEY PART, AND IT IS NOT A DETAIL — a threshold has an ORDER, so its
//   sufficient sample is two ADJACENT cells across the boundary, and what that
//   buys is the comparison operator itself (`>=` vs `>`). A partition has no
//   metric, so "adjacent" does not exist and that half does not generalise. In
//   exchange the partition case has a failure the threshold case cannot have:
//   a threshold's cells can only be MISPLACED, while a partition's cell can be
//   WRONG IN ITS DEFINITION — `html` was not an edge error, an HTML file with
//   inlined <script> is two syntaxes and the cell was false in the middle.
//
//   SO: a sibling, not an instance. Sufficient sample for a partition = one
//   observed real input per named cell, PLUS, for any cell whose membership
//   rests on a format or syntax assumption, one input that stresses that
//   assumption. Calling it MR-48 would import "adjacent" (meaningless here) and
//   export "cells can only be misplaced" (false here) — the elegant merge that
//   loses the distinction that makes either fixable.
//
// Counted, not claimed, and only about the classifier in this file — a floor on
// the exposure, never an estimate of it.
function printCellCensus(rows) {
  const cells = ['CHECK', 'MODULE', 'ACTOR', 'UNCLASSIFIED'];
  console.log('CELL CENSUS — every bucket this classifier names, and whether a REAL input lands in it');
  for (const c of cells) {
    const n = rows.filter((r) => r.klass === c).length;
    console.log(`  ${c.padEnd(14)} ${String(n).padStart(3)} real cell(s)${n === 0 ? '   ← UNSAMPLED BY THE TREE. Only --selftest plants land here; a planted cell is not a real one.' : ''}`);
  }
  console.log('  cells whose definition rests on a syntax assumption: 1 of 4 — CHECK, and it is');
  console.log('  the wrong-in-the-middle one: "a tool is a .mjs file" is this classifier\'s own');
  console.log('  confident entry, and the files it cannot read are counted above, not assumed away.');
}

function printCensus(rows) {
  const checks = rows.filter((r) => r.klass === 'CHECK');
  const g = (n) => checks.filter((r) => r.grade === n).length;
  console.log(`PLANT CENSUS (of ${checks.length} checks) — membership and worth are different questions`);
  console.log(`  planted (same-door, via doorplant.mjs) ${g('planted')}`);
  console.log(`  selftest-only (own door)               ${g('selftest-only')}`);
  console.log(`  UNPLANTED — green is \`unknown\`         ${g('unplanted')}`);
  console.log(`  drifted plant sites: NOT MEASURED BY THIS RUN — \`--plants\` measures it.`);
}

// ── modes ───────────────────────────────────────────────────────────────────

function modeList() {
  const model = classify();
  const bad = printEnumeration(model);
  printCensus(model.rows);
  console.log('');
  printCellCensus(model.rows);
  console.log('');
  printOutOfReach();
  console.log('');
  console.log('BOUNDARY: this enumerated the set. It ran nothing, so it says nothing about');
  console.log('          whether any check passes. `node tools/contract-set.mjs` runs them.');
  process.exit(bad ? 1 : 0);
}

function modeRun() {
  const model = classify();
  const unclassified = model.rows.filter((r) => r.klass === 'UNCLASSIFIED');
  const allChecks = model.rows.filter((r) => r.klass === 'CHECK');
  const actors = model.rows.filter((r) => r.klass === 'ACTOR');
  const chosen = selected(allChecks);
  const deselected = allChecks.filter((r) => !chosen.includes(r));

  console.log(`CONTRACT SET — ${allChecks.length} checks enumerated from ${model.rows.length} tools (derived, nothing typed).`);
  console.log(`  population source: ${POP_SOURCE}`);
  console.log(`  browser on this box: ${BROWSER || 'NONE FOUND'}   timeout ${TIMEOUT_S}s   ${ONLY ? `--only ${ONLY}` : ''}${NO_BROWSER ? ' --no-browser' : ''}`);
  console.log('');

  const ran = [];
  const unreached = [];   // enumerated CHECKS this run produced no verdict for
  const excluded = [];    // not checks at all, or deliberately deselected — listed, never silent
  for (const r of unclassified) unreached.push({ r, reason: `UNCLASSIFIED — ${r.why}` });
  for (const r of actors) excluded.push({ r, reason: `declared an actor by its own header — ${r.why}` });
  for (const r of deselected) excluded.push({ r, reason: `deselected by --only ${ONLY}` });

  console.log('── RAN');
  for (const r of chosen) {
    if (r.declaredNeeds) { unreached.push({ r, reason: `declares it needs ${r.declaredNeeds.replace(/^—\s*/, '')} — this run does not supply it` }); continue; }
    if (r.needsBrowser && (NO_BROWSER || !BROWSER)) {
      unreached.push({ r, reason: NO_BROWSER ? 'deselected by --no-browser' : `no browser on this box (looked for ${BROWSERS.join(', ')})` });
      continue;
    }
    const res = runOne(r);
    if (res.verdict === 'unreached') { unreached.push({ r, reason: res.reason, ms: res.ms }); continue; }
    ran.push({ r, res });
    const tag = res.verdict === 'pass' ? 'PASS' : 'FAIL';
    console.log(`   ${tag}  ${r.name.padEnd(36)} ${String(res.ms).padStart(7)}ms  exit ${res.code}`);
    if (res.verdict === 'fail') {
      const firstRed = (res.out + '\n' + res.err).split('\n').find((l) => /\b(FAIL|RED|NOT CAUGHT|MISSING|ERROR)\b/.test(l));
      if (firstRed) console.log(`         ${firstRed.trim().slice(0, 150)}`);
    }
  }
  if (!ran.length) console.log('   (nothing)');
  console.log('');

  console.log('── DID NOT REACH — every one of these is `unknown`, and unknown is not green');
  if (!unreached.length) console.log('   (nothing — every enumerated check produced a verdict)');
  for (const u of unreached.sort((a, b) => a.r.name.localeCompare(b.r.name))) {
    console.log(`   NOT REACHED  ${u.r.name} — ${u.reason}`);
  }
  console.log('');

  console.log('── NOT IN THE RUN SET — kept out by a declaration or a filter, never by silence');
  if (!excluded.length) console.log('   (nothing)');
  for (const u of excluded.sort((a, b) => a.r.name.localeCompare(b.r.name))) {
    console.log(`   EXCLUDED     ${u.r.name} — ${u.reason}`);
  }
  console.log('');

  // THRESHOLD NEIGHBOURHOOD (MR-48). The timeout is the only number this file
  // sets, so it prints the cells either side of it out of THIS run's real
  // measurements — and says so plainly when one side is empty, rather than
  // letting an unsampled boundary read as a calibrated one.
  const finished = ran.map((x) => x.res.ms).sort((a, b) => a - b);
  const timedOut = unreached.filter((u) => /timed out at/.test(u.reason)).map((u) => u.ms).sort((a, b) => a - b);
  console.log(`── TIMEOUT ${TIMEOUT_S}s — the cells either side of the only threshold this file sets`);
  console.log(`   below the line: slowest check that finished  ${finished.length ? `${finished[finished.length - 1]}ms (${ran.find((x) => x.res.ms === finished[finished.length - 1]).r.name})` : 'NO CELL — nothing finished'}`);
  console.log(`   above the line: fastest check that timed out ${timedOut.length ? `${timedOut[0]}ms` : 'NO CELL — nothing timed out, so this threshold is UNSAMPLED at its own boundary'}`);
  console.log('');

  printCensus(model.rows);
  console.log('');
  printCellCensus(model.rows);
  console.log('');
  const outside = printOutOfReach();
  console.log('');

  const failed = ran.filter((x) => x.res.verdict === 'fail');
  const attempted = allChecks.length - excluded.filter((e) => e.r.klass === 'CHECK').length;
  console.log(`RESULT  reached ${ran.length}/${attempted} checks this run attempted · ${failed.length} FAILED · ${unreached.length} NOT REACHED`);
  console.log(`        set is ${allChecks.length} checks · ${excluded.length} kept out by declaration or filter · ${outside} tracked file(s) outside this enumeration's syntax`);
  console.log('BOUNDARY: this is one box, one Node (' + process.version + '), one browser. It says which');
  console.log('          checks exist and whether they ran — nothing about whether any of them is a');
  console.log('          good check, and nothing about any other platform. Those stay `unknown`.');
  console.log('          "needs a browser" is read off a MENTION of one, so it over-declares and the');
  console.log('          unreached count is an upper bound, never an under-count.');
  if (failed.length) { console.log('EXIT 1 — a check ran and said no.'); process.exit(1); }
  if (unreached.length) { console.log('EXIT 2 — nothing failed, but the run did not reach everything. Unknown blocks.'); process.exit(2); }
  console.log('EXIT 0 — every enumerated check this run attempted was reached and passed.');
  console.log('         Not the same sentence as "the set is green" — read the two lines above it.');
  process.exit(0);
}

function modePlants() {
  const model = classify();
  const checks = selected(model.rows.filter((r) => r.klass === 'CHECK' && r.grade !== 'unplanted'));
  const unplanted = selected(model.rows.filter((r) => r.klass === 'CHECK' && r.grade === 'unplanted'));
  console.log(`PLANT DOORS — running the declared plant of ${checks.length} check(s). ${unplanted.length} unplanted check(s) have no door to run.`);
  console.log('DRIFT is counted from tools/doorplant.mjs\'s own `PLANT SITE DRIFTED` line — this file');
  console.log('invents no vocabulary. A drifted plant is a corpus that silently stopped running while');
  console.log('the tool\'s normal run stayed green. COUNTED HERE, FIXED NOWHERE — that is the order.');
  console.log('');
  let drifted = 0, green = 0, red = 0;
  const unreached = [];
  const driftLines = [];
  for (const r of checks) {
    if (r.needsBrowser && (NO_BROWSER || !BROWSER)) { unreached.push([r.name, NO_BROWSER ? 'deselected by --no-browser' : 'no browser on this box']); continue; }
    const started = Date.now();
    const p = spawnSync(process.execPath, [r.path, '--selftest'], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_S * 1000, maxBuffer: 128 * 1024 * 1024 });
    const ms = Date.now() - started;
    const out = `${p.stdout || ''}\n${p.stderr || ''}`;
    if (p.error && p.error.code === 'ETIMEDOUT') { unreached.push([r.name, `timed out at ${TIMEOUT_S}s`]); continue; }
    if (p.signal) { unreached.push([r.name, `killed by signal ${p.signal}`]); continue; }
    if (p.status !== 0 && (p.stdout || '').trim() === '') { unreached.push([r.name, `crashed before rendering a verdict (exit ${p.status}, zero stdout)`]); continue; }
    const hits = out.split('\n').filter((l) => /PLANT SITE DRIFTED/.test(l));
    if (hits.length) {
      drifted += hits.length;
      for (const h of hits) driftLines.push([r.name, h.trim()]);
      console.log(`   DRIFTED ${String(hits.length).padStart(2)}  ${r.name.padEnd(36)} ${String(ms).padStart(6)}ms  exit ${p.status}`);
      red++;
    } else if (p.status === 0) { green++; console.log(`   GREEN      ${r.name.padEnd(36)} ${String(ms).padStart(6)}ms`); }
    else { red++; console.log(`   RED        ${r.name.padEnd(36)} ${String(ms).padStart(6)}ms  exit ${p.status}`); }
  }
  console.log('');
  if (driftLines.length) {
    console.log('── DRIFTED PLANT SITES, by name');
    for (const [n, l] of driftLines) console.log(`   ${n} — ${l.slice(0, 190)}`);
    console.log('');
  }
  console.log('── DID NOT REACH');
  if (!unreached.length) console.log('   (nothing)');
  for (const [n, why] of unreached) console.log(`   NOT REACHED  ${n} — ${why}`);
  console.log('');
  console.log(`PLANT COUNT  doors run ${green + red} · green ${green} · red ${red} · DRIFTED PLANT SITES ${drifted} · not reached ${unreached.length} · unplanted checks ${unplanted.length}`);
  console.log('BOUNDARY: a green door here means the tool was watched red on its own known-bad in this');
  console.log('          run. It does not mean the plant is the right plant. Drift is counted, not fixed.');
  if (drifted || red) { process.exit(1); }
  if (unreached.length) { process.exit(2); }
  process.exit(0);
}

async function modeSelftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  // THREE PLANTS ACROSS TWO DOORS, because this file has two doors and one
  // corpus over both would prove the easy one twice. `--list` is the
  // CLASSIFICATION door (it reads bytes and sorts them); the bare run is the
  // EXECUTION door (it spawns tools and reads what came back). A plant aimed at
  // classification cannot go red through the execution door and the reverse is
  // just as true, so they are separated rather than averaged.
  //
  // Every plant enters as FILE BYTES in a copied real tree — no object is
  // handed to a predicate. The FOURTH red is not planted at all because it is
  // already real in this tree: `--plants --only player-poise-threshold` is a
  // drifted plant site on bytes nobody wrote for the occasion.
  let failed = 0;

  failed += await doorSelftest({
    tool: 'contract-set.mjs',
    args: ['--list'],
    timeoutMs: 180000,
    plants: [
      {
        // A CHECK THAT LOSES ITS VERDICT must not quietly leave the set. This
        // is the shape of every dead instrument this house has found: it still
        // exists, it still runs, and it can no longer say no. conhp.mjs has
        // exactly one verdict site, which is what makes it a one-edit defect —
        // a realistic one, not a contrived one.
        name: 'a check stops reserving a failing exit',
        file: 'tools/conhp.mjs',
        find: 'if (failures) process.exitCode = 1;',
        replace: 'if (failures) process.exitCode = 0;',
        expectRed: /UNCLASSIFIED\s+conhp\.mjs/,
      },
      {
        // A MISTYPED OVERRIDE MUST NOT SILENTLY DO NOTHING. The override is the
        // one hand-written thing in this design, so the way it fails is the
        // thing to watch: a verb nobody parses has to be louder than no verb at
        // all, or the escape hatch becomes the second copy it was meant to kill.
        name: 'an override verb is mistyped',
        file: 'tools/rebuild-matches.mjs',
        find: '// tools/rebuild-matches.mjs',
        replace: '// CONTRACT-SET: aktor — a typo nobody parses\n// tools/rebuild-matches.mjs',
        expectRed: /UNCLASSIFIED\s+rebuild-matches\.mjs — malformed CONTRACT-SET verb/,
      },
    ],
  });

  failed += await doorSelftest({
    tool: 'contract-set.mjs',
    args: ['--only', 'onevocab', '--timeout', '60'],
    timeoutMs: 180000,
    plants: [
      {
        // A CHECK THAT DIES HOLDING THE PEN ruled on nothing. Reporting it as
        // FAIL is MR-63's misattributed red: the reader repairs the game when
        // the instrument is what broke. It must land in DID NOT REACH.
        name: 'a check dies on an uncaught exception instead of ruling',
        file: 'tools/onevocab.mjs',
        find: "from '../src/content/index.js'",
        replace: "from '../src/content/NO-SUCH-MODULE.js'",
        expectRed: /NOT REACHED\s+onevocab\.mjs — DIED ON AN UNCAUGHT EXCEPTION/,
      },
    ],
  });

  process.exit(failed ? 1 : 0);
}

// ── entry ───────────────────────────────────────────────────────────────────

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (has('--selftest')) await modeSelftest();
  else if (has('--list')) modeList();
  else if (has('--plants')) modePlants();
  else modeRun();
}
