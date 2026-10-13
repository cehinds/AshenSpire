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
//      dev's version. CHANGELOG.md, when conflicted, is rebuilt from dev's text with
//      this pull request's own receipt lines moved in under their date headings;
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
//   node tools/pr-restamp.mjs --pr <N> [--base origin/dev]   merge and re-stamp (in a PR checkout)
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
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const BUILDORDINAL = join(ROOT, 'buildordinal.json');
const GENERATED = 'src/content/changelog.generated.js';

// The only paths a merge of dev may conflict in and still be resolved here.
const DERIVED = ['CHANGELOG.md', GENERATED, 'buildordinal.json'];
// A date group heading, exactly as about-changelog.mjs reads it.
const DATE_HEADING = /^## (\d{4}-\d{2}-\d{2})$/;
const PULL_URL = 'https://github.com/cehinds/AshenSpire/pull/';

// The receipt link for pull request n. The closing paren makes it exact: pull/19
// does not match pull/1907.
function linkFor(n) {
  return `](${PULL_URL}${n})`;
}

function isReceiptLine(line, n) {
  return line.startsWith('- ') && line.includes(linkFor(n));
}

// Re-stamps every receipt of pull request n in `text`: the backticked stamp that
// follows its link, ([#N](…/pull/N), `<stamp>`). Other pull requests are untouched.
export function restampReceipts(text, n, stamp) {
  const re = new RegExp(`(\\]\\(https://github\\.com/cehinds/AshenSpire/pull/${n}\\),\\s*\`)[^\`\\n]*(\`)`, 'g');
  return text.replace(re, (_, open, close) => `${open}${stamp}${close}`);
}

// THE PURE CORE. `devText` is origin/dev's CHANGELOG.md, `prText` the pull request's
// own. Returns the text with the pull request's receipt lines moved in under their
// date headings, first bullet under the heading, each re-stamped to `stamp`, and
// with any dev line for #n removed first (replaced, never duplicated).
// A pull request with no receipt in prText leaves devText as it is; the receipt
// checks then name the gap.
export function mergeReceiptLines(devText, prText, n, stamp) {
  const moved = [];
  let heading = null;
  for (const line of prText.split('\n')) {
    if (line.startsWith('## ')) heading = line.trimEnd();
    if (!isReceiptLine(line, n)) continue;
    if (!heading || !DATE_HEADING.test(heading)) {
      throw new Error(`#${n}'s receipt sits under ${heading ? `"${heading}"` : 'no heading'}, not a date heading`);
    }
    moved.push({ heading, line: restampReceipts(line, n, stamp) });
  }
  if (moved.length === 0) return devText;

  const kept = devText.split('\n').filter((l) => !l.includes(linkFor(n)));
  for (const heading of [...new Set(moved.map((m) => m.heading))]) {
    const block = moved.filter((m) => m.heading === heading).map((m) => m.line);
    const idx = kept.findIndex((l) => l.trimEnd() === heading);
    if (idx >= 0) {
      let k = idx + 1;
      while (k < kept.length && kept[k].trim() === '') k++;
      const after = k < kept.length && kept[k].startsWith('- ') ? [] : [''];
      kept.splice(k, 0, ...block, ...after);
      continue;
    }
    const date = heading.slice(3);
    let older = -1;
    for (let i = 0; i < kept.length; i++) {
      const m = DATE_HEADING.exec(kept[i].trimEnd());
      if (m && m[1] < date) { older = i; break; }
    }
    if (older >= 0) {
      kept.splice(older, 0, heading, '', ...block, '');
    } else {
      let end = kept.length;
      while (end > 0 && kept[end - 1].trim() === '') end--;
      kept.length = end;
      kept.push('', heading, '', ...block, '');
    }
  }
  return kept.join('\n');
}

// ---- the CLI: git, the merge, the checks --------------------------------------

