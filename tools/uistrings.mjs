#!/usr/bin/env node
// tools/uistrings.mjs — THE COPY RATCHET. How many sentences does the
// interface still keep in its code rather than in its table, and where?
//
// WHY. The 2026-09-11 content review counted the interface's copy and found it
// scattered: literals in 64 files under src/ui, hundreds of them distinct, with
// the same thing said two ways in two screens ("storage is full" beside
// "Storage full") and no way to reword the game without a code change. The
// answer is content/source/uiStrings.csv (the table) plus src/ui/strings.js
// (the lookup). The answer is not a weekend: migrating every screen at once is
// one enormous diff over surfaces only a browser can check.
//
// So this is the instrument that makes the migration a ONE-WAY street. It
// counts the copy sites left in code, per file, against tools/uistrings-
// baseline.json, and --check fails in BOTH directions:
//   · a file that GREW invented copy in code instead of asking the table — the
//     regression this exists to stop;
//   · a file that SHRANK and did not record it — an overstated baseline hides
//     the next regression inside its slack (tools/plantsites.mjs's rule, and
//     the reason that tool is the shape this one copies).
//
// WHAT COUNTS AS A COPY SITE, stated so a reader can argue with it rather than
// guess: a string literal that a human will READ, in one of the positions this
// codebase puts read-able text:
//   · a value for one of the copy keys (label:, title:, eyebrow:, note:, …)
//   · an assignment to .textContent / .innerText
//   · setAttribute('aria-label' | 'title' | 'placeholder', '…')
//   · an 'aria-label': '…' pair inside an attrs object
// and that LOOKS like prose rather than machinery: it has a letter, is longer
// than two characters, and is not a bare identifier (`small`), a selector
// (`.card`), a URL, or a camelCase token (`rewardCollect`). Template literals
// are deliberately NOT counted: an interpolated string is a sentence and an
// expression at once, and a count that includes them would move whenever the
// expression moved. They are copy too — the baseline's `note` says so rather
// than letting the number imply the work is smaller than it is.
//
//   node tools/uistrings.mjs                 the census, worst files first
//   node tools/uistrings.mjs --check         verify against the baseline; exit 1 on ANY difference
//   node tools/uistrings.mjs --write-baseline rewrite the baseline from the tree
//   node tools/uistrings.mjs --selftest      plant a new literal and a removed one; both must be CAUGHT
//
// BOUNDARY. A green here does NOT mean the migrated screens read well, that
// the table's ids are reachable, or that a string in the table is the one a
// screen shows. It counts literals in positions. The table's own rules —
// unknown id, missing form, unresolved token, extends cycles — are
// tests/ui-strings.test.mjs, and what a screen actually paints is the browser
// gates.
//
// REMOVAL: deleted the day the census is zero and no position can carry a
// literal again — not the day the number merely looks small.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { readdirSortedSync } from './dirorder.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASELINE = resolve(ROOT, 'tools/uistrings-baseline.json');

// The positions. Each is a regex over the file text with the literal in group 1.
const COPY_KEYS = [
  'label', 'title', 'eyebrow', 'note', 'text', 'question', 'confirmLabel',
  'cancelLabel', 'placeholder', 'alt', 'ariaLabel', 'message', 'hint',
  'heading', 'caption', 'body',
];
function positions() {
  const out = [];
  for (const key of COPY_KEYS) {
    out.push(new RegExp(`\\b${key}\\s*:\\s*'([^'\\\\]*)'`, 'g'));
    out.push(new RegExp(`\\b${key}\\s*:\\s*"([^"\\\\]*)"`, 'g'));
  }
  out.push(/\.(?:textContent|innerText)\s*=\s*'([^'\\]*)'/g);
  out.push(/\.(?:textContent|innerText)\s*=\s*"([^"\\]*)"/g);
  out.push(/setAttribute\(\s*'(?:aria-label|title|placeholder)'\s*,\s*'([^'\\]*)'\s*\)/g);
  out.push(/'aria-label'\s*:\s*'([^'\\]*)'/g);
  return out;
}

/** Prose a player reads, as opposed to machinery that happens to be a string. */
export function isCopy(s) {
  if (!/[A-Za-z]/.test(s) || s.length <= 2) return false;
  if (/^[a-z0-9-]+$/.test(s)) return false;              // bare token: 'small', 'aria-live'
  if (/^[.#[]/.test(s)) return false;                    // selector
  if (/^https?:/.test(s)) return false;                  // url
  if (/^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(s)) return false; // camelCase key
  return true;
}

/** Every .js file under src/ui, repo-relative, in a stable order. */
function uiFiles(root = ROOT) {
  const base = join(root, 'src/ui');
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSortedSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.js')) found.push(relative(root, full));
    }
  })(base);
  return found;
}

/** census(root) → { files: { path: count }, sites, distinct } */
export function census(root = ROOT) {
  const files = {};
  const distinct = new Set();
  let sites = 0;
  for (const file of uiFiles(root)) {
    const src = readFileSync(join(root, file), 'utf8');
    let count = 0;
    for (const re of positions()) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        if (!isCopy(m[1])) continue;
        count += 1;
        distinct.add(m[1]);
      }
    }
    if (count) files[file] = count;
  }
  for (const n of Object.values(files)) sites += n;
  return { files, sites, distinct: distinct.size };
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null;
  return JSON.parse(readFileSync(BASELINE, 'utf8'));
}

