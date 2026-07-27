#!/usr/bin/env node
// tools/zoomunits.mjs — one coordinate space, one home.
//
// The whole UI is scaled by `--ui-zoom` (styles/base.css:77 `body { zoom: ... }`,
// set in main.js applyUiScale). That makes two pixel units live in this codebase:
//
//   VISUAL px — what getBoundingClientRect() and pointer events report.
//   LOCAL  px — what an inline `style.left/top/width/height` is interpreted in.
//
// They differ by exactly the zoom factor, and the conversion between them has ONE
// home: `anchorLocalBox()` in src/ui/fx.js. This check finds every place a VISUAL
// value reaches a LOCAL px write without going through it.
//
// THE PREMISE IS MEASURED, NOT ASSUMED. tests/fixtures/zoomunits/two-spaces-probe.html
// writes 100 local px into a fixed, an absolute and a layer child under zoom 1.5
// and asks the browser where each landed. All three land at 150, and reading a
// rect then writing it straight back drifts 150 -> 225. Re-run:
//
//   /opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu \
//     --no-sandbox --virtual-time-budget=2000 --dump-dom \
//     file://$PWD/tests/fixtures/zoomunits/two-spaces-probe.html
//
// That matters because `position: fixed` looks like it should escape an ancestor's
// zoom, and if it did, half the findings below would be false positives. It does
// not escape it. I checked before I believed it.
//
// WHAT THIS PROVES, AND WHAT IT DOES NOT.
// This is a CONSISTENCY check, not a CORRECTNESS check. It proves a second copy of
// fx.js's transform exists and differs from it. It cannot tell you whether any
// given site renders visibly wrong — that needs a browser at a real zoom, and it
// says so on every run, including the clean ones.
//
// Why it exists: at 40c5b21 five call sites used anchorLocalBox and one file
// open-coded it. That one file was the first-run tutorial, and the mispositioned
// callout locked a new player out of their first fight (fixed in 3a0def9, Rune).
// One fact, one home, one deviant — so the check is a detector plus the known-bad
// corpus that proves it (development.md SOP 3), not a line in a review checklist.
//
// Usage
//   node tools/zoomunits.mjs [<path> ...]   scan files/dirs (default: src/)
//   node tools/zoomunits.mjs --selftest     run the known-bad/known-good corpus
//
// Exit codes
//   0  clean — no unconverted write, every file read
//   1  at least one finding, OR a corpus miss under --selftest
//   2  usage error
//
// REMOVAL CONDITION (development.md SOP 1's corollary). Delete this file, its
// fixtures and its wiring in tests/run-node.mjs when EITHER holds:
//   (a) `zoom:` is gone from styles/base.css and `--ui-zoom` from src/ — the two
//       spaces have collapsed into one and there is nothing left to convert; or
//   (b) `--selftest` reports known-bad recall below 2/2 OR known-good cleared
//       below 3/3, and it cannot be restored by fixing the check. A detector whose
//       own corpus escapes it is decoration; delete the check, not the fixtures.
//       Both numbers move with the SELFTEST table below — if you add a fixture,
//       update this line in the same commit or the condition stops being
//       evaluable, which is the same as not having one.
// It is NOT removed merely because the repo goes clean — clean is the state it is
// for.
//
// — Bjorn Falk

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

// ---------------------------------------------------------------- the two spaces

