// tools/buildversion-selftest.mjs — the known-bad corpus for the version check.
//
// SOP 5 does not ask for a detector. It asks for "a detector plus a known-bad
// corpus, never a checklist … it must FAIL on a fixture that re-types the
// version, or it proves nothing". Until this file ran, `--check` was `unknown`,
// not green, whatever it printed (development.md, *The instrument rule*).
//
// ── THE DOOR, STATED, BECAUSE THE DOOR NAMED IS THE EXTENT OF THE GREEN ──────
//
// Every plant below is a REAL EDIT TO A REAL FILE IN A REAL SOURCE TREE — a
// byte-for-byte copy of index.html, styles/, src/, assets/ and the committed
// bundle — and the tool is then entered at `check(root)`, the same entry point
// the live run uses. Nothing is handed to a predicate downstream of the sweep:
// each plant goes through the directory walk, the reader, the canonicalizer and
// the row's own test, exactly as a real defect would. The clause that demands
// this is development.md's same-door amendment; the reason it exists is that
// six sincere greens in this house were bought by fixtures that entered below
// the defect they were written to catch.
//
// WHAT THAT DOOR DOES *NOT* LICENSE, and it is the newer half of the clause:
// this says the check fires on a defect PRESENT IN THE FILES IT READS. It says
// nothing about a defect that never reaches those files — a version invented in
// a browser at runtime, a stamp painted by CSS. Those are ink, and ink is
// tools/buildstamp-shot.mjs with a browser and its own corpus.
//
// A NEGATIVE CONTROL RUNS FIRST, because a check that is red on a clean tree
// catches every plant and means nothing. What the control is USED for changed
// on 2026-08-16 and the next paragraph is the whole of it — it is recorded and
// compared against, no longer a veto.
//
// THE CONTROL IS RECORDED PER ROW, NOT USED AS A WHOLE-TREE VETO, AND THAT
// CHANGED ON 2026-08-16. It used to refuse the entire run if any row was
// non-green. That was right while a non-green control could only mean a broken
// check — but row B can now resolve to UNKNOWN on a tree whose defect is REAL,
// KNOWN and OPEN (the About screen and the build stamp render two different
// numbers; Constantine's call, carried by Marina). A whole-tree refusal would
// have let one honest open question silently disable the corpus for all five
// rows, which is a checklist outcome: the suite stops ruling and says so in a
// way nobody reads.
//
// SO EACH PLANT MUST MOVE ITS OWN ROW, AND THAT IS A STRICTLY STRONGER BAR THAN
// THE ONE IT REPLACES. Two things are demanded of every plant, not one:
//
//   1. the asserted row ends RED — not merely non-green. A plant that only
//      manages to push a row to UNKNOWN has not been caught; unknown is never
//      green and it is never evidence of a catch either.
//   2. the asserted row's DETAIL DIFFERS from the control's detail for that
//      same row. This is the new half. It proves THIS edit moved THIS row,
//      rather than the plant inheriting a verdict it did not earn from a row
//      that was already unhappy before it was planted.
//
// Clause 2 is what keeps an already-non-green row plantable at all, and row B
// is the reason it had to exist. A hit on any other row is still surfaced.
//
// Usage:  node tools/buildversion.mjs --selftest

import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, REPO_ROOT, sourceDigest } from './buildversion.mjs';

/** The files a real tree needs for every row to have something to rule on. */
const COPY = ['index.html', 'styles', 'src', 'assets', 'build'];

const edit = (root, rel, fn) => {
  const p = resolve(root, rel);
  writeFileSync(p, fn(readFileSync(p, 'utf8')), 'utf8');
};

/**
 * Each plant: a name, the row it MUST be caught by, and the edit — which takes
 * the tree root, so it may touch any real file in it.
 */
const PLANTS = [
  {
    name: 'the version RE-TYPED into source (SOP 5\'s named fixture)',
    row: 'A ONE HOME',
    plant: (root) => edit(root, 'src/buildversion.js',
      (t) => t.replace("export const SOURCE = 'UNSTAMPED';", "export const SOURCE = 'd20fb1bd4d';")),
  },
  {
    name: 'the injection markers renamed, so nothing could derive it',
    row: 'A ONE HOME',
    plant: (root) => edit(root, 'src/buildversion.js',
      (t) => t.replace('/* BUILD_SOURCE_START */', '/* BUILD_SRC_START */')),
  },
  // ---- row B, WATCHED AT BOTH EDGES -----------------------------------------
  // These two plants are the same defect at two moments in its life, and until
  // 2026-08-16 only the first was here. That is how the inversion survived: the
  // corpus proved the row caught a copy while the copy was harmless, and never
  // asked what the row did once the copy drifted. It went QUIET — green at the
  // moment of harm. A corpus that only plants the birth of a defect certifies
  // the half of the predicate that works.
  {
    name: 'a SECOND COPY of the release, born AGREEING — the palworld shape',
    row: 'B NO SECOND COPY',
    plant: (root, rel) => edit(root, 'src/ui/screens/about.js',
      (t) => t.replace('export function', `const SHOWN_VERSION = '${rel}';\n\nexport function`)),
  },
  {
    // The edge the old predicate went GREEN on. `rel` is not used: the whole
    // point is a value that no longer equals the release, so arm 1 is blind to
    // it by construction and only arm 2 — which never reads the value — can
    // see it. If this plant is ever "not caught", the proxy is back.
    name: 'a second copy that has ALREADY DRIFTED — harm landed, and the old predicate went green',
    row: 'B NO SECOND COPY',
    plant: (root) => edit(root, 'src/ui/screens/about.js',
      (t) => t.replace('export function', `const SHOWN_VERSION = '9.9.z';\n\nexport function`)),
  },
  {
    name: 'a named consumer stops deriving (combat prints no stamp)',
    row: 'C THREE CONSUMERS',
    plant: (root) => edit(root, 'src/ui/screens/combat.js',
      (t) => t.replace(/^.*buildStampHtml.*$/gm, '')),
  },
  {
    name: 'the build grows an input outside the digest\'s roots',
    row: 'D CONTAINMENT',
    plant: (root) => edit(root, 'index.html',
      (t) => t.replace('</head>', '  <link rel="stylesheet" href="vendor/theme.css" />\n</head>')),
  },
  {
    name: 'a source edit that never reached the bundle — the shipped stamp goes stale',
    row: 'E SHIPPED STAMP',
    plant: (root) => appendFileSync(resolve(root, 'src/content/balance.js'), '\n// a real edit nobody rebuilt\n'),
  },
];

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'buildversion-known-bad-'));
  for (const c of COPY) cpSync(resolve(REPO_ROOT, c), resolve(dir, c), { recursive: true });
  return dir;
}