function writeBaseline(now) {
  const prev = loadBaseline();
  const doc = {
    _: 'DERIVED from the tree by tools/uistrings.mjs --write-baseline. The copy still held in code, per file. It may only go DOWN, and every step down is recorded here in the same commit that takes it.',
    note: 'Template literals are not counted — an interpolated sentence moves whenever its expression does. They are copy too, and they are not in this number.',
    migrated: prev?.migrated || [],
    sites: now.sites,
    distinct: now.distinct,
    files: Object.fromEntries(Object.entries(now.files).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))),
  };
  writeFileSync(BASELINE, `${JSON.stringify(doc, null, 2)}\n`);
  return doc;
}

/** diff(baseline, now) → [{ file, was, is, verdict }] — both directions. */
export function diff(baseline, now) {
  const out = [];
  const paths = new Set([...Object.keys(baseline.files), ...Object.keys(now.files)]);
  for (const file of [...paths].sort()) {
    const was = baseline.files[file] || 0;
    const is = now.files[file] || 0;
    if (was === is) continue;
    out.push({ file, was, is, verdict: is > was ? 'GREW' : 'SHRANK — record it' });
  }
  return out;
}

function report(now, baseline) {
  const rows = Object.entries(now.files).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  console.log(`uistrings: ${now.sites} copy site(s) still in code across ${rows.length} file(s); ${now.distinct} distinct string(s).`);
  if (baseline?.migrated?.length) console.log(`  migrated to content/source/uiStrings.csv: ${baseline.migrated.join(', ')}`);
  for (const [file, n] of rows.slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${file}`);
  if (rows.length > 15) console.log(`  … and ${rows.length - 15} more file(s); the baseline holds them all.`);
}

// ---- selftest: the corpus nobody has watched go red is unknown --------------
function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'uistrings-'));
  const root = join(dir, 'tree');
  cpSync(join(ROOT, 'src'), join(root, 'src'), { recursive: true });
  const before = census(root);
  let passed = 0;
  let failed = 0;
  const ok = (cond, what) => { if (cond) { passed += 1; console.log(`  PASS  ${what}`); } else { failed += 1; console.log(`  FAIL  ${what}`); } };

  // A new hardcoded label appears in a screen — the regression this stops.
  const victim = join(root, 'src/ui/screens/reward.js');
  const original = readFileSync(victim, 'utf8');
  writeFileSync(victim, `${original}\nconst planted = { label: 'A sentence nobody put in the table' };\n`);
  const grew = census(root);
  const grewRows = diff(before, grew);
  ok(grewRows.length === 1 && grewRows[0].verdict === 'GREW' && grewRows[0].is === grewRows[0].was + 1,
    `a planted hardcoded label is CAUGHT by name (${grewRows[0]?.file || 'nothing caught'})`);

  // A literal is migrated and the baseline is not updated — also caught. The
  // planted tree is the baseline and the real tree is what shipped, which is
  // exactly the shape of a migration nobody recorded.
  writeFileSync(victim, original);
  const shrankRows = diff({ files: grew.files }, census(root));
  ok(shrankRows.length === 1 && shrankRows[0].verdict.startsWith('SHRANK'),
    `an unrecorded migration is CAUGHT (${shrankRows[0]?.file || 'nothing caught'})`);

  // And the reading itself: machinery must not be counted as prose.
  ok(!isCopy('small') && !isCopy('.card') && !isCopy('rewardCollect') && !isCopy('https://x.y') && isCopy('Take the card'),
    'the prose test admits a sentence and refuses a token, a selector, a camelCase key and a URL');

  rmSync(dir, { recursive: true, force: true });
  console.log(`\nuistrings --selftest: ${failed ? `RED — ${passed} passed, ${failed} failed` : `OK — ${passed} checks passed`}`);
  return failed ? 1 : 0;
}

// ---- main -------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.includes('--selftest')) {
  process.exit(selftest());
} else if (argv.includes('--write-baseline')) {
  const doc = writeBaseline(census());
  console.log(`uistrings: baseline written — ${doc.sites} site(s), ${Object.keys(doc.files).length} file(s).`);
} else {
  const now = census();
  const baseline = loadBaseline();
  if (argv.includes('--check')) {
    if (!baseline) { console.error('uistrings: no baseline — run --write-baseline first.'); process.exit(1); }
    const rows = diff(baseline, now);
    report(now, baseline);
    if (!rows.length) { console.log('uistrings: OK — every file matches the baseline.'); process.exit(0); }
    console.log('');
    for (const row of rows) console.log(`  ${row.verdict}  ${row.file}: baseline ${row.was}, tree ${row.is}`);
    console.log(`\nuistrings: RED — ${rows.length} file(s) differ from the baseline.`);
    console.log('  A file that GREW put a sentence in code that belongs in content/source/uiStrings.csv.');
    console.log('  A file that SHRANK did the right thing and owes `node tools/uistrings.mjs --write-baseline` in the same commit.');
    process.exit(1);
  }
  report(now, baseline);
}
