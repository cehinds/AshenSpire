// tools/dirorder.mjs — the one home for "what order do we read a directory in?"
//
// WHY THIS FILE EXISTS
// -------------------
// A build tool that iterates a directory with a bare `readdirSync` inherits the
// FILESYSTEM's order, and that order is not a property of the repo — it is a
// property of the machine. `build/AshenSpire.html` as committed at 40c5b21 proves
// it: its ASSET_MAP holds the same 97 keys as a Linux rebuild, in an order that
// differs at exactly two positions —
//
//     committed : … enemy_blightedValkyrie.webp , enemy_blightHound.webp …
//     rebuilt   : … enemy_blightHound.webp      , enemy_blightedValkyrie.webp …
//
// The committed order is CASE-INSENSITIVE collation ("blighted" < "blighth"),
// i.e. the shipped bundle was built on a case-insensitive filesystem (NTFS or
// APFS). So the artifact could not be reproduced — and therefore could not be
// verified by hash — from its own source at its own ref.
//
// THE TRAP, and it is the reason this is a module and not two `.sort()` calls:
// `localeCompare` and any case-insensitive comparator REPRODUCE the bad order.
// The fix is only a fix because it is byte order — locale-independent,
// collation-independent, identical on every runner. Written once, here, with the
// reason attached; a `.sort()` at each call site is the decision copied twice
// with its reason nowhere.
//
// Callers: tools/bundle.mjs (assets/ sweep), tools/content-build.mjs
// (content/source sweep). Both previously held this decision, and only one of
// them knew it.
//
// WHY THERE IS A CORPUS BELOW, and who put it there
// -------------------------------------------------
// Everything above this line existed at 4dd963a and asserted NOTHING. Vira signed
// #8 by reinstating the defect instead of arguing about it: in a real clone she
// swapped the comparator to `a.localeCompare(b)`, regenerated the artifacts the way
// an "improver" would, and got `verify-shipped` 4/4, `--selftest` 9/9,
// `tests/run-node.mjs` 34/0 and `git diff --exit-code -- build dist` CLEAN — over a
// bundle whose ASSET_MAP key order was byte-for-byte the 40c5b21 defect order
// again, 97 of 97. Every check in this PR green over the exact bug the branch is
// named after.
//
// The paragraphs above are the tell, not the guard. Lines 11-12 had the fixture
// already typed — as prose, with nothing asserting either string. That is the same
// shape I convicted bundle.mjs of one commit earlier: the defect named in prose,
// the guard unable to fire. So:
//
//   node tools/dirorder.mjs --selftest   the corpus — must pass
//   node tools/dirorder.mjs --mutate     reinstate the defect N ways; each must be
//                                        CAUGHT. Inverted expectation, so the
//                                        corpus is one nobody has to take on trust.
//
// The fixture is history's, not mine: the 34 names of assets/sprites/ in the order
// the 40c5b21 bundle recorded them (a case-insensitive filesystem's readdir), and
// the fact that byte order differs from it at exactly two positions. A synthesized
// pair would be my opinion about the trap; this pair is the trap.
//
// It does NOT rebuild anything, on purpose. My own boundary in ci.yml says building
// twice in one tree can never catch this, because readdir order is stable per
// filesystem — so a corpus that reached for a rebuild would be re-measuring the
// machine. The fixture is the point.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day fewer than two
// tools read a directory whose order reaches a shipped artifact — one caller is a
// local helper and belongs inline. Also delete it if a future build stops
// embedding iteration order in its output at all (e.g. the asset map becomes a
// sorted-at-load structure), because then the order is no longer observable and
// this guard is guarding nothing.
//
// REMOVAL CONDITION FOR THE CORPUS specifically: it goes when the comparator goes,
// and not before — it is deleted with this file, never separately, because a
// comparator here with no corpus is the state Vira falsified. Two narrower edits
// are allowed rather than deletion: (a) if the assets/sprites/ pair is ever
// renamed, the fixture stays as it is — it is a frozen historical listing, not a
// mirror of the working tree, and it must NOT be regenerated to match a later
// tree; (b) a mutation drops out of --mutate only when that mutation becomes
// impossible to write here, not when it becomes unlikely. It is NOT removed for
// having passed a long time — a --mutate that stops catching things is the alarm.

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * readdirSortedSync(dir, options?) → the same value `readdirSync` returns, in
 * byte order. Pass `{ withFileTypes: true }` and Dirents come back sorted by
 * `.name`. Byte order deliberately: see the trap above.
 */
