#!/usr/bin/env node
// tools/pr-restamp.mjs — KEEPS AN OPEN PULL REQUEST MERGEABLE AFTER EACH dev BUILD STAMP.
//
// THE DEFECT. Every push to dev makes build-stamp.yml commit
// `build: stamp <release>.<ordinal> [build-stamp]`, which rewrites three derived
// files: CHANGELOG.md, src/content/changelog.generated.js and buildordinal.json.
// An open pull request that carries a receipt conflicts in those files the moment
// the next stamp lands, and it cannot merge until someone merges dev into it and
// re-stamps its receipt by hand. Nothing else in the pull request is in conflict.
//
// THIS TOOL, run INSIDE a checkout whose HEAD is the pull request's head branch,
// with origin/dev fetched:
//
//   node tools/pr-restamp.mjs --pr <N> --base origin/dev
//
//   a. merges origin/dev without committing;
//   b. refuses (exit 3) when any conflicted path is outside the three derived
//      files: the merge is aborted and a person must merge dev;
//   c. resolves the derived files. buildordinal.json and the generated module take
//      dev's version. #N's receipt lines are moved out of CHANGELOG.md and placed
//      as the first bullet of the newest date group (a receipt lives under the date
//      it lands; a `## <today UTC>` group is created when the newest is older);
//   d. re-stamps #N's receipt to dev's box (buildordinal.json as resolved). Only #N's lines;
//   e. regenerates the changelog module and runs the receipt checks. A failure
//      aborts the merge and exits 4 with the output;
//   f. commits the merge (exit 0). When HEAD already contains origin/dev it prints
//      "up to date" and commits nothing.
//
// The merge commit is what makes the pull request mergeable again. It moves only the
// three derived files and dev's own commits; it is not a change to the pull request's
// content, so it stays inside CONTRIBUTING rule 6's exception (a push that only merges
// dev and regenerates derived files keeps the owner's approval).
//
// The CHANGELOG rebuild exists because a line-level merge of two stamped changelogs
// is not reliable: each side moved every receipt's stamp, so git's conflict is
// everywhere and a hunk-by-hunk pick would drop or duplicate receipts. Taking dev's
// text and re-inserting only this pull request's receipt lines cannot.
//
// Usage
//   node tools/pr-restamp.mjs --pr <N> [--base origin/dev] [--repo <dir>]
//                                                             merge and re-stamp <dir> (default: this checkout)
//   node tools/pr-restamp.mjs --selftest                     the planted cases of the pure core
//
// Exit codes
//   0  committed the merge, or already up to date
//   1  harness fault (dirty tree, a merge already in progress, git error); nothing left behind
//   2  usage
//   3  needs a person: a conflict outside the derived files (merge aborted)
//   4  a receipt or ordering check failed after the merge (merge aborted)

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as pathResolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// The checkout the merge runs in: the pull request's worktree, set by --repo. Its
// CHANGELOG.md and buildordinal.json are the ones read and written, and every git
// command runs there. The tool's own ROOT only supplies the script paths: a pull
// request's branch is never run, so its tools/ copy cannot change what runs.
let REPO = ROOT;
const changelogPath = () => join(REPO, 'CHANGELOG.md');
const buildordinalPath = () => join(REPO, 'buildordinal.json');
const GENERATED = 'src/content/changelog.generated.js';

// The only paths a merge of dev may conflict in and still be resolved here.
const DERIVED = ['CHANGELOG.md', GENERATED, 'buildordinal.json'];
// A date group heading, exactly as about-changelog.mjs reads it.
const DATE_HEADING = /^## (\d{4}-\d{2}-\d{2})$/;
const PULL_URL = 'https://github.com/cehinds/AshenSpire/pull/';

// A receipt line is a bullet whose title is bold and whose stamp group follows the
// link in the receipt shape: `- **Title** ([#N](…/pull/N), \`stamp\`)`. A line that
// merely mentions #N's link in its prose is another pull request's, and is not touched.
function receiptPrefix(n) {
  return `([#${n}](${PULL_URL}${n}), \``;
}