// Producers of VISUAL pixels. Each is a documented browser API that answers in
// post-zoom coordinates.
const VISUAL_SOURCES = [
  /\.getBoundingClientRect\s*\(/,
  /\b(?:clientX|clientY)\b/,
  /\b(?:pageX|pageY)\b/,
  /\b(?:window\.)?(?:innerWidth|innerHeight)\b/,
];

// The single home of the conversion. A binding assigned from it is LOCAL already.
const CONVERTER = /\banchorLocalBox\s*\(/;

// A binding read out of the custom property is a zoom divisor; dividing by one is
// the conversion done by hand (see fixtures/good_divided_by_zoom.js).
const ZOOM_READ = /getPropertyValue\s*\(\s*['"`]--ui-zoom['"`]\s*\)/;

const DECL = /(?:^|[;{}\s])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]*)/g;
const ASSIGN = /(?:^|[;{}\s])([A-Za-z_$][\w$]*)\s*=\s*([^;]*)/g;
// A LOCAL px geometry write. `%` and bare numbers are not visual pixels.
// `(.*)` not `(.+)`: the value is allowed to be empty here, because it may begin
// on the NEXT line. Requiring a character after `=` is what made the first cut of
// this check miss pre-fix tutorial.js:54-55.
const WRITE = /([A-Za-z_$][\w$.()'"\[\]]*)\.style\.(left|top|width|height)\s*=\s*(.*)$/;

/**
 * Strip // and /* *\/ comments, keeping template literals (the write's value
 * expression lives inside one). Deliberately simple: `//` is only treated as a
 * comment when it is not part of `://`, which is enough for this tree and is a
 * named limitation rather than a silent one.
 */
function stripComments(src) {
  const out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return out
    .split('\n')
    .map((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '/' && line[i + 1] === '/' && line[i - 1] !== ':') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

function anySource(expr) {
  return VISUAL_SOURCES.some((re) => re.test(expr));
}

/**
 * scan(src) → { findings, stats }. Findings are 1-indexed line numbers with the
 * write and the reason it is a finding.
 */
export function scan(src) {
  const clean = stripComments(src);
  const lines = clean.split('\n');

  // 1. LOCAL bindings: assigned straight from the converter. Never tainted.
  const local = new Set();
  // 2. Zoom divisors, so a hand-rolled division can be recognised.
  const zoomVars = new Set();
  for (const m of clean.matchAll(DECL)) {
    const [, name, expr] = m;
    if (CONVERTER.test(expr)) local.add(name);
    if (ZOOM_READ.test(expr)) zoomVars.add(name);
  }

  // 3. VISUAL bindings, propagated to a fixpoint so taint survives a `let`
  //    reassignment (fixtures/bad_taint_through_let.js) and an intermediate.
  const visual = new Set();
  const decls = [...clean.matchAll(DECL), ...clean.matchAll(ASSIGN)].map((m) => [m[1], m[2]]);
  let grew = true;
  let passes = 0;
  while (grew && passes < 12) {
    grew = false;
    passes++;
    for (const [name, expr] of decls) {
      if (local.has(name) || visual.has(name)) continue;
      const divided = [...zoomVars].some((z) => new RegExp(`/\\s*\\(?\\s*${z}\\b`).test(expr));
      if (divided) continue;
      const referencesVisual = [...visual].some((v) => new RegExp(`\\b${v}\\b`).test(expr));
      if (anySource(expr) || referencesVisual) {
        visual.add(name);
        grew = true;
      }
    }
  }

  // 4. Every LOCAL px geometry write, graded.
  //    The value may sit on following lines — pre-fix tutorial.js:54-55 wrapped a
  //    ternary that way, and the first cut of this check missed it for exactly
  //    that reason. A statement, not a line, is the unit.
  const findings = [];
  let writes = 0;
  lines.forEach((line, idx) => {
    const m = WRITE.exec(line.trim());
    if (!m) return;
    const [, target, prop, rawValue] = m;
    let value = rawValue.replace(/;\s*$/, '');
    for (let j = idx + 1; !/;/.test(rawValue) && j < lines.length && j <= idx + 6; j++) {
      value += ` ${lines[j].trim()}`;
      if (/;/.test(lines[j])) break;
    }
    value = value.replace(/;.*$/, '');
    if (!/px/.test(value)) return; // % or a unitless ratio cannot carry the error
    writes++;

    const divided = [...zoomVars].some((z) => new RegExp(`/\\s*\\(?\\s*${z}\\b`).test(value));
    if (divided) return;

    const direct = anySource(value);
    const via = [...visual].filter((v) => new RegExp(`\\b${v}\\b`).test(value));
    if (!direct && !via.length) return;

    findings.push({
      line: idx + 1,
      text: line.trim(),
      write: `${target}.style.${prop}`,
      why: direct
        ? 'a visual-pixel API is read directly into the value'
        : `the value reads ${via.join(', ')}, bound from a visual-pixel API`,
    });
  });

  return { findings, stats: { writes, local: local.size, visual: visual.size } };
}

// ---------------------------------------------------------------- driving

function jsFiles(p) {
  const abs = resolve(p);
  const st = statSync(abs);
  if (st.isFile()) return extname(abs) === '.js' || extname(abs) === '.mjs' ? [abs] : [];
  return readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1)) // sorted: the order IS part of the output
    .flatMap((e) => jsFiles(resolve(abs, e.name)));
}

function boundary(scanned, skipped) {
  console.log('BOUNDARY: consistency check, not correctness — it proves a second copy of');
  console.log('          fx.js anchorLocalBox exists and differs; never that a given site');
  console.log('          renders wrong. That needs a browser at a real --ui-zoom.');
  console.log('BOUNDARY: not looked at — style.transform / style.cssText / setProperty, CSS');
  console.log('          written by a stylesheet rather than inline, values crossing a');
  console.log(`          function boundary as an argument, and ${skipped} non-JS file(s).`);
  console.log(`BOUNDARY: read ${scanned} .js/.mjs file(s). A path not given is a path not checked.`);
}

const SELFTEST = [
  ['tests/fixtures/zoomunits/bad_tutorial_40c5b21.js', 'flag', 6],
  ['tests/fixtures/zoomunits/bad_taint_through_let.js', 'flag', 2],
  ['tests/fixtures/zoomunits/good_tutorial_3a0def9.js', 'clear', 0],
  ['tests/fixtures/zoomunits/good_divided_by_zoom.js', 'clear', 0],
  ['tests/fixtures/zoomunits/good_no_px_write.js', 'clear', 0],
];

function selftest() {
  console.log('zoomunits --selftest');
  let bad = 0;
  let badHit = 0;
  let good = 0;
  let goodHit = 0;
  for (const [rel, want, count] of SELFTEST) {
    const { findings } = scan(readFileSync(resolve(ROOT, rel), 'utf8'));
    const ok = want === 'flag' ? findings.length >= 1 : findings.length === 0;
    const exact = findings.length === count;
    if (want === 'flag') {
      bad++;
      if (ok) badHit++;
    } else {
      good++;
      if (ok) goodHit++;
    }
    console.log(
      `  ${ok ? (exact ? 'OK  ' : 'OK* ') : 'MISS'}  ${want.padEnd(5)} ${rel} → ${findings.length} finding(s), expected ${count}`
    );
  }
  console.log(`\nknown-bad recall  ${badHit}/${bad}`);
  console.log(`known-good clear  ${goodHit}/${good}`);
  console.log('OK* = right verdict, different count than recorded — read it before trusting the recall.');
  const pass = badHit === bad && goodHit === good;
  console.log(pass ? 'RESULT: corpus held.' : 'RESULT: corpus escaped — the check is decoration until this is 5/5.');
  return pass ? 0 : 1;
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  const paths = argv.filter((a) => !a.startsWith('--'));
  const targets = paths.length ? paths : [resolve(ROOT, 'src')];
  let files;
  try {
    files = targets.flatMap(jsFiles);
  } catch (e) {
    console.error(`zoomunits: ${e.message}`);
    return 2;
  }
  if (!files.length) {
    // An empty result against an unresolved path and a genuinely clean tree are
    // identical and mean the opposite (development.md SOP 2). Red, not green.
    console.error('zoomunits: no .js/.mjs files found in ' + targets.join(', ') + ' — treating as red, not clean.');
    return 1;
  }

  console.log(`zoomunits — ${targets.map((t) => relative(ROOT, resolve(t)) || '.').join(', ')}`);
  let total = 0;
  let writes = 0;
  for (const f of files) {
    const { findings, stats } = scan(readFileSync(f, 'utf8'));
    writes += stats.writes;
    if (!findings.length) continue;
    console.log(`\n${relative(ROOT, f)}`);
    for (const fd of findings) {
      total++;
      console.log(`  :${fd.line}  ${fd.write} — ${fd.why}`);
      console.log(`          ${fd.text}`);
    }
  }
  console.log(`\n${files.length} file(s), ${writes} inline px geometry write(s), ${total} unconverted`);
  boundary(files.length, 0);
  console.log(
    total
      ? `RESULT: ${total} write(s) carry a visual pixel into local space. Each is a second copy of the transform in src/ui/fx.js.`
      : 'RESULT: clean — every inline px geometry write goes through anchorLocalBox or divides by --ui-zoom.'
  );
  return total ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
