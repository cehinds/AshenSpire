#!/usr/bin/env node
// tools/handrenderers.mjs — THE GREEN-DEBT SENTINEL. How many places in this
// tree build the player's hand? The number is printed out loud, every run.
//
// Bjorn, 2026-08-15. My own sentence, adopted verbatim by Marina in the
// wave-four board (`2026-08-15-falk-wave-four-board.json`, scaryBlockerFirst):
//
//   > the renderer count gets said out loud at every train until it is one.
//
// WHY A TOOL AND NOT A MEMORY. The debt is GREEN debt: `coop.js` carries a
// second hand renderer, the suite is 83/0, axisfit exits 0, and nothing in this
// repo goes red about it. Green debt attracts no fixes — it is invisible to
// every instrument we own, so the only thing keeping it alive in the house is
// somebody remembering to mention it. *A gate you must remember to pass will be
// forgotten* (development.md, the carried-commit clause, on itself). A sentence
// in a packet is a memory; this is a check.
//
// AND IT IS DELIBERATELY NOT A BAN. The count being two is not illegal — Viki
// owns the collapse and it is in flight. What this makes impossible is SILENCE:
// the line below is written to be quoted verbatim in every gate report, so the
// number travels with the green instead of behind it. The day the count is one,
// this same line prints the discharge and nobody has to notice.
//
// THE PREDICATE, DERIVED, AND IT NAMES NO FILE. A hand renderer is a source
// file that CONSTRUCTS `.hand` markup — a class attribute whose tokens include
// exactly `hand`, or the same class set at runtime. Querying, filling or
// styling an existing `.hand` is not construction: after the collapse, coop.js
// may keep every `querySelector('.hand')` it has and the count still falls to
// one, which is the point of measuring construction. Two things this rules out
// on purpose, and both exist in this tree — see --selftest, plants 4 and 5:
//   · `class="hand-area"` — a different token, not a hand
//   · `"hand": "right"` in generated equipment content — a DATA KEY, never a
//     class. A grep for the word `hand` returns 200+ of these and would make
//     this sentinel a number nobody could act on.
//
// THE DECLARATION. `DECLARED` below is the count the house has agreed to carry,
// with the citation that tracks it. Observed == declared → exit 0, and the line
// still prints. Observed != declared → exit 1, because a tracked debt that moved
// without anyone editing the tracking is exactly the silence this file exists
// against. A DROP is good news and still exits 1: it costs one line to record,
// and the alternative is the discharge going unannounced.
//
// Usage:
//   node tools/handrenderers.mjs            count, print the line, verdict
//   node tools/handrenderers.mjs --json     the same, machine-readable
//   node tools/handrenderers.mjs --selftest the known-bad corpus (six plants)
// Exit: 0 observed == declared · 1 it moved · 2 the harness could not measure
//
// REMOVAL CONDITION (SOP 1's corollary): this file is DELETED the day the
// declared count is 1 and a second one cannot be born — i.e. when the hand is
// built in exactly one place and Viki's collapse has made the second unbuildable
// rather than merely absent. A sentinel over a debt that cannot recur is
// decoration, and I would rather delete it than let it print a comfortable 1
// forever.

import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ROOT = resolve(argOf('--root', HERE));
const AS_JSON = args.includes('--json');
const SELFTEST = args.includes('--selftest');

// ---------------------------------------------------------------------------
// THE DECLARED DEBT. One row, because there is one. Its `cite` is what a reader
// follows to find out who owns it and what closes it.
// ---------------------------------------------------------------------------
const DECLARED = 2;
const DEBT = {
  what: 'hand renderers — the player\'s hand is built in two places',
  cite: 'commons/status-packets/2026-08-15-falk-wave-four-board.json · scaryBlockerFirst '
    + '("coop.js still carries a second hand renderer, two laws deep") · '
    + 'wave-four lane: Viki, THE RENDERER COLLAPSE (the parity seam rides it)',
  closes: 'one place constructs the hand; coop.js\'s second copy is deleted, not patched',
};

// ---------------------------------------------------------------------------
// The scan. One home for "constructs .hand", used by the run and by every plant.
// ---------------------------------------------------------------------------
const SCAN_DIR = 'src';

