// tests/run-node.mjs — Node test runner: `node tests/run-node.mjs`
// Prints one line per test; exits 1 on any failure.
//
// No flags run the whole corpus. CI may schedule the same work as:
//   --no-selftests --no-discovered   engine and tool verdicts
//   --discovered-only --shard i/n   deterministic shards of discovered tests
//   --no-slow | --slow-only          with --discovered-only: leave out, or run
//                                    only, SLOW_DISCOVERED (run-node-lanes.mjs)
//   --selftests-only --selftest-group link|other   exhaustive corpus groups
// Selftests that write mutants must run in a separate checkout from tree gates.
// tools/gatelist.mjs and tools/testnumbers.mjs still read this invocation list.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTests } from './engine.test.js';
import { loadRunNodeFixtures } from './helpers/run-node-fixtures.mjs';
import { parseRunNodeOptions, discoveryShardFiles, discoverySpeedFiles, SLOW_DISCOVERED, selftestInGroup, shardSummaryCounts } from './run-node-lanes.mjs';

let options;
try {
  options = parseRunNodeOptions(process.argv.slice(2));
} catch (error) {
  console.error(`run-node: ${error.message}`);
  process.exit(2);
}
const CORE = options.core;
const SELFTESTS = options.selftests;
const DISCOVER = options.discovered;

// The fixtures runTests() is handed (art manifest, asset lookup, two legacy
// run-save files) are loaded here, not inside engine.test.js, so the browser
// harness stays fs-free; tests/helpers/run-node-fixtures.mjs says why.
const { artManifest, assetExists, legacyRunSave, preE6RunSave } = await loadRunNodeFixtures();
if (!artManifest) console.warn('  (no art manifest — test 33 will skip; run tools/equipment-blender.py)');

const { passed, failed, results } = CORE
  ? await runTests({ artManifest, assetExists, legacyRunSave, preE6RunSave })
  : { passed: 0, failed: 0, results: [] };
for (const r of results) {
  const tag = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}

// The zoom-unit guard runs HERE, not as a script somebody remembers to run. A
// check nobody reads is not a check: the tutorial lockout it exists to catch
// shipped past this suite while the suite was green the whole time.
// Two lines, because they fail for different reasons and must not be conflated:
//   36 — the check's own integrity (its corpus). Its failure is the check's fault.
//   37 — findings in src/. Its failure is the code's state, not the check's.
// Numbered 36/37, not 35/36: dev's test 35 is Sunna's accessibility-defaults test
// in engine.test.js. Two files, no git conflict, and a suite that would have
// printed "35." twice — the collision a merge cannot see.
let zoomExtra = 0;
let zoomPassed = 0; // counted, because "35 passed" over 37 printed lines is the same
                    // two-homes defect these two lines exist to catch.