export function readdirSortedSync(dir, options) {
  const entries = readdirSync(dir, options);
  if (entries.length && typeof entries[0] === 'string') {
    return entries.sort(byteOrder);
  }
  return entries.sort((a, b) => byteOrder(a.name, b.name));
}

// Explicit comparator rather than a bare `.sort()` so nobody "improves" it into
// a locale-aware one. `<`/`>` on JS strings compare UTF-16 code units, which is
// what every runner agrees on.
//
// Exported so the corpus can assert on the comparator DIRECTLY instead of through
// a filesystem. Vira's precision, which I am keeping: the name says "byte" and the
// operation is UTF-16 code units — identical for ASCII, divergent above U+FFFF.
// Every asset name is ASCII, so it is n/a today; the honest text is here and the
// overclaim is only in the name.
export function byteOrder(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ===========================================================================
// THE KNOWN-BAD CORPUS
//
// Nothing below runs on import — see isMain(). tools/verify-shipped.mjs runs its
// whole body on import, so its `export`s advertise a composability that exits 0 at
// you (Vira hit it, and read her own falsifier's silence as a pass for a moment).
// This module is imported by two build tools; a selftest that fired on import
// would be worse than no selftest.
// ===========================================================================

// The real readdir output of the case-insensitive filesystem that built 40c5b21:
// assets/sprites/'s 34 names in the order that bundle recorded them into ASSET_MAP.
// Regenerate ONLY from `git show 40c5b21:build/AshenSpire.html`, never from the
// working tree — this is a frozen historical listing, not a mirror of assets/.
const SHIPPED_ORDER_40C5B21 = [
  'enemy_ashRevenant.webp', 'enemy_blightedValkyrie.webp', 'enemy_blightHound.webp',
  'enemy_charredColossus.webp', 'enemy_courtDuelist.webp', 'enemy_courtMarionette.webp',
  'enemy_courtSurgeon.webp', 'enemy_emberStarvedPilgrim.webp', 'enemy_fellWarden.webp',
  'enemy_gildedKnight.webp', 'enemy_graveWisp.webp', 'enemy_huskBrute.webp',
  'enemy_livingArmor.webp', 'enemy_stitchedHound.webp', 'enemy_stitchedKing.webp',
  'enemy_valkyrieShade.webp', 'enemy_wanderingSoldier.webp', 'enemy_wyrmAspirant.webp',
  'enemy_wyrmLord.webp', 'herald_ember.webp', 'herald_frost.webp', 'herald_gold.webp',
  'herald_grace.webp', 'herald_rot.webp', 'reaver_ember.webp', 'reaver_frost.webp',
  'reaver_gold.webp', 'reaver_grace.webp', 'reaver_rot.webp', 'starseer_ember.webp',
  'starseer_frost.webp', 'starseer_gold.webp', 'starseer_grace.webp', 'starseer_rot.webp',
];

// The one pair, named, because it is the whole fact and a reader should not have to
// diff two arrays to find it.
const HOUND = 'enemy_blightHound.webp';
const VALKYRIE = 'enemy_blightedValkyrie.webp';

// The expected byte order, written as the historical fact rather than as a second
// 34-line array: it is the shipped order with EXACTLY the pair at index 1,2 swapped.
// Vira measured that number independently (2 positions, 97 keys) and so did I. A
// copy-pasted second listing would agree with this one and mean less — and it would
// be the second copy SOP 5 is about.
const BYTE_ORDER_EXPECTED = SHIPPED_ORDER_40C5B21.map((n, i) =>
  i === 1 ? SHIPPED_ORDER_40C5B21[2] : i === 2 ? SHIPPED_ORDER_40C5B21[1] : n);

// A control population: the three real names from assets/bg/, where collation and
// byte order AGREE. Without this the corpus only ever proves that things differ.
const AGREEING = ['bg_act1.webp', 'bg_act2.webp', 'bg_act3.webp'];

// The path handed to a fixture-fed copy of this module. Never touched: in --mutate
// the copy's `readdirSync` is a stub returning SHIPPED_ORDER_40C5B21, so the input
// order is the fixture's and not the runner's. That is what makes --mutate mean the
// same thing on ubuntu, windows and macOS.
const FIXTURE_DIR_SENTINEL = '<fixture>';

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const firstDiff = (a, b) => a.findIndex((x, i) => x !== b[i]);

/**
 * The corpus, as one function over (comparator, readdirSortedSync) so that
 * --mutate can run the IDENTICAL assertions against a mutated copy of this file.
 * Returns one record per case — passes included, deliberately. A corpus that
 * returns only its failures makes "nothing ran" and "everything passed" look the
 * same, and its labels end up typed twice.
 */
function runCorpus(cmp, readdirSorted) {
  const cases = [];
  const check = (label, ok, detail) => {
    cases.push({ label, ok, detail: ok ? '' : detail || '' });
    return ok;
  };

  // 1. THE ORDERING FACT, asserted directly on the comparator. This is the one that
  //    kills Vira's mutation: localeCompare returns +1 here.
  check('the pair: blightHound sorts BEFORE blightedValkyrie under byte order',
    cmp(HOUND, VALKYRIE) < 0, `comparator returned ${cmp(HOUND, VALKYRIE)}`);
  check('the pair, reversed: blightedValkyrie sorts AFTER blightHound (both edges)',
    cmp(VALKYRIE, HOUND) > 0, `comparator returned ${cmp(VALKYRIE, HOUND)}`);
  check('a name is equal to itself', cmp(HOUND, HOUND) === 0, `returned ${cmp(HOUND, HOUND)}`);

  // 2. The whole 34-name population, sorted from the real defect order.
  const sorted = [...SHIPPED_ORDER_40C5B21].sort(cmp);
  check('the 40c5b21 sprites listing sorts to byte order, all 34 positions',
    eq(sorted, BYTE_ORDER_EXPECTED),
    `first divergence at index ${firstDiff(sorted, BYTE_ORDER_EXPECTED)}: got ` +
    `${sorted[firstDiff(sorted, BYTE_ORDER_EXPECTED)]}`);
  check('and it is NOT the order 40c5b21 shipped',
    !eq(sorted, SHIPPED_ORDER_40C5B21),
    'the sorted result reproduces the committed defect order — this is the regression');
  check('sorting an already-sorted listing is a no-op (idempotent)',
    eq([...BYTE_ORDER_EXPECTED].sort(cmp), BYTE_ORDER_EXPECTED),
    `re-sorting byte order moved something at index ` +
    `${firstDiff([...BYTE_ORDER_EXPECTED].sort(cmp), BYTE_ORDER_EXPECTED)}`);
  check('the control population, where collation and byte order agree, is unchanged',
    eq([...AGREEING].sort(cmp), AGREEING),
    `assets/bg/'s three names came back as ${[...AGREEING].sort(cmp).join(', ')}`);

  // 3. Through the exported function, both return shapes, since bundle.mjs uses
  //    withFileTypes and content-build.mjs uses strings — two code paths, one rule.
  if (readdirSorted) {
    const r = readdirSorted(FIXTURE_DIR_SENTINEL);
    check('readdirSortedSync (strings) returns byte order', eq(r, BYTE_ORDER_EXPECTED),
      `first divergence at index ${firstDiff(r, BYTE_ORDER_EXPECTED)}`);
    const d = readdirSorted(FIXTURE_DIR_SENTINEL, { withFileTypes: true }).map((x) => x.name);
    check('readdirSortedSync (withFileTypes) returns byte order', eq(d, BYTE_ORDER_EXPECTED),
      `first divergence at index ${firstDiff(d, BYTE_ORDER_EXPECTED)}`);
  }

  return cases;
}

// True only when this file is the entry point. `pathToFileURL` rather than string
// surgery because a Windows argv[1] is `D:\a\...` and `file://D:\a\...` is not a URL
// this would ever have matched — and a selftest that silently never runs on one
// runner is the silence guard failing on itself.
function isMain() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

// ---------------------------------------------------------------------------
// --mutate: reinstate the defect, N ways, and require each to be CAUGHT.
//
// Source rewriting rather than an injected comparator, because Vira's mutation was
// a source edit and a corpus that only sees an injected function proves less. Every
// substitution is verified to have CHANGED the text: a mutation harness that
// silently no-ops is a green that measured nothing, which is the defect class this
// whole branch is about.
// ---------------------------------------------------------------------------
const MUTATIONS = [
  {
    id: 'localeCompare',
    why: "Vira's exact mutation — the one that reproduced the 40c5b21 order 97/97",
    apply: (src) => src.replace(/if \(a < b\) return -1;\n  if \(a > b\) return 1;\n  return 0;/,
      'return a.localeCompare(b);'),
  },
  {
    id: 'localeCompare-base',
    why: 'the same idea spelled as an explicit case-insensitive collation',
    apply: (src) => src.replace(/if \(a < b\) return -1;\n  if \(a > b\) return 1;\n  return 0;/,
      "return a.localeCompare(b, 'en', { sensitivity: 'base' });"),
  },
  {
    id: 'Intl.Collator',
    why: 'the fast idiom a performance-minded reviewer reaches for',
    apply: (src) => src.replace(/if \(a < b\) return -1;\n  if \(a > b\) return 1;\n  return 0;/,
      "return new Intl.Collator('en').compare(a, b);"),
  },
  {
    id: 'toLowerCase',
    why: 'hand-rolled case folding — no locale API in sight, same defect',
    apply: (src) => src.replace(/if \(a < b\) return -1;\n  if \(a > b\) return 1;\n  return 0;/,
      'const x = a.toLowerCase(), y = b.toLowerCase();\n  return x < y ? -1 : x > y ? 1 : 0;'),
  },
  {
    id: 'no-sort',
    why: 'the sort deleted at the call site: the order becomes the machine again',
    apply: (src) => src.replace(/return entries\.sort\(byteOrder\);/, 'return entries;')
      .replace(/return entries\.sort\(\(a, b\) => byteOrder\(a\.name, b\.name\)\);/, 'return entries;'),
  },
];

// The seam: replace the real fs import with a stub that hands back the fixture.
// Deterministic on every platform, which a real directory is not — I measured this
// machine handing back the 34 names ALREADY in byte order, so a corpus that leaned
// on the filesystem to be unsorted would have been blind to `no-sort` right here.
function feedFixture(src) {
  return src.replace(/^import \{ readdirSync \} from 'node:fs';$/m,
    `const __FIXTURE = ${JSON.stringify(SHIPPED_ORDER_40C5B21)};\n` +
    'const readdirSync = (dir, options) => (options && options.withFileTypes\n' +
    '  ? __FIXTURE.map((name) => ({ name, isDirectory: () => false }))\n' +
    '  : [...__FIXTURE]);');
}

async function loadVariant(tmpDir, label, transforms) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const self = fileURLToPath(import.meta.url);
  let src = readFileSync(self, 'utf8');
  for (const [name, fn] of transforms) {
    const next = fn(src);
    if (next === src) {
      // Unknown, and unknown blocks. Never a silent pass.
      throw new Error(`transform "${name}" changed nothing — this file drifted from the ` +
        'harness; the mutation was NOT applied and this case proves nothing');
    }
    src = next;
  }
  const file = join(tmpDir, `dirorder.${label}.mjs`);
  writeFileSync(file, src);
  return import(`file://${file.replace(/\\/g, '/')}`);
}

