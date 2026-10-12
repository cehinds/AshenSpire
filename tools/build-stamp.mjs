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
// THE GENERATED MODULE IS IN THE DIGEST. src/content/changelog.generated.js is
// under src/**, so writing it moves the box, and a receipt stamped with the box
// from before that write is one build behind. --stamp therefore runs the whole
// sequence as a convergence loop (converge, below): build, re-point to the box
// plus one, about-changelog --write, rebuild, and repeat until the box is a
// fixed point and one more build leaves buildordinal.json byte-identical, then
// buildversion --check. Bounded by MAX_ROUNDS; it never loops unbounded.
//
// Usage
//   node tools/build-stamp.mjs --stamp --range <before>..<after>   the whole stamp, for a push
//   node tools/build-stamp.mjs --stamp --prs 1884                  the same, named by hand
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

import { execFileSync, spawnSync } from 'node:child_process';
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

// THE CONVERGENCE LOOP (--stamp). The generated changelog module is inside the
// build digest (src/**), so writing it moves the box: a receipt stamped with the
// box it had before the write is one build behind the tree that carries the
// write. The manual rule was: stamp at ordinal+1, `about-changelog --write`
// (which allows exactly one build ahead), rebuild. This is that rule, run until
// it is a fixed point, and never more than MAX_ROUNDS times.
//
// `io` is the only thing that touches the world, so the loop is testable with
// a scripted fake: build() → { box, bytes } after a build; readChangelog() and
// writeChangelog(text); about() runs `about-changelog --write`; verify() →
// null, or the reason buildversion --check refused the tree.
export const MAX_ROUNDS = 3;
const fmtBox = (b) => `${b.release}.${b.ordinal}`;
const sameBox = (a, b) => a.release === b.release && a.ordinal === b.ordinal;

export function converge(io, prs, { maxRounds = MAX_ROUNDS } = {}) {
  const first = io.build();
  if (!restamp(io.readChangelog(), prs, first.box).changed.length) {
    return { status: 'nothing', box: first.box, rounds: 0, log: [] };
  }
  const log = [];
  let target = { release: first.box.release, ordinal: first.box.ordinal + 1 };
  for (let round = 1; round <= maxRounds; round += 1) {
    const cur = io.readChangelog();
    const re = restamp(cur, prs, target);
    if (re.text !== cur) io.writeChangelog(re.text);
    io.about();
    const built = io.build();
    log.push(`round ${round}: stamped ${fmtBox(target)}, rebuilt to ${fmtBox(built.box)}`);
    const everyLandedOnBox = restamp(io.readChangelog(), prs, built.box).changed.length === 0;
    if (sameBox(built.box, target) && everyLandedOnBox) {
      // A fixed point must survive one more build: nothing else may move the box.
      const again = io.build();
      if (again.bytes === built.bytes) {
        const problem = io.verify();
        if (problem) return { status: 'failed', reason: `the converged tree fails the build invariant: ${problem}`, box: built.box, rounds: round, log };
        return { status: 'converged', box: built.box, rounds: round, log };
      }
      log.push(`round ${round}: a further rebuild moved buildordinal.json to ${fmtBox(again.box)}; retrying`);
      target = again.box;
      continue;
    }
    // The rebuild landed the box where it landed; the next round re-points to that.
    target = built.box;
  }
  return { status: 'failed', reason: `no fixed point in ${maxRounds} rounds (the box keeps moving under the stamp)`, log };
}

// THE REAL WORLD behind converge(). A build failure throws, which the caller
// reports as a harness fault (exit 2): it is not a finding about the stamp.
function realIo() {
  const run = (args, what) => {
    const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`${what} exited ${r.status}`);
  };
  return {
    build() {
      run([join(ROOT, 'tools', 'launch.mjs'), '--build-only'], 'launch --build-only');
      const bytes = readFileSync(BUILDORDINAL, 'utf8');
      const b = JSON.parse(bytes);
      return { box: { release: b.release, ordinal: b.ordinal }, bytes };
    },
    readChangelog: () => readFileSync(CHANGELOG, 'utf8'),
    writeChangelog: (text) => writeFileSync(CHANGELOG, text),
    about: () => run([join(ROOT, 'tools', 'about-changelog.mjs'), '--write'], 'about-changelog --write'),
    verify() {
      const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'buildversion.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
      if (r.status === 0) return null;
      return (`${r.stdout}${r.stderr}`.trim().split('\n').slice(-2).join(' | ')) || 'buildversion --check failed';
    },
  };
}