// EVERY *.test.mjs IN THE REPOSITORY, FOUND RATHER THAN LISTED. This used to be
// a hand-typed array, and eighteen files under tests/ alone had been written,
// committed and never once run by it or by any workflow; four of them had gone
// red unseen. A new test file is now in the run the moment it exists. A file
// that must not be spawned here is named in NOT_SPAWNED with its reason, and an
// entry whose file has gone is itself a failure, so the list cannot rot quietly.
if (DISCOVER) {
  const { spawnSync } = await import('node:child_process');
  const { readdirSync, existsSync } = await import('node:fs');
  const { join, relative, sep } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  // Generated output and third-party trees hold no tests of ours. Dot-directories
  // are skipped except .github, so a workflow helper's own test is found too.
  const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'scratch']);
  const NOT_SPAWNED = new Map([
    ['tests/confirmation-modal.test.mjs', 'exports runConfirmationModalContract(); check 76 below calls it'],
    ['tests/card-removal-flick.test.mjs', 'exports runCardRemovalFlickTests(); called below'],
    ['tools/bundle.test.mjs', 'runs the real bundler against temporary checkouts for several minutes; ci.yml runs it as its own job, `parse-gate`'],
  ]);
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.github')) continue;
        walk(join(dir, entry.name));
      } else if (entry.name.endsWith('.test.mjs')) {
        found.push(relative(root, join(dir, entry.name)).split(sep).join('/'));
      }
    }
  };
  walk(root);
  found.sort();
  const stale = [...NOT_SPAWNED.keys()].filter(file => !existsSync(join(root, file)));
  const eligible = found.filter(file => !NOT_SPAWNED.has(file));
  let files;
  try {
    files = discoveryShardFiles(discoverySpeedFiles(eligible, options.slow), options.shard);
  } catch (error) {
    console.error(`run-node: ${error.message}`);
    process.exit(2);
  }
  // The spec reporter ends with a count and, on a failure, a "failing tests"
  // section. A red run prints the reporter's whole output: a file that dies
  // before registering a test (a syntax error, a missing import) shows its
  // exception ABOVE that section, and the section alone would drop the reason.
  // Simulation files spawn their own CPU-heavy processes. Bound Windows file
  // workers so concurrent local builds do not starve those existing deadlines;
  // discovery, assertions and subprocess timeouts remain unchanged.
  const workerArgs = process.platform === 'win32' ? ['--test-concurrency=4'] : [];
  // A shard that hangs would otherwise be cut by the CI job's timeout with no output at all
  // (spawnSync buffers it). Stop it first and print what it wrote, so the hung test is named.
  const SHARD_LIMIT_MS = 15 * 60 * 1000;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...workerArgs, ...files], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, timeout: SHARD_LIMIT_MS });
  if (result.error?.code === 'ETIMEDOUT') console.log(`run-node: the test run passed ${SHARD_LIMIT_MS / 60000} minutes and was stopped; its output so far follows, and the last test named is where it hung.`);
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  const count = (label) => Number(out.match(new RegExp(`^ℹ ${label} (\\d+)$`, 'm'))?.[1] ?? NaN);
  const ok = result.status === 0 && !stale.length && count('fail') === 0;
  if (!ok) {
    console.log(out || String(result.error));
    for (const file of stale) console.log(`  NOT_SPAWNED names ${file}, which no longer exists — remove the entry`);
  }
  const counts = shardSummaryCounts({ out, timedOut: result.error?.code === 'ETIMEDOUT', limitMinutes: SHARD_LIMIT_MS / 60000, files: files.length });
  console.log(`${ok ? 'PASS' : 'FAIL'}  every discovered test file passes — ${counts}` +
    ` (${NOT_SPAWNED.size} run elsewhere, each with its reason in NOT_SPAWNED)` +
    (options.slow === 'exclude' ? ` (${SLOW_DISCOVERED.size} slow files left to --slow-only)` : options.slow === 'only' ? ' [slow files only]' : '') +
    (options.shard ? ` [shard ${options.shard.index}/${options.shard.count}]` : ''));
  if (ok) zoomPassed++;
  else zoomExtra++;
}
// ---- THE GATE TABLE --------------------------------------------------------
// Every numbered check below is ONE ROW: { label, lane, group, name, hint, run }.
// `label` is the printed number and stays a cross-file unique id: tools/testnumbers.mjs
// (65) reads `label: '<n>'` here and `test('<n>. …')` in engine.test.js and fails on
// a collision, so a row's label is allocated against both files, never by hand here
// alone. Rows print in table order; a gap (29 sits between 46 and 51) is a number
// that was moved, not a row that is missing.
//
// lane 'selftest' rows run only under SELFTESTS and only when `group` is the
// requested --selftest-group (tests/run-node-lanes.mjs); lane 'tree' rows run
// under CORE. `run()` returns { ok, detail }; the loop prints
// `PASS|FAIL  <label>. <name> — <detail> <hint>` and counts it.
//
// `hint` is printed prose, kept in its own field so tools/gatelist.mjs (G1) still
// reads it as executed output: a hint that names `node tools/x.mjs` must be
// backed by an invocation of that tool in this file's execFileSync argv arrays,
// which are the runner functions just below.
//
// Pair shape, for the reason each pair exists: the selftest row is the CHECK'S OWN
// integrity against its planted corpus (its failure is the check's fault); the
// tree row is the state of the repository. Neither quotes a recomposed verdict:
// the detail is the tool's own terminated RESULT sentence (`quote`), because a
// second copy of a verdict drifts, and a verdict the harness cannot read in full
// is a FAIL that says so. No plant counts or tool counts are typed in comments
// here; each tool's RESULT line carries its own.
const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const PIPED = ['ignore', 'pipe', 'pipe'];
const capture = (call) => {
  try {
    return { out: call(), code: 0 };
  } catch (e) {
    return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
  }
};
const execOpts = { cwd: ROOT_DIR, encoding: 'utf8' };
const pipedOpts = { ...execOpts, stdio: PIPED };
// One runner per tool; the literal path stays inside the execFileSync argv array
// because that is what tools/gatelist.mjs counts as an invocation.
const runZoom = (args) => capture(() => execFileSync(process.execPath, ['tools/zoomunits.mjs', ...args], execOpts));
const runSurf = (args) => capture(() => execFileSync(process.execPath, ['tools/surfaces.mjs', ...args], execOpts));
const runCensus = (args) => capture(() => execFileSync(process.execPath, ['tools/screen-census.mjs', ...args], execOpts));
const runMark = (args) => capture(() => execFileSync(process.execPath, ['tools/markhome.mjs', ...args], execOpts));
const runLink = (args) => capture(() => execFileSync(process.execPath, ['tools/linkcheck.mjs', ...args], execOpts));
const runReach = (args) => capture(() => execFileSync(process.execPath, ['tools/statusreach.mjs', ...args], execOpts));
const runGrace = (args) => capture(() => execFileSync(process.execPath, ['tools/gracerefill.mjs', ...args], execOpts));
const runSets = (args) => capture(() => execFileSync(process.execPath, ['tools/closedsets.mjs', ...args], execOpts));
const runVocab = (args) => capture(() => execFileSync(process.execPath, ['tools/onevocab.mjs', ...args], execOpts));
const runGate = (args) => capture(() => execFileSync(process.execPath, ['tools/gatelist.mjs', ...args], execOpts));
const runNums = (args) => capture(() => execFileSync(process.execPath, ['tools/testnumbers.mjs', ...args], execOpts));
const runReads = (args) => capture(() => execFileSync(process.execPath, ['tools/watched.mjs', '--check-reads', ...args], execOpts));
const runUrlPath = (args) => capture(() => execFileSync(process.execPath, ['tools/urlpath-conversions.mjs', ...args], execOpts));
const runWeaponPackages = (args) => capture(() => execFileSync(process.execPath, ['tools/weapon-card-packages.mjs', ...args], execOpts));
const runUiComponents = (args) => capture(() => execFileSync(process.execPath, ['tools/ui-components.mjs', ...args], execOpts));
const runFlaskActions = (args) => capture(() => execFileSync(process.execPath, ['tools/flask-action-contract.mjs', ...args], pipedOpts));
const runUiStrings = (args) => capture(() => execFileSync(process.execPath, ['tools/uistrings.mjs', ...args], pipedOpts));

// One reader for every quoted verdict: the tool's own terminated RESULT sentence.
// A run with NO RESULT line, or one that wraps mid-sentence, is a FAIL that says
// so — quoting half a sentence would PASS on it.
const quote = (out) => {
  const m = out.match(/^RESULT: (.*)$/m);
  if (!m) return { text: null, why: 'NO RESULT LINE — the harness could not read the tool' };
  if (!/\.$/.test(m[1])) return { text: null, why: `TRUNCATED RESULT — "${m[1]}" does not end the sentence, so the verdict wrapped and the harness read half of it` };
  return { text: m[1], why: null };
};
// A row whose verdict is the tool's RESULT line: `what` names the invocation in a failure.
const quoted = (result, what) => {
  const v = quote(result.out);
  return { ok: result.code === 0 && !!v.text, detail: v.text || `${what} (exit ${result.code}): ${v.why}` };
};