export async function selftest() {
  console.log('buildversion --selftest: every plant is a real edit to a real tree, entered at check(root).');
  console.log('');

  const rel = /version:\s*'([^']+)'/.exec(readFileSync(resolve(REPO_ROOT, 'src/content/index.js'), 'utf8'))[1];
  let failures = 0;

  // ---- the control, recorded per row ---------------------------------------
  const control = fresh();
  let baseline;
  try {
    baseline = new Map(check(control).rows.map((r) => [r.name, r]));
  } finally {
    rmSync(control, { recursive: true, force: true });
  }
  const dirty = [...baseline.values()].filter((r) => !r.ok);
  if (!dirty.length) {
    console.log(`  ok    [control] the untouched copy is GREEN on all ${baseline.size} rows — the plants have something to disturb`);
  } else {
    console.log(`  note  [control] the untouched copy is NOT green on ${dirty.length} of ${baseline.size} rows.`);
    for (const r of dirty) {
      console.log(`          ${r.ok === null ? 'UNKNOWN' : 'RED'} ${r.name}: ${r.detail.split('\n')[0]}`);
    }
    console.log('          Each plant below must still move its own row (verdict RED *and* a detail');
    console.log('          that differs from this baseline), so these rows stay testable without');
    console.log('          being handed a verdict they did not earn.');
  }

  // ---- the corpus -----------------------------------------------------------
  for (const p of PLANTS) {
    const root = fresh();
    try {
      p.plant(root, rel);
      const rows = check(root).rows;
      const row = rows.find((r) => r.name === p.row);
      const before = baseline.get(p.row);
      const strays = rows.filter((r) => !r.ok && r.name !== p.row).map((r) => r.name);

      if (!row) {
        failures += 1;
        console.log(`  FAIL  [${p.row}] NO SUCH ROW — ${p.name}`);
        console.log(`          the plant asserts a row this check does not produce; the corpus is stale`);
      } else if (row.ok !== false) {
        failures += 1;
        console.log(`  FAIL  [${p.row}] NOT CAUGHT — ${p.name}`);
        console.log(`          the row is ${row.ok === null ? 'UNKNOWN' : 'PASS'} on a tree that carries this defect`);
        console.log(`          ${row.detail.split('\n')[0]}`);
      } else if (before && row.detail === before.detail) {
        // The row is red, but it was red for this same reason before the plant.
        // That is a verdict inherited, not earned, and it is a FAIL: it would
        // let a broken predicate ride on somebody else's open defect.
        failures += 1;
        console.log(`  FAIL  [${p.row}] VERDICT INHERITED — ${p.name}`);
        console.log(`          the row is red with the identical detail it had BEFORE the plant,`);
        console.log(`          so nothing here shows this check reacted to this defect at all`);
      } else {
        console.log(`  RED   [${p.row}] caught — ${p.name}`);
        if (before && !before.ok) {
          console.log(`          (row was ${before.ok === null ? 'UNKNOWN' : 'RED'} in the control; the plant moved it, detail differs)`);
        }
        console.log(`          ${row.detail.split('\n').slice(0, 3).map((s) => s.trim()).filter(Boolean).join(' / ').slice(0, 150)}`);
        // Not a failure of the plant, but it must be visible: a defect that
        // trips extra rows may be tripping them for a reason I did not intend.
        if (strays.length) console.log(`          also non-green: ${strays.join(', ')} (stated, not hidden)`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  console.log('');
  console.log(`  the digest this tree derives: ${sourceDigest().digest}`);
  console.log('');
  if (failures) {
    console.log(`buildversion --selftest: RED — ${failures} of ${PLANTS.length} known-bads walked through the check.`);
    return 1;
  }
  console.log(`buildversion --selftest: OK — ${PLANTS.length}/${PLANTS.length} known-bads observed red, each by the row that owns it and each having MOVED that row,`);
  console.log('  planted as real edits to a real tree and entered at check(root) — the same door the real run uses.');
  console.log('');
  console.log('BOUNDARY: this is a corpus, not a proof of completeness. It says these defects');
  console.log('  cannot pass; it says nothing about a seventh nobody thought of, and nothing at all');
  console.log('  about whether the stamp is VISIBLE — that is tools/buildstamp-shot.mjs.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exit(await selftest());
}