function prsFromArgs(argv) {
  const p = argv.indexOf('--prs');
  const r = argv.indexOf('--range');
  if (p >= 0) {
    const list = String(argv[p + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length || !list.every((s) => /^\d+$/.test(s))) throw new Error(`--prs wants pull request numbers, got '${argv[p + 1] ?? ''}'`);
    return { prs: [...new Set(list)], bound: '--prs' };
  }
  if (r >= 0) return prsFromRange(argv[r + 1]);
  throw new Error('--stamp wants --range <before>..<after> or --prs <N,N,…>');
}

function stampMode(argv) {
  let prs;
  let bound;
  try {
    ({ prs, bound } = prsFromArgs(argv));
  } catch (error) {
    console.error(`build-stamp: ${error.message}`);
    return 2;
  }
  console.log(`build-stamp --stamp — landed pull requests ${prs.length ? prs.map((n) => `#${n}`).join(' ') : 'none'} (${bound})`);
  let result;
  try { result = converge(realIo(), prs); }
  catch (error) {
    console.error(`build-stamp --stamp: HARNESS COULD NOT RUN — ${error.message}`);
    return 2;
  }
  for (const line of result.log || []) console.log(`  ${line}`);
  if (result.status === 'nothing') {
    console.log(`build-stamp: no landed receipt is stamped with an older box; buildordinal.json is ${fmtBox(result.box)} and nothing else changes`);
    return 0;
  }
  if (result.status === 'converged') {
    console.log(`build-stamp: converged on ${fmtBox(result.box)} in ${result.rounds} round(s); every landed receipt names it`);
    return 0;
  }
  console.error(`build-stamp --stamp: FAILED — ${result.reason}`);
  return 1;
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  if (argv.includes('--stamp')) return stampMode(argv);
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

  // THE CONVERGENCE LOOP, against a scripted world. `builds` is what each build
  // reports, in order; `bytes` is derived from the box so an unchanged box reads
  // as an unchanged buildordinal.json.
  const fake = (builds, { verify = null, text = `${MD}\n` } = {}) => {
    const state = { text, writes: 0, about: 0, built: 0 };
    const io = {
      build() {
        const box = builds[Math.min(state.built, builds.length - 1)];
        state.built += 1;
        return { box, bytes: `${box.release}.${box.ordinal}` };
      },
      readChangelog: () => state.text,
      writeChangelog(t) { state.text = t; state.writes += 1; },
      about() { state.about += 1; },
      verify: () => verify,
    };
    return { io, state };
  };
  const B = (n) => ({ release: '0.5.5', ordinal: n });
  {
    // Nothing landed on an older box: no write, no rebuild after the first.
    const { io, state } = fake([B(3)], { text: MD.replace(/0\.5\.5\.1/g, '0.5.5.3') });
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: a receipt already on the box stops at the first build', r.status === 'nothing' && state.writes === 0 && state.about === 0 && state.built === 1, JSON.stringify(r));
  }
  {
    // The box moves to 3 after the first build; the receipt goes to 4 (ordinal+1),
    // the write lands, the rebuild reports 4, and one more build is stable.
    const { io, state } = fake([B(3), B(4), B(4)]);
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: the one-round fixed point is ordinal+1, written and rebuilt', r.status === 'converged' && r.box.ordinal === 4 && r.rounds === 1 && state.writes === 1 && state.text.includes('`0.5.5.4`'), JSON.stringify(r));
  }
  {
    // The module was already current, so the write changes nothing and the box
    // stays at 3. The next round re-points to 3 and converges there.
    const { io, state } = fake([B(3), B(3), B(3), B(3)]);
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: a rebuild that does not bump re-points to the actual box and converges', r.status === 'converged' && r.box.ordinal === 3 && r.rounds === 2 && state.text.includes('`0.5.5.3`'), JSON.stringify(r));
  }
  {
    // The box never settles: each rebuild reports a new ordinal, so the loop stops.
    const { io } = fake([B(3), B(4), B(5), B(6), B(7), B(8), B(9), B(10)]);
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: a box that never settles fails after the round bound, not forever', r.status === 'failed' && /no fixed point in 3 rounds/.test(r.reason), JSON.stringify(r));
  }
  {
    // A converged tree that buildversion --check refuses is a failure, not a green.
    const { io } = fake([B(3), B(4), B(4)], { verify: 'digest differs' });
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: a fixed point that fails buildversion --check is refused', r.status === 'failed' && /digest differs/.test(r.reason), JSON.stringify(r));
  }
  {
    // A further rebuild moves the file after a box looked settled: retry, do not accept.
    // Builds: 3 (first), 4 (round 1 reaches the target), 5 (the stability build moves it),
    // then 5 and 5 (round 2 settles). Accepting round 1 would have been the bug.
    const { io } = fake([B(3), B(4), B(5), B(5), B(5)]);
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: a box that moves on the stability build is retried, not accepted', r.status === 'converged' && r.box.ordinal === 5 && r.rounds === 2, JSON.stringify(r));
  }

  console.log('');
  if (red) { console.log(`build-stamp-selftest: FAIL — ${red} check(s) red`); return 1; }
  console.log(`build-stamp-selftest: OK — ${passed} checks passed`);
  return 0;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);
if (invoked) process.exit(main(process.argv.slice(2)));
