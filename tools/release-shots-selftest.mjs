#!/usr/bin/env node
// tools/release-shots-selftest.mjs — the known-bad corpus for release-shots.mjs.
//
// Bjorn, 2026-08-15. Vira's doors audit (`docs/TOOL-DOORS-AUDIT.md`) puts
// release-shots in the HARNESS/exempt column — "asserts nothing". That was true
// of the tool it was written about and it is not true of this one: this file
// refuses BEFORE the browser on an unaccounted state, on a blind reader, on an
// empty home and on a stale bundle, and it fails a shot whose landmark never
// resolved. Those are assertions, so they owe a red, and until today they had
// none. *The instrument rule*: a check whose failing case nobody has watched
// fail is `unknown`, not green.
//
// THE DOOR, and it is the whole reason this file is 200 lines instead of 20.
// Every plant is a REAL EDIT TO A COPY OF THE WHOLE REPO — src/, styles/,
// dist/, tools/, content/ — and the tool is then run AS A WHOLE PROGRAM inside
// that copy (`node <copy>/tools/release-shots.mjs`), so it derives its own ROOT
// from its own location and reads the planted files through the same
// readFileSync, the same imports and the same browser a real run uses. Nothing
// is handed to a function. A fixture passed to `appShotStates()` would exercise
// the regex and prove nothing about the run.
//
// SEVEN PLANTS. Five refuse before the browser (cheap, and they are the guards
// that carry most of this tool's claim); two drive the real browser against a
// planted bundle, because a corpus made only of pre-browser plants would leave
// the half that photographs unproven — which is the shape Vira's audit found
// six times on 2026-08-08.
//
//   1  unaccounted state   a ?shot= state the app has and SCREENS does not
//   2  blind reader        Vira's whitespace plant: every comparison reformatted
//   3  partial blindness   three comparisons reformatted, not all
//   4  empty home          settingsCategories() derives zero ids
//   5  stale bundle        src declares a tab the shipped bundle does not carry
//   6  landmark gone       the browser half: a real MISS on a planted bundle
//   7  drive target gone   the DRIVEN half: a shot whose click has nothing to click
//
// WHY 7 EXISTS, AND IT IS AN ADMISSION (Bjorn, 2026-08-16). Plants 0-6 all run
// `--only title` — an UNDRIVEN shot. So when I changed `profile-drawer` to open
// its tab by CLICKING (cc5f6dd's parent, 3b74fd3), this corpus went green over a
// change it could not see: plant 6's red licenses the undriven landmark door and
// is SILENCE about the driven one. Vira planted both halves by hand and watched
// them red; a plant watched once and not written down is an anecdote, so the one
// that plant 6 cannot give — the DRIVE ITSELF failing — is now a standing row.
// The other half she ran (kill the driven shot's landmark) is deliberately NOT
// added: it is plant 6's class at a second address, and a corpus that grows a row
// per shot measures its own length.
//
// And one GREEN control (plant 0): the untouched copy must exit 0, or every red
// below is a red about copying a tree.
//
// Run: node tools/release-shots-selftest.mjs [--no-browser]
// Exit: 0 all plants behaved · 1 any plant misbehaved · 2 the harness could not run

import { mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const NO_BROWSER = process.argv.includes('--no-browser');

// What a copy of this repo needs to be a running repo. Derived intent, listed
// once: if a plant ever fails because a directory is missing from here, the
// failure is mine and not the tool's, which is why the list is checked.
const NEEDED = ['src', 'styles', 'tools', 'content', 'dist', 'index.html'];

const missing = NEEDED.filter((p) => !existsSync(join(ROOT, p)));
if (missing.length) {
  console.error(`release-shots-selftest: this tree is missing ${missing.join(', ')} — cannot build a runnable copy.`);
  process.exit(2);
}

const base = mkdtempSync(join(tmpdir(), 'release-shots-selftest-'));
const copies = [];
function copyTree(name) {
  const d = join(base, name);
  mkdirSync(d, { recursive: true });
  for (const p of NEEDED) cpSync(join(ROOT, p), join(d, p), { recursive: true });
  copies.push(d);
  return d;
}
const edit = (tree, rel, fn) => {
  const p = join(tree, rel);
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`plant edited nothing in ${rel} — the plant is broken, not the tool`);
  writeFileSync(p, after);
};

