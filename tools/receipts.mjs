#!/usr/bin/env node
// tools/receipts.mjs — EVERY MERGED PULL REQUEST HAS A RECEIPT BEFORE IT IS PROMOTED.
//
// THE DEFECT THIS EXISTS FOR, and it is not hypothetical: #629, #631, #635,
// #637, #640, #645, #648, #649 and #650 each landed on `dev` with no entry in
// CHANGELOG.md. Every one was found later, by a person reading the merge log
// against the file and noticing a gap — #633 came back for #629 four merges
// afterwards, and #641 came back for three at once. The in-game changelog is a
// projection of that file (#189), so a missing receipt is missing for a PLAYER
// too, not only for the repository.
//
// Nothing was broken in any of those cases. That is exactly why it kept
// happening: an unreceipted merge is green, ships, and reads as finished. The
// only thing that ever caught it was attention, and attention does not scale
// past the third merge in an evening.
//
// THE RULE, and it is bounded on purpose: every `Merge pull request #N` commit
// that is on this branch AND NOT YET on the promotion target must be named by
// some receipt in CHANGELOG.md. The bound is what makes this affordable and
// what makes it meaningful — the question is never "has every merge in history
// got a receipt" (they have not, and the file's own header says which stretch
// is deliberately unreconstructed). The question is "is this promotion
// complete", asked while the answer can still be acted on.
//
// WHAT IT DOES NOT CHECK, stated so the silence is a decision:
//   · whether the receipt is TRUE. Prose is not machine-checkable, and a gate
//     that pretended otherwise would license worse prose, not better.
//   · whether the ordinal on the receipt is the one committed at that merge.
//     tools/about-changelog.mjs owns the file's shape; this owns its coverage.
//   · direct landings that name no pull request. A receipt names a pull
//     request; a commit that has none cannot be named by one, and the file's
//     header already records that class rather than hiding it.
//
// Usage
//   node tools/receipts.mjs --check              origin/test..HEAD (the promotion)
//   node tools/receipts.mjs --check --since dev  any other range
//   node tools/receipts.mjs --selftest           the known-bad corpus
//
// Exit 0 green, 1 a gap, 2 the harness could not run.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');

// The one shape a receipt is required to carry. It is the shape every receipt
// in the file already uses, and it is the shape the in-game projection reads.
const RECEIPT_REF = /\/pull\/(\d+)\)/g;
const MERGE_SUBJECT = /^Merge pull request #(\d+)\s/;