function isReceiptLine(line, n) {
  return line.startsWith('- **') && line.includes(receiptPrefix(n));
}

// Re-stamps every receipt of pull request n in `text`: the backticked stamp that
// follows its link, ([#N](…/pull/N), `<stamp>`). Other pull requests are untouched.
// The non-derived paths in a list of changed paths. The PR's own content is what
// is left once the derived files are set aside.
export function nonDerived(paths) {
  return paths.filter((p) => p && !DERIVED.includes(p));
}

// Which paths were added to, or dropped from, a set of changed paths. An empty
// result on both sides means the same files changed, before and after the merge.
export function diffSetChange(before, after) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((p) => !b.has(p)).sort(),
    removed: [...b].filter((p) => !a.has(p)).sort(),
  };
}

export function restampReceipts(text, n, stamp) {
  const re = new RegExp(`(\\]\\(https://github\\.com/cehinds/AshenSpire/pull/${n}\\),\\s*\`)[^\`\\n]*(\`)`);
  return text.split('\n').map((line) => (isReceiptLine(line, n) ? line.replace(re, (_, open, close) => `${open}${stamp}${close}`) : line)).join('\n');
}

// THE PURE CORE. `baseText` is the CHANGELOG.md the merge starts from (origin/dev's,
// or the merged text), `prText` the pull request's own. Its receipt lines for #n are
// REMOVED from baseText and re-inserted as the FIRST bullet of the NEWEST date group,
// re-stamped to `stamp`. A receipt lives under the date it lands, not the date its
// author wrote it: when the newest group is older than `today` (UTC), a `## today`
// group is created at the top. A newest group dated after `today` is used as it is.
// A pull request with no receipt in prText returns baseText unchanged; the receipt
// checks then name the gap.
export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export function mergeReceiptLines(baseText, prText, n, stamp, today = utcToday()) {
  const moved = [];
  for (const line of prText.split('\n')) {
    if (isReceiptLine(line, n)) moved.push(restampReceipts(line, n, stamp));
  }
  if (moved.length === 0) return baseText;

  const kept = baseText.split('\n').filter((l) => !isReceiptLine(l, n));
  let at = kept.findIndex((l) => DATE_HEADING.test(l.trimEnd()));
  const newest = at >= 0 ? DATE_HEADING.exec(kept[at].trimEnd())[1] : null;
  if (newest === null || newest < today) {
    const head = `## ${today}`;
    if (at >= 0) {
      kept.splice(at, 0, head, '');
    } else {
      let end = kept.length;
      while (end > 0 && kept[end - 1].trim() === '') end--;
      kept.length = end;
      kept.push('', head, '');
    }
    at = kept.indexOf(head);
  }
  let k = at + 1;
  while (k < kept.length && kept[k].trim() === '') k++;
  const after = k < kept.length && kept[k].startsWith('- ') ? [] : [''];
  kept.splice(k, 0, ...moved, ...after);
  return kept.join('\n');
}

// ---- the CLI: git, the merge, the checks --------------------------------------