// A class attribute in a markup string: class="…" / class='…' / class=`…`.
const CLASS_ATTR = /class\s*=\s*(["'`])([\s\S]*?)\1/g;
// The same class set at runtime, the three forms this tree could grow.
const RUNTIME_FORMS = [
  { re: /classList\.add\(\s*(["'`])([^"'`]*)\1/g, what: 'classList.add' },
  { re: /className\s*=\s*(["'`])([^"'`]*)\1/g, what: 'className =' },
  { re: /setAttribute\(\s*["'`]class["'`]\s*,\s*(["'`])([^"'`]*)\1/g, what: 'setAttribute(class)' },
];
// Token-exact. `hand-area` is a different token and must not count; this is the
// whole difference between a number that means something and a grep.
const hasHandToken = (value) => String(value)
  .split(/[\s${}]+/)                      // whitespace, and template-hole edges
  .some((t) => t === 'hand');

function jsFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') || e.name.endsWith('.mjs')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function scan(root) {
  const dir = join(root, SCAN_DIR);
  let files;
  try { files = jsFiles(dir); }
  catch (e) { return { error: `cannot read ${SCAN_DIR}/ under ${root}: ${e.message}` }; }
  // THE REFERENT GUARD (SOP 2's ⚙). An empty scan and a collapsed tree print the
  // same 0. A 0 here is a reader that stopped reading, never a hand that stopped
  // being built — the game does not ship without one.
  if (!files.length) return { error: `${SCAN_DIR}/ under ${root} holds no .js files — that is a broken read, not a tree with no hand` };
  const sites = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const lineOf = (idx) => text.slice(0, idx).split('\n').length;
    for (const m of text.matchAll(CLASS_ATTR)) {
      if (hasHandToken(m[2])) sites.push({ file: relative(root, f), line: lineOf(m.index), how: 'class attribute', text: m[0].slice(0, 60) });
    }
    for (const { re, what } of RUNTIME_FORMS) {
      for (const m of text.matchAll(re)) {
        if (hasHandToken(m[2])) sites.push({ file: relative(root, f), line: lineOf(m.index), how: what, text: m[0].slice(0, 60) });
      }
    }
  }
  const byFile = [...new Set(sites.map((s) => s.file))].sort();
  return { files: files.length, sites, byFile, count: byFile.length };
}

function gitShort(root) {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return '?'; }
}

// ---------------------------------------------------------------------------
// THE LINE. This is the artifact — one line, quotable verbatim into any gate
// report, carrying the number, the tree it was read at, and where the debt is
// tracked. Everything else this file prints is context for whoever is fixing it.
// ---------------------------------------------------------------------------
function sentinelLine(count, ref) {
  if (count === 1) return `GREEN-DEBT SENTINEL — hand renderers: 1 at ${ref}. DISCHARGED: the hand is built in one place. (${DEBT.cite})`;
  return `GREEN-DEBT SENTINEL — hand renderers: ${count} at ${ref}, declared ${DECLARED}, not yet one. `
    + `Nothing in this repo goes red about it. (${DEBT.cite})`;
}

function run() {
  const r = scan(ROOT);
  const ref = gitShort(ROOT);
  if (r.error) {
    if (AS_JSON) console.log(JSON.stringify({ tool: 'tools/handrenderers.mjs', ref, error: r.error }, null, 1));
    else console.error(`handrenderers: ${r.error}\n  Unknown is never a pass (SOP 2's silence guard).`);
    return 2;
  }
  if (AS_JSON) {
    console.log(JSON.stringify({
      tool: 'tools/handrenderers.mjs', ref, declared: DECLARED, observed: r.count,
      line: sentinelLine(r.count, ref), files: r.byFile, sites: r.sites, debt: DEBT,
    }, null, 1));
    return r.count === DECLARED ? 0 : 1;
  }

  console.log(`\n${sentinelLine(r.count, ref)}\n`);
  console.log(`  scanned ${r.files} .js file(s) under ${SCAN_DIR}/ · ${r.sites.length} construction site(s) in ${r.count} file(s)`);
  for (const f of r.byFile) {
    const mine = r.sites.filter((s) => s.file === f);
    console.log(`    ${f}`);
    for (const s of mine) console.log(`      :${String(s.line).padEnd(5)} ${s.how.padEnd(18)} ${s.text.replace(/\s+/g, ' ')}`);
  }
  console.log(`\n  DEBT     ${DEBT.what}`);
  console.log(`  TRACKED  ${DEBT.cite}`);
  console.log(`  CLOSES   ${DEBT.closes}`);
  console.log(`\n  PREDICATE: a file that CONSTRUCTS .hand markup — a class attribute (or a runtime`);
  console.log('  className/classList/setAttribute) whose tokens include exactly `hand`. Querying or');
  console.log('  filling an existing .hand is not construction, and `hand-area` is a different token.');
  console.log('  No file is named in this tool; the list above is derived every run.');
  console.log('\n  BOUNDARY — what this number does NOT say:');
  console.log('   · it counts CONSTRUCTION SITES, not behaviour. Two files could build one hand');
  console.log('     between them, or one file could build two different hands. It is a consistency');
  console.log('     count, not a correctness one — mine, said about my own instrument.');
  console.log('   · it reads src/ only. A hand built in dist/ and not in src/ is verify-shipped\'s');
  console.log('     subject, not this one, and a hand built by a template this scan cannot see');
  console.log('     (a string assembled from pieces) would not appear — the honest hole.');
  console.log('   · a green here is NOT the debt being fixed. It is the debt being SAID.');

  if (r.count === DECLARED) {
    console.log(`\n  exit 0 — observed ${r.count} == declared ${DECLARED}: tracked, and said out loud.`);
    return 0;
  }
  if (r.count < DECLARED) {
    console.log(`\n  exit 1 — observed ${r.count} < declared ${DECLARED}. THIS IS THE GOOD NEWS AND IT IS STILL A RED:`);
    console.log(`  the debt moved and the declaration did not. Set DECLARED = ${r.count} in this file (and, if`);
    console.log('  it is 1, quote the discharge line above in the gate report and delete this tool per its');
    console.log('  removal condition). A discharge nobody records is the same silence, wearing a smile.');
    return 1;
  }
  console.log(`\n  exit 1 — observed ${r.count} > declared ${DECLARED}: a hand renderer was BORN. That is the`);
  console.log('  second copy this house is named for, arriving while every other check stayed green.');
  return 1;
}

// ---------------------------------------------------------------------------
// THE KNOWN-BAD CORPUS — six plants, and the door is a real tree on disk.
//
// Each plant COPIES THE REAL TREE to a temp dir, edits real source files there,
// and runs THIS FILE as a child process against it with --root. The plant
// therefore enters where the real input enters: the scan reads it off the disk
// through the same jsFiles()/scan() every real run performs. Nothing is handed
// to the predicate directly — a fixture passed straight to hasHandToken() would
// exercise the half that was never in doubt (development.md, *The instrument
// rule*, same-door clause).
//
// Both edges, as the Charter requires: plants 1-3 must go RED, plants 4-6 must
// stay GREEN — a sentinel that counts a `hand-area` div is worse than none,
// because the number it prints is one nobody can act on.
// ---------------------------------------------------------------------------
function selftest() {
  const base = mkdtempSync(join(tmpdir(), 'handrenderers-selftest-'));
  const mk = (name) => {
    const d = join(base, name);
    mkdirSync(d, { recursive: true });
    cpSync(join(ROOT, 'src'), join(d, 'src'), { recursive: true });
    return d;
  };
  const edit = (tree, rel, fn) => {
    const p = join(tree, rel);
    writeFileSync(p, fn(readFileSync(p, 'utf8')));
  };
  // The file the plants act on is DERIVED from a clean scan, never typed — a
  // selftest carrying a hardcoded path is the second copy, in the instrument
  // that exists to count copies.
  const clean = scan(ROOT);
  if (clean.error) { console.error(`handrenderers --selftest: cannot read the real tree: ${clean.error}`); return 2; }
  if (clean.count < 1) { console.error('handrenderers --selftest: the real tree constructs no hand — nothing to plant against.'); return 2; }
  const aRenderer = clean.byFile[0];

  const plants = [
    {
      name: '1 a third renderer is born',
      want: 'RED', wantExit: 1, wantRe: new RegExp(`hand renderers: ${clean.count + 1}`),
      build: (t) => writeFileSync(join(t, 'src/ui/screens/__plant-third-hand.js'),
        'export const draw = () => `<div class="hand"></div>`;\n'),
    },
    {
      name: '2 a renderer is deleted (the discharge)',
      want: 'RED', wantExit: 1, wantRe: new RegExp(`hand renderers: ${clean.count - 1}`),
      build: (t) => edit(t, clean.byFile[clean.byFile.length - 1],
        (s) => s.replace(/class\s*=\s*(["'`])([^"'`]*\bhand\b[^"'`]*)\1/g,
          (m, q, v) => (hasHandToken(v) ? `class=${q}${v.split(/\s+/).filter((x) => x !== 'hand').join(' ')}${q}` : m))),
    },
    {
      name: '3 FLOOR the tree cannot be read',
      want: 'RED', wantExit: 2, wantRe: /broken read|cannot read/,
      build: (t) => { rmSync(join(t, 'src'), { recursive: true, force: true }); mkdirSync(join(t, 'src')); },
    },
    {
      name: '4 a hand-area div (must NOT count)',
      want: 'GREEN', wantExit: 0, wantRe: new RegExp(`hand renderers: ${clean.count}`),
      build: (t) => writeFileSync(join(t, 'src/ui/screens/__plant-hand-area.js'),
        'export const draw = () => `<div class="hand-area"><div class="hand-rail"></div></div>`;\n'),
    },
    {
      name: '5 a "hand" DATA KEY (must NOT count)',
      want: 'GREEN', wantExit: 0, wantRe: new RegExp(`hand renderers: ${clean.count}`),
      build: (t) => writeFileSync(join(t, 'src/content/generated/__plant-rows.js'),
        'export const rows = [{ "hand": "right", "slot": "hand" }, { hand: \'left\' }];\n'),
    },
    {
      name: '6 a file that only QUERIES .hand (must NOT count)',
      want: 'GREEN', wantExit: 0, wantRe: new RegExp(`hand renderers: ${clean.count}`),
      build: (t) => writeFileSync(join(t, 'src/ui/screens/__plant-queries.js'),
        'export const fill = (app) => { const h = app.querySelector(\'.hand\'); h.innerHTML = cards; };\n'),
    },
  ];

  console.log(`handrenderers --selftest — ${plants.length} plants, each a REAL EDIT to a COPY OF THE REAL TREE,`);
  console.log(`  read back through the same disk scan a real run performs. Clean tree: ${clean.count} renderer(s).\n`);
  let failed = 0;
  for (const pl of plants) {
    const tree = mk(pl.name.split(' ')[0]);
    pl.build(tree);
    let out = ''; let code = 0;
    try {
      out = execFileSync(process.execPath, [join(HERE, 'tools/handrenderers.mjs'), '--root', tree],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout || ''}${e.stderr || ''}`; }
    const sawRe = pl.wantRe.test(out);
    const sawExit = code === pl.wantExit;
    const ok = sawRe && sawExit;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'BAD '} ${pl.want.padEnd(5)} ${pl.name.padEnd(38)} exit ${code} (wanted ${pl.wantExit})${sawRe ? '' : '  — the expected line did not appear'}`);
    if (!ok) console.log(`         saw: ${out.trim().split('\n').filter((l) => /SENTINEL|handrenderers:/.test(l)).join(' | ').slice(0, 220)}`);
  }
  rmSync(base, { recursive: true, force: true });
  console.log('');
  if (failed) {
    console.log(`${failed} of ${plants.length} plants misbehaved. This sentinel may NOT be cited.`);
    return 1;
  }
  console.log(`all ${plants.length} plants behaved: 3 observed RED, 3 observed GREEN.`);
  console.log('DOOR: every plant was a real file written into a copy of the real src/ tree and read back');
  console.log('  through the same directory walk and the same scan a real run performs. Entry point:');
  console.log('  `node tools/handrenderers.mjs --root <planted tree>`, a whole run, no internals called.');
  console.log('NOT PASSED THROUGH: the bundler. Every plant is a source-tree fact; a hand constructed only');
  console.log('  in dist/AshenSpire.html is outside this door and outside this tool (verify-shipped owns it).');
  console.log('BOUNDARY: the plants prove the COUNTER can move and can refuse to move. They do not prove');
  console.log('  the count is the right thing to count — that is the predicate above, and it is a person\'s claim.');
  return 0;
}

process.exit(SELFTEST ? selftest() : run());
