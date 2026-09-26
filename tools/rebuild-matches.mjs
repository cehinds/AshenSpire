// tools/rebuild-matches.mjs — does a build from THIS source reproduce what is
// committed, and does it reproduce itself?
//
// ---- SINCE 2026-09-26 THE BUILD IS NOT COMMITTED ON dev ----------------------
//
// The Git LFS budget ran out, so build/AshenSpire.html is ignored and CI builds
// it. What a commit still carries from its build is the BOX, buildordinal.json:
// the ordinal and the source digest the build wrote. So the generative question
// is now asked of that: build from the source in front of you, and the box must
// not move (a moved box is a receipt pointing at a build this source did not
// make — the old "foreign bundle" class, arriving through the file that is
// still committed). Then build again: the two builds must be byte-identical, so
// the artifact CI publishes for a commit is THE build of that commit.
//
// ---- WHY THIS FILE EXISTS AT ALL --------------------------------------------
//
// It was a row in the family repo's release floor (F22), and Sten found what
// that meant: *a check living outside the tree it protects.* He also proved it
// is not a spare — it is the ONLY door onto a defect class Vira named at
// ce4f171, head source with a bundle imported from somewhere else. He rebuilt
// that case at dev and watched the other three doors stay green:
//
//     verify-shipped        exit 0        build == dist  (both foreign)
//     artifact-provenance   "same commit"
//     THIS                  RED
//
// The reason generalises and is worth keeping in front of whoever edits this:
// THE OTHER THREE ARE RELATIONAL — committed against committed. A bundle that
// came from elsewhere is invisible to every one of them BY CONSTRUCTION,
// because both copies are consistently foreign together. This one is
// GENERATIVE: it makes a new artifact from the source in front of it and asks
// whether the committed one could have come from here. Nothing else in the tree
// does that, and a relational check can never be widened into one.
//
// ONE HOME EACH, and this file is deliberately narrow. `dist` equals `build` is
// tools/verify-shipped.mjs check B and is NOT restated here — Sten's own
// correction, after his first version of this command carried a `-- build dist`
// whose dist half COULD NOT FIRE (bundle.mjs writes OUT_DIR = build/ only). A
// dead token in a command is the class he spent that night removing from other
// people's instruments. This owns build/. That is the whole of it.
//
// ---- WHAT A GREEN HERE DOES NOT MEAN ----------------------------------------
//
// Printed by the tool itself, not only here, because a suite that prints only
// PASS is "green wasn't clearance" shipped as infrastructure.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = 'build/AshenSpire.html';
const ABS = resolve(ROOT, BUNDLE);
// What a build writes that IS committed: the box, and the changelog projection
// the receipt flow regenerates. Both must survive a rebuild untouched.
const COMMITTED_OUTPUTS = ['buildordinal.json', 'src/content/changelog.generated.js'];
// The same tier tools/launch.mjs builds: light unless --full-art (release/main).
const TIER_FLAG = process.argv.includes('--full-art') ? [] : ['--light'];

// A Windows checkout may feed the bundler CRLF source. That is checkout format,
// not foreign content. Canonicalize CRLF only; every other byte still binds.
const md5 = (buf) => createHash('md5').update(
  Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'))
).digest('hex');
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();
const restore = () => spawnSync('git', ['-C', ROOT, 'checkout', '--', ...COMMITTED_OUTPUTS]);

/** unknown is not the softer bucket — it BLOCKS, exactly as red does (SOP 2). */
function unknown(why, detail) {
  console.log(`rebuild-matches: UNKNOWN — ${why}`);
  if (detail) console.log(`  ${detail}`);
  console.log('  UNKNOWN BLOCKS. It is not a pass and it is not a soft red: this tool could');
  console.log('  not put itself in a position to answer, so nothing has been checked.');
  process.exit(2);
}

