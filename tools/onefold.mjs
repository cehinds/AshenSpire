#!/usr/bin/env node
// tools/onefold.mjs — HOW MANY PLACES IN THIS TREE BUILD A FOLD?
//
// Sunna, 2026-08-16. Constantine said "go ahead and allow the fold" (MR-151)
// and the lane that answers him could have been written two ways. Saga named
// the wrong one before anyone typed it:
//
//   > a lane written as "build the fold" would have a seat author a second
//   > mountDisclosure — the exact debt TR1 is already open on.
//
// TR1's price was three trains. `tools/handrenderers.mjs` is Bjorn's sentinel
// over that debt on the player's hand, and this file is the same instrument
// pointed at the disclosure affordance, before there is anything to count. I
// would rather ship the counter with the first extension than write it after
// the second renderer exists — which is when handrenderers had to be written.
//
// TWO NUMBERS, BECAUSE THERE ARE TWO WAYS TO GROW A SECOND ONE.
//
//   FOLD    files that construct the D26 affordance's OWN MARKUP — a class
//           attribute (or a runtime className / classList.add / setAttribute
//           ('class')) whose tokens include exactly `disc-face`, `disc-faces`
//           or `disc-reveal`. DECLARED 1. This is the gate: a copy of
//           mountDisclosure keeps the vocabulary, because a copy is made by
//           copying.
//
//   EXPAND  files that construct an `aria-expanded` state at all — the ARIA
//           contract every disclosure widget publishes, whatever it calls its
//           classes. DECLARED 3, and the roster is DERIVED and printed. This
//           axis exists because the first one has an obvious hole: a fold
//           written from scratch under fresh class names is invisible to a
//           vocabulary check. It does not close the hole — it makes the wider
//           population a number that cannot move in silence.
//
// WHAT THESE NUMBERS DO NOT SAY, and I would rather write it here than have it
// read off me later (Vira, 2026-08-15: THE DOOR NAMED IS THE EXTENT OF THE
// GREEN). The FOLD predicate is a claim about CLASS TOKENS IN src/. It is
// silent about:
//   · a fold with neither `disc-*` classes nor `aria-expanded` — a bare
//     `<details>`, a `.hidden` toggled by a boolean, a CSS-only rotation. This
//     tree already ships two such (`<details class="cz-stats">`,
//     `<details class="cz-kit">`) and they are not counted, on purpose: they
//     are the platform's own widget, not a hand-built renderer.
//   · behaviour. Two files could build one fold between them; one file could
//     build two different ones. This is a consistency count, not a correctness
//     one — mine, said about my own instrument.
//   · anything outside src/. dist/ is verify-shipped's subject.
// The sentence this tool licenses is exactly its predicate and no wider: ONE
// FILE CONSTRUCTS THE DISCLOSURE AFFORDANCE'S MARKUP, and THREE construct an
// aria-expanded state. Not "there is one fold in the game".
//
// AND IT IS NOT A BAN. A second expander is not illegal — `equipment.js` and
// `customRun.js` each own a real one and neither is the D26 fold. What this
// makes impossible is a fourth arriving without a line in a report.
//
// Usage:
//   node tools/onefold.mjs             the counts, the roster, the verdict
//   node tools/onefold.mjs --json      the same, machine-readable
//   node tools/onefold.mjs --root DIR  another checkout (a planted copy)
//   node tools/onefold.mjs --selftest  the same-door known-bad corpus
// Exit: 0 both observed == declared · 1 one moved · 2 the harness could not read
//
// REMOVAL CONDITION (SOP 1's corollary): deleted with components/disclosure.js,
// or the day a second fold cannot be born — a linter that refuses the second
// construction site outright makes this counter decoration, and I would rather
// delete it than let it print a comfortable 1 forever.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ROOT = resolve(argOf('--root', HERE));
const AS_JSON = args.includes('--json');

// ---------------------------------------------------------------------------
// THE DECLARATIONS. Each carries what closes it, so a reader who finds the
// number moved knows what they are looking at.
// ---------------------------------------------------------------------------
const DECLARED_FOLD = 1;
const DECLARED_EXPAND = 3;
const CITE = 'MR-151 (Constantine, 2026-08-16: "go ahead and allow the fold") · Saga\'s warning: '
  + 'a lane written as "build the fold" grows a second mountDisclosure · the precedent is '
  + 'tools/handrenderers.mjs, TR1, whose price was three trains';