// A whole run of the real tool inside the planted copy.
function runIn(tree, extra = []) {
  let out = ''; let code = 0;
  try {
    out = execFileSync(process.execPath, [join(tree, 'tools/release-shots.mjs'), '--out', join(tree, 'shots'), ...extra],
      { cwd: tree, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
  } catch (e) { code = e.status ?? -1; out = `${e.stdout || ''}${e.stderr || ''}`; }
  return { out, code };
}

// The browser plants need one shot only; the derivation plants never get that
// far, so they are run with the same narrow flags and cost nothing extra.
// A plant may override with its own `narrow` — and plant 7 must, because `title`
// is an UNDRIVEN shot and this default was quietly the corpus's whole door.
const NARROW = ['--only', 'title', '--shape', '390x844'];

const plants = [
  {
    name: '0 GREEN control — an untouched copy',
    want: 'GREEN', wantExit: 0, wantRe: /release-shots: OK/, browser: true,
    build: () => {},
  },
  {
    name: '1 unaccounted state',
    want: 'RED', wantExit: 1, wantRe: /neither photographed nor excluded: plantstate/, browser: false,
    // The app grows a state. This is the exact defect the derivation was written
    // for — Rune's `?shot=event` at 52e0bc1, which this tool refused to run past.
    build: (t) => edit(t, 'src/main.js', (s) => s.replace(
      /(\n\s*)(if \(shotState === ')/, `$1if (shotState === 'plantstate') { /* PLANT */ }$1$2`)),
  },
  {
    name: '2 blind reader (Vira\'s whitespace plant)',
    want: 'RED', wantExit: 1, wantRe: /derived ZERO \?shot= states/, browser: false,
    // Pure whitespace. The game is unaffected and the reader goes blind — this
    // printed `0 states … 0 unaccounted` and exit 0 before the floor existed.
    build: (t) => edit(t, 'src/main.js', (s) => s.replace(/shotState === '/g, "shotState==='")),
  },
  {
    name: '3 partial blindness (ONE state, every comparison)',
    want: 'RED', wantExit: 1, wantRe: /SCREENS claims to cover state\(s\) the reader cannot find/, browser: false,
    // The half a floor cannot catch: a SMALLER, CONFIDENT NUMBER. One state
    // stops being derivable and every other state still is, so the zero-floor
    // sails through and the count quietly drops by one.
    //
    // MY FIRST VERSION OF THIS PLANT CAME BACK GREEN AND THE TOOL WAS RIGHT.
    // It reformatted three comparisons spread across `map`, `combat` and
    // `customize` — but main.js compares `map` three times, `combat` four —
    // so every state remained derivable from the comparisons I had not touched
    // and the derived set never changed. The instrument I was testing WITH was
    // the broken one, which is my own named failure mode and the reason this
    // paragraph is here instead of a bug report about release-shots. A plant
    // must kill the FACT, not some of its copies.
    build: (t) => edit(t, 'src/main.js', (s) => s.replace(/shotState === 'map'/g, "shotState==='map'")),
  },
  {
    name: '4 empty home (settings categories)',
    want: 'RED', wantExit: 1, wantRe: /derived ZERO ids/, browser: false,
    build: (t) => edit(t, 'src/ui/screens/settings.js', (s) => s.replace(
      /(export function settingsCategories\(\) \{)/, '$1\n  return []; // PLANT')),
  },
  {
    name: '5 stale bundle (src declares a tab dist lacks)',
    want: 'RED', wantExit: 1, wantRe: /does not appear in dist\/AshenSpire\.html — the bundle is OLDER/, browser: false,
    build: (t) => edit(t, 'src/ui/uiContent.js', (s) => s.replace(
      /(export const MENU_TABS = \[)/, "$1\n  { id: 'plantedtab', label: 'Planted', icon: '?', tip: 'PLANT' },")),
  },
  {
    name: '6 landmark gone (the browser half)',
    want: 'RED', wantExit: 1, wantRe: /MISS|did not render as meant/, browser: true,
    // The SHIPPED BUNDLE is the artifact this tool photographs, so the plant
    // goes in the bundle: the title screen's landmark class is renamed and the
    // shot must MISS. This is the only plant that proves the photographing half
    // can fail, and it is why --no-browser is a narrower claim and says so.
    build: (t) => edit(t, 'dist/AshenSpire.html', (s) => s.replace(/title-screen/g, 'title-screen-planted')),
  },
  {
    name: '7 drive target gone (the DRIVEN half)',
    want: 'RED', wantExit: 1, wantRe: /drive failed on profile-drawer: no Profile tab in the settings screen/,
    browser: true,
    // A DIFFERENT DOOR FROM PLANT 6, and that is the whole reason for the row.
    // 6 renames the landmark and asks whether the photograph can miss. This one
    // leaves the landmark alone and takes away THE THING THE SHOT CLICKS: the
    // settings tab strip still renders, every tab still carries data-member, and
    // not one of them answers to 'Profile'. So the drive's own guard fires first
    // and says so by name — `drive failed on profile-drawer: …` — and the shot
    // then misses because .prof-restore is rendered only inside a panel nothing
    // opened. Both halves are asserted: the sentence, and exit 1.
    //
    // The plant goes in the SHIPPED BUNDLE for the same reason plant 6's does —
    // that is the artifact this tool photographs. `data-member="${esc(cat)}"` is
    // one home (src/ui/screens/settings.js) and appears once in the bundle, so
    // the edit is surgical: no category is renamed, no other selector moves.
    narrow: ['--only', 'profile-drawer', '--shape', '390x844'],
    build: (t) => edit(t, 'dist/AshenSpire.html',
      (s) => s.replace(/data-member="\$\{esc\(cat\)\}"/, 'data-member="planted-${esc(cat)}"')),
  },
];

console.log(`release-shots --selftest — ${plants.length} plants, each a REAL EDIT to a COPY OF THE WHOLE REPO,`);
console.log('  run as a whole program inside that copy so it derives its own ROOT and reads the');
console.log(`  planted files through the same imports and browser a real run uses.${NO_BROWSER ? '  (--no-browser)' : ''}\n`);

let failed = 0; let ran = 0; let skipped = 0;
for (const pl of plants) {
  if (pl.browser && NO_BROWSER) {
    console.log(`  skip       ${pl.name.padEnd(44)} --no-browser`);
    skipped++;
    continue;
  }
  const tree = copyTree(pl.name.split(' ')[0]);
  try { pl.build(tree); }
  catch (e) { console.log(`  BAD        ${pl.name.padEnd(44)} the plant itself failed: ${e.message}`); failed++; continue; }
  const { out, code } = runIn(tree, pl.narrow || NARROW);
  ran++;
  // PRINT THE RED, DO NOT ASK TO BE TRUSTED FOR IT (Bjorn, 2026-08-16, at Marina's
  // instruction to watch plant 7 go red BY NAME rather than trust the count). This
  // loop used to print `exit 1 (wanted 1)` and nothing else, so a reader could see
  // THAT a plant went red and never WHICH red — while `onefold --selftest`, one
  // tool over, has always printed `red named: <the line>`. Two sibling corpora, one
  // showing its evidence and one asking for the benefit of the doubt. The exit code
  // was never the interesting half: a plant that exits 1 for an unrelated reason and
  // a plant that caught its defect are the same integer, and the regex is the only
  // thing that tells them apart — so the regex's own match is now on the line.
  const hit = pl.wantRe.exec(out);
  const sawRe = hit !== null;
  const sawExit = code === pl.wantExit;
  const ok = sawRe && sawExit;
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'BAD '} ${pl.want.padEnd(5)} ${pl.name.padEnd(44)} exit ${code} (wanted ${pl.wantExit})${sawRe ? '' : '  — the expected line did not appear'}`);
  if (sawRe && pl.want === 'RED') console.log(`         red named: ${hit[0].trim().slice(0, 150)}`);
  if (!ok) console.log(`         tail: ${out.trim().split('\n').slice(-3).join(' | ').slice(0, 260)}`);
}

for (const d of copies) rmSync(d, { recursive: true, force: true });
rmSync(base, { recursive: true, force: true });

console.log('');
if (failed) {
  console.log(`${failed} of ${ran} plants misbehaved. release-shots may NOT be cited as coverage.`);
  process.exit(1);
}
console.log(`all ${ran} plants behaved${skipped ? ` (${skipped} skipped)` : ''}: the derivation guards go red, the browser half goes red, and an untouched copy stays green.`);
console.log('DOOR: entry point `node <planted copy>/tools/release-shots.mjs` — a whole run, from argv');
console.log('  through the derivation, the imports, serve(), chromium and the landmark assertion.');
console.log('  Plants 1-5 are real edits to real source homes; plants 6 and 7 are real edits to the');
console.log('  shipped bundle, which is the artifact this tool photographs. 6 enters by the LANDMARK');
console.log('  on an undriven shot, 7 by the DRIVE on a driven one — two doors, and before 7 existed');
console.log('  the undriven landmark was the whole extent of the browser half\'s green.');
console.log('NOT PASSED THROUGH: the build. Nothing here runs tools/launch.mjs, so a defect that only');
console.log('  appears when src/ is rebuilt into dist/ is outside this door (verify-shipped owns that).');
if (NO_BROWSER) console.log('  AND: --no-browser was passed, so the photographing half was NOT observed this run.');
console.log('BOUNDARY: these prove the REFUSALS and the MISS can fire. They do not prove any landmark');
console.log('  points at the right thing — the SCREENS table is a person\'s claim, and Vira has already');
console.log('  found one that matched nothing (`.deck-strip .mini`, which nothing on that screen emits).');
process.exit(0);