const GATES = [
  { label: '36', lane: 'selftest', group: 'zoomunits',
    name: 'the zoom-unit check still catches its own known-bad corpus',
    run: () => quoted(runZoom(['--selftest']), 'zoomunits --selftest') },
  { label: '37', lane: 'tree',
    name: 'the carried set of unconverted px writes is exactly as recorded',
    hint: '(`node tools/zoomunits.mjs` for the ledger, `--raw` for the bare red)',
    run: () => quoted(runZoom([]), 'zoomunits') },
  // 38 — the BOUND, arithmetic half only (Marina's Rule 2): clampBox never returns
  // a box outside the container it was given. Bounding cannot be verified without
  // layout; tools/zoomplace.mjs does that in a browser. The known-bad is the third
  // case (a box bigger than the view); the check cannot see a clamp computed in
  // one space and written in another, and says so in its hint.
  { label: '38', lane: 'tree',
    name: 'clampBox keeps a box inside its named container',
    hint: '(arithmetic only — the space it is computed in is what #15 was, and no unit test can see that)',
    run: async () => {
      const { clampBox } = await import('../src/ui/fx.js');
      const view = { width: 1000, height: 800 };
      const inside = (b, w, h, pad) => b.left >= pad - 0.001 && b.top >= pad - 0.001 && b.left + w <= view.width - pad + 0.001 && b.top + h <= view.height - pad + 0.001;
      // No coverage summary of these cases in prose: the names below are that
      // description, single-homed.
      const cases = [
        ['a box already inside is not moved', () => {
          const r = clampBox({ left: 100, top: 100, width: 200, height: 100 }, view);
          return r.left === 100 && r.top === 100;
        }],
        ['a box off the right/bottom is pulled back inside', () => {
          const r = clampBox({ left: 1400, top: 1400, width: 200, height: 100 }, view);
          return inside(r, 200, 100, 4);
        }],
        ['a box off the left/top is pushed back inside', () => {
          const r = clampBox({ left: -900, top: -900, width: 200, height: 100 }, view);
          return inside(r, 200, 100, 4);
        }],
        ['a box larger than the view pins to the low edge, never slides off the far one', () => {
          const r = clampBox({ left: -5000, top: 5000, width: 4000, height: 3000 }, view);
          return r.left === 4 && r.top === 4;
        }],
        ['keep:40 lets a pointer-tracked box overhang, but never vanish', () => {
          const r = clampBox({ left: -5000, top: -5000, width: 200, height: 100 }, view, { keep: 40 });
          return r.left + 200 >= 44 && r.top + 100 >= 44 && r.left < 4 && r.top < 4;
        }],
        ['keep larger than the box degrades to the whole box, not to a negative bound', () => {
          const r = clampBox({ left: 9999, top: 9999, width: 20, height: 20 }, view, { keep: 500 });
          return inside(r, 20, 20, 4);
        }],
        // The far edge of the SAME rule: `lo` and `hi` are different expressions and
        // the keep:40 case above exercises only `lo`. Mutating `hi = span - pad - k`
        // to `span - pad - size` leaves the six cases above green while a
        // pointer-tracked box loses its overhang (956 -> 796).
        ['keep:40 overhangs the RIGHT/BOTTOM edge too, not just the left/top', () => {
          const r = clampBox({ left: 9999, top: 9999, width: 200, height: 100 }, view, { keep: 40 });
          return r.left + 200 > view.width - 4 && r.top + 100 > view.height - 4
              && r.left <= view.width - 4 - 40 + 0.001 && r.top <= view.height - 4 - 40 + 0.001;
        }],
      ];
      const bad = cases.filter(([, fn]) => !fn()).map(([n]) => n);
      return { ok: !bad.length, detail: bad.length ? `failed: ${bad.join('; ')}` : `${cases.length}/${cases.length} cases.` };
    } },
  // 39/40 — every navigable surface declared in data has a handler (#78). A join
  // between two lists in the UI layer, so it lives here rather than in
  // engine.test.js (whose numbered names two files cannot both hand out).
  { label: '39', lane: 'selftest', group: 'surfaces',
    name: 'the surface check still catches its own known-bad corpus',
    run: () => quoted(runSurf(['--selftest']), 'surfaces --selftest') },
  { label: '40', lane: 'tree',
    name: 'every declared navigable surface has a handler',
    hint: '(`node tools/surfaces.mjs` for the sets, `--selftest` for the reds)',
    run: () => quoted(runSurf([]), 'surfaces') },
  // 41/42 — the screen census (Marina's ruling, 2026-08-07). Wired in because a
  // census nobody runs is the defect it reports: it needs no browser, bundle or
  // port. 41 is its own integrity; 42 red with exit 2 means the census could not
  // be taken (the check's or the tree's fault, never the game's), exit 1 is a
  // finding and its line names the owner. 42 PASSES while screens sit unwatched,
  // on purpose: how many are unwatched is the project's state, printed every run
  // and graded by nobody here.
  { label: '41', lane: 'selftest', group: 'screen-census',
    name: 'the screen census still catches its own known-bad corpus',
    run: () => quoted(runCensus(['--selftest']), 'screen-census --selftest') },
  { label: '42', lane: 'tree',
    name: 'every screen in the tree is mountable, and the census can still read it',
    hint: '(`node tools/screen-census.mjs` for the checklist itself)',
    run: () => quoted(runCensus(['--raw']), 'screen-census') },
  // 43/44 — card text marks have one home (Sunna): fillTemplate() output is drawn
  // in two containers (the card face and the Smith preview in #tooltip), and a
  // rule keyed to `.card` only left the preview's changed number unstyled.
  { label: '43', lane: 'selftest', group: 'markhome',
    name: 'the card-text mark check still catches its own known-bad corpus',
    run: () => quoted(runMark(['--selftest']), 'markhome --selftest') },
  { label: '44', lane: 'tree',
    name: 'every card-text mark rule reaches both places card text is drawn',
    hint: '(`node tools/markhome.mjs` for the ledger)',
    run: () => quoted(runMark(['--raw']), 'markhome') },
  // 45/46 — every named import resolves to a real export. linkcheck links every
  // module graph without evaluating a line, so a renamed export that leaves a
  // hand-started tool standing is caught for the price of no browser. 45 has
  // three results (caught / MISSED / UNPLANTABLE) so a plant whose edit did not
  // land is never reported as a catch or a miss.
  { label: '45', lane: 'selftest', group: 'linkcheck',
    name: 'the link check still catches its own known-bad corpus',
    run: () => quoted(runLink(['--selftest']), 'linkcheck --selftest') },
  { label: '46', lane: 'tree',
    name: 'every named import in the tree resolves to a real export',
    hint: '(`node tools/linkcheck.mjs` names the file and the error)',
    run: () => quoted(runLink(['--raw']), 'linkcheck') },
  // 29/51 — can a player ever meet this status? (Rune, 2026-08-08.) Two complete
  // threshold-proc rows shipped with no applier; every downstream check tested
  // the ROW, none could tell a row with a door from one without. 29 was "50."
  // and collided with engine.test.js's own 50: it moved to the one gap in the
  // sequence (tools/testnumbers.mjs --raw), so this table reads 46, 29, 51.
  { label: '29', lane: 'selftest', group: 'statusreach',
    name: 'the status-reach check still catches its own known-bad corpus',
    run: () => quoted(runReach(['--selftest']), 'statusreach --selftest') },
  { label: '51', lane: 'tree',
    name: 'every shipped status has something that applies it',
    hint: '(`node tools/statusreach.mjs` names the row and the route)',
    run: () => quoted(runReach([]), 'statusreach') },
  // 52/53 — every exported closed set has a reader (Marina's ask).
  { label: '52', lane: 'selftest', group: 'closedsets',
    name: 'the closed-set check still catches its own known-bad corpus',
    run: () => quoted(runSets(['--selftest']), 'closedsets --selftest') },
  { label: '53', lane: 'tree',
    name: 'every exported closed set is read by something',
    hint: '(`node tools/closedsets.mjs` for the table, `--selftest` for the reds)',
    run: () => quoted(runSets([]), 'closedsets') },
  // 54/55 — the grace refill (Constantine, 2026-08-08). The plants enter by the
  // door the real input uses: a deep copy of the real contentBundle handed to
  // the real validateContent, registries built by createRegistries.
  { label: '54', lane: 'selftest', group: 'gracerefill',
    name: 'the grace-refill refusals still catch their own known-bad corpus',
    run: () => quoted(runGrace(['--selftest']), 'gracerefill --selftest') },
  { label: '55', lane: 'tree',
    name: 'a grace pours what balance.graceRefill says it pours',
    hint: '(`node tools/gracerefill.mjs` names each row and what it resolves to)',
    run: () => quoted(runGrace([]), 'gracerefill') },
  // 56/57 — the relic-modifier vocabulary is ONE vocabulary (Sten). The other
  // half of 52/53's stated hole: closedsets asks whether a set has a reader,
  // onevocab asks whether one vocabulary has a second hand-typed copy.
  { label: '56', lane: 'selftest', group: 'onevocab',
    name: 'the one-vocabulary check still catches its own known-bad corpus',
    run: () => quoted(runVocab(['--selftest']), 'onevocab --selftest') },
  { label: '57', lane: 'tree',
    name: 'the relic-modifier vocabulary has one home and one derivation path',
    hint: '(`node tools/onevocab.mjs` names the copy and the door that disagreed)',
    run: () => quoted(runVocab([]), 'onevocab') },
  // 67/68 — does a gate run its instruments, and does it listen? (#295.) It lives
  // here and not in the workflow because a `|| true` on a redundant step silences
  // the gate the day the tree goes green, and this suite runs at every gate.
  // 67 was derived from testnumbers' own "next free number" output after three
  // collisions with engine.test.js; a reservation written in one file is not one.
  { label: '67', lane: 'selftest', group: 'gatelist',
    name: 'the gate-list check still catches its own known-bad corpus',
    run: () => quoted(runGate(['--selftest']), 'gatelist --selftest') },
  { label: '68', lane: 'tree',
    name: "every step that names an instrument invokes it or states what goes unwatched, and no shell invocation's exit status is swallowed",
    hint: '(`node tools/gatelist.mjs --raw` for the census, `--since <ref>` for what a ref ADDED)',
    run: () => quoted(runGate([]), 'gatelist') },
  // 64/65 — no two tests wear the same number; 64 is the check's own corpus and
  // 65 the state of the two declared test sources. Numbered 64/65 with a gap left
  // for in-flight PRs; the gap did not hold, which is what the check exists for.
  { label: '64', lane: 'selftest', group: 'testnumbers',
    name: 'the test-number check still catches its own known-bad corpus',
    run: () => quoted(runNums(['--selftest']), 'testnumbers --selftest') },
  // 69 — the probe corpus's own derivations (Bjorn, 2026-08-22): tools/watched.mjs
  // `--check-reads` needs no browser, ledger or bundle, so CI can afford it.
  { label: '69', lane: 'tree',
    name: 'every watched-probe still reads a file that exists and an anchor still in it',
    hint: '(`node tools/watched.mjs --check-reads` for the derived file:line of every anchor)',
    run: () => quoted(runReads([]), 'watched --check-reads') },
  { label: '65', lane: 'tree',
    name: 'no two tests in this suite wear the same number',
    hint: '(`node tools/testnumbers.mjs --raw` for every label and where it is declared)',
    run: () => quoted(runNums([]), 'testnumbers') },
  // 73/74 — module URL/filesystem path conversions use node:url (#13). 73 proves
  // the two required known-bads through the real scanner from a spaced working
  // directory; 74 scans tools/ and tests/.
  { label: '73', lane: 'selftest', group: 'urlpath-conversions',
    name: 'the URL/path check catches both known-bads from a spaced working directory',
    run: () => quoted(runUrlPath(['--selftest']), 'urlpath-conversions --selftest') },
  { label: '74', lane: 'tree',
    name: 'module URL/filesystem path conversions use the platform API',
    hint: '(`node tools/urlpath-conversions.mjs` names each site)',
    run: () => quoted(runUrlPath([]), 'urlpath-conversions') },
  // 77/78 — fixed attack-slot composition: the first proves the old right-hand-only
  // lookup is still discriminating, the second runs the full 0/1/2 weapon matrix.
  { label: '77', lane: 'selftest', group: 'weapon-card-packages',
    name: 'the weapon-package check catches the right-hand-only lookup',
    run: () => quoted(runWeaponPackages(['--selftest']), 'weapon-card-packages --selftest') },
  { label: '78', lane: 'tree',
    name: 'equipped weapons deterministically rebind the fixed authored attack slots',
    run: () => quoted(runWeaponPackages([]), 'weapon-card-packages') },
  // 94/95 — reusable UI component contracts (#1316). C5 and C12 sat red on dev
  // because nothing ran the tool.
  { label: '94', lane: 'selftest', group: 'ui-components',
    name: 'the UI component check still catches its own known-bad corpus',
    run: () => quoted(runUiComponents(['--selftest']), 'ui-components --selftest') },
  { label: '95', lane: 'tree',
    name: 'every reusable UI component contract holds',
    hint: '(`node tools/ui-components.mjs` names each broken contract)',
    run: () => quoted(runUiComponents([]), 'ui-components') },
  // 96/97 — the flask action contract. Its verdict is its own SELFTEST line and
  // "N passed, M failed" line, not a RESULT sentence.
  { label: '96', lane: 'selftest', group: 'flask-action-contract',
    name: 'the flask action contract still catches its own known-bad corpus',
    run: () => {
      const r = runFlaskActions(['--selftest']);
      const verdict = r.out.match(/^SELFTEST (?:GREEN|RED)[^\n]*/m)?.[0] || '';
      return { ok: r.code === 0 && /^SELFTEST GREEN/.test(verdict), detail: verdict || `flask-action-contract --selftest (exit ${r.code}) printed no SELFTEST verdict` };
    } },
  { label: '97', lane: 'tree',
    name: "combat and the map's Potions control share one flask action contract",
    hint: '(`node tools/flask-action-contract.mjs` names each check)',
    run: () => {
      const r = runFlaskActions([]);
      const v = r.out.match(/^flask-action-contract: (\d+) passed, (\d+) failed$/m);
      const fails = [...r.out.matchAll(/^FAIL (.*)$/gm)].map((m) => m[1]).join('; ');
      return {
        ok: r.code === 0 && !!v && v[2] === '0' && Number(v[1]) > 0,
        detail: `${v ? v[0] : `flask-action-contract (exit ${r.code}) printed no verdict`}${fails ? ` (${fails})` : ''}`,
      };
    } },
  // 98/99 — the copy ratchet (tools/uistrings.mjs). It sat red on dev from
  // 2026-09-17 to 2026-10-02 because nothing ran it.
  { label: '98', lane: 'selftest', group: 'uistrings',
    name: 'the copy ratchet still catches its own known-bad corpus',
    run: () => {
      const r = runUiStrings(['--selftest']);
      const verdict = r.out.match(/^uistrings --selftest: (?:OK|RED)[^\n]*/m)?.[0] || '';
      return { ok: r.code === 0 && /: OK — /.test(verdict), detail: verdict || `uistrings --selftest (exit ${r.code}) printed no verdict` };
    } },
  { label: '99', lane: 'tree',
    name: 'no file holds more or fewer hardcoded sentences than the copy baseline records',
    hint: '(`node tools/uistrings.mjs --check` names each file)',
    run: () => {
      const r = runUiStrings(['--check']);
      const verdict = r.out.match(/^uistrings: (?:OK|RED)[^\n]*/m)?.[0] || '';
      const rows = [...r.out.matchAll(/^ {2}((?:GREW|SHRANK|NOT A REPO KEY)[^\n]*)$/gm)].map((m) => m[1]).join('; ');
      return { ok: r.code === 0 && /^uistrings: OK — /.test(verdict), detail: `${verdict || `uistrings --check (exit ${r.code}) printed no verdict`}${rows ? ` (${rows})` : ''}` };
    } },
  // 76 — destructive quit/load confirmation without a native browser prompt. A DOM
  // behavior test with a deliberately tiny host: it exercises the shared
  // component's event contract and reads both controller call sites; it does not
  // render pixels or claim responsive geometry (browser QA).
  { label: '76', lane: 'tree',
    name: 'quit and load use one reversible themed confirmation behavior',
    run: async () => {
      const { runConfirmationModalContract } = await import('./confirmation-modal.test.mjs');
      const confirmation = await runConfirmationModalContract();
      return { ok: confirmation.ok, detail: confirmation.detail };
    } },
  // 79 — the shipped pose frames and their generated table agree. The table
  // (src/content/poseSprites.js) is generated from art/poses by tools/pose-ship.mjs;
  // committing one side without the other leaves rows naming files that are not
  // there, and registration lives in these numbers (a floor line not below its
  // crop top would place the figure off its feet).
  { label: '79', lane: 'tree',
    name: 'every shipped pose frame has a file and registers on its floor',
    hint: '(tools/pose-ship.mjs regenerates both sides; this check reads them, it does not run it)',
    run: async () => {
      // Each frame is an art-manifest.json id (step 12), not a file in a tree here.
      const { manifestIds } = await import('../tools/art-source.mjs');
      const shipped = manifestIds();
      const { POSE_FRAMES, POSE_STRIP, POSE_DIR, POSE_CANVAS } = await import('../src/content/poseSprites.js');
      const classes = [...new Set([...POSE_FRAMES.keys()].map((k) => k.split('_')[0]))];
      const tints = [...new Set([...POSE_FRAMES.keys()].map((k) => k.split('_').at(-1)))];
      const bad = [];
      for (const c of classes) {
        for (const t of tints) {
          for (const pose of POSE_STRIP) {
            const row = POSE_FRAMES.get(`${c}_${pose}_${t}`);
            if (!row) { bad.push(`${c}/${pose}/${t}: no row`); continue; }
            if (!shipped.has(POSE_DIR + row.f)) bad.push(`${c}/${pose}/${t}: ${row.f} missing from art-manifest.json`);
            if (!(row.g > row.y)) bad.push(`${c}/${pose}/${t}: floor ${row.g} is not below the crop top ${row.y}`);
            if (row.x + row.w > POSE_CANVAS.width + 1 || row.y + row.h > POSE_CANVAS.height + 1) {
              bad.push(`${c}/${pose}/${t}: crop runs off the ${POSE_CANVAS.width}x${POSE_CANVAS.height} canvas`);
            }
          }
        }
      }
      const want = classes.length * tints.length * POSE_STRIP.length;
      return {
        ok: !bad.length,
        detail: bad.length ? `${bad.length} bad: ${bad.slice(0, 3).join('; ')}` : `${want}/${want} frames over ${classes.length} classes x ${tints.length} tints x ${POSE_STRIP.length} poses.`,
      };
    } },
];

