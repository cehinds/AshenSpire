#!/usr/bin/env node
// tools/verify-shipped.mjs — verify the file a PLAYER is handed, not the file the
// bundler just wrote.
//
// WHY THIS EXISTS — the guard that could not see the shipped artifact
// -----------------------------------------------------------------
// tools/bundle.mjs already names this bug in prose ("the art-less-build bug",
// around :141-152) and prints a guard for it:
//
//     if (mapEntries === 0) console.log('  WARNING: no art inlined — …');
//
// Two defects in one line. It reads `mapEntries`, a variable in its own process,
// about the build it is in the middle of writing — so it is structurally
// incapable of seeing dist/, which is what README.md:25 hands to a player. And it
// is a console.log: bundle.mjs exits 0 either way, so nothing is gated on it.
// At 40c5b21 the guard was green on every run while dist/AshenSpire.html had
// `indexOf('ASSET_MAP')` === -1 — it had never run that bundler at all.
//
// A guard that cannot see the shipped file and cannot fail is not a guard. This
// tool reads files off disk, exits non-zero, and proves it can fail with
// --selftest against a corpus that includes THE REAL STALE ARTIFACT, pulled out
// of this repo's own history by blob id. A synthesized known-bad is my opinion
// about the defect; the blob is the defect.
//
//   node tools/verify-shipped.mjs             verify the working tree
//   node tools/verify-shipped.mjs --selftest  run the known-bad corpus
//
// WHAT IT DOES NOT CHECK, and this is the point of the chain:
//   dist carries art  +  dist === build  →  the player's file is this source.
// Check B alone would pass on two identically art-less files, so A is what makes
// the chain terminate in a true claim rather than in agreement. Agreement is not
// synchronization (SOP 5).
//
// REMOVAL CONDITION (SOP 1's corollary): deleted — not amended — the day dist/
// holds no tracked artifact, i.e. when the standalone ships as a release asset
// and README.md links the release (see dist/README.md, *Why this is tracked*).
// With nothing tracked in dist/ there is nothing for this to verify and the
// checks become theatre. Also deleted if bundle.mjs stops inlining art into a
// single file, because then check A is asserting a property the build no longer
// claims. NOT removed for having passed a long time: --selftest is what keeps it
// honest, and a --selftest that stops failing on the corpus is itself the alarm.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const SELFTEST = args.includes('--selftest');

const BUILD = 'build/AshenSpire.html';
const DIST_DIR = 'dist';
const SHIPPED = 'dist/AshenSpire.html'; // the path README.md:25 gives a player

// The stale artifact as committed at 40c5b21: 712667 bytes, no ASSET_MAP token,
// three inlined images instead of 101. Kept as a corpus entry by blob id rather
// than as a checked-in fixture — a 712 KiB fixture to prove a guard works is a
// second copy of the very artifact we are trying to stop tracking.
const STALE_BLOB = '940dd0da11972e7ca378787700aebb84e6566f54';

// ---------------------------------------------------------------------------
// The checks, as pure functions over bytes, so --selftest can feed them a corpus
// instead of asserting against a mock of myself.
// ---------------------------------------------------------------------------

/** A. Does this HTML actually carry the art inline? */
export function checkCarriesArt(name, bytes) {
  const text = bytes.toString('utf8');
  const hasMap = text.includes('ASSET_MAP');
  const images = (text.match(/data:image\/[a-z+]*;base64/g) || []).length;
  if (!hasMap) {
    return {
      ok: false, code: 'NO_ART',
      detail: `${name} has no ASSET_MAP token (indexOf = -1) — it was not produced by ` +
        `tools/bundle.mjs. ${images} inlined image(s) found; a real build has ~101.`,
    };
  }
  if (images === 0) {
    return { ok: false, code: 'NO_ART', detail: `${name} has an ASSET_MAP but zero inlined images.` };
  }
  return { ok: true, code: 'NO_ART', detail: `${name}: ASSET_MAP present, ${images} inlined images` };
}

/** B. Is the shipped file the build, byte for byte? */
export function checkShippedIsBuilt(distName, distBytes, buildBytes) {
  if (distBytes.equals(buildBytes)) {
    return { ok: true, code: 'DRIFT', detail: `${distName} is byte-identical to ${BUILD} (${distBytes.length} bytes)` };
  }
  return {
    ok: false, code: 'DRIFT',
    detail: `${distName} (${distBytes.length} bytes) differs from ${BUILD} (${buildBytes.length} bytes). ` +
      `Either dist/ is stale — run \`node tools/launch.mjs --build-only\` — or the build is not ` +
      `reproducible on this machine, which tools/dirorder.mjs exists to prevent.`,
  };
}

