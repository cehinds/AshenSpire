#!/usr/bin/env node
// Merge a promoted test snapshot into existing alternative pairs. No force
// pushes, conflict strategies, cherry-picks, or writes to the primary branches.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { alternativePairs } from './alternative-branches.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
}).trim();
const paths = (cwd, from, to) => git(cwd, 'diff', '--name-only', '--no-renames', '-z', from, to).split('\0').filter(Boolean);
const DERIVED = new Set(['buildordinal.json', 'docs/ARCHITECTURE-CURRENT-DEV.md']);

export function protectedPaths(repo, source, target) {
  const base = git(repo, 'merge-base', source, target);
  const protectedFiles = paths(repo, base, target).filter((file) => !DERIVED.has(file));
  const incoming = new Set(paths(repo, base, source));
  const different = new Set(paths(repo, target, source));
  // An identical edit on both sides is already preserved and is safe to merge.
  const overlaps = protectedFiles.filter((file) => incoming.has(file) && different.has(file));
  return { protectedFiles, overlaps };
}

export function mergeAlternative(repo, source, target, { regenerate = false } = {}) {
  const before = git(repo, 'rev-parse', target);
  if (spawnSync('git', ['-C', repo, 'merge-base', '--is-ancestor', source, target]).status === 0) return before;
  // A test branch with no independent changes can take the already-generated
  // dev result verbatim. It needs neither another checkout nor another build.
  if (spawnSync('git', ['-C', repo, 'merge-base', '--is-ancestor', target, source]).status === 0) return git(repo, 'rev-parse', source);
  const { protectedFiles, overlaps } = protectedPaths(repo, source, target);
  if (overlaps.length) throw new Error(`Refusing ${target}: shared updates overlap alternative changes:\n${overlaps.join('\n')}`);
  const scratch = process.platform === 'win32' ? 'D:/repos/.codex/worktrees' : tmpdir();
  mkdirSync(scratch, { recursive: true });
  const parent = mkdtempSync(join(scratch, 'ashen-alternative-'));
  const worktree = join(parent, 'checkout');
  let added = false;
  try {
    git(repo, 'worktree', 'add', '--quiet', '--detach', worktree, target);
    added = true;
    try { git(worktree, 'merge', '--no-ff', '--no-commit', source); }
    catch (error) {
      const conflicts = git(worktree, 'diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
      if (!regenerate || !conflicts.length || conflicts.some((file) => !DERIVED.has(file))) throw error;
      // These two outputs are rebuilt below, never conflict-resolved by hand.
      git(worktree, 'restore', '--source', before, '--staged', '--worktree', '--', ...conflicts);
    }
    // Verify the resulting tree, including modes, deletions and rename endpoints.
    const changed = new Set(git(worktree, 'diff', '--cached', '--name-only', '--no-renames', '-z', before).split('\0'));
    for (const file of protectedFiles) {
      if (changed.has(file)) {
        throw new Error(`Refusing ${target}: merge changes protected path ${file}`);
      }
    }
    if (regenerate) {
      // Both histories can have advanced their counters independently. Seed
      // the generator from the newest receipt in the merged release so the
      // variant cannot fall behind a promoted changelog entry after a conflict.
      const mergedRelease = execFileSync(process.execPath, ['--input-type=module', '-e',
        "import { release } from './tools/buildversion.mjs'; process.stdout.write(release(process.cwd()));"], { cwd: worktree, encoding: 'utf8' }).trim();
      const seeds = [source, before].map((ref) => ({ ref, record: JSON.parse(git(worktree, 'show', `${ref}:buildordinal.json`)) }))
        .filter(({ record }) => record.release === mergedRelease)
        .sort((a, b) => b.record.ordinal - a.record.ordinal);
      if (seeds.length) git(worktree, 'restore', '--source', seeds[0].ref, '--staged', '--worktree', '--', 'buildordinal.json');
      // Use the merged tree's generator. CI builds and verifies this receipt.
      execFileSync(process.execPath, ['--input-type=module', '-e',
        "import { bumpOrdinal } from './tools/buildversion.mjs'; bumpOrdinal(process.cwd());"], { cwd: worktree, stdio: 'inherit' });
      git(worktree, 'add', '--', 'buildordinal.json');
    }
    // A repeat of an already-applied promotion is a no-op.
    if (git(worktree, 'status', '--porcelain') || existsSync(git(worktree, 'rev-parse', '--git-path', 'MERGE_HEAD'))) {
      git(worktree, 'commit', '-m', `Sync promoted updates into ${target.replace(/^origin\//, '')}`);
    }
    if (regenerate) {
      const mergedSha = git(worktree, 'rev-parse', 'HEAD');
      execFileSync(process.execPath, ['tools/update-architecture.mjs', '--verify'], {
        cwd: worktree, stdio: 'inherit',
        env: { ...process.env, ARCHITECTURE_SOURCE_REF: target.replace(/^origin\//, ''), ARCHITECTURE_SOURCE_SHA: mergedSha },
      });
      git(worktree, 'add', '--', 'docs/ARCHITECTURE-CURRENT-DEV.md');
      if (git(worktree, 'diff', '--cached', '--name-only')) {
        git(worktree, 'commit', '-m', 'docs: refresh alternative architecture [architecture-sync]');
      }
    }
    return git(worktree, 'rev-parse', 'HEAD');
  } finally {
    if (added) git(repo, 'worktree', 'remove', '--force', worktree);
    rmSync(parent, { recursive: true, force: true });
  }
}

export function syncAlternatives(repo, { source = 'origin/test', push = false, regenerate = true } = {}) {
  const names = git(repo, 'for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin/alternative/').split('\n');
  // Root alternative/dev and alternative/test are retained historical channels,
  // not synchronization targets after their consolidation into dev.
  const pairs = alternativePairs(names).filter(({ dev, test }) =>
    dev !== 'alternative/dev' || test !== 'alternative/test');
  const updates = [];
  // Construct every result before pushing anything. A failure leaves ALL refs alone.
  for (const { dev, test } of pairs) {
    const devSha = mergeAlternative(repo, source, `origin/${dev}`, { regenerate });
    const testSha = mergeAlternative(repo, devSha, `origin/${test}`, { regenerate });
    updates.push({ branch: dev, sha: devSha }, { branch: test, sha: testSha });
  }
  if (push && updates.length) git(repo, 'push', '--atomic', 'origin', ...updates.map(({ branch, sha }) => `${sha}:refs/heads/${branch}`));
  return updates;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const updates = syncAlternatives(process.cwd(), { source: process.env.PROMOTED_SHA || 'origin/test', push: process.argv.includes('--push') });
    const report = updates.length ? updates.map(({ branch, sha }) => `- ${branch}: ${sha}`).join('\n') : '- No eligible named alternative dev/test pairs; root alternative branches remain frozen.';
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Alternative synchronization\n\n${report}\n`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `branches=${JSON.stringify(updates.map(({ branch }) => branch))}\n`);
  } catch (error) {
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Alternative synchronization blocked\n\nNo alternative refs were pushed. Reconcile these paths while preserving the variant, then rerun:\n\n\`\`\`\n${error.message}\n\`\`\`\n`);
    console.error(error.message);
    process.exitCode = 1;
  }
}
