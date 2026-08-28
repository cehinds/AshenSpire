// tools/rebuild-matches.mjs — does a build from THIS source reproduce the
// committed build/ ?
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
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRACKED = 'build/AshenSpire.html';
const ABS = resolve(ROOT, TRACKED);

// Git stores this text artifact with LF, while a Windows checkout may feed the
// bundler CRLF source and produce mixed newline bytes. That is checkout format,
// not foreign content. Canonicalize CRLF only; every other byte still binds.
const md5 = (buf) => createHash('md5').update(
  Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'))
).digest('hex');
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();

/** unknown is not the softer bucket — it BLOCKS, exactly as red does (SOP 2). */
function unknown(why, detail) {
  console.log(`rebuild-matches: UNKNOWN — ${why}`);
  if (detail) console.log(`  ${detail}`);
  console.log('  UNKNOWN BLOCKS. It is not a pass and it is not a soft red: this tool could');
  console.log('  not put itself in a position to answer, so nothing has been checked.');
  process.exit(2);
}

// ---- the referent gate: prove there is something to rule on ------------------
//
// SOP 2's ⚙ clause. An empty or unresolvable answer and a genuinely clean one
// are identical and mean the opposite, so every precondition below resolves to
// UNKNOWN rather than to a quiet green.
let head;
try {
  head = git('rev-parse', 'HEAD');
} catch {
  unknown(`${ROOT} is not a git repository`, 'nothing here has a committed build to compare against');
}
const shortHead = head.slice(0, 7);

let committed;
try {
  committed = execFileSync('git', ['-C', ROOT, 'show', `HEAD:${TRACKED}`], { maxBuffer: 1 << 30 });
} catch {
  unknown(`HEAD does not track ${TRACKED}`, `at ${head} — there is no committed build to reproduce`);
}
if (!committed.length) unknown(`the committed ${TRACKED} is empty`, `at ${head}`);

// A build/ that already disagrees with HEAD makes the comparison below measure
// somebody's working tree, not this commit. That is not a red — it is a wrong
// question, and it gets the bucket that blocks.
if (spawnSync('git', ['-C', ROOT, 'diff', '--quiet', '--', TRACKED]).status !== 0) {
  unknown(`${TRACKED} is already modified in the working tree`,
    `at ${head} — commit it or restore it, then this can measure the source instead of the edit`);
}

const before = md5(committed);
const mtimeBefore = statSync(ABS).mtimeMs;

// ---- generate --------------------------------------------------------------
//
// THE NUMERATOR NEEDS A GUARD, NOT ONLY THE DENOMINATOR — Bjorn's UNPLANTABLE
// finding, one tool over, and the same shape here. If the bundler dies, or is
// replaced by something that writes nothing, `build/` is untouched and the byte
// comparison below passes with a confident smile. So the run has to prove it
// RAN: exit 0, and the file it owns actually rewritten.
const built = spawnSync('node', ['tools/bundle.mjs'], { cwd: ROOT, encoding: 'utf8' });
const restore = () => spawnSync('git', ['-C', ROOT, 'checkout', '--', TRACKED]);

if (built.status !== 0) {
  restore();
  unknown(`tools/bundle.mjs exited ${built.status === null ? 'on a signal' : built.status}`,
    `at ${head} — a bundler that cannot run has not disagreed with anything`
    + `${built.stderr ? `\n  ${built.stderr.trim().split('\n').slice(-3).join('\n  ')}` : ''}`);
}
if (statSync(ABS).mtimeMs === mtimeBefore) {
  restore();
  unknown(`tools/bundle.mjs exited 0 without writing ${TRACKED}`,
    `at ${head} — an unwritten file matches the committed one for the wrong reason`);
}

const after = md5(readFileSync(ABS));
restore();

// ---- the verdict ------------------------------------------------------------
console.log(`rebuild-matches: ${TRACKED} at ${shortHead}`);
console.log(`  committed  canonical-LF md5 ${before}  at ${head}`);
console.log(`  rebuilt    canonical-LF md5 ${after}  from the source at ${head}`);
console.log('');

if (before !== after) {
  console.log('RED — the committed build was NOT produced by this source.');
  console.log('  Either the bundle is stale, or it came from another commit. This is the');
  console.log('  only check in the tree that can tell you so: verify-shipped compares the');
  console.log('  two committed copies to each other and artifact-provenance reads what the');
  console.log('  file says about itself, and a foreign bundle satisfies both.');
  console.log('  Fix: node tools/launch.mjs --build-only, at this head, and commit it.');
  console.log('  (The working tree was restored — this tool leaves no edit behind.)');
  process.exit(1);
}

console.log('GREEN — a build from this source reproduces the committed build/.');
console.log('');
console.log('BOUNDARY — what this green does NOT mean:');
console.log(`  · nothing about dist/. "dist equals build" is verify-shipped check B, one`);
console.log('    home each, and this row owns build/ only — deliberately narrow.');
console.log('  · nothing about whether the game plays, renders, or is any good. It compares');
console.log('    content produced by a bundler against content in a commit. CRLF is');
console.log('    canonicalized to LF; verify-shipped still owns exact build/dist bytes.');
console.log(`  · reproducibility ON THIS MACHINE only — Node ${process.version}, ${process.platform}.`);
console.log('    A bundler whose output varies by platform is a defect this cannot see from');
console.log('    one runner; that is the git-diff step in .github/workflows/ci.yml.');
console.log('  · nothing about the SOURCE being right. It proves the artifact came from the');
console.log('    tree, never that the tree is correct — Bjorn\'s standing distinction between');
console.log('    "the copies agree" and "the survivor is right".');
process.exit(0);
