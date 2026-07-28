#!/usr/bin/env node
// tools/zoomunits.mjs — one coordinate space, one home.
//
// The whole UI is scaled by `--ui-zoom` (styles/base.css, `body { zoom: var(--ui-zoom, 1) }`,
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
// THE CARRIED SET (added by Rune at the dev merge; Bjorn's instrument, his ruled
// shape). Nine unconverted writes at four sites predate this check and none is
// owned yet. Left as a bare red they made the suite permanently red, which trains
// a reader to skip the line — and a red that is always there cannot tell you a
// TENTH site just arrived. So the set below is recorded and asserted EXACTLY:
//
//   a finding not in the set        → red. Something new carries the bug.
//   an entry with no finding        → red. It was fixed or edited; delete its
//                                     line here in the SAME commit (that is the
//                                     set's upkeep rule, and it enforces itself).
//   an entry for a write THIS CHANGE introduced → red, and the discharge is to FIX
//                                     the write, never to edit the ledger. Checked
//                                     at git merge-base origin/dev HEAD; a base
//                                     that will not resolve is UNKNOWN, not clean.
//                                     (Vira's ratchet, ruled over a literal count:
//                                     "carried" MEANS predates this change.)
//   every entry matched, nothing new → 0, and all nine still print, every run.
//
// Keyed on file + the write's own text, NEVER on line numbers: src/main.js moved
// 79 lines between 082860c and this ref (#8's ?shot= gate, #10's ?shotSettings=
// seeding) while every one of these writes stayed byte-identical. A baseline
// pinned to line numbers is a `red-at <old ref>` read against a newer tree.
// `--raw` restores the original verdict — any finding is red, no set consulted.
//
// Usage
//   node tools/zoomunits.mjs [<path> ...]   scan files/dirs (default: src/)
//   node tools/zoomunits.mjs --selftest     run the known-bad/known-good corpus
//   node tools/zoomunits.mjs --raw          ignore the carried set: any finding is red
//
// Exit codes
//   0  the carried set matched exactly, nothing new, every entry admissible
//      (or --raw: no finding at all)
//   1  a NEW finding, a VANISHED entry, an INADMISSIBLE entry, or a corpus miss
//      under --selftest
//   2  UNKNOWN — the admissibility base would not resolve, or a usage error. Never
//      a pass: unknown blocks (SOP 2), it is not the softer bucket.
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
// Only admissibility() spawns git; the carried/new/vanished half is pure filesystem.
import { execFileSync } from 'node:child_process';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// fileURLToPath, not .pathname — the SAME defect as the main-module guard below,
// four hundred lines up and found while fixing that one. A file URL's .pathname
// keeps the leading slash before a drive letter and leaves percent-escapes encoded,
// so on Windows ROOT resolved to `\D:\a\EldenSpire\EldenSpire` (a rooted path with a
// literal `D:` directory — not a legal path) instead of `D:\a\EldenSpire\EldenSpire`,
// and any repo path containing a space became `%20`. Fixing only the guard would have
// moved windows-latest from a vacuous green to `exit 2, no .js/.mjs files found`.
// Ten other tools in this repo already spell it this way.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

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

// `skipped` is an accumulator, not a return value, because the recursion flat-maps.
// It counts entries that EXIST under the given paths and are not .js/.mjs — the
// files this tool structurally cannot read, which is exactly what the boundary
// block claims to report. It was the literal `0` until now (Vira's finding): the
// number was never computed, and read true for its whole life only because src/
// happens to contain no non-JS file. Measured or absent; this is measured.
function jsFiles(p, skipped) {
  const abs = resolve(p);
  const st = statSync(abs);
  if (st.isFile()) {
    const isJs = extname(abs) === '.js' || extname(abs) === '.mjs';
    if (!isJs) skipped.n++;
    return isJs ? [abs] : [];
  }
  return readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1)) // sorted: the order IS part of the output
    .flatMap((e) => jsFiles(resolve(abs, e.name), skipped));
}

