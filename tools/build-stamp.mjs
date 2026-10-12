#!/usr/bin/env node
// tools/build-stamp.mjs — THE BUILD NUMBER IS PRODUCED AFTER THE MERGE, NOT BEFORE IT.
//
// THE DEFECT THIS EXISTS FOR. Every pull request into `dev` used to commit a
// bumped buildordinal.json and a CHANGELOG receipt stamped with it. But any
// other merge into `dev` moves the ordinal, so a pull request that had just
// matched its box went red the moment a neighbour landed: receipts.mjs --pr
// reported a stampMismatch, and dev-preview reported "The rebuild changed
// nothing committed". The author could only chase the box, and every merge
// restarted the chase.
//
// THE NEW MODEL. A pull request writes its receipt with the stamp of
// buildordinal.json as it stands on its own branch, and does not commit
// buildordinal.json at all. After a push to `dev` lands, the build-stamp
// workflow (.github/workflows/build-stamp.yml) rebuilds the merged tree, which
// is the one place the real box is produced, and then calls this tool. This
// tool re-points the stamp of every pull request that LANDED in that push to
// the box the rebuild wrote, so each receipt names the build it shipped in.
// The workflow then regenerates the changelog module and pushes the three files
// to `dev`. Nothing here decides an ordinal; it only copies the one the build
// already wrote.
//
// WHAT COUNTS AS LANDED is receipts.mjs's rule, not a copy of it: a merge commit
// anywhere in the range, and a `… (#N)` squash suffix on the first-parent line
// only (rangeSubjects and landedPull, exported from there).
//
// WHAT IT WRITES. Only the stamp that follows a receipt's link:
//   ([#N](https://github.com/cehinds/AshenSpire/pull/N), `X`)  ->  `X` = release.ordinal
// Every other byte of CHANGELOG.md is left alone, and about-changelog.mjs --write
// still owns the file's shape and the generated module. A pull request with no
// receipt is a note, not a failure: receipts.mjs --check is what fails a gap.
//
// Usage
//   node tools/build-stamp.mjs --range <before>..<after>   the PRs that landed in a push
//                                                           (after must be HEAD)
//                                                           before all zeros or
//                                                           unknown: HEAD's own
//                                                           landing only
//   node tools/build-stamp.mjs --prs 1884,1876             named by hand
//   node tools/build-stamp.mjs --selftest                  the known-bad corpus
//
// Exit 0 when the changelog is stamped (or nothing needed stamping), 1 when the
// selftest fails, 2 when the harness could not run (bad usage, no box).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { landedPull, rangeSubjects } from './receipts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const BUILDORDINAL = join(ROOT, 'buildordinal.json');