async function mutate() {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const tmp = mkdtempSync(join(tmpdir(), 'dirorder-mutate-'));
  console.log('dirorder --mutate: reinstating the defect. Every case below must be CAUGHT.\n');
  let bad = 0;

  // Positive control FIRST: the fixture-fed copy with no mutation must PASS, or the
  // kills below are being scored by a broken harness.
  const clean = await loadVariant(tmp, 'control', [['feedFixture', feedFixture]]);
  const cleanFails = runCorpus(clean.byteOrder, clean.readdirSortedSync).filter((c) => !c.ok);
  if (cleanFails.length) {
    console.log('  BROKEN  control: unmutated fixture-fed copy FAILED the corpus');
    for (const f of cleanFails) console.log(`            · ${f.label} — ${f.detail}`);
    bad += 1;
  } else {
    console.log('  OK      control: unmutated fixture-fed copy passes the corpus (the harness works)');
  }

  for (const m of MUTATIONS) {
    let fails;
    try {
      const mod = await loadVariant(tmp, m.id, [['feedFixture', feedFixture], [m.id, m.apply]]);
      fails = runCorpus(mod.byteOrder, mod.readdirSortedSync).filter((c) => !c.ok);
    } catch (e) {
      console.log(`  BAD     ${m.id}: ${String(e.message).split('\n')[0]}`);
      bad += 1;
      continue;
    }
    if (fails.length) {
      console.log(`  CAUGHT  ${m.id} — ${m.why}`);
      console.log(`            ${fails.length} assertion(s) went red; first: ${fails[0].label}`);
    } else {
      console.log(`  MISSED  ${m.id} — ${m.why}`);
      console.log('            the corpus passed a reinstated defect. It is decoration.');
      bad += 1;
    }
  }

  boundary([
    'nothing was built and nothing was rebuilt: this is the fixture, not the artifact',
    'a mutation MISSED here is not "the code is fine" — it is "the corpus is blind"',
    'the copies are rewritten source in a temp dir; --selftest is what checks the',
    ' file that actually ships',
  ]);
  if (bad) {
    console.error(`\ndirorder --mutate: ${bad} case(s) wrong. The corpus does not kill what it claims to.`);
    return 1;
  }
  console.log(`\ndirorder --mutate: OK — ${MUTATIONS.length} reinstatements of the defect, ${MUTATIONS.length} caught.`);
  return 0;
}

