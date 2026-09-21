// tools/doorplant.mjs — the same-door selftest harness: plant a known-bad in a
// COPY OF THE REAL TREE, run the tool whole from that copy, watch it go red.
//
// WHY. Vira's doors audit (docs/TOOL-DOORS-AUDIT.md, vira/the-doors-audited,
// 2026-08-14) classified 37 asserting tools with no re-runnable red and named
// the recurring defect: a plant handed to the acceptance predicate downstream
// of the readFileSync / import / serve road the real input travels. The
// instrument rule's same-door clause (commons/development.md, family repo):
// the known-bad must enter where the real input enters, and the check states
// its door in its own output. This harness is the one home of that mechanic
// for the tools that read THIS TREE — closedsets.mjs proved the pattern
// (plants written into a copied real tree on disk, read back through the same
// collect()); this generalizes it to a whole-tool subprocess run.
//
// WHAT IT DOES, per plant:
//   1. copies the real tree (src/, content/, styles/, tools/*.mjs, index.html)
//      to a scratch dir — the copy IS a runnable checkout;
//   2. edits the named file in the copy — the plant enters as FILE BYTES in
//      the same file the real defect would live in;
//   3. runs `node tools/<tool>` with cwd = the copy, so every stage the real
//      run performs (readFileSync, import graph, serve.mjs, the browser boot
//      for browser tools) runs against the planted bytes;
//   4. requires a non-zero exit AND an output line matching the plant's
//      expected red — a red for the wrong reason is NOT a catch;
//   5. restores the pristine bytes (the revert is discarding the edit; the
//      real tree was never touched), and finally re-runs CLEAN, which must be
//      green — both edges, every time.
//
// A plant whose find-string no longer exists is a HARD RED (`plant site
// drifted`), never a skip — a corpus that silently stops running is the
// eleven-instruments shape (gracerefill's legacy corpus, the same audit).
//
// HARNESS, not a check: this file asserts nothing about the game. Its callers
// do. It is exercised — observed red — every time a tool's selftest runs,
// because a NOT-CAUGHT plant exits 1 by this file's own hand.
//
// REMOVAL CONDITION: deleted the day the suite runner grows a per-test door
// harness that subsumes it, or the last tool selftest importing it is deleted.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REAL_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const COPY_SET = ['src', 'content', 'styles', 'index.html', 'tools'];

// LINE ENDINGS ARE NOT PART OF THE PLANT (2026-09-17). Plants are authored with
// `\n`, because that is what the committed blobs carry and what Linux CI checks
// out. A Windows checkout under `core.autocrlf=true` hands copyTree a CRLF
// working tree, so an exact `bytes.includes(find)` on a MULTI-LINE find-string
// can never match — every authored `\n` faces a `\r\n` in the file. The corpus
// then reported PLANT SITE DRIFTED for plants whose site had not moved an inch:
// a false red on Windows, invisible on Linux, and indistinguishable in the
// output from the real drift the hard-red exists to catch. Single-line plants
// were unaffected, which is why it looked arbitrary.
//
// The fix is to treat EOLs as a property of the CHECKOUT, not of the plant:
// re-express `find`/`replace` in the target file's own line ending before
// matching, and write the replacement back in that same ending so the planted
// file stays internally consistent. `plantsites.mjs` already decided this for
// the static scan (it compares LF-normalised views); this is the same rule at
// the stage that actually edits bytes.
//
// WHAT THIS DOES NOT DO: it does not widen matching. The as-authored bytes are
// still tried, a find-string that is absent in BOTH forms is still the same
// hard PLANT SITE DRIFTED, and on an LF tree every candidate collapses to the
// authored string — Linux CI behaves byte-for-byte as it did before.
function detectEol(bytes) {
  const crlf = (bytes.match(/\r\n/g) || []).length;
  const loneLf = (bytes.match(/(?<!\r)\n/g) || []).length;
  return crlf > loneLf ? '\r\n' : '\n';
}