function git(args) {
  return spawnSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function gitOk(args) {
  const r = git(args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
  return r.stdout;
}

function node(args) {
  return spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function mergeInProgress() {
  return git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).status === 0;
}

// Leaves the repository exactly as it was at `preHead`: no merge in progress, no
// half-written derived file. Runs on every exit path that does not commit.
function abortTo(preHead) {
  if (mergeInProgress()) git(['merge', '--abort']);
  git(['reset', '-q', '--hard', preHead]);
}

function unmergedPaths() {
  return gitOk(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
}

function readBox() {
  const box = JSON.parse(readFileSync(buildordinalPath(), 'utf8'));
  if (typeof box.release !== 'string' || !Number.isInteger(box.ordinal)) {
    throw new Error('buildordinal.json has no release and integer ordinal');
  }
  return box;
}

function main(argv) {
  const flag = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const pr = flag('--pr');
  const base = flag('--base') || 'origin/dev';
  REPO = pathResolve(flag('--repo') || ROOT);
  if (!pr || !/^\d+$/.test(pr)) {
    console.error('usage: node tools/pr-restamp.mjs --pr <N> [--base origin/dev] | --selftest');
    return 2;
  }

  const head = gitOk(['rev-parse', '--verify', 'HEAD']).trim();
  const baseSha = gitOk(['rev-parse', '--verify', `${base}^{commit}`]).trim();
  if (git(['merge-base', '--is-ancestor', baseSha, head]).status === 0) {
    console.log(`pr-restamp: #${pr} is up to date with ${base}`);
    return 0;
  }
  if (mergeInProgress()) {
    console.error('pr-restamp: a merge is already in progress; refusing to start another');
    return 1;
  }
  // Untracked files do not block the merge: git refuses one it would overwrite.
  if (gitOk(['status', '--porcelain', '--untracked-files=no']).trim() !== '') {
    console.error('pr-restamp: the working tree is not clean; refusing to merge into it');
    return 1;
  }

  // The PR's own non-derived change, before the merge: the set the merge must not alter.
  const prBefore = nonDerived(gitOk(['diff', '--name-only', gitOk(['merge-base', head, baseSha]).trim(), head]).split('\n'));
  const merged = git(['merge', '--no-ff', '--no-commit', baseSha]);
  const unmerged = unmergedPaths();
  if (merged.status !== 0 && unmerged.length === 0) {
    abortTo(head);
    console.error(`pr-restamp: git merge failed without conflicts:\n${(merged.stderr || merged.stdout).trim()}`);
    return 1;
  }
  const outside = unmerged.filter((p) => !DERIVED.includes(p));
  if (outside.length > 0) {
    abortTo(head);
    console.log(`pr-restamp: #${pr} needs a person — conflicts in: ${outside.join(', ')}`);
    return 3;
  }

  const checkFailure = (label, r) => {
    abortTo(head);
    console.log(`pr-restamp: #${pr} ${label} failed; the merge was aborted`);
    console.log((r.stdout || '') + (r.stderr || ''));
    return 4;
  };

  try {
    // c. dev's box and generated module win, conflicted or not.
    gitOk(['checkout', baseSha, '--', 'buildordinal.json', GENERATED]);
    const box = readBox();
    const stamp = `${box.release}.${box.ordinal}`;

    // Whether or not git conflicted in CHANGELOG.md, #N's receipt lines come from the
    // pull request's own text and land in the newest date group of the merged text.
    // A conflicted file on disk holds conflict markers, so its start text is dev's.
    const prText = gitOk(['show', `${head}:CHANGELOG.md`]);
    const startText = unmerged.includes('CHANGELOG.md')
      ? gitOk(['show', `${baseSha}:CHANGELOG.md`])
      : readFileSync(changelogPath(), 'utf8');
    writeFileSync(changelogPath(), restampReceipts(mergeReceiptLines(startText, prText, pr, stamp), pr, stamp));

    // e. the module follows the changelog, then the receipt and order checks must pass.
    const write = node([join(ROOT, 'tools', 'about-changelog.mjs'), '--root', REPO, '--write']);
    if (write.status !== 0) return checkFailure('about-changelog --write', write);
    const receipts = node([join(ROOT, 'tools', 'receipts.mjs'), '--check', '--pr', pr, '--root', REPO]);
    if (receipts.status !== 0) return checkFailure('receipts --check --pr', receipts);
    const order = node([join(ROOT, 'tools', 'about-changelog.mjs'), '--root', REPO, '--check-order', '--pending', pr]);
    if (order.status !== 0) return checkFailure('about-changelog --check-order --pending', order);

    // Only the three derived files may move. Anything else the tools touched is a fault.
    gitOk(['add', '--', 'buildordinal.json', 'CHANGELOG.md', GENERATED]);
    if (gitOk(['diff', '--name-only']).trim() !== '') {
      abortTo(head);
      console.error('pr-restamp: a step changed a file outside the derived set; the merge was aborted');
      return 1;
    }

    // The PR's own diff against dev must be the one it had before the merge. A dev
    // change merged into a file the PR did not touch is dev's, not the PR's, and does
    // not show here; a file the PR changed that now equals dev's version does, and
    // that is a person's call, not the bot's.
    const prAfter = nonDerived(gitOk(['diff', '--name-only', baseSha]).split('\n'));
    const change = diffSetChange(prBefore, prAfter);
    if (change.added.length || change.removed.length) {
      abortTo(head);
      console.log(`pr-restamp: #${pr} needs a person — its diff against ${base} would change: ` +
        `added [${change.added.join(', ')}] removed [${change.removed.join(', ')}]`);
      return 3;
    }

    // f. the merge commit.
    gitOk(['commit', '-q', '-m', `Merge dev and restamp #${pr}'s receipt [pr-restamp]`]);
    const sha = gitOk(['rev-parse', '--short', 'HEAD']).trim();
    console.log(`pr-restamp: #${pr} merged ${base} and re-stamped its receipt to \`${stamp}\` (${sha})`);
    return 0;
  } catch (err) {
    abortTo(head);
    console.error(`pr-restamp: ${err.message}`);
    return 1;
  }
}

// ---- --selftest: the planted cases of the pure core ---------------------------

function selftest() {
  const rc = (n, stamp) => `- **Title ${n}** ([#${n}](${PULL_URL}${n}), \`${stamp}\`). Prose.`;
  const dev = [
    '# Changelog', '', 'intro', '',
    '## 2026-10-12', '', rc(1907, '0.7.1.1457'), rc(1928, '0.7.1.1455'), '',
    '## 2026-10-11', '', rc(1900, '0.7.1.1400'), '',
  ].join('\n');
  const STAMP = '0.7.1.1460';
  const fails = [];
  const check = (name, ok, detail = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}`);
    if (!ok) fails.push(name);
  };
  const headings = (t) => t.split('\n').filter((l) => /^## /.test(l));
  const prText = (date, ...lines) => `# Changelog\n\n## ${date}\n\n${lines.join('\n')}\n`;

  console.log('pr-restamp --selftest — the pure CHANGELOG core, planted cases');

  // 1. an old-dated PR receipt lands in the NEWEST group as its first bullet, re-stamped.
  let out = mergeReceiptLines(dev, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-12');
  let lines = out.split('\n');
  const h12 = lines.indexOf('## 2026-10-12');
  check('old-dated PR receipt lands in the newest group, first bullet, re-stamped',
    lines[h12 + 2] === rc(1930, STAMP) && lines[h12 + 3] === rc(1907, '0.7.1.1457'),
    `got ${JSON.stringify(lines.slice(h12, h12 + 5))}`);
  check('old-dated PR receipt is not left under its own old date',
    lines.filter((l) => l.includes(`${PULL_URL}1930)`)).length === 1
    && lines.indexOf(rc(1930, STAMP)) < lines.indexOf('## 2026-10-11'));
  check('no heading is invented when the newest group is already today',
    headings(out).join() === '## 2026-10-12,## 2026-10-11', headings(out).join());

  // 2. the newest group is older than today: a today group is created at the top.
  out = mergeReceiptLines(dev, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-13');
  check('older newest group: a today group is created at the top, holding the line',
    headings(out).join() === '## 2026-10-13,## 2026-10-12,## 2026-10-11'
    && out.includes(`## 2026-10-13\n\n${rc(1930, STAMP)}\n\n## 2026-10-12`), headings(out).join());

  // 3. a newest group dated after today is used as it is.
  out = mergeReceiptLines(dev, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-11');
  check('newest group dated after today is used, no heading created',
    headings(out).join() === '## 2026-10-12,## 2026-10-11' && out.includes(`## 2026-10-12\n\n${rc(1930, STAMP)}`), headings(out).join());

  // 4. no date headings at all: the group is appended.
  out = mergeReceiptLines('# Changelog\n\nintro\n', prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-13');
  check('no date group yet: the today group is appended',
    out.endsWith(`## 2026-10-13\n\n${rc(1930, STAMP)}\n`), JSON.stringify(out));

  // 5. a PR line already in dev under an old stamp: moved to the top, re-stamped, not duplicated.
  out = mergeReceiptLines(dev, prText('2026-10-12', rc(1928, '0.7.1.1450')), 1928, STAMP, '2026-10-12');
  lines = out.split('\n');
  const count1928 = lines.filter((l) => l.includes(`${PULL_URL}1928)`)).length;
  check('already present: #N appears once, re-stamped, first under the newest group',
    count1928 === 1 && out.includes(rc(1928, STAMP)) && !out.includes('0.7.1.1455')
    && lines[lines.indexOf('## 2026-10-12') + 2] === rc(1928, STAMP), `count ${count1928}`);

  // 6. other PRs' lines untouched: same text, same order, same stamps.
  const others = (t) => t.split('\n').filter((l) => l.startsWith('- ') && !l.includes(`${PULL_URL}1928)`));
  check('other PRs: their lines are identical to dev\'s, in order', others(out).join('\n') === others(dev).join('\n'));

  // 7. restampReceipts re-stamps only #N.
  const two = `${rc(1907, '0.7.1.1457')}\n${rc(1930, '0.7.1.1450')}`;
  const r7 = restampReceipts(two, 1930, STAMP);
  check('restamp: only #N\'s stamp changes', r7 === `${rc(1907, '0.7.1.1457')}\n${rc(1930, STAMP)}`, r7);
  check('restamp: pull/19 does not match pull/1907', restampReceipts(rc(1907, '0.7.1.1457'), 19, STAMP) === rc(1907, '0.7.1.1457'));

  // 8a. another PR's receipt whose prose links #N is not #N's line: untouched, not moved.
  const prose = `- **Other** ([#1907](${PULL_URL}1907), \`0.7.1.1457\`). Builds on [#1930](${PULL_URL}1930), \`0.7.1.1400\`, see ${PULL_URL}1930) too.`;
  const withProse = mergeReceiptLines(`# Changelog\n\n## 2026-10-12\n\n${prose}\n`, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-12');
  check('prose linking #N in another receipt is left exactly as it was',
    withProse.includes(prose) && restampReceipts(prose, 1930, STAMP) === prose);

  // 8. a PR text without a receipt for #N leaves the base unchanged.
  check('a PR text with no receipt for #N leaves the base unchanged',
    mergeReceiptLines(dev, '## 2026-10-13\n\nno receipt here\n', 1930, STAMP, '2026-10-13') === dev);

  // 9. the PR's own non-derived set: unchanged, added to, or dropped from.
  const same = diffSetChange(['a.js', 'b.js'], ['b.js', 'a.js']);
  check('set check: the same files before and after pass', same.added.length === 0 && same.removed.length === 0);
  const added = diffSetChange(['a.js'], ['a.js', 'dev-only.js']);
  check('set check: a file added by the merge is named', added.added.join() === 'dev-only.js' && added.removed.length === 0);
  const dropped = diffSetChange(['a.js', 'b.js'], ['a.js']);
  check('set check: a PR file that now equals dev is named as dropped', dropped.removed.join() === 'b.js' && dropped.added.length === 0);
  check('set check: derived files are not counted', nonDerived(['CHANGELOG.md', 'buildordinal.json', 'src/content/changelog.generated.js', 'a.js']).join() === 'a.js');

  console.log('');
  if (fails.length) { console.log(`pr-restamp --selftest: FAIL — ${fails.length} case(s)`); return 1; }
  console.log('pr-restamp --selftest: OK');
  return 0;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);
if (invoked) {
  const argv = process.argv.slice(2);
  process.exit(argv.includes('--selftest') ? selftest() : main(argv));
}
