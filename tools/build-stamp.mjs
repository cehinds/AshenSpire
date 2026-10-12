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
// and, when that stamp would break its date group's newest-build-first order, the
// receipt's own line moves within that group (reorderReceipt). Nothing moves across
// a date heading. Every other byte of CHANGELOG.md is left alone, and about-changelog.mjs
// --write still owns the file's shape and the generated module. A pull request with no
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
//   node tools/build-stamp.mjs --stamp --since-last-stamp          the whole stamp, for a push: the
//                                                                  landings since the last [build-stamp]
//                                                                  commit, else the introduction's parent
//   node tools/build-stamp.mjs --stamp --range <before>..<after>   the same, for a range named by hand
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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { landedPull, rangeSubjects } from './receipts.mjs';
import { compareVersions, versionTuple } from './buildversion.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const BUILDORDINAL = join(ROOT, 'buildordinal.json');
const GENERATED = join(ROOT, 'src', 'content', 'changelog.generated.js');

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

// THE ORDER KEY OF A STAMP, as about-changelog's stampKey builds it, so the move below
// agrees with the strict check: the version, then the scheme slot (a legacy `-rc.N`
// stamp sorts first within its candidate), then the tail. about-changelog.mjs runs its
// own gate on import, so its copy cannot be imported here; this is the same rule, and
// the test that runs the real --check-order on the result is what keeps the two in step.
function orderKey(stamp) {
  const m = /^(\d+\.\d+\.\d+(?:-[A-Za-z]+\.\d+)?)\.(\d+)$/.exec(stamp);
  if (!m) return null;
  const v = versionTuple(m[1], Number(m[2]));
  if (v === null) return null;
  return [...v.slice(0, 3), /-rc\.\d+$/.test(m[1]) ? '0' : '1', v[3]];
}