function boundary(scanned, skipped, mode = {}) {
  console.log('BOUNDARY: consistency check, not correctness — it proves a second copy of');
  console.log('          fx.js anchorLocalBox exists and differs; never that a given site');
  console.log('          renders wrong. That needs a browser at a real --ui-zoom.');
  console.log('BOUNDARY: not looked at — style.transform / style.cssText / setProperty, CSS');
  console.log('          written by a stylesheet rather than inline, values crossing a');
  console.log(`          function boundary as an argument, and ${skipped} non-JS file(s).`);
  console.log('BOUNDARY: one finding per line, first match wins. A line holding a converted');
  console.log('          write followed by an unconverted one reads clean — and with no');
  console.log('          finding there is no entry, so rule (3) below never sees it. That');
  console.log('          bypasses this guard upstream of itself (Bjorn, carded, pre-existing).');
  console.log(`BOUNDARY: read ${scanned} .js/.mjs file(s). A path not given is a path not checked.`);
  // Bjorn: a boundary line is the one piece of prose that may never be wrong — and
  // under --raw this block asserted three rules were enforced in a run where zero of
  // them executed. The claim is now conditioned on the invocation that printed it.
  if (mode.raw) {
    console.log('BOUNDARY: --raw. The carried set was NOT consulted in this run — none of the');
    console.log('          three rules below ran, and this output says nothing about whether');
    console.log('          the ledger matches the tree. It is the presence detector only.');
    return;
  }
  // Vira's amendment: test 37's name and this tool's header READ as a ratchet, so
  // the boundary has to say which rules a machine actually holds and which are prose.
  console.log('BOUNDARY: three rules govern the carried set. ALL THREE ARE MACHINE-ENFORCED:');
  console.log('          (1) a finding not in the set is red · (2) an entry with no finding is');
  console.log('          red · (3) an entry may not be admitted for a write this change');
  console.log('          introduced — checked at git merge-base origin/dev HEAD, and UNKNOWN');
  console.log('          when that base will not resolve. NOT enforced, and prose only: each');
  console.log('          entry\'s NOTE (why it is unfixed, who owns it) is unchecked text, and');
  console.log('          RELOCATION is not caught — deleting a carried write and reintroducing');
  console.log('          byte-identical text elsewhere in the SAME file reads as no change,');
  console.log('          with the note now describing a site that moved (Vira, carded).');
  // Bjorn's finding 3, and it is the sharpest limit on rule (3): it is a PR-time
  // gate by construction.
  console.log('BOUNDARY: rule (3) is a PR-TIME gate and goes VACUOUS once this branch merges.');
  console.log('          On dev, merge-base origin/dev HEAD is HEAD, so every entry predates');
  console.log('          "this change" trivially and a laundered entry that cleared review');
  console.log('          ONCE is never caught by rule (3) again. It gates entry, not residence.');
  if (mode.adm && mode.adm.state === 'ok') {
    console.log(`BOUNDARY: rule (3) was checked against base ${mode.adm.base.slice(0, 12)} — named because a stale`);
    console.log('          origin/dev silently moves it (a clone of a worktree inherits the');
    console.log('          stale ref, and the check then proves something about the wrong tree).');
  }
}

// The carried set — see THE CARRIED SET in the header. `text` is the write's own
// source line, whitespace-normalised; it is the key, and the line numbers in the
// notes are prose that this tool re-derives on every run rather than trusting.
// Each note says why it is still here, because an entry with no reason is a site
// nobody ever has to fix.
const CARRIED = [
  {
    file: 'src/main.js',
    text: 'el.style.left = `${ar.left - lr.left + ar.width / 2 + ((extra && extra.dx) || 0)}px`;',
    note: 'poseFxShowcase — dev-only (?shot=fx), so no player sees it; it is the harness that generates this repo’s screenshot evidence, which is worse, not better. Byte-for-byte the deviant removed from tutorial.js in 3a0def9. Unowned.',
  },
  {
    file: 'src/main.js',
    text: 'el.style.top = `${ar.top - lr.top + ar.height * 0.4 + ((extra && extra.dy) || 0)}px`;',
    note: 'poseFxShowcase, the y half of the same write. Unowned.',
  },
  {
    file: 'src/ui/components/tooltip.js',
    text: 'el.style.left = `${Math.max(4, left)}px`;',
    note: 'the shared tooltip singleton, tainted through a reassigned `let` — the shape no grep finds. Player-facing at every zoom. Unowned.',
  },
  {
    file: 'src/ui/components/tooltip.js',
    text: 'el.style.top = `${Math.max(4, top)}px`;',
    note: 'the same tooltip, y axis. Unowned.',
  },
  {
    file: 'src/ui/screens/combat.js',
    text: 'dragGhost.style.left = `${mv.clientX - 70}px`;',
    note: 'drag-to-target ghost, straight from clientX. PLAYER-FACING on every zoomed desktop, on the affordance the tutorial itself teaches. The most consequential of the nine. Unowned.',
  },
  {
    file: 'src/ui/screens/combat.js',
    text: 'dragGhost.style.top = `${mv.clientY - 100}px`;',
    note: 'the same drag ghost, y axis. Unowned.',
  },
  {
    file: 'src/ui/screens/combat.js',
    text: 'ghost.style.left = `${from.left}px`;',
    note: 'flyCard’s ghost, from a raw rect. Player-facing. Unowned.',
  },
  {
    file: 'src/ui/screens/combat.js',
    text: 'ghost.style.top = `${from.top}px`;',
    note: 'flyCard’s ghost, y axis. Unowned.',
  },
  {
    file: 'src/ui/screens/combat.js',
    text: 'ghost.style.width = `${from.width}px`;',
    note: 'flyCard’s ghost, width. Unowned.',
  },
];

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// One spelling of a path, chosen at the edge where the platform's convention enters
// the program. path.relative answers in the HOST separator, so on Windows the scanner
// produced `src\ui\components\tooltip.js` while the ledger records `src/ui/...`, no
// key ever matched, and the tool reported `0 carried, 9 new, 9 vanished` — every entry
// vanished and every finding new, on a tree where nothing had changed. Third defect of
// this family in this file: a value spelled by the platform instead of normalised at
// the boundary. Both sides of every comparison go through here, so neither the scanner
// nor the ledger can reintroduce a host-specific spelling. On POSIX it is the identity
// function, so no key value on Linux or macOS moves by a byte.
const relKey = (p) => p.split(sep).join('/');

