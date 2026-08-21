#!/usr/bin/env node
// tools/testnumbers.mjs — NO TWO TESTS WEAR THE SAME NUMBER.
//
// Bjorn Falk, 2026-08-21.
//
// WHY IT EXISTS, and it is a measurement of me rather than a theory.
//
// The suite's numbers are hand-allocated across TWO files with nothing checking
// them, and `tests/run-node.mjs` has carried a warning about exactly that since
// test 36 was written:
//
//   > "Numbered 36/37, not 35/36: dev's test 35 is Sunna's accessibility-defaults
//   >  test in engine.test.js. Two files, no git conflict, and a suite that would
//   >  have printed '35.' twice — the collision a merge cannot see."
//
// Wiring one instrument in, I collided with that hazard TWICE in ten minutes —
// 58/59, then 60/61 — one screen below the warning. I then "fixed" it by
// deriving from the highest literal in the other file, which prevents NEW
// collisions and is blind to EXISTING ones. Vira found the existing one by
// reading the suite's own output:
//
//   PASS  50. five-stat creation vocabulary and class presets come from one …
//   PASS  50. the status-reach check still catches its own known-bad corpus
//
// TWO TESTS NUMBERED 50 ON dev. A reader who greps a run for "50." gets two
// answers; a reviewer told "50 is red" cannot tell which suite half to open.
//
// WHAT IT CHECKS
//   T1 NO DUPLICATE LABEL — no number is declared in more than one place,
//      whether the collision is across the two homes or inside one of them.
//   T2 EVERY DECLARED HOME WAS READ, AND ITS PATTERN STILL MATCHES — a home
//      that vanishes, or an emission pattern that has rotted so it matches
//      nothing, is exit 2 (`unknown`, which blocks). NOT "zero tests, all
//      unique, green" — that is the silence this file exists to refuse.
//
// THE DOOR, AND ITS HONEST NAME. This reads the two test SOURCES and derives
// the labels each one emits. **It is a consistency check, not a correctness
// check** — it proves the declared labels do not collide, never that a label is
// the right one, and a number COMPOSED at runtime would be invisible to it.
// Because that distinction is where my checks usually go wrong, the derivation
// was measured against the artifact rather than assumed: at dev = 3a08a3d it
// derives 92 labels and the suite PRINTS 92, with zero in either direction —
//
//   node tests/run-node.mjs | grep -oE '^(PASS|FAIL|SKIP)  [0-9]+[a-z]*\.'
//
// That is one ref, not a proof for all time; it is why T2 refuses rather than
// reporting a shrunken census when a pattern stops matching.
//
// THE POPULATION IS DECLARED AND A NEW HOME IS INVISIBLE. Only the two files
// below are read. A third test file would carry numbers nothing here sees —
// named, not fixed, because guessing at "any file under tests/" would make the
// emission patterns guesses too.
//
// KNOWN-BAD FIRST (development.md, *The instrument rule*), AND WHY NOT
// doorplant.mjs. That harness requires the UNPLANTED copy to come back green,
// and this tool's subject was RED when it was written — so its clean edge would
// have failed for the tree's state rather than the corpus's. The harness below
// keeps the same door (file bytes in a copied real tree, the tool run whole from
// the copy) and adds the edge doorplant cannot express: a plant that must go
// GREEN, without which a tool that simply always reds passes every other plant.
//
// ⚠ THE COLLISION IS FIXED IN THE COMMIT AFTER THIS TOOL'S, so the baseline is
// now genuinely green and the corpus keeps dev's real defect as a PLANT rather
// than manufacturing its absence. That restructure was not my initiative: the
// renumber moved the old plants' anchor, all five reported PLANT SITE DRIFTED,
// and the wired test went red — a corpus refusing to run rather than quietly
// passing. Read the note above PLANTS before editing any anchor here.
//
// Usage:
//   node tools/testnumbers.mjs            the verdict
//   node tools/testnumbers.mjs --raw      every label and where it is declared
//   node tools/testnumbers.mjs --selftest the same-door known-bad corpus
// Exit: 0 no duplicates · 1 a duplicate · 2 a home could not be read (unknown)
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the suite stops
// hand-numbering its tests — if the number is derived from position, there is
// no second home to disagree with. Also WRONG, AND REWRITTEN, the first time
// two tests print the same number and this says OK: then the source was never
// where the label was decided.