// THE RECEIPT'S LINE WITHIN ITS DATE GROUP. A group runs newest build first, so a
// re-pointed receipt can sit out of order with its neighbours. It is left where it is
// when every stamped receipt above it is at least as new and every one below at most
// as new (a tie keeps its place). Otherwise it moves to just above the first stamped
// receipt of its group whose build is lower, or, when none is lower, just below the
// group's last stamped receipt. A group is the lines between two `## ` headings, so
// the move never crosses a date. Receipts are one line each (about-changelog refuses
// a receipt that is not a top-level bullet), so a move is a move of one line.
function reorderReceipt(text, pr, stamp) {
  const key = orderKey(stamp);
  if (key === null) return text;
  const lines = text.split('\n');
  const hit = new RegExp(`/pull/${pr}\\),\\s*\`${stamp.replace(/\./g, '\\.')}\``);
  const at = lines.findIndex((l) => l.startsWith('- ') && hit.test(l));
  if (at < 0) return text;
  let head = at - 1;
  while (head >= 0 && !/^## /.test(lines[head])) head -= 1;
  let tail = at + 1;
  while (tail < lines.length && !/^## /.test(lines[tail])) tail += 1;
  const stamped = [];
  for (let i = head + 1; i < tail; i += 1) {
    if (i === at || !lines[i].startsWith('- ')) continue;
    const m = /\/pull\/\d+\),\s*`([^`\n]+)`/.exec(lines[i]);
    const k = m ? orderKey(m[1]) : null;
    if (k !== null) stamped.push({ i, cmp: compareVersions(k, key) });
  }
  const comparable = stamped.filter((s) => s.cmp !== null);
  const inOrder = comparable.every((s) => (s.i < at ? s.cmp >= 0 : s.cmp <= 0));
  if (inOrder || !comparable.length) return text;
  const rest = lines.slice();
  const [moved] = rest.splice(at, 1);
  const lower = comparable.find((s) => s.cmp < 0);
  // An index in `rest`: the line at original index `i` has moved up one if it sat below `at`.
  const shifted = (i) => (i > at ? i - 1 : i);
  const to = lower ? shifted(lower.i) : shifted(comparable[comparable.length - 1].i) + 1;
  rest.splice(to, 0, moved);
  return rest.join('\n');
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

// THE LANDED PULL REQUESTS OF A PUSH, by the rule the stamp itself uses: the commits
// above the base on HEAD's first-parent line, with the merges and squashes among them.
// about-changelog.mjs --pending auto reads it, so the pending set and the re-point set
// can never disagree about what landed.
export function landedSince({ cwd = ROOT } = {}) {
  const { base } = stampBaseIn(cwd);
  if (!base) return landedInSubjects(headEntries(cwd));
  return landedInSubjects(rangeSubjects(base, { cwd }));
}

// THE BASE OF A LANDING RANGE, in order:
//   1. the newest first-parent BOT STAMP commit on HEAD (the exact predicate below);
//   2. else the first parent of the commit that INTRODUCED the stamp workflow, so the
//      introducing merge is counted, and nothing merged before the pipeline existed is;
//   3. else HEAD's own subject only.
// NOT THE EVENT'S before. A run that was cancelled, or that failed, stamped nothing, and
// the next run's before would skip the merges it missed. Both bases above are commits
// on HEAD that stay put, so a later run always covers an earlier one's misses.
//
// A BOT STAMP COMMIT, EXACTLY. A substring marker is not enough: a human squash whose
// title mentions [build-stamp] would otherwise become the base and drop its own pull
// request from every later range. Both the author and the whole subject must match what
// build-stamp writes. The workflow's `if:` checks the author and the prefix; this
// predicate is the exact check, and every use goes through it.
export const BOT_AUTHOR = 'github-actions[bot]';
export const STAMP_SUBJECT = /^build: stamp \d+\.\d+\.\d+(?:-[A-Za-z]+\.\d+)?\.\d+ \[build-stamp\]$/;
export const WORKFLOW_PATH = '.github/workflows/build-stamp.yml';
export function isStampCommit(author, subject) {
  return author === BOT_AUTHOR && STAMP_SUBJECT.test(subject);
}

// PURE. `commits` is HEAD's first-parent line, newest first, as {sha, author, subject};
// `baseline` is the introduction's first parent, or null. Returns { base, source }, base
// null meaning HEAD's own subject only.
export function pickStampBase(commits, baseline) {
  const hit = commits.find((c) => isStampCommit(c.author, c.subject));
  if (hit) return { base: hit.sha, source: 'last-stamp' };
  if (baseline) return { base: baseline, source: 'introduction' };
  return { base: null, source: 'head-only' };
}

// PURE. The landed pull requests of the commits above `base` on the first-parent line,
// newest first. A squash `(#N)` and a merge subject both count, as in receipts.mjs.
// With base null or absent, every commit counts.
export function landedAfterBase(commits, base) {
  const i = base ? commits.findIndex((c) => c.sha === base) : -1;
  const above = i >= 0 ? commits.slice(0, i) : commits;
  return landedInSubjects(above.map((c) => ({ subject: c.subject, firstParent: true })));
}

// The first parent of the oldest first-parent commit that added the stamp workflow, or
// null when git cannot find the introduction (a root commit, or a shallow history).
export function introductionBase(cwd) {
  let added;
  try {
    added = execFileSync('git', ['log', '--first-parent', '--diff-filter=A', '--format=%H', '--', WORKFLOW_PATH], { cwd, encoding: 'utf8' });
  } catch { return null; }
  const shas = added.split('\n').filter(Boolean);
  if (!shas.length) return null;
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${shas[shas.length - 1]}^1`], { cwd, encoding: 'utf8' }).trim() || null;
  } catch { return null; }
}

export function stampBaseIn(cwd) {
  const lines = execFileSync('git', ['log', '--first-parent', '--format=%H%x09%an%x09%s', 'HEAD'], { cwd, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const commits = lines.map((l) => {
    const [sha, author, ...rest] = l.split('\t');
    return { sha, author, subject: rest.join('\t') };
  });
  return pickStampBase(commits, introductionBase(cwd));
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
  // THE MODULE FIRST, EVERY RUN. A PR can leave src/content/changelog.generated.js
  // stale against CHANGELOG.md (a docs-only receipt that already matches). The
  // generated module is in the digest, so the box that build reports is only right
  // once the module is current; repairing it must not wait for a receipt to move.
  // THE LANDED RECEIPTS TO THE COMMITTED BOX FIRST. about-changelog --write refuses a
  // receipt that is out of order with the groups around it: a stale landed receipt of
  // today sits above yesterday's build, so the write cannot run on the stale text. The
  // box read from buildordinal.json is the ceiling, and re-pointing the landed receipts
  // to it makes the order hold. The normal path below then re-points them off that box.
  const committed = io.readBox();
  const text0 = io.readChangelog();
  const pre = restamp(text0, prs, committed);
  if (pre.text !== text0) io.writeChangelog(pre.text);
  const repointed = pre.text !== text0;
  const wrote = io.about();
  const first = io.build();
  const log = [];
  let target;
  if (restamp(io.readChangelog(), prs, first.box).changed.length) {
    target = { release: first.box.release, ordinal: first.box.ordinal + 1 };
  } else if (!wrote && !repointed) {
    return { status: 'nothing', box: first.box, rounds: 0, log };
  } else {
    // The module was repaired and no landed receipt is off the box. The box that
    // build reported settles only if one more build agrees, as a fixed point must.
    log.push(`the module was repaired; no landed receipt is off the box ${fmtBox(first.box)}`);
    const again = io.build();
    if (again.bytes === first.bytes) {
      const problem = io.verify();
      if (problem) return { status: 'failed', reason: `the converged tree fails the build invariant: ${problem}`, box: again.box, rounds: 0, log };
      return { status: 'converged', box: again.box, rounds: 0, log };
    }
    log.push(`a further rebuild moved buildordinal.json to ${fmtBox(again.box)}; settling from there`);
    target = again.box;
  }
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
    // The box the tree was committed with, before this run's build changes it.
    readBox() {
      const b = JSON.parse(readFileSync(BUILDORDINAL, 'utf8'));
      return { release: b.release, ordinal: b.ordinal };
    },
    readChangelog: () => readFileSync(CHANGELOG, 'utf8'),
    writeChangelog: (text) => writeFileSync(CHANGELOG, text),
    // Returns whether the module on disk changed, so the loop knows a repair happened.
    about() {
      const before = existsSync(GENERATED) ? readFileSync(GENERATED, 'utf8') : '';
      run([join(ROOT, 'tools', 'about-changelog.mjs'), '--write'], 'about-changelog --write');
      return (existsSync(GENERATED) ? readFileSync(GENERATED, 'utf8') : '') !== before;
    },
    verify() {
      const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'buildversion.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
      if (r.status === 0) return null;
      return (`${r.stdout}${r.stderr}`.trim().split('\n').slice(-2).join(' | ')) || 'buildversion --check failed';
    },
  };
}

// Exit 0 when HEAD is a bot stamp commit, 1 when it is not. The workflow's no-diff
// branch uses it to re-dispatch the preview for a stamped tip, and only for one:
// an ordinary no-diff run (a docs-only push) must not dispatch anything.
function isStampHead() {
  const [author, ...rest] = git(['log', '-1', '--format=%an%x09%s', 'HEAD']).trimEnd().split('\t');
  const stamp = isStampCommit(author, rest.join('\t'));
  console.log(stamp ? 'HEAD is a build stamp commit' : 'HEAD is not a build stamp commit');
  return stamp ? 0 : 1;
}

function prsFromArgs(argv) {
  const p = argv.indexOf('--prs');
  const r = argv.indexOf('--range');
  if (p >= 0) {
    const list = String(argv[p + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length || !list.every((s) => /^\d+$/.test(s))) throw new Error(`--prs wants pull request numbers, got '${argv[p + 1] ?? ''}'`);
    return { prs: [...new Set(list)], bound: '--prs' };
  }
  if (argv.includes('--since-last-stamp')) {
    return { prs: landedSince({ cwd: ROOT }), bound: 'since the last [build-stamp] commit' };
  }
  if (r >= 0) return prsFromRange(argv[r + 1]);
  throw new Error('--stamp wants --since-last-stamp, --range <before>..<after>, or --prs <N,N,…>');
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
  if (argv.includes('--is-stamp-head')) return isStampHead();
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

  // THE BASE OF A LANDING RANGE (first-parent line, newest first).
  const line = [
    { sha: 'm3', author: 'dev', subject: 'Merge pull request #7 from a/b' },
    { sha: 's2', author: 'dev', subject: 'Add a thing (#8)' },
    { sha: 'st1', author: BOT_AUTHOR, subject: 'build: stamp 0.7.1.1400 [build-stamp]' },
    { sha: 'm0', author: 'dev', subject: 'Merge pull request #5 from x/y' },
  ];
  // A human squash that merely mentions the marker is not a base, and its PR still counts.
  const squash = [
    { sha: 'h2', author: 'dev', subject: 'Explain the [build-stamp] marker (#9)' },
    { sha: 'h1', author: 'dev', subject: 'Merge pull request #4 from a/b' },
  ];
  check('base: a human squash mentioning [build-stamp] is not a base', pickStampBase(squash, null).source === 'head-only');
  check('base: a bot commit with a wrong subject is not a base', pickStampBase([{ sha: 'b', author: BOT_AUTHOR, subject: 'build: stamp [build-stamp] oops' }], null).source === 'head-only');
  check('base: a human author with the exact stamp subject is not a base', pickStampBase([{ sha: 'b', author: 'dev', subject: 'build: stamp 0.7.1.1 [build-stamp]' }], null).source === 'head-only');
  check('landed: the human squash is counted, its PR is not dropped', landedAfterBase(squash, null).join() === '9,4', `got ${landedAfterBase(squash, null)}`);
  const noStamp = line.filter((c) => !isStampCommit(c.author, c.subject));
  check('base: the last stamp commit wins over the introduction',
    JSON.stringify(pickStampBase(line, 'm0')) === JSON.stringify({ base: 'st1', source: 'last-stamp' }));
  check('base: without a stamp, the introduction serves',
    JSON.stringify(pickStampBase(noStamp, 'm0')) === JSON.stringify({ base: 'm0', source: 'introduction' }));
  check('base: without a stamp or a before, HEAD only',
    JSON.stringify(pickStampBase(noStamp, null)) === JSON.stringify({ base: null, source: 'head-only' }));
  check('landed after the stamp: a merge and a squash count, the stamp does not',
    landedAfterBase(line, 'st1').join() === '7,8', `got ${landedAfterBase(line, 'st1')}`);
  check('landed with no base: every commit counts',
    landedAfterBase(line, null).join() === '7,8,5', `got ${landedAfterBase(line, null)}`);

  // THE CONVERGENCE LOOP, against a scripted world. `builds` is what each build
  // reports, in order; `bytes` is derived from the box so an unchanged box reads
  // as an unchanged buildordinal.json.
  const fake = (builds, { verify = null, text = `${MD}\n`, aboutChanges = false, box = B(2) } = {}) => {
    const state = { text, writes: 0, about: 0, built: 0 };
    const io = {
      build() {
        const box = builds[Math.min(state.built, builds.length - 1)];
        state.built += 1;
        return { box, bytes: `${box.release}.${box.ordinal}` };
      },
      readBox: () => box,
      readChangelog: () => state.text,
      writeChangelog(t) { state.text = t; state.writes += 1; },
      // about-changelog --write refuses an order it cannot project: a receipt citing a newer
      // build than the one above it. The stamps read in file order must never rise downward.
      about() {
        state.about += 1;
        const stamps = [...state.text.matchAll(/\/pull\/\d+\), `0\.5\.5\.(\d+)`/g)].map((m) => Number(m[1]));
        for (let i = 1; i < stamps.length; i += 1) {
          if (stamps[i] > stamps[i - 1]) throw new Error('build runs backward: a receipt cites a newer build than the group above it');
        }
        return aboutChanges;
      },
      verify: () => verify,
    };
    return { io, state };
  };
  const B = (n) => ({ release: '0.5.5', ordinal: n });
  {
    // Nothing landed on an older box: no write, no rebuild after the first.
    const { io, state } = fake([B(3)], { box: B(3), text: MD.replace(/0\.5\.5\.1/g, '0.5.5.3') });
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: a receipt already on the box, a current module, stops at the first build', r.status === 'nothing' && state.writes === 0 && state.about === 1 && state.built === 1, JSON.stringify(r));
  }
  {
    // A STALE MODULE UNDER A RECEIPT ALREADY ON THE BOX. The module write runs first and
    // repairs it (aboutChanges). That moves the box (3 → 4), so the receipt is off it and
    // is re-pointed to 5, the box plus one; the rebuild confirms, and the fixed point is 5.
    const { io, state } = fake([B(4), B(5), B(5)], { aboutChanges: true, box: B(3), text: MD.replace(/0\.5\.5\.1/g, '0.5.5.3') });
    const r = converge(io, ['12'], { maxRounds: 3 });
    const first = state.about === 2 && r.status === 'converged' && r.box.ordinal === 5 && r.rounds === 1;
    check('converge: a stale module under a receipt already on the box is repaired first, then the receipt follows the bump to a fixed point', first, JSON.stringify(r) + ` about=${state.about}`);
  }
  {
    // The module was stale but no landed receipt is off the box: the repaired build's box
    // settles when one more build agrees; nothing is re-pointed.
    const { io, state } = fake([B(4), B(4)], { aboutChanges: true, text: MD.replace(/0\.5\.5\.1/g, '0.5.5.4') });
    const r = converge(io, ['999'], { maxRounds: 3 });
    check('converge: a repaired module with no receipt off the box settles without re-pointing anything', r.status === 'converged' && r.box.ordinal === 4 && r.rounds === 0 && state.writes === 0, JSON.stringify(r));
  }
  {
    // THE CROSS-GROUP STALE CASE. Today's landed receipt (#12) sits above yesterday's group at 5
    // and is stale at 1. The real write refuses that order (the fake's about() throws on it), so
    // the landed receipt must be re-pointed to the committed box 5 BEFORE the first write. The
    // module write then changes the module, the build bumps to 6, and the receipt follows the
    // bump to 7: a fixed point. If about() ran first, the stale text would throw.
    const stale = '## 2026-10-12\n\n- **Today** ([#12](https://github.com/cehinds/AshenSpire/pull/12), ' + '\x60' + '0.5.5.1' + '\x60' + ').\n\n## 2026-10-11\n\n- **Yesterday** ([#13](https://github.com/cehinds/AshenSpire/pull/13), ' + '\x60' + '0.5.5.5' + '\x60' + ').\n';
    const { io, state } = fake([B(6), B(7), B(7)], { aboutChanges: true, box: B(5), text: stale });
    let r;
    try { r = converge(io, ['12'], { maxRounds: 3 }); } catch (error) { r = { status: 'threw', reason: error.message }; }
    const ok = r.status === 'converged' && r.box.ordinal === 7 && state.text.includes('\x60' + '0.5.5.7' + '\x60') && state.about === 2;
    check('converge: a stale landed receipt across a newer group is re-pointed to the committed box before the write, then to a fixed point', ok, JSON.stringify(r) + ' about=' + state.about);
  }
  {
    // The box moves to 3 after the first build; the receipt goes to 4 (ordinal+1),
    // the write lands, the rebuild reports 4, and one more build is stable.
    const { io, state } = fake([B(3), B(4), B(4)]);
    const r = converge(io, ['12'], { maxRounds: 3 });
    check('converge: the one-round fixed point is ordinal+1, written and rebuilt', r.status === 'converged' && r.box.ordinal === 4 && r.rounds === 1 && state.writes === 2 && state.text.includes('`0.5.5.4`'), JSON.stringify(r));
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