const SCAN_DIR = 'src';

// A class attribute in a markup string, and the three runtime forms this tree
// could grow. Same shapes handrenderers.mjs reads, same reason: QUERYING an
// existing `.disc-face` is not constructing one, and a comment that spells the
// class name is prose. `disclosure.js` itself does both — it builds the row and
// then querySelectors it back — and only the building counts.
const CLASS_ATTR = /class\s*=\s*(["'`])([\s\S]*?)\1/g;
const RUNTIME_FORMS = [
  { re: /classList\.add\(\s*(["'`])([^"'`]*)\1/g, what: 'classList.add' },
  { re: /className\s*=\s*(["'`])([^"'`]*)\1/g, what: 'className =' },
  { re: /setAttribute\(\s*["'`]class["'`]\s*,\s*(["'`])([^"'`]*)\1/g, what: 'setAttribute(class)' },
];
// Token-exact, split on whitespace and template-hole edges. `disc-faces` and
// `disc-face` are two different tokens and both count; `cz-disc` is neither,
// which is why the creation screen may carry that layout hook without becoming
// a second renderer.
const FOLD_TOKENS = new Set(['disc-face', 'disc-faces', 'disc-reveal']);
const hasFoldToken = (value) => String(value).split(/[\s${}]+/).some((t) => FOLD_TOKENS.has(t));

// The expander axis. `aria-expanded="..."` inside a markup string, or set at
// runtime. The `=` is required, which is what keeps the header comment in
// disclosure.js (`aria-expanded + data-reveal=...`) out of the count — prose
// that names the attribute is not a control that publishes it.
const EXPAND_FORMS = [
  { re: /aria-expanded\s*=\s*["'`]/g, what: 'aria-expanded= in markup' },
  { re: /setAttribute\(\s*["'`]aria-expanded["'`]\s*,/g, what: 'setAttribute(aria-expanded)' },
  { re: /\.ariaExpanded\s*=/g, what: '.ariaExpanded =' },
];

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
  // THE REFERENT GUARD (SOP 2's ⚙). An empty scan and a collapsed tree print
  // the same 0. A 0 here is a reader that stopped reading, not a game that
  // stopped having a creation screen.
  if (!files.length) {
    return { error: `${SCAN_DIR}/ under ${root} holds no .js files — that is a broken read, not a tree with no fold` };
  }
  const fold = []; const expand = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(root, f);
    const lineOf = (idx) => text.slice(0, idx).split('\n').length;
    for (const m of text.matchAll(CLASS_ATTR)) {
      if (hasFoldToken(m[2])) fold.push({ file: rel, line: lineOf(m.index), how: 'class attribute', text: m[0].slice(0, 60) });
    }
    for (const { re, what } of RUNTIME_FORMS) {
      for (const m of text.matchAll(re)) {
        if (hasFoldToken(m[2])) fold.push({ file: rel, line: lineOf(m.index), how: what, text: m[0].slice(0, 60) });
      }
    }
    for (const { re, what } of EXPAND_FORMS) {
      for (const m of text.matchAll(re)) {
        expand.push({ file: rel, line: lineOf(m.index), how: what, text: m[0].slice(0, 48) });
      }
    }
  }
  const files1 = [...new Set(fold.map((s) => s.file))].sort();
  const files2 = [...new Set(expand.map((s) => s.file))].sort();
  return { files: files.length, fold, expand, foldFiles: files1, expandFiles: files2, foldCount: files1.length, expandCount: files2.length };
}

function gitShort(root) {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return '?'; }
}

// THE LINE — quotable verbatim into any gate report, carrying both numbers and
// the tree they were read at.
function sentinelLine(r, ref) {
  return `ONE-FOLD SENTINEL — disclosure-affordance renderers: ${r.foldCount} at ${ref} `
    + `(declared ${DECLARED_FOLD}); aria-expanded constructors: ${r.expandCount} (declared ${DECLARED_EXPAND}). `
    + `${r.foldCount === DECLARED_FOLD ? 'The fold is built in ONE place.' : 'THE FOLD HAS MORE THAN ONE HOME.'}`;
}

function run() {
  const r = scan(ROOT);
  const ref = gitShort(ROOT);
  if (r.error) {
    if (AS_JSON) console.log(JSON.stringify({ tool: 'tools/onefold.mjs', ref, error: r.error }, null, 1));
    else console.error(`onefold: ${r.error}\n  Unknown is never a pass (SOP 2's silence guard).`);
    return 2;
  }
  if (AS_JSON) {
    console.log(JSON.stringify({
      tool: 'tools/onefold.mjs', ref,
      declaredFold: DECLARED_FOLD, observedFold: r.foldCount, foldFiles: r.foldFiles, foldSites: r.fold,
      declaredExpand: DECLARED_EXPAND, observedExpand: r.expandCount, expandFiles: r.expandFiles, expandSites: r.expand,
      line: sentinelLine(r, ref), cite: CITE,
    }, null, 1));
    return (r.foldCount === DECLARED_FOLD && r.expandCount === DECLARED_EXPAND) ? 0 : 1;
  }

  console.log(`\n${sentinelLine(r, ref)}\n`);
  console.log(`  scanned ${r.files} .js file(s) under ${SCAN_DIR}/`);
  console.log(`\n  FOLD — constructs the disclosure affordance's markup (${r.fold.length} site(s) in ${r.foldCount} file(s)):`);
  for (const f of r.foldFiles) {
    console.log(`    ${f}`);
    for (const s of r.fold.filter((x) => x.file === f)) {
      console.log(`      :${String(s.line).padEnd(5)} ${s.how.padEnd(18)} ${s.text.replace(/\s+/g, ' ')}`);
    }
  }
  console.log(`\n  EXPAND — constructs an aria-expanded state (${r.expand.length} site(s) in ${r.expandCount} file(s)):`);
  for (const f of r.expandFiles) {
    const mine = r.expand.filter((x) => x.file === f);
    console.log(`    ${f}  (${mine.length} site(s), lines ${mine.map((s) => s.line).join(', ')})`);
  }
  console.log(`\n  TRACKED  ${CITE}`);
  console.log('\n  PREDICATE — and the sentence above is exactly this and no wider:');
  console.log('   · FOLD counts FILES that CONSTRUCT a class token of {disc-face, disc-faces,');
  console.log('     disc-reveal}. Querying or styling one is not construction; `cz-disc` is a');
  console.log('     different token; a comment naming the class is prose.');
  console.log('   · EXPAND counts FILES that CONSTRUCT an aria-expanded state, by markup');
  console.log('     attribute, setAttribute or the IDL property.');
  console.log('\n  BOUNDARY — what these numbers do NOT say:');
  console.log('   · a fold with neither vocabulary is invisible here. A bare <details>, a hidden');
  console.log('     flag, a CSS-only rotate. This tree ships two <details> on the creation screen');
  console.log('     alone and they are deliberately uncounted: the platform\'s widget, not a renderer.');
  console.log('   · it is a CONSISTENCY count, not a correctness one. One file could build two');
  console.log('     different folds and still read as 1.');
  console.log('   · src/ only. dist/ is verify-shipped\'s subject.');

  const okFold = r.foldCount === DECLARED_FOLD;
  const okExpand = r.expandCount === DECLARED_EXPAND;
  if (okFold && okExpand) {
    console.log(`\n  exit 0 — fold ${r.foldCount} == ${DECLARED_FOLD}, expanders ${r.expandCount} == ${DECLARED_EXPAND}: counted, and said out loud.`);
    return 0;
  }
  if (!okFold) {
    console.log(`\n  FAIL the fold is built in ${r.foldCount} file(s), declared ${DECLARED_FOLD}`);
    console.log(r.foldCount > DECLARED_FOLD
      ? '    A SECOND FOLD RENDERER. This is the debt TR1 is open on, arriving here. The fix is\n'
        + '    to extend components/disclosure.js, not to keep the copy — a copy that agrees today\n'
        + '    is the shape that cost this house three trains.'
      : '    THE FOLD LOST ITS HOME. A drop is not good news that needs no line: either the\n'
        + '    affordance was deleted or this reader stopped reading. Neither is green.');
  }
  if (!okExpand) {
    console.log(`\n  FAIL aria-expanded is constructed in ${r.expandCount} file(s), declared ${DECLARED_EXPAND}`);
    console.log('    An expander was born or died without a line in the declaration. It may be');
    console.log('    entirely correct — update the number and say which one, in the commit that');
    console.log('    moved it. A tracked count that moves in silence is the thing being prevented.');
  }
  return 1;
}

// ---------------------------------------------------------------------------
// THE KNOWN-BAD CORPUS. Every plant enters as FILE BYTES in a copy of this real
// tree, and this whole tool is re-run from that copy (tools/doorplant.mjs).
// ---------------------------------------------------------------------------
const PLANTS = [
  {
    name: 'a second fold renderer, copied verbatim',
    file: 'src/ui/screens/customize.js',
    append: `
// planted: the fold, built again on the screen instead of extended in the
// component — Saga's warning made real.
export function mountPickerFold(host, label) {
  host.innerHTML = '<div class="disc-faces"></div><div class="disc-reveal" hidden></div>';
  const b = document.createElement('button');
  b.className = 'disc-face disc-pick';
  b.textContent = label;
  host.querySelector('.disc-faces').appendChild(b);
}`,
    expectRed: /FAIL the fold is built in 2 file\(s\), declared 1/,
  },
  {
    name: 'a second fold under a fresh vocabulary (the hole the EXPAND axis is for)',
    file: 'src/ui/screens/customize.js',
    append: `
// planted: a fold that keeps none of the disclosure vocabulary. Predicate A is
// blind to it by construction; the aria-expanded census is not.
export function mountQuietFold(host, label) {
  const b = document.createElement('button');
  b.className = 'quiet-fold';
  b.setAttribute('aria-expanded', 'false');
  b.textContent = label;
  host.appendChild(b);
}`,
    expectRed: /FAIL aria-expanded is constructed in 4 file\(s\), declared 3/,
  },
  {
    // WRITTEN TWICE, AND THE FIRST ONE IS THE LESSON. My first version of this
    // plant deleted the `host.innerHTML = '<div class="disc-faces">…'` line
    // alone and the tool STAYED GREEN AT 1 — the two `className = 'disc-face…'`
    // sites in the same file still counted it. The plant was wrong, not the
    // check, and I only know that because the harness said NOT CAUGHT out loud.
    // A drop is a WHOLE-FILE event; nothing smaller can produce one.
    name: 'the vocabulary renamed out from under the stylesheet — a 0 must not read as green',
    file: 'src/ui/components/disclosure.js',
    find: 'disc-',
    replace: 'fold-',
    all: true,
    expectRed: /FAIL the fold is built in 0 file\(s\), declared 1|THE FOLD LOST ITS HOME/,
  },
];

async function selftest() {
  const { doorSelftest } = await import(join(HERE, 'tools/doorplant.mjs'));
  const code = await doorSelftest({ tool: 'onefold.mjs', plants: PLANTS, timeoutMs: 60000 });

  // THE REFERENT GUARD, THROUGH THE REAL CLI. Not a fixture handed to scan():
  // the tool is spawned exactly as a person spawns it, at a root with no src/,
  // and must exit 2 rather than print a comfortable 0.
  console.log('\n  referent guard: `node tools/onefold.mjs --root <a tree with no src/>` through the CLI');
  const r = spawnSync(process.execPath, [join(HERE, 'tools/onefold.mjs'), '--root', join(HERE, 'docs')],
    { encoding: 'utf8', timeout: 60000 });
  const guarded = r.status === 2 && /broken read|cannot read/.test(`${r.stdout}${r.stderr}`);
  console.log(guarded
    ? `  CAUGHT  an unreadable tree exits 2, not 0 — "${`${r.stdout}${r.stderr}`.trim().split('\n')[0].slice(0, 110)}"`
    : `  NOT CAUGHT  exit ${r.status} on a tree with no src/ — a 0 here would be a fold that vanished, read as green`);

  console.log(`\nonefold --selftest: ${code === 0 && guarded ? 'held' : 'FAILED'} — `
    + `${PLANTS.length} same-door plant(s) + the referent guard.`);
  console.log('  BOUNDARY: the plants cover a copied renderer, a renamed one, and a deleted one.');
  console.log('  NOT covered by any plant, and it cannot be: a fold built with neither the class');
  console.log('  vocabulary nor aria-expanded. That is stated as the predicate\'s hole above rather');
  console.log('  than planted, because no known-bad can make a check fire on a thing its predicate');
  console.log('  does not mention (Vira, commons/development.md, 2026-08-15).');
  process.exit(code === 0 && guarded ? 0 : 1);
}

if (args.includes('--selftest')) await selftest();
else process.exit(run());