import { readFileSync, existsSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);

// THE DECLARED HOMES, each with the shape IT uses to emit a label. The two
// files genuinely emit differently — engine.test.js names its test in the
// `test(...)` call, run-node.mjs interpolates a verdict and then the number —
// so one clever universal regex would be a guess about both. Two named patterns
// are a fact about each.
const HOMES = [
  { path: 'tests/engine.test.js', how: "test('<n>. …')", re: /\btest\(\s*['"`](\d+[a-z]*)\.\s/g },
  { path: 'tests/run-node.mjs', how: '`${verdict}  <n>. …`', re: /\}\s\s(\d+[a-z]*)\.\s/g },
];

// THE SECOND DERIVATION OF THE SAME FACT, and it is what makes T2 mean anything.
// The per-home patterns above are CALL-ANCHORED: they find a label by the code
// that emits it. This one is LABEL-ANCHORED: it finds the same labels by their
// own shape — a number and a dot opening a string, or following the two spaces
// run-node puts after its verdict — and knows nothing about `test(`.
//
// ⚠ IT EXISTS BECAUSE THE FIRST VERSION OF T2 ONLY FIRED AT ZERO. The rot plant
// renamed `test(` to `spec(`, the call-anchored pattern fell from 73 labels to
// TWO, and this tool printed "OK — 21 test labels, all unique" and exited 0. A
// census that SHRANK read as clean — the exact class this file exists to refuse,
// committed inside the file. Found by the corpus, not by me.
//
// Equality between two derivations needs no baseline and no threshold, which is
// why it is this and not "at least N labels": a frozen count would be a second
// home for a fact, which is the defect one level up.
const LABEL_SHAPED = /(?:['"`]|\}\s{2})(\d+[a-z]*)\.\s/g;

// Comments stripped before either derivation: a `test(` or a "50. " inside a
// comment is documentation, and counting it would make both numbers wrong in
// the same direction, which is the worst way for a cross-check to agree.
function stripComments(src) {
  let out = '', q = null, i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) { out += c; if (c === q && src[i - 1] !== '\\') q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

function collect(root) {
  const labels = [];
  const problems = [];
  for (const home of HOMES) {
    const abs = join(root, home.path);
    if (!existsSync(abs)) { problems.push(`declared home ${home.path} DOES NOT EXIST — the census cannot be taken`); continue; }
    let text;
    try { text = readFileSync(abs, 'utf8'); } catch (e) { problems.push(`declared home ${home.path} could not be read: ${e.message}`); continue; }
    const clean = stripComments(text);
    const found = [...clean.matchAll(new RegExp(home.re.source, 'g'))].map((m) => m[1]);
    const shaped = [...clean.matchAll(new RegExp(LABEL_SHAPED.source, 'g'))].map((m) => m[1]);
    if (!found.length) {
      problems.push(`${home.path}: its emission pattern ${home.how} matched NOTHING — the pattern has rotted or the file changed shape. `
        + 'Zero labels is UNKNOWN, never "all unique"');
      continue;
    }
    if (found.length !== shaped.length) {
      problems.push(`${home.path}: the two derivations DISAGREE — ${found.length} label(s) by the emission pattern ${home.how}, `
        + `${shaped.length} by label shape. One of them has rotted, so this home's census is UNKNOWN. `
        + 'A census that shrank is not a census that is clean');
      continue;
    }
    for (const n of found) labels.push({ n, home: home.path });
  }
  return { labels, problems };
}

// ── the same-door corpus ────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  // ⚠ THE CORPUS WAS RESTRUCTURED WHEN THE DEFECT WAS FIXED, AND THE HARNESS
  // DEMANDED IT. Every plant used to carry an ABSENCE edit that removed dev's
  // real "50." collision first, because the tree was red and the green edge had
  // to be manufactured. The commit that renumbered run-node's label to 29 moved
  // that edit's anchor, all five plants reported PLANT SITE DRIFTED, and test 64
  // went red — which is a corpus refusing to run rather than quietly passing,
  // and is the behaviour worth having.
  //
  // Now the tree is clean, so the shape inverts and improves: the UNPLANTED copy
  // is the green edge (no manufacturing), and the collision this card was opened
  // for is kept as a PLANT — the real historical defect, re-runnable forever.
  const PLANTS = [
    { name: 'BASELINE — the unplanted copy must go GREEN, not merely quieter',
      edits: [], want: 'green' },
    { name: 'the real dev collision, re-planted: run-node takes back the 50 that engine.test.js owns',
      edits: [{ file: 'tests/run-node.mjs', find: '}  29. the status-reach', replace: '}  50. the status-reach' }],
      want: 'red', match: /BAD\s+T1 .*engine\.test\.js \+ tests\/run-node\.mjs/ },
    { name: 'a duplicate INSIDE one home, not across the two',
      edits: [{ file: 'tests/run-node.mjs', find: '}  52. the closed-set', replace: '}  51. the closed-set' }],
      want: 'red', match: /BAD\s+T1 / },
    // ⚠ A PARTIAL ROT, AND THAT IS BETTER THAN THE TOTAL ONE I AIMED FOR.
    // `  test('` does not match every call — some are indented differently — so
    // the emission pattern falls from 73 labels to TWO rather than to zero. The
    // first T2 only fired at ZERO and printed "OK — 21 test labels, all unique",
    // exit 0: a census that SHRANK, read as clean, inside the file written to
    // refuse exactly that. The corpus found it, not me. The expected red is the
    // DISAGREEMENT between two derivations, which is what actually knows.
    { name: "a home's emission pattern partially rots — 73 labels become 2, and a shrunken census is not a clean one",
      edits: [{ file: 'tests/engine.test.js', find: "  test('", replace: "  spec('", all: true }],
      want: 'unknown', match: /derivations DISAGREE/ },
    { name: 'a declared home stops existing',
      edits: [{ file: 'tests/run-node.mjs', drop: true }], want: 'unknown', match: /DOES NOT EXIST/ },
  ];

  console.log(`testnumbers --selftest — same-door corpus (${PLANTS.length} plants)`);
  console.log('DOOR: each plant is FILE BYTES in a copied real tree; the tool runs WHOLE from that copy.');
  console.log('      The BASELINE plant is the unplanted copy and it must go GREEN — the edge everyone');
  console.log('      skips, and without it a tool that simply always reds passes every other plant.');
  const dir = mkdtempSync(join(tmpdir(), 'testnumbers-selftest-'));
  let failed = 0;
  try {
    cpSync(join(ROOT, 'tests'), join(dir, 'tests'), { recursive: true });
    cpSync(join(ROOT, 'tools'), join(dir, 'tools'), { recursive: true, filter: (s) => !/tools[\\/](results|shots)([\\/]|$)/.test(s) });
    const pristine = new Map();
    for (const h of HOMES) pristine.set(h.path, readFileSync(join(dir, h.path), 'utf8'));

    for (const p of PLANTS) {
      let drifted = null;
      for (const e of p.edits) {
        const target = join(dir, e.file);
        if (e.drop) { rmSync(target, { force: true }); continue; }
        const bytes = readFileSync(target, 'utf8');
        if (!bytes.includes(e.find)) { drifted = `${e.file} no longer contains ${JSON.stringify(e.find)}`; break; }
        writeFileSync(target, e.all ? bytes.split(e.find).join(e.replace) : bytes.replace(e.find, e.replace));
      }
      const restore = () => { for (const [rel, bytes] of pristine) writeFileSync(join(dir, rel), bytes); };
      if (drifted) { restore(); failed++; console.error(`  RED  plant "${p.name}": PLANT SITE DRIFTED — ${drifted}. A corpus that silently stops running is the defect.`); continue; }
      const r = spawnSync(process.execPath, [join(dir, 'tools', 'testnumbers.mjs')], { encoding: 'utf8' });
      restore();
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      const wantCode = p.want === 'green' ? 0 : p.want === 'red' ? 1 : 2;
      const codeOk = r.status === wantCode;
      const matchOk = !p.match || p.match.test(out);
      if (codeOk && matchOk) {
        const line = out.split('\n').find((l) => (p.match || /RESULT/).test(l)) || out.split('\n').find((l) => /RESULT/.test(l)) || '';
        console.log(`  ${p.want === 'green' ? 'GREEN ' : p.want === 'red' ? 'CAUGHT' : 'UNKNWN'}  "${p.name}" — exit ${r.status}; ${line.trim().slice(0, 120)}`);
      } else {
        failed++;
        console.error(`  MISS  "${p.name}" — wanted exit ${wantCode}${p.match ? ` and /${p.match.source}/` : ''}, got exit ${r.status}${matchOk ? '' : ' and no match'}`);
        console.error(`    tail: ${out.trim().split('\n').slice(-4).join('\n    ')}`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(failed
    ? `RESULT: SELFTEST RED — ${failed} plant(s) failed.`
    : `RESULT: known-bad recall ${PLANTS.length}/${PLANTS.length} — ${PLANTS.length} plants including one that must go GREEN, each entering as file bytes in a copied real tree.`);
  process.exit(failed ? 1 : 0);
}

// ── the verdict ─────────────────────────────────────────────────────────────
const { labels, problems } = collect(ROOT);
console.log('testnumbers — no two tests wear the same number');
console.log(`DOOR: the declared test sources are parsed for the label each one EMITS. Homes: ${HOMES.map((h) => `${h.path} (${h.how})`).join(' · ')}`);
console.log('      A CONSISTENCY check, not a correctness one: it proves the declared labels do not');
console.log('      collide, never that any label is the right one.');
console.log('');

if (problems.length) {
  for (const p of problems) console.log(`  BAD  T2 — ${p}`);
  console.log('');
  console.log(`RESULT: UNKNOWN — ${problems.length} declared home(s) could not be read, so no census was taken.`);
  console.log('BOUNDARY: exit 2 is `unknown`, which blocks. It is NOT a verdict about duplicates.');
  process.exit(2);
}

const byLabel = new Map();
for (const { n, home } of labels) {
  if (!byLabel.has(n)) byLabel.set(n, []);
  byLabel.get(n).push(home);
}
const dupes = [...byLabel.entries()].filter(([, homes]) => homes.length > 1);

console.log(`  ok   T2 — all ${HOMES.length} declared homes read; every emission pattern still matches `
  + `(${HOMES.map((h) => `${h.path.replace('tests/', '')} ${labels.filter((l) => l.home === h.path).length}`).join(', ')})`);

if (dupes.length) {
  console.log(`  BAD  T1 — ${dupes.length} number(s) worn by more than one test: `
    + dupes.map(([n, homes]) => `"${n}." in ${homes.join(' + ')}`).join(' · '));
} else {
  console.log(`  ok   T1 — all ${labels.length} declared test labels are unique`);
}

if (process.argv.includes('--raw')) {
  console.log('');
  for (const [n, homes] of [...byLabel.entries()].sort((a, b) => (parseInt(a[0], 10) - parseInt(b[0], 10)) || a[0].localeCompare(b[0]))) {
    console.log(`  ${homes.length > 1 ? 'DUPE' : '    '}  ${String(n).padStart(4)}.  ${homes.join(' + ')}`);
  }
}

// REPORTED, NOT ASSERTED. A gap is not a defect — a deleted test leaves one, and
// nothing says the sequence must be dense. It is printed because the next hand
// allocating a number wants it, and because a number typed beside the list that
// owns it is what this whole file is about.
const plain = [...byLabel.keys()].filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i <= plain[plain.length - 1]; i++) if (!byLabel.has(String(i))) gaps.push(i);
console.log('');
console.log(`⚠ REPORTED, NOT ASSERTED — ${labels.length} labels, highest ${plain[plain.length - 1]}, `
  + `${gaps.length} gap(s)${gaps.length ? `: ${gaps.join(', ')}` : ''}. A gap is not a defect; the next free number is `
  + `${plain[plain.length - 1] + 1} unless a gap is deliberately reused.`);
console.log('');

if (dupes.length) {
  console.log(`RESULT: ${dupes.length} duplicate test number(s) over ${labels.length} label(s).`);
  console.log('BOUNDARY: reads the two declared sources only. A third test file, or a number COMPOSED');
  console.log('          at runtime, is invisible here — and this proves labels do not collide, never');
  console.log('          that a label is correct.');
  process.exit(1);
}
console.log(`RESULT: OK — ${labels.length} test labels, all unique across ${HOMES.length} homes.`);
console.log('BOUNDARY: reads the two declared sources only. A third test file, or a number COMPOSED');
console.log('          at runtime, is invisible here — and this proves labels do not collide, never');
console.log('          that a label is correct.');
process.exit(0);