function git(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function gitOk(args) {
  const r = git(args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
  return r.stdout;
}

function node(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
  const box = JSON.parse(readFileSync(BUILDORDINAL, 'utf8'));
  if (typeof box.release !== 'string' || !Number.isInteger(box.ordinal)) {
    throw new Error('buildordinal.json has no release and integer ordinal');
  }
  return box;
}

function main(argv) {
  const flag = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const pr = flag('--pr');
  const base = flag('--base') || 'origin/dev';
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
  if (gitOk(['status', '--porcelain']).trim() !== '') {
    console.error('pr-restamp: the working tree is not clean; refusing to merge into it');
    return 1;
  }

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

    let changelog;
    if (unmerged.includes('CHANGELOG.md')) {
      const devText = gitOk(['show', `${baseSha}:CHANGELOG.md`]);
      const prText = gitOk(['show', `${head}:CHANGELOG.md`]);
      changelog = mergeReceiptLines(devText, prText, pr, stamp);
    } else {
      changelog = readFileSync(CHANGELOG, 'utf8');
    }
    // d. #N's receipt names dev's box, wherever it came from.
    writeFileSync(CHANGELOG, restampReceipts(changelog, pr, stamp));

    // e. the module follows the changelog, then the receipt and order checks must pass.
    const write = node([join(ROOT, 'tools', 'about-changelog.mjs'), '--write']);
    if (write.status !== 0) return checkFailure('about-changelog --write', write);
    const receipts = node([join(ROOT, 'tools', 'receipts.mjs'), '--check', '--pr', pr]);
    if (receipts.status !== 0) return checkFailure('receipts --check --pr', receipts);
    const order = node([join(ROOT, 'tools', 'about-changelog.mjs'), '--check-order', '--pending', pr]);
    if (order.status !== 0) return checkFailure('about-changelog --check-order --pending', order);

    // Only the three derived files may move. Anything else the tools touched is a fault.
    gitOk(['add', '--', 'buildordinal.json', 'CHANGELOG.md', GENERATED]);
    if (gitOk(['diff', '--name-only']).trim() !== '') {
      abortTo(head);
      console.error('pr-restamp: a step changed a file outside the derived set; the merge was aborted');
      return 1;
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

  console.log('pr-restamp --selftest — the pure CHANGELOG core, planted cases');

  // 1. heading exists: the line becomes the first bullet under it.
  let out = mergeReceiptLines(dev, `# Changelog\n\n## 2026-10-12\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  let lines = out.split('\n');
  const h12 = lines.indexOf('## 2026-10-12');
  check('heading exists: the PR line is the first bullet under it',
    lines[h12 + 2] === rc(1930, STAMP) && lines[h12 + 3] === rc(1907, '0.7.1.1457'),
    `got ${JSON.stringify(lines.slice(h12, h12 + 5))}`);

  // 2a. heading missing, newer than the newest: inserted above 2026-10-12, in date order.
  out = mergeReceiptLines(dev, `## 2026-10-13\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  check('heading missing: created in date-descending order (newest first)',
    headings(out).join() === '## 2026-10-13,## 2026-10-12,## 2026-10-11', headings(out).join());
  check('heading missing: the new group holds the PR line as its only bullet',
    out.includes(`## 2026-10-13\n\n${rc(1930, STAMP)}\n\n## 2026-10-12`));

  // 2b. heading missing, older than every group: appended after the oldest.
  out = mergeReceiptLines(dev, `## 2026-09-30\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  check('heading missing: an older date goes after the oldest group',
    headings(out).join() === '## 2026-10-12,## 2026-10-11,## 2026-09-30', headings(out).join());

  // 2c. heading missing, between two groups.
  out = mergeReceiptLines(dev, `## 2026-10-11\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  check('heading exists again (2026-10-11): line first under it, no duplicate heading',
    headings(out).filter((h) => h === '## 2026-10-11').length === 1);
  out = mergeReceiptLines(dev, `## 2026-10-13\n\nno receipt here\n`, 1930, STAMP);
  check('a PR text with no receipt for #N leaves dev unchanged', out === dev);

  // 3. PR line already in dev under an old stamp: replaced, not duplicated.
  out = mergeReceiptLines(dev, `## 2026-10-12\n\n${rc(1928, '0.7.1.1450')}\n`, 1928, STAMP);
  lines = out.split('\n');
  const count1928 = lines.filter((l) => l.includes(`${PULL_URL}1928)`)).length;
  check('already present: #N appears once, re-stamped', count1928 === 1 && out.includes(rc(1928, STAMP)) && !out.includes('0.7.1.1455'),
    `count ${count1928}`);
  check('already present: the line moves to the top of its group',
    lines[lines.indexOf('## 2026-10-12') + 2] === rc(1928, STAMP));

  // 4. other PRs' lines untouched: same text, same order, same stamps.
  const others = (t) => t.split('\n').filter((l) => l.startsWith('- ') && !l.includes(`${PULL_URL}1928)`));
  check('other PRs: their lines are identical to dev\'s, in order',
    others(out).join('\n') === others(dev).join('\n'));

  // 5. restampReceipts re-stamps only #N.
  const two = `${rc(1907, '0.7.1.1457')}\n${rc(1930, '0.7.1.1450')}`;
  const r5 = restampReceipts(two, 1930, STAMP);
  check('restamp: only #N\'s stamp changes', r5 === `${rc(1907, '0.7.1.1457')}\n${rc(1930, STAMP)}`, r5);
  check('restamp: pull/19 does not match pull/1907', restampReceipts(rc(1907, '0.7.1.1457'), 19, STAMP) === rc(1907, '0.7.1.1457'));

  // 6. a PR receipt under a non-date heading is refused, not guessed at.
  let threw = false;
  try { mergeReceiptLines(dev, `## History\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP); } catch { threw = true; }
  check('a receipt under a non-date heading is refused', threw);

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