// ------------------------------------------------------------- admissibility
// "Carried" means PREDATES THIS CHANGE. Nothing enforced that until now: a write
// and its CARRIED entry could arrive in one commit and every gate stayed green
// (Bjorn demonstrated it; Vira reinstated it and ruled this the fix over a
// literal count, because a literal's false red is discharged by editing the
// number down — the reflex that opens the laundering path — while this one is
// discharged by FIXING THE WRITE).
//
// THIS IS THE ONLY PART OF THE TOOL THAT TOUCHES GIT, deliberately (Vira's
// binding). carried/new/vanished above is pure filesystem and stays that way, so
// a git failure can never change which findings matched which entries. An
// unresolvable base is UNKNOWN → exit 2, never folded into a pass (SOP 2's
// silence guard: an empty answer against an unproven ref is not a clean one).
//
// Counted, not merely present: k entries sharing one text need k occurrences at
// the base. Presence alone would admit a byte-identical twin introduced by this
// change, which is the same laundering one entry to the right. That is stricter
// than the ruling's wording and is flagged as such in the commit — the ruling's
// three cases behave identically either way.
function admissibility(entries) {
  let base;
  try {
    base = execFileSync('git', ['merge-base', 'origin/dev', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (!/^[0-9a-f]{7,40}$/.test(base)) throw new Error(`merge-base returned ${JSON.stringify(base)}`);
  } catch (e) {
    return { state: 'unknown', why: `could not resolve git merge-base origin/dev HEAD — ${e.message.split('\n')[0]}` };
  }
  const wanted = new Map(); // file → Map(normalised text → entries needing it)
  for (const c of entries) {
    if (!wanted.has(c.file)) wanted.set(c.file, new Map());
    const m = wanted.get(c.file);
    const k = norm(c.text);
    m.set(k, (m.get(k) || 0) + 1);
  }
  const inadmissible = [];
  for (const [file, texts] of wanted) {
    let atBase = null;
    try {
      atBase = execFileSync('git', ['show', `${base}:${relKey(file)}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch {
      atBase = null; // the file itself is new in this change — every entry for it is inadmissible
    }
    const counts = new Map();
    if (atBase !== null) {
      for (const line of atBase.split('\n')) {
        const k = norm(line);
        if (k) counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    for (const [text, need] of texts) {
      const have = counts.get(text) || 0;
      if (have < need) inadmissible.push({ file, text, need, have, fileMissing: atBase === null });
    }
  }
  return { state: 'ok', base, inadmissible, checked: entries.length };
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

  // The boundary block's non-JS count needs a fixture or it is unfalsifiable: src/
  // holds zero non-JS files, so a measured 0 and the hardcoded 0 it replaced are the
  // same three characters on this tree, and the defect would have been invisible
  // again the day someone reintroduced it. This directory is the mixed corpus that
  // already exists for this tool — five .js and exactly one non-JS
  // (two-spaces-probe.html) — so the number has to move with reality to stay right.
  // Asserted on the RENDERED LINE, not on the counter, because the original defect
  // was at the CALL SITE — `boundary(files.length, 0)` — and a fixture that would
  // not have caught its own bug is decoration. This drives a real run over the
  // fixture directory and reads the sentence a person reads. `--raw` so the run
  // makes ZERO git calls and Vira's verified binding-1 property is unchanged.
  const covDir = resolve(ROOT, 'tests/fixtures/zoomunits');
  const covLines = [];
  const realLog = console.log;
  console.log = (...a) => covLines.push(a.join(' '));
  try {
    main(['--raw', covDir]);
  } finally {
    console.log = realLog;
  }
  const covRead = /read (\d+) \.js\/\.mjs file/.exec(covLines.join('\n'));
  const covSkip = /and (\d+) non-JS file\(s\)/.exec(covLines.join('\n'));
  const covOk = !!covRead && covRead[1] === '5' && !!covSkip && covSkip[1] === '1';
  console.log(
    `  ${covOk ? 'OK  ' : 'MISS'}  boundary line over tests/fixtures/zoomunits → ` +
      `"read ${covRead ? covRead[1] : '?'} .js/.mjs" and "${covSkip ? covSkip[1] : '?'} non-JS" (expected 5 and 1)`
  );

  const corpusPass = badHit === bad && goodHit === good;
  const pass = corpusPass && covOk;
  // The numbers live ON the RESULT line so the harness can quote one terminated
  // sentence instead of scraping two. Bjorn's finding 1: test 36's detail came from
  // the same `grab` helper, so renaming a word in this output printed `recall ?`
  // inside a PASS. There is now nothing for a rename to silently break — a RESULT
  // this harness cannot read is a FAIL, not a question mark.
  // "corpus held" stays keyed on the CORPUS, so it cannot start meaning something
  // else; the skip-count fixture is its own clause. The exit code reflects both.
  console.log(
    corpusPass
      ? `RESULT: corpus held — known-bad recall ${badHit}/${bad}, known-good cleared ${goodHit}/${good}; non-JS skip count ${covOk ? 'measured' : 'NOT MEASURED'}.`
      : `RESULT: corpus escaped — known-bad recall ${badHit}/${bad}, known-good cleared ${goodHit}/${good}; the check is decoration until both are full; non-JS skip count ${covOk ? 'measured' : 'NOT MEASURED'}.`
  );
  return pass ? 0 : 1;
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  const paths = argv.filter((a) => !a.startsWith('--'));
  const targets = paths.length ? paths : [resolve(ROOT, 'src')];
  const skipped = { n: 0 };
  let files;
  try {
    files = targets.flatMap((t) => jsFiles(t, skipped)); // NOT flatMap(jsFiles): that passes the index as `skipped`
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

  const raw = argv.includes('--raw');
  console.log(`zoomunits — ${targets.map((t) => relative(ROOT, resolve(t)) || '.').join(', ')}${raw ? ' (--raw: carried set ignored)' : ''}`);

  // Match findings against the carried set by file + the write's own text. An
  // entry may be claimed once, so a duplicated write shows up as new rather than
  // hiding behind its twin.
  const unclaimed = CARRIED.map((c) => ({ ...c, key: `${relKey(c.file)}\x00${norm(c.text)}`, hit: null }));
  const fresh = [];
  let total = 0;
  let writes = 0;
  for (const f of files) {
    const rel = relKey(relative(ROOT, f));
    const { findings, stats } = scan(readFileSync(f, 'utf8'));
    writes += stats.writes;
    for (const fd of findings) {
      total++;
      const key = `${rel}\x00${norm(fd.text)}`;
      const entry = raw ? null : unclaimed.find((c) => c.key === key && !c.hit);
      if (entry) entry.hit = { rel, ...fd };
      else fresh.push({ rel, ...fd });
    }
  }
  const vanished = raw ? [] : unclaimed.filter((c) => !c.hit);

  if (fresh.length) {
    console.log(`\nNEW — not in the carried set:`);
    for (const fd of fresh) {
      console.log(`  ${fd.rel}:${fd.line}  ${fd.write} — ${fd.why}`);
      console.log(`          ${fd.text}`);
    }
  }
  if (vanished.length) {
    console.log(`\nVANISHED — recorded in the carried set, not found in the tree:`);
    for (const c of vanished) {
      console.log(`  ${c.file}  ${c.text}`);
      console.log(`          fixed, moved or reformatted — delete this entry in the same commit.`);
    }
  }
  const held = unclaimed.filter((c) => c.hit);
  if (held.length) {
    // Printed on every run, including green ones: the whole risk of a carried set
    // is that it becomes a place where defects go quiet.
    console.log(`\nCARRIED — ${held.length} known unconverted write(s), still unfixed, line numbers re-derived now:`);
    for (const c of held) {
      console.log(`  ${c.hit.rel}:${c.hit.line}  ${c.hit.write}`);
      console.log(`          ${c.note}`);
    }
  }

  // Admissibility runs AFTER the pure-filesystem partition above and cannot alter
  // it — every carried/new/vanished number is already decided at this point. Under
  // --raw it is not computed at all, so that invocation spawns no git whatsoever.
  const adm = raw ? null : admissibility(CARRIED);
  // `adm` is null under --raw (git deliberately never consulted), so every reader
  // of it is guarded. Without this the --raw path threw and exit 1 made the crash
  // look exactly like the bare red it was supposed to be printing.
  if (adm && adm.state === 'unknown') {
    console.log(`\nADMISSIBLE — UNKNOWN. ${adm.why}`);
    console.log('        Whether these entries predate this change is unproven, not proven false.');
    console.log('        Unknown blocks (SOP 2); it is never folded into a pass.');
  } else if (adm && adm.inadmissible.length) {
    console.log(`\nINADMISSIBLE — ${adm.inadmissible.length} entry(ies) record a write that does NOT predate this change`);
    console.log(`        (base: git merge-base origin/dev HEAD = ${adm.base.slice(0, 12)})`);
    for (const i of adm.inadmissible) {
      console.log(`  ${i.file}${i.fileMissing ? '  [file absent at base]' : ''}  ${i.have}/${i.need} occurrence(s) at base`);
      console.log(`          ${i.text}`);
    }
    console.log('        "Carried" means PREDATES THIS CHANGE. Discharge this by FIXING the');
    console.log('        write, not by editing the ledger — an entry admitted here would be');
    console.log('        this change laundering its own defect into the debt column.');
  }

  console.log(`\n${files.length} file(s), ${writes} inline px geometry write(s), ${total} unconverted`);
  boundary(files.length, skipped.n, { raw, adm });
  if (raw) {
    console.log(
      total
        ? `RESULT: ${total} write(s) carry a visual pixel into local space. Each is a second copy of the transform in src/ui/fx.js.`
        : 'RESULT: clean — every inline px geometry write goes through anchorLocalBox or divides by --ui-zoom.'
    );
    return total ? 1 : 0;
  }

  console.log(
    `RESULT: ${held.length} carried, ${fresh.length} new, ${vanished.length} vanished, ` +
      `${adm.state === 'unknown' ? 'admissibility UNKNOWN' : `${adm.inadmissible.length} inadmissible of ${adm.checked} checked`}.`
  );
  if (fresh.length || vanished.length || (adm.state === 'ok' && adm.inadmissible.length)) {
    console.log('        The carried set no longer describes the tree. Fix the new write, or');
    console.log('        update the set — whichever is true — in the same commit.');
    return 1;
  }
  if (adm.state === 'unknown') return 2;
  // `held.length`, not the word "nine". Bjorn grew the set to 10 and this line
  // still said nine — a derived count and a literal for the same fact, two lines
  // apart, inside the tool that exists to catch two homes for one fact. I did not
  // reason that out when I wrote it; I typed the number I happened to be looking at.
  console.log(`        The set is exactly as recorded. This is NOT "clean": ${held.length} write(s)`);
  console.log('        still carry a visual pixel into local space and none of them is owned.');
  return 0;
}

// pathToFileURL, not `file://` + argv[1]. The hand-rolled form is correct only where
// argv[1] starts with `/`: on Windows it compares
//   file://D:\a\EldenSpire\tools\zoomunits.mjs   against
//   file:///D:/a/EldenSpire/tools/zoomunits.mjs
// which is always false, so main() never ran, nothing printed, and node exited 0 —
// a whole guard reported green on every Windows run this branch ever had. This repo
// already spells the predicate correctly in tools/serve.mjs and tools/dirorder.mjs;
// this is a collapse to the spelling already proven on Windows, `|| ''` included so
// the three sites read alike. (Bjorn's diagnosis and strings, 2026-07-28.)
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exit(main(process.argv.slice(2)));