// ---- the referent gate -------------------------------------------------------
let head;
try {
  head = git('rev-parse', 'HEAD');
} catch {
  unknown(`${ROOT} is not a git repository`, 'nothing here has a committed box to compare against');
}
const shortHead = head.slice(0, 7);

// An edited box makes the comparison measure somebody's working tree, not this
// commit. Not a red — a wrong question, and it gets the bucket that blocks.
if (spawnSync('git', ['-C', ROOT, 'diff', '--quiet', '--', ...COMMITTED_OUTPUTS]).status !== 0) {
  unknown(`${COMMITTED_OUTPUTS.join(' or ')} is already modified in the working tree`,
    `at ${head} — commit it or restore it, then this can measure the source instead of the edit`);
}

// ---- generate, twice ---------------------------------------------------------
//
// THE NUMERATOR NEEDS A GUARD. If the bundler dies or writes nothing, the
// comparisons below pass for the wrong reason, so each run must prove it RAN:
// exit 0, and the bundle actually (re)written.
function build(n) {
  const mtimeBefore = existsSync(ABS) ? statSync(ABS).mtimeMs : null;
  const built = spawnSync('node', ['tools/bundle.mjs', ...TIER_FLAG], { cwd: ROOT, encoding: 'utf8' });
  if (built.status !== 0) {
    restore();
    unknown(`tools/bundle.mjs exited ${built.status === null ? 'on a signal' : built.status} (build ${n})`,
      `at ${head} — a bundler that cannot run has not disagreed with anything`
      + `${built.stderr ? `\n  ${built.stderr.trim().split('\n').slice(-3).join('\n  ')}` : ''}`);
  }
  if (!existsSync(ABS) || statSync(ABS).mtimeMs === mtimeBefore) {
    restore();
    unknown(`tools/bundle.mjs exited 0 without writing ${BUNDLE} (build ${n})`,
      `at ${head} — an unwritten file matches for the wrong reason`);
  }
  return md5(readFileSync(ABS));
}

const first = build(1);
const moved = COMMITTED_OUTPUTS.filter((f) => spawnSync('git', ['-C', ROOT, 'diff', '--quiet', '--', f]).status !== 0);
if (moved.length) {
  restore();
  console.log(`rebuild-matches: RED — a build from the source at ${shortHead} rewrote ${moved.join(', ')}.`);
  console.log('  The committed box was NOT written by this source: the source moved after the');
  console.log('  last rebuild, or the box came from another tree. The receipt names a build');
  console.log('  this commit does not make.');
  console.log('  Fix: node tools/launch.mjs --build-only at this head, re-point the receipt,');
  console.log('  and commit the box. (The working tree was restored.)');
  process.exit(1);
}
const second = build(2);

console.log(`rebuild-matches: ${BUNDLE} at ${shortHead}`);
console.log(`  build 1  canonical-LF md5 ${first}`);
console.log(`  build 2  canonical-LF md5 ${second}`);
console.log(`  ${COMMITTED_OUTPUTS.join(', ')} unchanged by the rebuild`);
console.log('');

if (first !== second) {
  console.log('RED — two builds of the same source differ. The artifact CI publishes for a');
  console.log('  commit would not be THE build of that commit. The fix belongs in');
  console.log('  tools/bundle.mjs or tools/dirorder.mjs.');
  process.exit(1);
}

console.log('GREEN — this source rebuilds its committed box, and rebuilds identically.');
console.log('');
console.log('BOUNDARY — what this green does NOT mean:');
console.log('  · nothing about dist/ or the root aliases: that is verify-shipped check B.');
console.log('  · nothing about whether the game plays, renders, or is any good.');
console.log(`  · reproducibility ON THIS MACHINE only — Node ${process.version}, ${process.platform}.`);
console.log('    Cross-platform agreement is ci.yml\'s reproducible-agree job.');
console.log('  · nothing about the SOURCE being right. It proves the box came from the tree,');
console.log('    never that the tree is correct.');
process.exit(0);