// THE PURE CORE, kept separate from git so the known-bads below can drive it
// without a repository. Everything this tool concludes is concluded here.
export function unreceipted(mergeSubjects, changelogText) {
  const receipted = new Set();
  for (const m of changelogText.matchAll(RECEIPT_REF)) receipted.add(m[1]);
  const merged = [];
  for (const subject of mergeSubjects) {
    const m = MERGE_SUBJECT.exec(subject);
    if (m) merged.push(m[1]);
  }
  return { receipted, merged, missing: merged.filter((n) => !receipted.has(n)) };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function resolve(rev) {
  try { return git(['rev-parse', '--verify', '--quiet', rev]).trim() || null; }
  catch { return null; }
}

function rangeSubjects(since) {
  const spec = since ? `${since}..HEAD` : 'HEAD';
  const out = git(['log', '--merges', '--format=%s', spec, ...(since ? [] : ['--max-count=40'])]);
  return out.split('\n').filter(Boolean);
}

function check(sinceArg) {
  // The promotion target is the default bound. A checkout that has not fetched
  // it is NOT silently widened to all of history — that would turn a green into
  // a meaningless one. It falls back to the last 40 merges and SAYS SO.
  let since = sinceArg || null;
  let bound;
  if (since) {
    if (!resolve(since)) {
      console.error(`receipts: cannot resolve --since ${since}`);
      return 2;
    }
    bound = `${since}..HEAD`;
  } else {
    since = ['origin/test', 'test'].find((r) => resolve(r)) || null;
    bound = since ? `${since}..HEAD` : 'the last 40 merges (no promotion target fetched)';
  }

  const changelog = readFileSync(CHANGELOG, 'utf8');
  const { receipted, merged, missing } = unreceipted(rangeSubjects(since), changelog);

  // THE FLOOR THAT KEEPS THIS TOOL HONEST. If the reference syntax in
  // CHANGELOG.md ever changes, this regex quietly matches nothing, every merge
  // reads as unreceipted, and the tool becomes noise — or, with the comparison
  // inverted, silently green. Parsing zero references is the tool's own defect
  // and is reported as one, never as a finding about the changelog.
  if (receipted.size === 0) {
    console.error('receipts: HARNESS COULD NOT RUN — CHANGELOG.md yielded no pull-request');
    console.error('  references at all. The file\'s receipt syntax has moved out from under');
    console.error(`  ${RECEIPT_REF}. Fix this tool; do not read the result below as a finding.`);
    return 2;
  }

  console.log(`receipts — every merged pull request named by a receipt in CHANGELOG.md`);
  console.log(`  range      ${bound}`);
  console.log(`  merges     ${merged.length}`);
  console.log(`  receipts   ${receipted.size} pull request(s) referenced in the file`);
  console.log('');

  if (missing.length) {
    for (const n of missing) {
      console.log(`  FAIL  #${n} merged with no receipt in CHANGELOG.md`);
    }
    console.log('');
    console.log('  A receipt names the pull request and the build ordinal committed at that');
    console.log('  merge, and the in-game changelog is regenerated from this file:');
    console.log('');
    console.log('    node tools/about-changelog.mjs --write && node tools/bundle.mjs');
    console.log('');
    console.log(`receipts: FAIL — ${missing.length} of ${merged.length} merged pull request(s) carry no receipt`);
    return 1;
  }

  for (const n of merged) console.log(`  PASS  #${n} has a receipt`);
  // The empty range is a real answer, not an absent one: nothing is owed. It is
  // counted as the one assertion it is, so the verdict door never sees a zero.
  const checks = merged.length || 1;
  if (!merged.length) console.log('  PASS  no pull request has merged into this range — nothing is owed');
  console.log('');
  console.log(`receipts: OK — ${checks} checks passed`);
  return 0;
}

// THE KNOWN-BADS. Each must go red, and the clean copy must be green, or
// nothing above proves anything. They drive the pure core directly: a corpus
// that needed a scratch git repository would be slower and would test git.
function selftest() {
  const CLEAN_LOG = ['Merge pull request #12 from a/b', 'Merge pull request #13 from a/c'];
  const CLEAN_MD = 'x ([#12](https://github.com/o/r/pull/12), `0.5.5.1`)\ny ([#13](https://github.com/o/r/pull/13), `0.5.5.2`)';
  const plants = [
    ['a merge with no receipt', [...CLEAN_LOG, 'Merge pull request #14 from a/d'], CLEAN_MD, ['14']],
    ['the receipt names a different pull request', CLEAN_LOG, CLEAN_MD.replace('/pull/13)', '/pull/31)'), ['13']],
    ['two merges, one receipt', [...CLEAN_LOG, 'Merge pull request #15 from a/e', 'Merge pull request #16 from a/f'], CLEAN_MD, ['15', '16']],
  ];

  let passed = 0;
  let red = 0;
  console.log('receipts --selftest — the known-bads, each driven through the same core');
  console.log('');

  const clean = unreceipted(CLEAN_LOG, CLEAN_MD);
  if (clean.missing.length) {
    console.log(`  RED  clean copy is not green — it reports ${clean.missing.join(', ')} missing.`);
    console.log('       No plant below proves anything.');
    console.log('');
    console.log('receipts-selftest: FAIL — the clean copy is not green');
    return 1;
  }
  console.log('  PASS  clean copy: 2 merges, 2 receipts, nothing missing');
  passed += 1;

  for (const [name, log, md, expected] of plants) {
    const got = unreceipted(log, md).missing;
    const ok = got.length === expected.length && got.every((n, i) => n === expected[i]);
    if (ok) { console.log(`  CAUGHT  "${name}" -> missing ${got.join(', ')}`); passed += 1; }
    else { console.log(`  RED  "${name}" -> expected ${expected.join(', ')}, got ${got.join(', ') || 'nothing'}`); red += 1; }
  }

  // The plant that guards the guard: a changelog whose reference syntax moved
  // must NOT read as "every merge unreceipted" out in the world — check() turns
  // that into exit 2. Here we prove the core is what makes that detectable.
  const moved = unreceipted(CLEAN_LOG, CLEAN_MD.replaceAll('/pull/', '/pr/'));
  if (moved.receipted.size === 0) { console.log('  CAUGHT  "receipt syntax moved" -> zero references parsed, which check() refuses as a harness fault'); passed += 1; }
  else { console.log('  RED  "receipt syntax moved" -> still parsed references; the floor cannot fire'); red += 1; }

  console.log('');
  if (red) { console.log(`receipts-selftest: FAIL — ${red} plant(s) did not go red`); return 1; }
  console.log(`receipts-selftest: OK — ${passed} checks passed`);
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) process.exit(selftest());
else if (argv.includes('--check') || argv.length === 0) {
  const i = argv.indexOf('--since');
  process.exit(check(i >= 0 ? argv[i + 1] : null));
} else {
  console.error('usage: node tools/receipts.mjs [--check] [--since <rev>] | --selftest');
  process.exit(2);
}