/** C. Has a version-stamped build artifact been committed again? */
export function checkNoStampedTwin(trackedDistFiles) {
  const stamped = trackedDistFiles.filter((f) => /^AshenSpire-.+\.html$/.test(f));
  if (stamped.length) {
    return {
      ok: false, code: 'STAMPED_TWIN',
      detail: `tracked version-stamped artifact(s) in dist/: ${stamped.join(', ')}. ` +
        `These are launcher output and are ignored by .gitignore — a tracked one means the ` +
        `ignore rule and tools/launch.mjs have drifted apart again.`,
    };
  }
  return { ok: true, code: 'STAMPED_TWIN', detail: 'no version-stamped artifact is tracked' };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const results = [];
function record(r) {
  results.push(r);
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  [${r.code}] ${r.detail}`);
}

function boundary(lines) {
  console.log('');
  console.log('BOUNDARY — what a green from this tool does NOT mean:');
  // Continuation lines start with a space so they read as wrapped prose, not as
  // extra bullets. A boundary a reader skims wrong is a boundary not delivered.
  for (const l of lines) console.log(l.startsWith(' ') ? '    ' + l.trim() : '  · ' + l);
}

// ---------------------------------------------------------------------------
// --selftest: the known-bad corpus. Every entry must FAIL for its named reason,
// and the positive control must pass. A corpus where nothing fails proves nothing.
// ---------------------------------------------------------------------------
if (SELFTEST) {
  console.log('verify-shipped --selftest: every case below must land on its expected verdict.\n');
  const bad = [];
  const expect = (label, r, wantOk, wantCode) => {
    const ok = r.ok === wantOk && r.code === wantCode;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label} → ${r.ok ? 'pass' : 'fail'} [${r.code}]` +
      (ok ? '' : `  (expected ${wantOk ? 'pass' : 'fail'} [${wantCode}])`));
    if (!ok) bad.push(label);
    if (!wantOk && !r.ok) console.log(`         reason given: ${r.detail.split(' — ')[0].slice(0, 96)}`);
  };

  const goodArt = Buffer.from(
    '<html><script>const ASSET_MAP={"assets/a.webp":"data:image/webp;base64,AAAA"};</script></html>', 'utf8');

  // 1. Synthetic art-less build — the class of defect, minimal form.
  expect('synthetic: html with no ASSET_MAP',
    checkCarriesArt('synthetic-artless.html', Buffer.from('<html>no map here</html>', 'utf8')),
    false, 'NO_ART');

  // 2. Synthetic: ASSET_MAP present but empty of images.
  expect('synthetic: ASSET_MAP with zero images',
    checkCarriesArt('synthetic-emptymap.html', Buffer.from('<html>const ASSET_MAP={};</html>', 'utf8')),
    false, 'NO_ART');

  // 3. THE REAL DEFECT — dist/AshenSpire.html exactly as committed at 40c5b21,
  //    fetched from git by blob id. If this stops failing, the check is broken,
  //    not the history.
  let stale = null;
  try {
    stale = execFileSync('git', ['cat-file', 'blob', STALE_BLOB], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    // Unreachable corpus is `unknown`, and unknown blocks. Never a silent pass.
    console.log(`  BAD  real: stale blob ${STALE_BLOB.slice(0, 8)} unreachable — ${String(e.message).split('\n')[0]}`);
    console.log('         A shallow clone cannot run this corpus entry. Fetch full depth.');
    bad.push('real stale blob unreachable (unknown, not pass)');
  }
  if (stale) {
    expect(`real: dist/AshenSpire.html @40c5b21 (blob ${STALE_BLOB.slice(0, 8)}, ${stale.length} bytes)`,
      checkCarriesArt('dist/AshenSpire.html@40c5b21', stale), false, 'NO_ART');
    expect('real: that same stale blob vs a good build',
      checkShippedIsBuilt('dist/AshenSpire.html@40c5b21', stale, goodArt), false, 'DRIFT');
  }

  // 4. Synthetic drift: one byte apart. The subtle case a size check would miss.
  const drifted = Buffer.from(goodArt.toString('utf8').replace('AAAA', 'AAAB'), 'utf8');
  expect('synthetic: dist differs from build by one byte',
    checkShippedIsBuilt('synthetic-drift.html', drifted, goodArt), false, 'DRIFT');

  // 5. The stamped twin, by its real committed name.
  expect('real: AshenSpire-0.2.0-ashen.html tracked in dist/',
    checkNoStampedTwin(['AshenSpire.html', 'AshenSpire-0.2.0-ashen.html', 'README.md']),
    false, 'STAMPED_TWIN');

  // 6-8. Positive controls — the checks must not fail everything indiscriminately.
  expect('control: good build carries art', checkCarriesArt('good.html', goodArt), true, 'NO_ART');
  expect('control: identical bytes are not drift',
    checkShippedIsBuilt('good.html', goodArt, goodArt), true, 'DRIFT');
  expect('control: clean dist/ listing', checkNoStampedTwin(['AshenSpire.html', 'README.md']), true, 'STAMPED_TWIN');

  boundary([
    'nothing about the working tree — --selftest checks the CHECKS, not the repo',
    'the synthetic cases are my model of the defect; only the blob cases are the defect',
    'no browser opened anything: art PRESENT is not art RENDERING',
  ]);
  if (bad.length) {
    console.error(`\nverify-shipped --selftest: ${bad.length} case(s) landed on the wrong verdict:`);
    for (const b of bad) console.error('    · ' + b);
    process.exit(1);
  }
  console.log('\nverify-shipped --selftest: OK — every known-bad case failed for its named reason.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Normal run: verify the working tree.
// ---------------------------------------------------------------------------
console.log('verify-shipped: checking the file a player is handed.\n');

const buildPath = resolve(ROOT, BUILD);
if (!existsSync(buildPath)) {
  console.error(`verify-shipped: ${BUILD} does not exist. Run \`node tools/bundle.mjs\` first.`);
  process.exit(1);
}
const buildBytes = readFileSync(buildPath);

// A on the build first: the chain dist===build only terminates in a true claim if
// build itself is sound. This is the assertion bundle.mjs printed and never gated.
record(checkCarriesArt(BUILD, buildBytes));

const shippedPath = resolve(ROOT, SHIPPED);
if (!existsSync(shippedPath)) {
  record({ ok: false, code: 'MISSING', detail: `${SHIPPED} does not exist, but README.md:25 links it.` });
} else {
  const shippedBytes = readFileSync(shippedPath);
  record(checkCarriesArt(SHIPPED, shippedBytes));
  record(checkShippedIsBuilt(SHIPPED, shippedBytes, buildBytes));
}

// C from git, not the filesystem: an ignored file sitting in dist/ after a
// launcher run is correct and must not fail this. Only a TRACKED one is the bug.
let trackedDist = [];
try {
  trackedDist = execFileSync('git', ['ls-files', '--', DIST_DIR], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).map((p) => p.replace(/^dist\//, ''));
  record(checkNoStampedTwin(trackedDist));
} catch (e) {
  record({ ok: false, code: 'STAMPED_TWIN', detail: `could not list tracked files in dist/ (${String(e.message).split('\n')[0]}) — unknown, which blocks` });
}

// Report every untracked artifact sitting in dist/, as information not verdict.
const onDisk = existsSync(resolve(ROOT, DIST_DIR)) ? readdirSync(resolve(ROOT, DIST_DIR)) : [];
const untracked = onDisk.filter((f) => f.endsWith('.html') && !trackedDist.includes(f));
if (untracked.length) console.log(`  note        untracked in dist/ (expected, launcher output): ${untracked.join(', ')}`);

boundary([
  'nothing rendered it. ASSET_MAP present and 101 data: URIs is not "the art appears"',
  '   — that needs a browser and a seeing seat, and this tool has neither',
  'nothing played it. This says the shipped file IS this source, never that this',
  ' source is a good game, balanced, or even winnable',
  'no statement about the tutorial lockout: that fix lives on another branch, so a',
  ' dist/ verified here still contains the locked tutorial',
  'reproducibility across machines is not checked here — that is the git-diff step',
  ' in .github/workflows/ci.yml running on three runners',
]);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\nverify-shipped: FAILED ${failed.length} of ${results.length}.`);
  console.error('  Fix: node tools/launch.mjs --build-only   (rebuilds build/ AND refreshes dist/)');
  process.exit(1);
}
console.log(`\nverify-shipped: OK — ${results.length} checks passed.`);
process.exit(0);
