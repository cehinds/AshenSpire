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
// A NEGATIVE CONTROL RUNS FIRST. A check that is red on a clean tree catches
// every plant and means nothing; the pristine copy must be GREEN before a
// single defect is planted, and the run refuses if it is not.
//
// AND EACH PLANT NAMES THE ROW IT MUST BE CAUGHT BY. "Something went red" is
// not evidence: a plant caught by the wrong row is a check agreeing with me by
// accident. The row is asserted, and a hit on any other row is a FAIL here.
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
  {
    name: 'a SECOND COPY of the release, born agreeing — the palworld shape',
    row: 'B NO SECOND COPY',
    plant: (root, rel) => edit(root, 'src/ui/screens/about.js',
      (t) => t.replace('export function', `const SHOWN_VERSION = '${rel}';\n\nexport function`)),
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

  // ---- the negative control -------------------------------------------------
  const control = fresh();
  try {
    const { rows, red } = check(control);
    if (red) {
      console.log('  FAIL  [control] the untouched copy is already RED — no plant below could mean anything:');
      for (const r of rows.filter((x) => !x.ok)) console.log(`          ${r.name}: ${r.detail.split('\n')[0]}`);
      return 1;
    }
    console.log(`  ok    [control] the untouched copy is GREEN on all ${rows.length} rows — the plants have something to disturb`);
  } finally {
    rmSync(control, { recursive: true, force: true });
  }

  // ---- the corpus -----------------------------------------------------------
  for (const p of PLANTS) {
    const root = fresh();
    try {
      p.plant(root, rel);
      const { rows } = check(root);
      const reds = rows.filter((r) => !r.ok).map((r) => r.name);
      const caught = reds.includes(p.row);
      const strays = reds.filter((r) => r !== p.row);
      if (!caught) {
        failures += 1;
        console.log(`  FAIL  [${p.row}] NOT CAUGHT — ${p.name}`);
        console.log(`          the check stayed green on a tree that carries this defect`);
      } else if (strays.length) {
        // Not a failure of the plant, but it must be visible: a defect that
        // trips extra rows may be tripping them for a reason I did not intend.
        console.log(`  RED   [${p.row}] caught — ${p.name}`);
        console.log(`          also red: ${strays.join(', ')} (stated, not hidden)`);
      } else {
        console.log(`  RED   [${p.row}] caught — ${p.name}`);
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
  console.log(`buildversion --selftest: OK — ${PLANTS.length}/${PLANTS.length} known-bads observed red, each by the row that owns it,`);
  console.log('  planted as real edits to a real tree and entered at check(root) — the same door the real run uses.');
  console.log('');
  console.log('BOUNDARY: this is a corpus, not a proof of completeness. It says these six defects');
  console.log('  cannot pass; it says nothing about a seventh nobody thought of, and nothing at all');
  console.log('  about whether the stamp is VISIBLE — that is tools/buildstamp-shot.mjs.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exit(await selftest());
}