function toEol(text, eol) {
  if (text == null) return text;
  const lf = text.replace(/\r\n/g, '\n');
  return eol === '\r\n' ? lf.replace(/\n/g, '\r\n') : lf;
}

/**
 * Choose the byte-form of one find/replace pair for the file it is landing in.
 * Preference order, first match wins:
 *   1. the file's own EOL — the checkout-agnostic reading of the plant;
 *   2. exactly as authored — so a plant that deliberately spells `\r\n`, or a
 *      genuinely mixed-EOL file, still matches the bytes its author meant.
 * Returns null when neither form is present: that is real drift.
 */
function planEdit(bytes, find, replace) {
  const eol = detectEol(bytes);
  const candidates = [
    { find: toEol(find, eol), replace: toEol(replace, eol), translated: true },
    { find, replace, translated: false },
  ];
  for (const c of candidates) {
    if (c.find !== '' && bytes.includes(c.find)) {
      return { ...c, eol, translated: c.translated && c.find !== find };
    }
  }
  return null;
}

function copyTree(extra = [], { includePng = false } = {}, realRoot = REAL_ROOT) {
  const dir = mkdtempSync(join(tmpdir(), 'doorplant-'));
  // `extra` is for tools whose real door is an artifact outside the source
  // set — tapsize measures dist/AshenSpire.html, so for that tool the SHIPPED
  // BUNDLE is where the known-bad has to enter, and planting into styles/
  // would be a plant the tool never reads.
  for (const entry of [...COPY_SET, ...extra]) {
    const from = join(realRoot, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(dir, entry), {
      recursive: true,
      filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src)
        && !/\.py$/.test(src) && (includePng || !/\.png$/.test(src))
        && !/dist[\\/](?!AshenSpire\.html$)[^\\/]+$/.test(src),
    });
  }
  return dir;
}