for (const gate of GATES) {
  const inLane = gate.lane === 'selftest' ? SELFTESTS && selftestInGroup(options.selftestGroup, gate.group) : CORE;
  if (!inLane) continue;
  const { ok, detail } = await gate.run();
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${gate.label}. ${gate.name} — ${detail}${gate.hint ? ` ${gate.hint}` : ''}`);
  if (ok) zoomPassed++;
  else zoomExtra++;
}

// The combat-foundation suites themselves are discovered above; this is the
// tag-junction audit that used to ride in the same try.
if (CORE) {
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync(process.execPath, ['tools/attack-source-audit.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    console.log('PASS  attack-source audit: the tag junction is current (attack-source-audit --check)');
    zoomPassed++;
  } catch (error) {
    console.log(`FAIL  attack-source audit: ${error.stdout || error.message}`);
    zoomExtra++;
  }
}
// FINISH §10: every asset directory has a CREDITS.md row, and README §Legal
// names the same AI vendors as the AI disclosure. The selftest is in memory
// (fixture text only, no copies of the tree), so it is cheap in either lane.
{
  const { execFileSync } = await import('node:child_process');
  const runCredits = (args) => execFileSync(process.execPath, ['tools/credits-check.mjs', ...args], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  const lanes = [];
  if (CORE) lanes.push({ args: [], label: 'credits-check: every asset directory has a CREDITS row; README §Legal agrees with the AI disclosure' });
  if (SELFTESTS && selftestInGroup(options.selftestGroup, 'credits-check')) lanes.push({ args: ['--selftest'], label: 'credits-check --selftest: each rule still goes red on its plant' });
  for (const lane of lanes) {
    try {
      const out = runCredits(lane.args).trim().split('\n').pop();
      console.log(`PASS  ${lane.label} — ${out}`);
      zoomPassed++;
    } catch (error) {
      console.log(`FAIL  ${lane.label} — ${String(error.stdout || error.message).slice(0, 800)}`);
      zoomExtra++;
    }
  }
}
// FINISH §3, *A headless full run in CI*: five whole seeded runs for every
// class (map → fights → rewards → events → acts → boss), each to a win or a
// death. Red on a crash, and red on a SOFT-LOCK — a fight the bot's actions
// never resolve, or a map walk longer than the map without reaching its boss.
// Seeds are runsim's fixed formula, so the run is the same every time; it takes
// a few seconds. The selftest plants a throw inside a fight, a stalled fight and
// a boss-less map cycle, and requires a clean fleet to repeat seed for seed.
if (CORE || (SELFTESTS && selftestInGroup(options.selftestGroup, 'runsim'))) {
  const { execFileSync } = await import('node:child_process');
  const { RUNSIM_FLEET_TIMEOUT_MS, RUNSIM_SELFTEST_TIMEOUT_MS } = await import('../tools/runsim-selftest-policy.mjs');
  const runSim = (args) => {
    try {
      const timeout = args.includes('--selftest') ? RUNSIM_SELFTEST_TIMEOUT_MS : RUNSIM_FLEET_TIMEOUT_MS;
      return { out: execFileSync(process.execPath, ['tools/runsim.mjs', ...args], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}\nsubprocess: exit ${e.status ?? 'none'}, signal ${e.signal || 'none'}, error ${e.code || 'none'}\n`, code: e.status ?? 1 };
    }
  };
  const lanes = [];
  if (CORE) lanes.push({ args: ['5'], label: 'runsim 5: a headless full run for every class on fixed seeds, 0 crashes, 0 soft-locks' });
  if (SELFTESTS && selftestInGroup(options.selftestGroup, 'runsim')) lanes.push({ args: ['--selftest'], label: 'runsim --selftest: a crash, a stalled fight and a boss-less map each still go red' });
  for (const lane of lanes) {
    const r = runSim(lane.args);
    const result = (r.out.match(/^RESULT: (.*)$/m) || [])[1];
    const ok = r.code === 0 && result && !/^FAILED/.test(result);
    const detail = result && r.code === 0 ? result
      : `runsim ${lane.args.join(' ')} (exit ${r.code}): ${result || 'no RESULT line'}\n${r.out.slice(-800)}`;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${lane.label} — ${detail}`);
    if (ok) zoomPassed++;
    else zoomExtra++;
  }
}
// The third authored tree: content/config/**.json compiles to
// src/config/generated/ui.js. A hand edit to the generated module, or a JSON
// edit nobody compiled, is red here (tests/ui-config.test.mjs holds the rules).
if (CORE) {
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync(process.execPath, ['tools/config-build.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    console.log('PASS  generated UI config is current with content/config (config-build --check)');
    zoomPassed++;
  } catch (error) {
    console.log(`FAIL  generated UI config: ${error.stderr || error.stdout || error.message}`);
    zoomExtra++;
  }
  // The fourth authored tree: content/hud-layout/<form-factor>.json compiles to
  // styles/hud-layout.generated.css (docs/hud-layout-tokens.md). A hand edit to
  // the stylesheet, or a JSON edit nobody compiled, is red here
  // (tests/hud-layout-css.test.mjs holds the rules).
  try {
    execFileSync(process.execPath, ['tools/hud-layout-css.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    console.log('PASS  generated HUD layout CSS is current with content/hud-layout (hud-layout-css --check)');
    zoomPassed++;
  } catch (error) {
    console.log(`FAIL  generated HUD layout CSS: ${error.stderr || error.stdout || error.message}`);
    zoomExtra++;
  }
  // The design tokens in content/config/ui/tokens.json publish as CSS custom
  // properties in styles/tokens.generated.css (tests/tokens-css.test.mjs).
  try {
    execFileSync(process.execPath, ['tools/tokens-css.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    console.log('PASS  generated token CSS is current with content/config/ui/tokens.json (tokens-css --check)');
    zoomPassed++;
  } catch (error) {
    console.log(`FAIL  generated token CSS: ${error.stderr || error.stdout || error.message}`);
    zoomExtra++;
  }
  // The style ratchet: raw font sizes below the text minimum, bare z-index of
  // 100+ and bare hex colours in styles/*.css may fall but never rise above
  // tools/style-lint-baseline.json (tests/style-lint.test.mjs holds the rules).
  try {
    execFileSync(process.execPath, ['tools/style-lint.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    console.log('PASS  style lint is within its baseline (style-lint --check)');
    zoomPassed++;
  } catch (error) {
    console.log(`FAIL  style lint: ${error.stderr || error.stdout || error.message}`);
    zoomExtra++;
  }
  // The tag tree's derived views — tags, domains, pairings, property rules and
  // src/framework/data/{properties,relations}.js (which bakes the default
  // balance bindings in) — are generated, and nothing at runtime checks them
  // against the tree. This is the drift gate: an edit to nodes.csv or
  // balance.js that was not rebuilt is red here.
  try {
    execFileSync(process.execPath, ['tools/content-build.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    console.log('PASS  generated content is current with content/source, the tag tree\'s views included (content-build --check)');
    zoomPassed++;
  } catch (error) {
    console.log(`FAIL  generated content: ${String(error.stderr || error.stdout || error.message).slice(0, 600)}`);
    zoomExtra++;
  }
}
if (CORE) try {
  const { runCardRemovalFlickTests } = await import('./card-removal-flick.test.mjs');
  const result = runCardRemovalFlickTests();
  console.log(`PASS  Card removal and touch flick regressions: ${result.checks} checks`);
  zoomPassed++;
} catch (error) {
  zoomExtra++;
  console.error('FAIL  Card removal and touch flick regressions:', error);
}
// The bundler rewrites `import { x } from` into a load-time destructure, so a
// named import of a module that is still loading (an import cycle) is undefined
// for good, while Node's ESM live bindings hide it from every other test here.
// This walks the same module graph in the bundle's require order. Origin/dev
// had three (evalPredicate in cardBehavior.js crashed selectCardVariant live).
if (CORE) try {
  const { findCycleHazards } = await import('../tools/bundle-cycles.mjs');
  const hazards = findCycleHazards('src/main.js');
  if (hazards.length) {
    for (const h of hazards) console.log(`  ${h.importer}:${h.line} destructures {${h.names.join(', ')}} from ${h.target} mid-load: ${h.chain.join(' -> ')}`);
    console.log(`FAIL  no bundled named import targets a module still loading: ${hazards.length} hazard(s); use \`import * as N\` for cyclic edges`);
    zoomExtra++;
  } else {
    console.log('PASS  no bundled named import targets a module still loading (import-cycle destructure hazard)');
    zoomPassed++;
  }
} catch (error) {
  console.log('FAIL  bundle cycle check: ' + error.message);
  zoomExtra++;
}
console.log(`\n${passed + zoomPassed} passed, ${failed + zoomExtra} failed`);
console.log('BOUNDARY: 1–35 are engine and content invariants. 36–37 are a CONSISTENCY');
console.log('          check over coordinate spaces — they prove a transform has two');
console.log('          homes, never that a pixel renders wrong. 38 is arithmetic on');
console.log('          numbers a caller supplies, and the #15 defect was a correct');
console.log('          clamp computed in the wrong space, which 38 cannot detect.');
console.log('          Nothing here opens a browser, so no test in this file has seen');
// BARE FORM, not `node tools/zoomplace.mjs`. Every boundary line in ci.yml names
// its tool bare — "tools/tutorial-reach.mjs drives 8 viewports and NO job here
// runs it" — and spelling the command instead is a different speech act: it is
// what a reader would TYPE, and it reads as "this list runs this". This line was
// the only command-form boundary reference in either gate list, and tools/gatelist.mjs
// (67/68) now holds that distinction as a rule, so the one exception had to go.
// The sentence is unchanged; only the backticked command became a bare name.
// — Bjorn, 2026-08-21, #295.
console.log('          the screen. tools/zoomplace.mjs is the half that has.');
console.log('          39–40 are a JOIN between two source lists: they prove every');
console.log('          declared navigable surface HAS a handler, never that the');
console.log('          handler draws anything — release-shots is the half that has');
console.log('          watched a panel paint.');
console.log('          41–42 are a CENSUS, not a verdict: they prove every screen in');
console.log('          src/ui/screens/ is mountable and that the census can still read');
console.log('          its homes. A screen counted as reached is one an instrument NAMES');
console.log('          a way into — not one anything ran, passed, or photographed.');
console.log('          43–44 read SELECTORS, not pixels. They prove no card-text mark');
console.log('          rule is keyed to one of the two containers card text is drawn');
console.log('          in; they are silent on what colour it ends up, on inline styles,');
console.log('          and on any other route to one container only. The render');
console.log('          comparison that would close that has no home in this suite.');
console.log('          45–46 LINK, THEY DO NOT RUN. Every named import resolves to a real');
console.log('          export and not one module body was executed — so they prove the');
console.log('          eleven hand-started instruments START, never that any of them');
console.log('          WORKS. A name that exists but is wrong links green, and');
console.log('          release-shots must still be RUN by a person before a delivery.');
console.log('          50–51 prove a status has a DOOR, never that the door opens on');
console.log('          anything. They read definitions: nothing here says a card is in');
console.log('          a pool, that a run can draw it, or that the numbers are balanced.');
console.log('          Cases 7e2 and 7e3 separately exercise one real tagged hit for');
console.log('          each exposure; they do not prove broader card coverage.');
console.log('          52–53 ASK ONE QUESTION: is each exported closed set READ anywhere.');
console.log('          They are silent on whether a set has a second, hand-typed copy');
console.log('          somewhere — the defect that made the question worth asking. Green');
console.log('          means no vocabulary is decoration, never that none is duplicated.');
console.log('          That silence now has exactly ONE exception and it is named, not general:');
console.log('          56–57 close it for the relic-modifier vocabulary alone. Every other');
console.log('          closed set in the tree is still unwatched for a second copy.');
console.log('          54–55 NEVER OPEN A BROWSER. 54 proves the boot refusals fire and the');
console.log('          shrine pours, through the real bundle and the real registry; 55 reports');
console.log('          the shipped table. Neither has seen the settings rows or the shrine');
console.log('          sentence — those are photographed (`?shot=rest`), not asserted.');
console.log('          Neither settles whether 3+3 is release balance; the old no-Mana');
console.log('          A/B is stale, so that needs a Mana-aware simulation and player review.');
console.log('          56–57 GUARD ONE VOCABULARY: the tags and resource ids a relic uses to');
console.log('          modify you. They prove that vocabulary has one typed home, that both');
console.log('          content doors accept the same words, and that a relic resource grant');
console.log('          reaches max HP by one road with one answer at creation and at load.');
console.log('          They are SILENT on the other modifier vocabularies this game carries —');
console.log('          64-65 ARE ABOUT THE SUITE ITSELF, not the game: no two tests wear the same');
console.log('          number. A CONSISTENCY check — it proves the declared labels do not collide,');
console.log('          never that any label is the right one, and it reads only the two declared');
console.log('          test sources, so a third test file or a number composed at runtime is');
console.log('          invisible to it.');
console.log("          equipment's `self.maxHp/maxMana/maxStamina=+N` mods column, relic PASSIVE_TYPES scalars,");
console.log('          status MODIFIER_TYPES — and on whether any of those numbers is balanced.');
console.log('          67–68 ARE ABOUT THE GATE, NOT THE GAME — the only pair here that is. They');
console.log('          prove that every STEP naming an instrument invokes it (or states what goes');
console.log('          unwatched), and that no invocation in a SHELL list has its exit status');
console.log('          discarded. THE NAME IS THE MEASUREMENT: 63 says SWALLOWED, not SILENCED, because');
console.log('          swallowing is what G4 measures. ⚠ IT DOES NOT COVER THIS');
console.log('          FILE: a JavaScript gate list is not audited for it, and this suite is one — so');
console.log('          63 is deaf in its own venue and says so in its own output, by name, every run.');
console.log('          They say NOTHING about whether a listed tool passes,');
console.log('          nothing about instruments a person starts at a terminal, and nothing about a');
console.log('          gate that lives only in a PR body. The census of which tools sit in no list');
console.log('          is REPORTED by that tool and asserted by nobody — that disposition is a');
console.log('          design call with real costs, and it is not this suite\'s to make.');
console.log('          69 IS A CONSISTENCY CHECK OVER A CITATION, NOT A CORRECTNESS ONE. It proves');
console.log('          every watched-probe still names a file that exists and an anchor literal');
console.log('          still in it — it CANNOT tell whether that anchor identifies the right thing,');
console.log('          and an anchor picked loose enough to survive any edit greens here forever.');
console.log('          `by` in tools/watched-probes.json names who picked it. It also runs only the');
console.log('          READ door of tools/watched.mjs: nothing in this suite opens the build, drives');
console.log('          a probe, or photographs a control, so `watched` as a VERDICT is still');
console.log('          unwatched by CI — only the derivations behind it are.');
console.log('          73–74 guard module URL/path conversion shapes in tools/ and tests/:');
console.log('          actual dynamic file:// templates/concats and same-file static URL');
console.log('          pathname conversions through direct, grouped, bracket, destructuring,');
console.log('          or bounded local-alias forms. A platform consumer is trusted only through');
console.log('          its static node:url import; ambiguous lexical, binding, or alias flow fails');
console.log('          closed. They prove both fixtures fail from a spaced working directory;');
console.log('          they do not cover cross-module flow or platform-API semantic correctness.');
console.log('          76 drives the shared confirmation component in a minimal DOM and reads');
console.log('          the two controller call sites. It proves cancellation/commit semantics,');
console.log('          focus containment/return, and native-prompt removal; it does not paint');
console.log('          the dialog or prove responsive geometry in a real browser.');
// On macOS stdout to a pipe is asynchronous, and an immediate process.exit cut the
// report off mid-stream (the failing test's name never reached the CI log). Exit
// once the last write has been flushed; writes on one stream complete in order.
process.exitCode = failed + zoomExtra > 0 ? 1 : 0;
process.stdout.write('', () => process.exit(process.exitCode));