// ---------------------------------------------------------------------------
// --selftest: the corpus against the code that actually ships, plus the one thing
// the fixture cannot see — a real directory on this real filesystem.
// ---------------------------------------------------------------------------
async function selftest() {
  console.log('dirorder --selftest: the comparator against the order 40c5b21 shipped.\n');

  // A real directory of the real 34 names, on this real filesystem, read through the
  // real export — so the sentinel path in runCorpus resolves to something the
  // machine actually has to answer for.
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'dirorder-'));
  for (const n of SHIPPED_ORDER_40C5B21) writeFileSync(join(dir, n), '');

  // The real, in-tree comparator — no rewriting, no injection. If someone
  // "improves" it, these are the lines that go red.
  const cases = runCorpus(byteOrder, (_sentinel, options) => readdirSortedSync(dir, options));
  for (const c of cases) {
    console.log(`  ${c.ok ? 'OK  ' : 'FAIL'} ${c.label}${c.ok ? '' : ` — ${c.detail}`}`);
  }
  const fails = cases.filter((c) => !c.ok).map((c) => `${c.label} — ${c.detail}`);

  // The divergence itself, measured rather than assumed. Vira's boundary said she
  // REASONED that localeCompare is ICU-deterministic within a Node version and did
  // not run it on three filesystems; this line runs it on all three, and if ICU ever
  // agrees with bytes on some runner then the trap is not reproducible there and the
  // corpus is blind there — which is `unknown`, and unknown blocks.
  const lc = HOUND.localeCompare(VALKYRIE);
  const diverges = lc > 0;
  console.log(`  ${diverges ? 'OK  ' : 'FAIL'} collation DISAGREES with byte order here: ` +
    `'${HOUND}'.localeCompare('${VALKYRIE}') = ${lc} (want > 0; byte order gives -1)`);
  if (!diverges) {
    fails.push('collation does not diverge from byte order on this runner — the mutation ' +
      'this corpus exists to catch is unobservable here, which is unknown, not clean');
  }

  // What the machine handed back BEFORE the sort — information, not a verdict. If
  // this line ever reads "already in byte order", the `no-sort` mutation is
  // unobservable on this filesystem, which is why --mutate feeds a fixture instead.
  const raw = readdirSync(dir);
  console.log(`  note  this filesystem's raw readdir order was ` +
    `${eq(raw, BYTE_ORDER_EXPECTED) ? 'ALREADY byte order' : 'NOT byte order'} ` +
    `(so the sort above was ${eq(raw, BYTE_ORDER_EXPECTED) ? 'a no-op here' : 'load-bearing here'})`);

  const empty = readdirSortedSync(mkdtempSync(join(tmpdir(), 'dirorder-empty-')));
  const emptyOk = Array.isArray(empty) && empty.length === 0;
  console.log(`  ${emptyOk ? 'OK  ' : 'FAIL'} an empty directory returns [] and does not throw`);
  if (!emptyOk) fails.push('empty directory did not return []');

  boundary([
    'nothing here says a build is reproducible. This says the COMPARATOR is stable;',
    ' the artifact claim is the git-diff step in ci.yml, on three runners',
    'the fixture is assets/sprites/ at 40c5b21 — 34 of the bundle\'s 97 keys, the only',
    ' 34 where any collation divergence has ever existed in this repo',
    'a bare `.sort()` would pass every assertion above, because default sort IS',
    ' UTF-16 code-unit order. The explicit comparator is for the reader, not the',
    ' machine — and that is why --mutate does not list it as a known-bad',
    'this cannot see a caller going back to a bare readdirSync: that is a grep, and',
    ' Bjorn and Vira did it by hand at 4dd963a. No detector owns it yet',
  ]);
  if (fails.length) {
    console.error(`\ndirorder --selftest: ${fails.length} assertion(s) red:`);
    for (const f of fails) console.error('    · ' + f);
    console.error('  If the comparator was "improved" to a locale-aware one, this is that.');
    return 1;
  }
  console.log('\ndirorder --selftest: OK — the order 40c5b21 shipped is not the order this comparator produces.');
  return 0;
}

function boundary(lines) {
  console.log('');
  console.log('BOUNDARY — what a green from this tool does NOT mean:');
  for (const l of lines) console.log(l.startsWith(' ') ? '    ' + l.trim() : '  · ' + l);
}

if (isMain()) {
  const args = process.argv.slice(2);
  const run = args.includes('--mutate') ? mutate
    : args.includes('--selftest') ? selftest
      : async () => {
        console.error('tools/dirorder.mjs is a library. It has two modes of its own:\n' +
          '  node tools/dirorder.mjs --selftest   the known-bad corpus\n' +
          '  node tools/dirorder.mjs --mutate     reinstate the defect; each must be caught');
        return 2;
      };
  run().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
}