function runTool(root, tool, args, timeoutMs, env) {
  const r = spawnSync(process.execPath, [join('tools', tool), ...args], {
    cwd: root, timeout: timeoutMs, encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}`, signal: r.signal };
}

/**
 * plants: [{ name, file, find, replace }] or [{ name, file, append }]
 *   file    — repo-relative path the real input lives in
 *   find    — exact substring that MUST exist in the copy (else hard red)
 *   replace — its replacement (the defect)
 *   append  — text appended to the file instead (the defect arrives at EOF)
 *   edits   — [{ file, find, replace, all } | { file, append }] for a defect
 *             that is genuinely more than one file. Use INSTEAD of file/find.
 *   prep    — [[cmd, ...argv]] run in the copy AFTER the edits and BEFORE the
 *             tool; each must exit 0 or the plant is a hard red.
 *   expectRed — RegExp the failing run's output must match
 *   args    — argv for THIS plant's run, replacing the shared `args`. For a
 *             defect that only exists at one shape: the creation menu's zoom
 *             arithmetic renders correctly at --ui-zoom 1.00 and wrongly
 *             either side of it, so a plant of it run only at a 1.00 shape is
 *             a false NOT-CAUGHT. A plant that names its own argv gets its own
 *             clean baseline at the same argv, below.
 * args: extra argv for every tool run (e.g. ['--only', '390x844'])
 * realRoot: the checkout to copy. Defaults to this repo and no tool passes it —
 *   it exists so `doorplant.mjs --selftest` can run this harness whole against a
 *   synthetic fixture checkout, which is how the harness gets a door of its own.
 * Returns an exit code: 0 all plants caught + clean green, 1 otherwise.
 *
 * `edits` AND `prep` ADDED 2026-08-15 (Viki, MR-41) — the same-door clause taken
 * literally rather than stretched:
 *
 *   · A CSV CONTENT DOOR HAS TWO STAGES. An author edits `content/source/*.csv`
 *     and runs `node tools/content-build.mjs`; the game imports the generated
 *     module. A plant that stops at the spreadsheet never reaches the runtime,
 *     and one typed straight into `src/content/generated/*.js` has entered
 *     BELOW the door — it is the compiler's output written by hand. `prep` is
 *     that missing stage, and the house was already doing it by hand:
 *     statusreach's DOOR block records *"…then `node tools/content-build.mjs`
 *     recompiled"* as a dated one-off, which SOP 2's drift clause rots to
 *     `unknown` at the next ref. This makes that observation re-runnable.
 *   · SOME DEFECTS ARE TWO FILES, AND SPLITTING THEM PLANTS NEITHER. A
 *     presentation bug that can only fire on content nobody has authored yet
 *     needs the content row AND the code. Either half alone is green for a
 *     reason that has nothing to do with coverage — which this file already
 *     calls a false NOT-CAUGHT (see `all` below, the same argument one level
 *     down).
 *
 * Both are opt-in and change nothing for existing callers. Falsifier (SOP 1's
 * corollary, counted not judged): cut them if no plant ever needs a second file
 * or a compile — then they are decoration.
 */
export async function doorSelftest({ tool, plants, args = [], timeoutMs = 300000, env = {}, extraCopy = [], includePng = false, realRoot = REAL_ROOT }) {
  console.log(`${tool} --selftest — same-door known-bad corpus (${plants.length} plant(s))`);
  console.log(`DOOR: each plant enters as FILE BYTES in a copied real tree at the file(s) named below —`);
  console.log(`      the same file the real defect would ship in. The tool then runs WHOLE from that`);
  console.log(`      copy (cwd = copy root): readFileSync, the import graph, serve.mjs and any browser`);
  console.log(`      boot all read the planted bytes. Nothing is handed to an inner function directly.`);
  console.log(`      A plant carrying \`prep\` runs that command in the copy first, so a two-stage`);
  console.log(`      content door (spreadsheet -> content-build -> generated module) is travelled whole.`);
  console.log(`      Revert = the copy is discarded; the real tree is never edited.`);
  console.log(`      Plants are authored with \\n; each is re-expressed in the target file's own line`);
  console.log(`      ending before matching, so a CRLF checkout is not mistaken for a drifted site.`);
  // THE VERDICT VOCABULARY, PRINTED WHERE THE VERDICTS ARE READ. Each name is a
  // different repair, and before 2026-08-21 three of them shared one word.
  console.log(`      VERDICTS: CAUGHT = failed by its own named red · UNCAUGHT = tool stayed green`);
  console.log(`                (blind check, or the plant's premise moved) · RED-FOR-WRONG-REASON =`);
  console.log(`                failed by some OTHER red · RED-NOT-EXIT = red printed, exit still 0 ·`);
  console.log(`                DRIFTED = the find-string is gone, so the plant never armed at all.`);
  const root = copyTree(extraCopy, { includePng }, realRoot);
  let failed = 0;
  try {
    for (const p of plants) {
      const edits = p.edits || [{ file: p.file, find: p.find, replace: p.replace, append: p.append, all: p.all }];
      const where = edits.map((e) => e.file).join(' + ');
      const pristine = new Map();
      let drifted = null;
      const translated = [];
      for (const e of edits) {
        const target = join(root, e.file);
        const bytes = readFileSync(target, 'utf8');
        // A defect can require two edits in one file. Preserve the bytes from
        // before the FIRST edit; overwriting this entry after the second edit
        // makes restore() retain half the plant and poisons every later edge,
        // including the supposedly clean baseline.
        if (!pristine.has(target)) pristine.set(target, bytes);
        if (e.append != null) {
          const eol = detectEol(bytes);
          writeFileSync(target, `${bytes}${eol}${toEol(e.append, eol)}${eol}`);
          continue;
        }
        // Read the plant in the checkout's line ending (see detectEol above).
        // DRIFTED is unchanged in meaning: it fires when the site is absent in
        // the file's own EOL *and* as authored.
        const plan = planEdit(bytes, e.find, e.replace);
        if (!plan) { drifted = e.file; break; }
        if (plan.translated) translated.push(e.file);
        // `all` replaces EVERY occurrence. A one-shot replace on a token that
        // appears twice in the real file plants half a defect, and the tool
        // stays green for a reason that has nothing to do with its coverage —
        // that is a false NOT-CAUGHT, which is as misleading as a false green.
        writeFileSync(target, e.all ? bytes.split(plan.find).join(plan.replace) : bytes.replace(plan.find, plan.replace));
      }
      const restore = () => { for (const [target, bytes] of pristine) writeFileSync(target, bytes); };
      if (drifted) {
        restore();
        console.error(`RED  plant "${p.name}": PLANT SITE DRIFTED — ${drifted} no longer contains the find-string, in the file's own line ending or exactly as authored. A corpus that silently stops running is the defect; rewrite the plant.`);
        failed++;
        continue;
      }
      // The compile stage, if this door has one. A prep that fails means the
      // plant was never armed, so the run below would be green about nothing —
      // hard red rather than a NOT CAUGHT that reads like coverage.
      let prepFailed = null;
      for (const cmd of p.prep || []) {
        const pr = spawnSync(cmd[0] === 'node' ? process.execPath : cmd[0], cmd.slice(1), { cwd: root, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
        if (pr.status !== 0) { prepFailed = `${cmd.join(' ')} exited ${pr.status}: ${`${pr.stdout || ''}${pr.stderr || ''}`.trim().split('\n').slice(-4).join(' | ')}`; break; }
      }
      if (prepFailed) {
        restore();
        console.error(`RED  plant "${p.name}": PREP FAILED — ${prepFailed}. The plant was never armed; nothing below this line is evidence.`);
        failed++;
        continue;
      }
      const r = runTool(root, tool, p.args || args, timeoutMs, env);
      restore();
      // A prep stage WRITES into the copy (content-build regenerates modules),
      // so restoring the edited sources is not enough — re-run it clean so the
      // next plant and the final clean run start from generated bytes that
      // match the pristine sources.
      for (const cmd of p.prep || []) spawnSync(cmd[0] === 'node' ? process.execPath : cmd[0], cmd.slice(1), { cwd: root, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
      const matched = p.expectRed.test(r.out);
      if (r.code !== 0 && matched) {
        const line = r.out.split('\n').find((l) => p.expectRed.test(l)) || '';
        console.log(`  CAUGHT  "${p.name}" -> ${where}${p.prep ? ` (prep: ${p.prep.map((c) => c.join(' ')).join('; ')})` : ''}${translated.length ? ` (CRLF checkout: plant re-expressed in the file's line ending for ${[...new Set(translated)].join(', ')})` : ''} — exit ${r.code}; red named: ${line.trim().slice(0, 140)}`);
      } else {
        // THREE FAILURES WEARING ONE NAME (Bjorn, 2026-08-21, AshenSpire#299).
        //
        // This branch used to print `NOT CAUGHT` for every non-catch, and the
        // uprightgate corpus proved that hides the diagnosis: of its five
        // non-catches, three exited 0 (the tool never noticed) and two exited 1
        // (the tool DID fail — just not by its own named red, which is §3's
        // "failing for the wrong reason is not red"). Those need opposite
        // fixes: one says the check is blind, the other says the check is
        // loud about something else. A third state — the red PRINTED while
        // the tool still exited 0 — is an instrument that whispers, and it is
        // the defect a console-only warning already cost this house once.
        //
        // VERDICT SEMANTICS ARE UNCHANGED ON PURPOSE: every branch below still
        // counts one failure, exactly as before. This renames a failure; it
        // never converts one into a pass. `doorplant` is shared by every
        // `--selftest` corpus in the tree, so a corpus that passed before this
        // change passes identically after it.
        failed++;
        const klass = r.code !== 0
          ? 'RED-FOR-WRONG-REASON'
          : matched ? 'RED-NOT-EXIT' : 'UNCAUGHT';
        const why = {
          'RED-FOR-WRONG-REASON': 'the tool FAILED, but not by the red this plant names — a red for the wrong reason is not a catch (SOP 14 §3). Either the plant broke something else on its way in, or the check that fired is not the check this plant is aimed at.',
          'RED-NOT-EXIT': 'the expected red was PRINTED and the tool still exited 0 — the instrument whispered instead of failing. A check nobody can fail is not a check.',
          UNCAUGHT: 'the known-bad was armed by the real door and this tool stayed green — decoration, not evidence. Either the check is blind to this defect, or the plant\'s PREMISE has moved: it still applies, still runs, and tests a causal path the code no longer has.',
        }[klass];
        console.error(`  ${klass}  "${p.name}" -> ${where} — exit ${r.code}${r.signal ? ` (signal ${r.signal})` : ''}, expected-red ${matched ? 'PRESENT' : 'NOT in output'}. ${why}`);
        console.error(`    tail: ${r.out.trim().split('\n').slice(-6).join('\n    ')}`);
      }
    }
    // ONE CLEAN RUN PER ARGV A PLANT ACTUALLY USED. A plant that names its own
    // `args` is a plant whose defect only exists at that shape, and the
    // baseline that proves its red was the plant has to be the run it was
    // compared against — a green at some OTHER shape says nothing about it.
    const argvs = [...new Set([JSON.stringify(args), ...plants.map((p) => JSON.stringify(p.args || args))])];
    for (const argv of argvs) {
      const at = JSON.parse(argv);
      const label = at.length ? at.join(' ') : '(no argv)';
      const clean = runTool(root, tool, at, timeoutMs, env);
      if (clean.code === 0) console.log(`  CLEAN  unplanted copy runs green (exit 0) at ${label} — the reds above were the plants, not the harness.`);
      else {
        failed++;
        console.error(`  RED  clean copy exited ${clean.code} at ${label} — the baseline is not green, so no plant compared against it proves anything.`);
        console.error(`    tail: ${clean.out.trim().split('\n').slice(-8).join('\n    ')}`);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(failed ? `SELFTEST RED — ${failed} plant(s)/edge(s) failed` : `SELFTEST GREEN — every plant went red by the same door the real input enters, and the clean copy is green`);
  return failed ? 1 : 0;
}

/* ── THE HARNESS'S OWN DOOR ───────────────────────────────────────────────────
 *
 *   node tools/doorplant.mjs --selftest
 *
 * doorplant decides, for every `--selftest` corpus in the tree, whether a
 * known-bad was armed at all — and when it read plants wrong, the failure was
 * invisible in exactly the way this file exists to prevent. On a Windows
 * checkout 22 of startup-gate's 24 plants were CAUGHT and two printed PLANT
 * SITE DRIFTED; the two were the only two whose find-string spanned a line, so
 * against CRLF bytes nothing else COULD have matched. The corpus looked like it
 * was reporting on the source. It was reporting on the checkout.
 *
 * So the harness gets what it gives its callers. A SYNTHETIC CHECKOUT is built
 * on disk — files written deliberately in CRLF and deliberately in LF — and
 * `doorSelftest` runs WHOLE against it: the real copyTree, the real edit stage,
 * a real `node tools/<tool>` subprocess, the real verdicts. Nothing is handed
 * to planEdit directly; that would be the downstream-predicate defect the doors
 * audit named, one level up.
 *
 * Two corpora, because a fix that only buys a green is not a fix:
 *   GREEN — plants authored with \n, landing in CRLF files AND LF files, must
 *           every one be CAUGHT, and the unplanted fixture must run green.
 *   DRIFT — a find-string absent in EVERY line ending must still be the hard
 *           PLANT SITE DRIFTED. The EOL rule must not soften the hard-red.
 *
 * The fixture tool tests EOL UNIFORMITY FIRST and exits on it, so a plant that
 * matched but wrote its replacement back in the wrong ending arrives as
 * RED-FOR-WRONG-REASON rather than as a catch it did not earn.
 *
 * Cheap on purpose — no browser, no port, no bundle, about a second — so the
 * always-on lane can carry it next to `plantsites.mjs --check`.
 *
 * REMOVAL CONDITION: deleted with doorSelftest itself.
 */

const FIXTURE_TOOL = String.raw`#!/usr/bin/env node
// Fixture tool for doorplant.mjs --selftest. Not a check about the game; it
// exists so the harness has a real subprocess to run against a real checkout.
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');

// EOL UNIFORMITY FIRST, and it exits. A plant that matched the file but wrote
// its replacement back in the other line ending would otherwise still count as
// CAUGHT — this turns it into RED-FOR-WRONG-REASON, which is what it is.
for (const f of ['styles/fixture.css', 'src/fixture.js', 'src/fixture-lf.js']) {
  const bytes = read(f);
  const crlf = (bytes.match(/\r\n/g) || []).length;
  const loneLf = (bytes.match(/(?<!\r)\n/g) || []).length;
  if (crlf && loneLf) {
    console.error('RED FIXTURE.EOL-MIXED — ' + f + ' carries ' + crlf + ' CRLF and ' + loneLf + ' lone-LF ending(s); the edit did not write back in the ending the file already had.');
    process.exit(1);
  }
}

const css = read('styles/fixture.css').replace(/\r\n/g, '\n');
const js = read('src/fixture.js').replace(/\r\n/g, '\n');
const lf = read('src/fixture-lf.js').replace(/\r\n/g, '\n');
const reds = [];
if (!css.includes('  width: var(--iconbtn-size); height: var(--iconbtn-size); flex: 0 0 auto;\n  min-width: var(--iconbtn-size); min-height: var(--iconbtn-size);')) reds.push('RED FIXTURE.TAP-FLOOR — the icon button no longer takes its box from the tap-floor token.');
if (!js.includes('  loadReviewSlot = slot;\n  render();')) reds.push('RED FIXTURE.REVIEW — the second activation no longer opens the review.');
if (!js.includes('  pointerOnly: true,')) reds.push('RED FIXTURE.POINTER-ONLY — the hold is no longer pointer-only.');
if (js.includes('FIXTURE_FORBIDDEN')) reds.push('RED FIXTURE.APPEND — a forbidden declaration reached the end of the module.');
if (!lf.includes('export function fixtureLf() {\n  return true;\n}')) reds.push('RED FIXTURE.LF-BLOCK — the LF module lost its authored block.');
for (const red of reds) console.error(red);
console.log('fixture-gate: ' + (reds.length ? reds.length + ' red(s)' : 'GREEN — every fixture contract holds'));
process.exit(reds.length ? 1 : 0);
`;

const FIXTURE_CSS = `/* Fixture stylesheet for doorplant.mjs --selftest. Written in CRLF on purpose:
   this is the shape a Windows checkout hands copyTree. */
:root {
  --tap-floor: 2.75rem;
  --iconbtn-size: var(--tap-floor);
}

.as-iconbtn, .modal-iconbtn, .modal-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--iconbtn-size); height: var(--iconbtn-size); flex: 0 0 auto;
  min-width: var(--iconbtn-size); min-height: var(--iconbtn-size);
}
`;

const FIXTURE_JS = `// Fixture module for doorplant.mjs --selftest. Written in CRLF on purpose.
export let loadReviewSlot = null;

export function openReview(slot) {
  loadReviewSlot = slot;
  render();
}

export const holdOptions = {
  pointerOnly: true,
};

function render() {}
`;

const FIXTURE_LF_JS = `// Fixture module for doorplant.mjs --selftest. Written in LF on purpose — the
// same corpus must stay green on the checkout Linux CI gets.
export function fixtureLf() {
  return true;
}
`;

// The CSS block as a plant author types it: LF, because that is what the
// committed blob carries. It lands in a CRLF file, and that is the whole point.
const CSS_BLOCK = '.as-iconbtn, .modal-iconbtn, .modal-close {\n  display: inline-flex; align-items: center; justify-content: center;\n  width: var(--iconbtn-size); height: var(--iconbtn-size); flex: 0 0 auto;\n  min-width: var(--iconbtn-size); min-height: var(--iconbtn-size);';
const CSS_SHRUNK = '.as-iconbtn, .modal-iconbtn, .modal-close {\n  display: inline-flex; align-items: center; justify-content: center;\n  width: 3rem; height: 3rem; flex: 0 0 auto;\n  min-width: 3rem; min-height: 3rem;';
const LF_BLOCK = 'export function fixtureLf() {\n  return true;\n}';
const LF_BLOCK_BROKEN = 'export function fixtureLf() {\n  return false;\n}';

// `at`/`was`/`now` rather than `file`/`find`/`replace` so these synthetic sites
// are not scanned by plantsites.mjs against the real tree — they name a fixture
// checkout that exists only while this selftest runs, and reporting them as
// drifted-against-this-tree would be a false entry in the #498 backlog.
const FIXTURE_GREEN = [
  {
    name: 'multi-line plant lands in a CRLF stylesheet (the kit.css regression)',
    at: 'styles/fixture.css', was: CSS_BLOCK, now: CSS_SHRUNK,
    expectRed: /RED FIXTURE\.TAP-FLOOR/,
  },
  {
    name: 'multi-line plant lands in a CRLF module (the saveSlotSelector regression)',
    at: 'src/fixture.js', was: '  loadReviewSlot = slot;\n  render();', now: '  loadReviewSlot = null;\n  render();',
    expectRed: /RED FIXTURE\.REVIEW/,
  },
  {
    name: 'single-line plant still lands — the case CRLF never broke',
    at: 'src/fixture.js', was: '  pointerOnly: true,', now: '  pointerOnly: false,',
    expectRed: /RED FIXTURE\.POINTER-ONLY/,
  },
  {
    name: 'multi-line plant lands in an LF module — Linux CI is unchanged',
    at: 'src/fixture-lf.js', was: LF_BLOCK, now: LF_BLOCK_BROKEN,
    expectRed: /RED FIXTURE\.LF-BLOCK/,
  },
  {
    name: 'appended defect arrives in the ending the file already had',
    at: 'src/fixture.js', append: 'export const FIXTURE_FORBIDDEN = true;',
    expectRed: /RED FIXTURE\.APPEND/,
  },
  {
    name: 'one defect spanning a CRLF file and an LF file — each read in its own ending',
    spans: [
      { at: 'styles/fixture.css', was: CSS_BLOCK, now: CSS_SHRUNK },
      { at: 'src/fixture-lf.js', was: LF_BLOCK, now: LF_BLOCK_BROKEN },
    ],
    // BOTH reds, in the order the fixture tool prints them: an expectRed that
    // matched either one alone would pass while half the defect never landed.
    expectRed: /RED FIXTURE\.TAP-FLOOR[\s\S]*RED FIXTURE\.LF-BLOCK/,
  },
];

const FIXTURE_DRIFT = [
  {
    name: 'multi-line find-string that is absent in EVERY line ending',
    at: 'src/fixture.js', was: '  loadReviewSlot = neighbour;\n  rerender();', now: '  loadReviewSlot = null;\n  rerender();',
    expectRed: /RED FIXTURE\.REVIEW/,
  },
  {
    name: 'single-line find-string that is absent — EOL translation invents no match',
    at: 'src/fixture.js', was: '  pointerOnly: maybe,', now: '  pointerOnly: false,',
    expectRed: /RED FIXTURE\.POINTER-ONLY/,
  },
];

const asPlants = (corpus) => corpus.map(({ at, was, now, spans, ...rest }) => (spans
  ? { ...rest, edits: spans.map((s) => ({ file: s.at, find: s.was, replace: s.now })) }
  : { ...rest, file: at, find: was, replace: now }));

function writeFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'doorplant-fixture-'));
  for (const dir of ['tools', 'src', 'styles']) mkdirSync(join(root, dir), { recursive: true });
  const asCrlf = (text) => text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const asLf = (text) => text.replace(/\r\n/g, '\n');
  // The fixture tool itself is LF — it is the instrument, not the specimen.
  writeFileSync(join(root, 'tools', 'fixture-gate.mjs'), asLf(FIXTURE_TOOL));
  writeFileSync(join(root, 'styles', 'fixture.css'), asCrlf(FIXTURE_CSS));
  writeFileSync(join(root, 'src', 'fixture.js'), asCrlf(FIXTURE_JS));
  writeFileSync(join(root, 'src', 'fixture-lf.js'), asLf(FIXTURE_LF_JS));
  return root;
}

// doorSelftest reports through the console, and that report IS its evidence.
// Capture it so this check can assert on the WORDING of the drift red, and echo
// every line indented so a human running --selftest still reads the transcript.
async function runCorpus(label, realRoot, plants) {
  console.log(`\n── ${label} ──`);
  const lines = [];
  const log = console.log, error = console.error;
  const tee = (sink) => (...a) => { const s = a.join(' '); lines.push(s); sink(`  │ ${s.split('\n').join('\n  │ ')}`); };
  console.log = tee(log);
  console.error = tee(error);
  let code;
  try { code = await doorSelftest({ tool: 'fixture-gate.mjs', plants, timeoutMs: 60000, realRoot }); }
  finally { console.log = log; console.error = error; }
  return { code, out: lines.join('\n') };
}

async function selftest() {
  console.log('doorplant.mjs --selftest — the harness itself, run against a synthetic CHECKOUT');
  console.log('DOOR: a fixture checkout is written to disk with styles/fixture.css and src/fixture.js in');
  console.log('      CRLF and src/fixture-lf.js in LF, then doorSelftest runs WHOLE against it — copyTree,');
  console.log('      the edit stage, a real `node tools/fixture-gate.mjs` subprocess and the real verdicts.');
  console.log('      Plants are authored with \\n, exactly as every caller in tools/ authors them.');
  const root = writeFixtureRoot();
  const failures = [];
  try {
    const green = await runCorpus(`GREEN corpus — ${FIXTURE_GREEN.length} plants across CRLF and LF files`, root, asPlants(FIXTURE_GREEN));
    if (green.code !== 0) failures.push('the GREEN corpus did not come back green: an LF-authored plant failed to arm in the fixture checkout. If the reds above say PLANT SITE DRIFTED, the line-ending rule is gone and every CRLF checkout is back to false-redding multi-line plants.');
    else if (!/CRLF checkout: plant re-expressed/.test(green.out)) failures.push('the GREEN corpus passed without ever re-expressing a plant for a CRLF file — the fixture is no longer being written in CRLF, so this corpus has stopped testing the thing it exists for.');

    const drift = await runCorpus(`DRIFT corpus — ${FIXTURE_DRIFT.length} plants whose sites genuinely do not exist`, root, asPlants(FIXTURE_DRIFT));
    if (drift.code === 0) failures.push('the DRIFT corpus came back GREEN — a find-string absent in every line ending was treated as present. The hard-red that catches real drift has been softened, which is a worse defect than the false red it replaced.');
    const drifted = (drift.out.match(/PLANT SITE DRIFTED/g) || []).length;
    if (drifted !== FIXTURE_DRIFT.length) failures.push(`the DRIFT corpus named PLANT SITE DRIFTED ${drifted} time(s); expected ${FIXTURE_DRIFT.length}. A site that is genuinely gone but fails under some OTHER verdict does not tell its reader to rewrite the plant.`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log('');
  for (const f of failures) console.error(`RED  ${f}`);
  console.log(failures.length
    ? `DOORPLANT SELFTEST RED — ${failures.length} edge(s) failed`
    : "DOORPLANT SELFTEST GREEN — LF-authored plants arm in CRLF and LF checkouts alike, replacements are written back in the ending the file already had, and a site that is genuinely gone is still a hard PLANT SITE DRIFTED");
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (process.argv.includes('--selftest')) process.exit(await selftest());
  console.error('doorplant.mjs is a harness imported by tool selftests; it asserts nothing on its own. Its own door: node tools/doorplant.mjs --selftest');
  process.exit(2);
}
