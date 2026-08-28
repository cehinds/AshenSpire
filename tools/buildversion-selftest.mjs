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

import { cpSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, REPO_ROOT, sourceDigest, whichCommits, ORDINAL_HOME, ORDINAL_CEILING } from './buildversion.mjs';

/** The files a real tree needs for every row to have something to rule on. */
const COPY = ['index.html', 'styles', 'src', 'assets', 'build', 'buildordinal.json'];

// macOS can report ENOTEMPTY for a just-closed Git worktree while directory
// entries settle. Node retries that class of recursive-removal failure only
// when maxRetries is non-zero. Keep the wait bounded and keep the final error:
// cleanup that is still impossible after five linearly delayed retries
// (about 1.5 seconds of total backoff) remains a real selftest red.
const removeTempTree = (dir) => rmSync(dir, {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 100,
});

const editJson = (root, fn) => {
  const p = resolve(root, ORDINAL_HOME);
  writeFileSync(p, `${JSON.stringify(fn(JSON.parse(readFileSync(p, 'utf8'))), null, 2)}\n`, 'utf8');
};

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
  // ---- rows F and G, THE LOCK ON A FILE THE DIGEST CANNOT SEE ---------------
  // buildordinal.json sits outside the digest roots by necessity (a fixpoint:
  // bumping on a digest change cannot itself move the digest). The whole price
  // of that is a hand-edit the build will never correct, so these plants are
  // that hand-edit, performed three ways. F1 changes the number. G changes the
  // digest the number claims to belong to. Between them there is no edit to
  // this file that ships quietly: to fake the number you must also produce the
  // digest of the tree you are standing in, which is derived, not typeable.
  {
    name: 'the ordinal HAND-EDITED — the file and the shipped box disagree',
    row: 'F ORDINAL ON THE BOX',
    plant: (root) => editJson(root, (j) => ({ ...j, ordinal: j.ordinal + 7 })),
  },
  {
    // I asserted a sort ceiling in the tool; an asserted ceiling nobody has
    // watched refuse is a sentence, not a check.
    name: 'the ordinal reaches the width where the pad stops sorting',
    row: 'F ORDINAL ON THE BOX',
    plant: (root) => editJson(root, (j) => ({ ...j, ordinal: ORDINAL_CEILING })),
  },
  {
    // Isolates G: the NUMBER still matches the box, so F stays green and only
    // the "was this computed for this source" question can fire.
    name: 'the recorded digest HAND-EDITED — the number belongs to another tree',
    row: 'G ORDINAL BELONGS TO THIS TREE',
    plant: (root) => editJson(root, (j) => ({ ...j, digest: 'deadbeef01' })),
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
  // ---- the two fields A4 added, each watched red at its own guard -----------
  // Constantine picked A4 on 2026-08-16, which put `built <date>` and a run-path
  // label on the About line. Both are injected exactly like the digest, so both
  // can fail exactly like the digest — typed into source, or shipped disagreeing
  // with their home. A field with no plant is a field whose guard nobody has
  // watched fail, which is `unknown`, not green (development.md).
  {
    // The A-row plant for the run path. Its twin for the DATE is not here and
    // is not missing: row A checks all four placeholders through ONE predicate
    // over ONE list, so a plant per marker would re-prove the same `.filter`
    // four times. This one proves the list is walked; F and E below prove the
    // two new facts are locked at the artifact, which is the half that is new.
    name: 'the run path TYPED into source, so the page asserts a path nobody injected',
    row: 'A ONE HOME',
    plant: (root) => edit(root, 'src/buildversion.js',
      (t) => t.replace("export const RUN_PATH = 'UNPLACED';", "export const RUN_PATH = 'standalone file';")),
  },
  {
    // The date's hand-edit, and it is the ordinal's plant pointed one field
    // over: buildordinal.json is outside the digest roots, so the build will
    // never correct a typed date and a wrong day would ship in silence.
    name: 'the build date HAND-EDITED — the file and the shipped box disagree about the day',
    row: 'F ORDINAL ON THE BOX',
    plant: (root) => editJson(root, (j) => ({ ...j, built: '1999-12-31' })),
  },
  {
    // THE CROSSED LABEL, and it is the failure this field exists to prevent
    // arriving through the field itself. A bundle that calls itself the source
    // tree sends every bug report from it to the wrong artifact — quietly,
    // plausibly, and with more confidence than the silence it replaced.
    name: 'the shipped bundle names the OTHER run path — a standalone file claiming to be the source tree',
    row: 'E SHIPPED STAMP',
    plant: (root) => edit(root, 'build/AshenSpire.html',
      (t) => t.replace("const RUN_PATH = 'standalone file'", "const RUN_PATH = 'source tree'")),
  },
];

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'buildversion-known-bad-'));
  for (const c of COPY) cpSync(resolve(REPO_ROOT, c), resolve(dir, c), { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// THE TRACEABILITY CORPUS — a second door, and it needed one
// ---------------------------------------------------------------------------
//
// The seven plants above all enter at `check(root)`, which reads FILES. `--which`
// reads HISTORY, and no file plant can reach it: the defect lives in the shape of
// the commit graph, not in any byte of any tree. So this corpus builds a real git
// repository with a real merge in it and enters at `whichCommits()` — the same
// function the CLI calls, over a real `git log`, on a real `.gitattributes`.
//
// WHAT IT PLANTS is the shape that was live on `dev` at `a05d071`: a bundle
// RE-DERIVED INSIDE THE MERGE ACT, so the merge commit's artifact differs from
// BOTH parents. `git log -S` does not diff merges at all by default, so the
// pickaxe walked straight past the commit that shipped the build. Case T1 runs
// the OLD command as well as the new one and requires the old one to be SILENT —
// the observed red, without which the fix is its author's opinion.
//
// T2 is the other edge and it is the one a fix could easily buy the first with:
// making merges visible also makes REMOVALS visible, and the caller's question is
// "which commit shipped this", not "when did this string move". A digest replaced
// by a merge must report the commit that shipped it and NOT the merge that
// stopped shipping it.

// stderr is PIPED, not inherited: `git merge --no-commit` reports success on
// stderr, and a corpus that prints git's chatter between its own verdicts is a
// corpus a tired reader skims past.
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a],
  { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

/** A repo whose bundle is re-derived inside a merge — the live `dev` shape. */
function freshRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'buildversion-history-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'selftest@family.local');
  git(dir, 'config', 'user.name', 'selftest');
  git(dir, 'config', 'commit.gpgsign', 'false');
  mkdirSync(resolve(dir, 'build'));
  // The real repo marks the bundle `-text` (a byte-identity gate). Carried here
  // because a grep that declines to read a binary-marked blob would be a second
  // way to answer "nowhere", and the corpus must be able to tell them apart.
  writeFileSync(resolve(dir, '.gitattributes'), 'build/AshenSpire.html -text\n');
  const bundle = (d) => writeFileSync(resolve(dir, 'build/AshenSpire.html'), `<html><script>const SOURCE = '${d}';</script></html>\n`);
  const commit = (m) => { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', m); };

  bundle('aaaaaaaaaa'); commit('shipped aaaaaaaaaa on main, no merge involved');
  git(dir, 'checkout', '-q', '-b', 'side');
  writeFileSync(resolve(dir, 'side.txt'), 'side work\n'); commit('side work, bundle untouched');
  git(dir, 'checkout', '-q', 'main');
  writeFileSync(resolve(dir, 'main.txt'), 'main work\n'); commit('main work, bundle untouched');
  // The merge act itself re-derives the bundle: neither parent carries bbbbbbbbbb.
  git(dir, 'merge', '-q', '--no-commit', '--no-ff', 'side');
  bundle('bbbbbbbbbb'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'merged side and re-derived the bundle in the same act');
  return dir;
}


// ---------------------------------------------------------------------------
// ROW H — A THIRD DOOR, BECAUSE HIS RULE IS A CLAIM ABOUT TWO COMMITS
// ---------------------------------------------------------------------------
//
// "the one with the higher value ... at th ened shoudl be the newest build" is
// not a property of a tree. It is a property of a tree AND ITS PARENT, so no
// file plant can reach it and neither can the history corpus above, which owns
// a toy repo with no real bundle in it. This one copies the real tree, makes it
// a git repository, and commits twice — the second commit shipping a changed
// build/AshenSpire.html with the ordinal left where it was. That is the defect
// in its natural habitat: somebody rebuilds, the ordinal does not move, and two
// different artifacts read the same number. Exactly what we replaced.
//
// The control arm is the same repo with the ordinal moved, so the row is
// watched GREEN and RED over one variable — otherwise a row that is red at
// every commit would look like a catch.

function ordinalHistory() {
  let failures = 0;
  const say = (ok, label, detail) => {
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'RED  ' : 'FAIL '} [H ORDINAL INCREASES] ${ok ? 'caught' : 'NOT CAUGHT'} — ${label}`);
    console.log(`          ${detail}`);
  };

  /** A committed tree, then a second commit that ships a new bundle. */
  const build = (moveOrdinal) => {
    const dir = fresh();
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'selftest@family.local');
    git(dir, 'config', 'user.name', 'selftest');
    git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'the build that shipped');
    // A REAL change to the shipped artifact — the same door a rebuild enters by.
    appendFileSync(resolve(dir, 'build/AshenSpire.html'), '<!-- a later build -->\n');
    if (moveOrdinal) {
      const p = resolve(dir, ORDINAL_HOME);
      const j = JSON.parse(readFileSync(p, 'utf8'));
      writeFileSync(p, `${JSON.stringify({ ...j, ordinal: j.ordinal + 1 }, null, 2)}\n`, 'utf8');
    }
    git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'a second build');
    return dir;
  };

  for (const [moved, label] of [[false, 'a NEW BUILD SHIPPED and the ordinal did not move — two builds, one number'],
    [true, 'the control: the same commit with the ordinal moved must go GREEN']]) {
    const dir = build(moved);
    try {
      const row = check(dir).rows.find((r) => r.name === 'H ORDINAL INCREASES');
      const detail = row ? row.detail.split('\n')[0].trim() : 'NO SUCH ROW';
      if (!moved) say(row && row.ok === false, label, detail);
      else {
        const ok = row && row.ok === true;
        if (!ok) failures += 1;
        console.log(`  ${ok ? 'ok   ' : 'FAIL '} [H ORDINAL INCREASES] ${label}`);
        console.log(`          ${detail}`);
      }
    } finally {
      removeTempTree(dir);
    }
  }
  return failures;
}

/** Returns the number of failures; prints one line per case. */
function traceability() {
  const dir = freshRepo();
  let failures = 0;
  const say = (ok, label, detail) => {
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'RED  ' : 'FAIL '} [--which] ${ok ? 'caught' : 'NOT CAUGHT'} — ${label}`);
    console.log(`          ${detail}`);
  };
  try {
    const merge = git(dir, 'log', '-1', '--format=%h', 'main').trim();
    const first = git(dir, 'log', '--format=%h', '--reverse', 'main').trim().split('\n')[0];

    // T1 — the plant, and the old command watched silent on it.
    let old = '';
    try { old = git(dir, 'log', '-S', 'bbbbbbbbbb', '--oneline', '--', 'build/AshenSpire.html').trim(); } catch { old = ''; }
    const now = whichCommits('bbbbbbbbbb', dir);
    say(old === '' && now.length === 1 && now[0].startsWith(merge),
      'a digest introduced BY A MERGE (the live `dev = a05d071` shape)',
      `old \`git log -S\` → ${old === '' ? 'SILENT (the defect, observed)' : `"${old}"`} · whichCommits → ${now.length === 1 ? now[0] : JSON.stringify(now)}`);

    // T2 — the edge the fix could have bought the first one with.
    const removed = whichCommits('aaaaaaaaaa', dir);
    say(removed.length === 1 && removed[0].startsWith(first),
      'a digest REPLACED by that merge reports the commit that SHIPPED it, not the one that stopped',
      `whichCommits → ${removed.length === 1 ? removed[0] : JSON.stringify(removed)} (the merge ${merge} must not appear)`);

    // T3 — the empty edge. A tool that answers everything answers nothing.
    const none = whichCommits('cccccccccc', dir);
    say(none.length === 0, 'a digest no commit ever shipped returns EMPTY, not a plausible commit',
      `whichCommits → ${JSON.stringify(none)}`);
  } finally {
    removeTempTree(dir);
  }
  return failures;
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
    removeTempTree(control);
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
      removeTempTree(root);
    }
  }

  // ---- the traceability corpus, a second door ------------------------------
  console.log('');
  console.log('  --which reads HISTORY, not files, so no plant above can reach it. These enter');
  console.log('  at whichCommits() over a real repo with a real merge in it.');
  const TRACE = 3;
  failures += traceability();

  console.log('');
  console.log('  Row H is a claim about a commit AND ITS PARENT, so it has its own door too:');
  console.log('  the real tree, made a git repo, committed twice, entered at check(root).');
  const HIST = 2;
  failures += ordinalHistory();

  console.log('');
  console.log(`  the digest this tree derives: ${sourceDigest().digest}`);
  console.log('');
  const total = PLANTS.length + TRACE + HIST;
  if (failures) {
    console.log(`buildversion --selftest: RED — ${failures} of ${total} known-bads walked through the check.`);
    return 1;
  }
  console.log(`buildversion --selftest: OK — ${total}/${total} known-bads observed red, each by the row or command that owns it,`);
  console.log(`  ${PLANTS.length} planted as real edits to a real tree and entered at check(root), ${TRACE} planted as a real`);
  console.log(`  git history and entered at whichCommits(), and ${HIST} planted as a real tree committed twice —`);
  console.log('  the same three doors the real runs use. The last pair is watched RED and GREEN over');
  console.log('  one variable, so a row that was red at every commit could not pass as a catch.');
  console.log('');
  console.log('BOUNDARY: this is a corpus, not a proof of completeness. It says these defects');
  console.log('  cannot pass; it says nothing about one nobody thought of, and nothing at all');
  console.log('  about whether the stamp is VISIBLE — that is tools/buildstamp-shot.mjs.');
  console.log('  On ORDERING it now says something, and only this: row H proves the ordinal ROSE');
  console.log('  across one commit and its first parent. It is silent on any other pair, on');
  console.log('  branches that never merged, and on whether a player can READ the number.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exit(await selftest());
}