// The pull request numbers that landed, in first-seen order, from the entries
// receipts.mjs's range walk returns. A number is taken once.
export function landedInSubjects(entries) {
  const out = [];
  for (const entry of entries) {
    const n = landedPull(entry);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// `<before>..<after>` as two revisions. Throws on anything else, so a malformed
// range is a usage error rather than a silent empty stamp.
export function parseRange(text) {
  const m = /^([^.\s]*)\.\.([^.\s]+)$/.exec(String(text || ''));
  if (!m) throw new Error(`--range wants <before>..<after>, got '${text ?? ''}'`);
  return { before: m[1], after: m[2] };
}

// A push's `before` is all zeros when the branch was created by the push, and
// may be missing from a manual run. Either way there is no range to walk.
export function isNullSha(sha) {
  return !sha || /^0+$/.test(sha);
}

// THE PURE CORE. Re-points every receipt of each named pull request to `box`.
// Matches the link's own number exactly: `/pull/18)` cannot match `/pull/1884)`,
// because the closing parenthesis is part of the pattern.
//
// Returns:
//   text      the rewritten changelog (equal to the input when nothing moved)
//   changed   [{ pr, from, to }] for each receipt whose stamp was rewritten
//   current   [pr] whose receipt already carries the box (no change)
//   missing   [pr] with no receipt at all (a note, not a failure)
//   unstamped [pr] whose receipt has no `<release>.<ordinal>` span after its link
export function restamp(changelogText, prs, box) {
  const stamp = `${box.release}.${box.ordinal}`;
  let text = changelogText;
  const changed = [];
  const current = [];
  const missing = [];
  const unstamped = [];
  for (const pr of [...new Set(prs.map(String))]) {
    if (!/^\d+$/.test(pr)) throw new Error(`restamp: '${pr}' is not a pull request number`);
    const link = `/pull/${pr})`;
    const re = new RegExp(`(/pull/${pr}\\),\\s*\`)([^\`\\n]+)(\`)`, 'g');
    const hits = [...text.matchAll(re)];
    if (!hits.length) {
      (text.includes(link) ? unstamped : missing).push(pr);
      continue;
    }
    const froms = hits.map((h) => h[2]);
    if (froms.every((f) => f === stamp)) { current.push(pr); continue; }
    text = text.replace(re, (_, before, _old, after) => `${before}${stamp}${after}`);
    changed.push({ pr, from: froms[0], to: stamp });
  }
  return { text, changed, current, missing, unstamped };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function revOf(rev) {
  try { return git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).trim() || null; }
  catch { return null; }
}

// HEAD's own landing, for a push that has no usable `before`. A squash or a
// merge commit at HEAD is the only landing such a push can carry.
function headEntries(cwd = ROOT) {
  const subject = execFileSync('git', ['log', '-1', '--format=%s', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  return [{ subject, firstParent: true }];
}

// THE LANDED PULL REQUESTS OF A PUSH, by the same rule as the stamp itself:
// the commits from `before` to HEAD, or HEAD's own subject when `before` is all
// zeros or not in this checkout. about-changelog.mjs --pending auto reads it, so
// the pending set and the re-point set can never disagree about what landed.
export function landedSince(before, { cwd = ROOT } = {}) {
  let known = false;
  if (!isNullSha(before)) {
    try { execFileSync('git', ['cat-file', '-e', `${before}^{commit}`], { cwd, stdio: 'ignore' }); known = true; }
    catch { known = false; }
  }
  if (!known) return landedInSubjects(headEntries(cwd));
  return landedInSubjects(rangeSubjects(before, { cwd }));
}

function readBox() {
  try {
    const box = JSON.parse(readFileSync(BUILDORDINAL, 'utf8'));
    if (typeof box.release === 'string' && Number.isInteger(box.ordinal)) return box;
  } catch { /* reported by the caller */ }
  return null;
}

function prsFromRange(text) {
  const { before, after } = parseRange(text);
  const head = revOf('HEAD');
  if (revOf(after) !== head) {
    throw new Error(`--range's <after> must be HEAD (${head}); got ${after}`);
  }
  if (isNullSha(before) || !revOf(before)) {
    return { prs: landedInSubjects(headEntries()), bound: 'HEAD only (no usable before)' };
  }
  return { prs: landedInSubjects(rangeSubjects(before)), bound: `${before}..HEAD` };
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  const r = argv.indexOf('--range');
  const p = argv.indexOf('--prs');
  if (r < 0 && p < 0) {
    console.error('usage: node tools/build-stamp.mjs --range <before>..<after> | --prs <N,N,…> | --selftest');
    return 2;
  }
  const box = readBox();
  if (!box) {
    console.error('build-stamp: HARNESS COULD NOT RUN — buildordinal.json is missing or has no release and integer ordinal.');
    return 2;
  }
  let prs;
  let bound;
  try {
    if (p >= 0) {
      const list = String(argv[p + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!list.length || !list.every((s) => /^\d+$/.test(s))) {
        console.error(`build-stamp: --prs wants pull request numbers, got '${argv[p + 1] ?? ''}'`);
        return 2;
      }
      prs = [...new Set(list)];
      bound = '--prs';
    } else {
      ({ prs, bound } = prsFromRange(argv[r + 1]));
    }
  } catch (error) {
    console.error(`build-stamp: ${error.message}`);
    return 2;
  }

  const stamp = `${box.release}.${box.ordinal}`;
  const text = readFileSync(CHANGELOG, 'utf8');
  const result = restamp(text, prs, box);
  console.log(`build-stamp — re-point landed pull requests to the box ${stamp}`);
  console.log(`  range      ${bound}`);
  console.log(`  landed     ${prs.length ? prs.map((n) => `#${n}`).join(' ') : 'none'}`);
  console.log('');
  for (const c of result.changed) console.log(`  CHANGED   #${c.pr}  \`${c.from}\` -> \`${c.to}\``);
  for (const pr of result.current) console.log(`  CURRENT   #${pr}  already \`${stamp}\``);
  for (const pr of result.missing) console.log(`  NOTE      #${pr} landed with no receipt in CHANGELOG.md; nothing to re-point`);
  for (const pr of result.unstamped) console.log(`  NOTE      #${pr} has a receipt with no \`<release>.<ordinal>\` stamp after its link; left alone`);
  if (result.text !== text) writeFileSync(CHANGELOG, result.text);
  console.log('');
  console.log(`build-stamp: ${result.changed.length} receipt(s) re-pointed to \`${stamp}\``);
  return 0;
}

// THE KNOWN-BADS. Each drives restamp directly, so no git repository is needed.
// The clean copy's own assertions run first: a corpus whose clean copy is not
// clean proves nothing.
function selftest() {
  const BOX = { release: '0.5.5', ordinal: 2 };
  const link = (n, s) => `- **Entry ${n}** ([#${n}](https://github.com/cehinds/AshenSpire/pull/${n}), \`${s}\`)`;
  const MD = [link(12, '0.5.5.1'), link(13, '0.5.5.1'), link(1884, '0.5.5.1'), link(18, '0.5.5.1')].join('\n');
  const stampOf = (text, n) => new RegExp(`/pull/${n}\\),\\s*\`([^\`]+)\``).exec(text)?.[1];
  let passed = 0;
  let red = 0;
  const check = (name, ok, detail = '') => {
    if (ok) { console.log(`  PASS  ${name}`); passed += 1; }
    else { console.log(`  RED   ${name}${detail ? ` -> ${detail}` : ''}`); red += 1; }
  };
  console.log('build-stamp --selftest — restamp and the landing rule');
  console.log('');

  const one = restamp(MD, ['12'], BOX);
  check('one PR re-pointed: its stamp moves, its neighbour is untouched',
    one.changed.length === 1 && one.changed[0].pr === '12' && one.changed[0].to === '0.5.5.2'
      && stampOf(one.text, 12) === '0.5.5.2' && stampOf(one.text, 13) === '0.5.5.1',
    JSON.stringify(one.changed));

  const absent = restamp(MD, ['99'], BOX);
  check('a PR with no receipt: no change, reported as missing',
    absent.text === MD && absent.changed.length === 0 && absent.missing.join() === '99',
    `missing=${absent.missing}`);

  const right = restamp(MD.replace(/0\.5\.5\.1/g, '0.5.5.2'), ['12'], BOX);
  check('a stamp already right: no change, reported as current',
    right.changed.length === 0 && right.current.join() === '12' && right.text === MD.replace(/0\.5\.5\.1/g, '0.5.5.2'));

  const two = restamp(MD, ['12', '13'], BOX);
  check('two PRs: both re-pointed, the other two untouched',
    two.changed.map((c) => c.pr).join() === '12,13' && stampOf(two.text, 1884) === '0.5.5.1' && stampOf(two.text, 18) === '0.5.5.1');

  const eighteen = restamp(MD, ['18'], BOX);
  check('#18 does not re-point #1884 (a prefix of another number)',
    eighteen.changed.length === 1 && stampOf(eighteen.text, 18) === '0.5.5.2' && stampOf(eighteen.text, 1884) === '0.5.5.1',
    JSON.stringify(eighteen.changed));

  const big = restamp(MD, ['1884'], BOX);
  check('#1884 does not re-point #18',
    big.changed.length === 1 && stampOf(big.text, 1884) === '0.5.5.2' && stampOf(big.text, 18) === '0.5.5.1');

  const one8 = restamp(MD, ['1'], BOX);
  check('#1 is not a receipt of #1884 or #18 (a prefix is not a match)',
    one8.changed.length === 0 && one8.missing.join() === '1');

  const bare = `- **Bare** ([#20](https://github.com/cehinds/AshenSpire/pull/20))`;
  const unst = restamp(bare, ['20'], BOX);
  check('a receipt with no stamp after its link is left alone and reported',
    unst.text === bare && unst.unstamped.join() === '20' && unst.changed.length === 0);

  const landed = landedInSubjects([
    'Merge pull request #5 from a/b',
    { subject: 'Add a thing (#6)', firstParent: true },
    { subject: 'Fix inside a branch (#7)', firstParent: false },
    'Merge PR #8: a title',
    { subject: 'Merge pull request #5 from a/b', firstParent: false },
  ]);
  check('landing: merge subjects anywhere, squash on the first-parent line only, each number once',
    landed.join() === '5,6,8', `got ${landed}`);

  const range = parseRange('abc123..def456');
  check('parseRange reads <before>..<after>', range.before === 'abc123' && range.after === 'def456');
  let threw = false;
  try { parseRange('nope'); } catch { threw = true; }
  check('parseRange refuses a malformed range', threw);
  check('an all-zero before is a null sha', isNullSha('0000000000000000000000000000000000000000') && isNullSha(''));

  console.log('');
  if (red) { console.log(`build-stamp-selftest: FAIL — ${red} check(s) red`); return 1; }
  console.log(`build-stamp-selftest: OK — ${passed} checks passed`);
  return 0;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);
if (invoked) process.exit(main(process.argv.slice(2)));
