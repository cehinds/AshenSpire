#!/usr/bin/env node

// Keep the repository root an intentional front door. This check reads Git's
// tracked-file index, so ignored editor state and untracked local work cannot
// make it red.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_ROOTS = new Set([
  '.claude',
  '.gitattributes',
  '.github',
  '.gitignore',
  'assets',
  'build',
  'buildordinal.json',
  'content',
  'CONTRIBUTING.md',
  'CREDITS.md',
  'desktop',
  'DEVELOPER.md',
  'dist',
  'docs',
  'index.html',
  'LICENSE',
  'music',
  'PROMPT.md',
  'README.md',
  'run.bat',
  'run.sh',
  'SPEC.md',
  'src',
  'styles',
  'tests',
  'tools',
]);

const REQUIRED_DOORS = new Set([
  'README.md',
  'index.html',
  'run.bat',
  'run.sh',
  'src',
  'tests',
  'tools',
]);

function git(repo, args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function trackedRootNames(repo) {
  const paths = git(repo, ['ls-files', '-z']).split('\0').filter(Boolean);
  return new Set(paths.map((path) => path.replaceAll('\\', '/').split('/')[0]));
}

function inspectRootNames(names) {
  const unexpected = [...names].filter((name) => !ALLOWED_ROOTS.has(name)).sort();
  const missingDoors = [...REQUIRED_DOORS].filter((name) => !names.has(name)).sort();
  return { unexpected, missingDoors };
}

function formatFindings({ unexpected, missingDoors }) {
  const lines = [];
  if (unexpected.length) {
    lines.push(`unexpected tracked root entries: ${unexpected.join(', ')}`);
    lines.push('move each entry under an existing owner, or amend this allowlist deliberately');
  }
  if (missingDoors.length) {
    lines.push(`missing public root doors: ${missingDoors.join(', ')}`);
  }
  return lines;
}

function checkRepo(repo) {
  const findings = inspectRootNames(trackedRootNames(repo));
  const lines = formatFindings(findings);
  if (lines.length) {
    for (const line of lines) console.error(`FAIL root-shape: ${line}`);
    return false;
  }
  console.log(`PASS root-shape: ${ALLOWED_ROOTS.size} allowed names; ${REQUIRED_DOORS.size} required public doors; tracked root is intentional.`);
  return true;
}

function write(repo, relative, text = '') {
  const path = join(repo, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function selftest() {
  const repo = mkdtempSync(join(tmpdir(), 'ashenspire-root-shape-'));
  try {
    git(repo, ['init', '--quiet']);
    for (const path of [
      'README.md', 'index.html', 'run.bat', 'run.sh',
      'src/main.js', 'tests/probe.txt', 'tools/probe.mjs',
    ]) write(repo, path);
    git(repo, ['add', '.']);

    const control = inspectRootNames(trackedRootNames(repo));
    if (formatFindings(control).length) {
      throw new Error(`clean control was not green: ${formatFindings(control).join('; ')}`);
    }
    console.log('GREEN control: an intentional tracked root passes.');

    write(repo, 'scratch-notes.txt');
    git(repo, ['add', 'scratch-notes.txt']);
    const unexpected = inspectRootNames(trackedRootNames(repo));
    if (!unexpected.unexpected.includes('scratch-notes.txt')) {
      throw new Error('known-bad unexpected root entry was not caught');
    }
    console.log('RED caught: a tracked scratch file at the root is named.');

    git(repo, ['rm', '--cached', '--quiet', 'scratch-notes.txt']);
    unlinkSync(join(repo, 'scratch-notes.txt'));
    git(repo, ['rm', '--cached', '--quiet', 'run.bat']);
    const missing = inspectRootNames(trackedRootNames(repo));
    if (!missing.missingDoors.includes('run.bat')) {
      throw new Error('known-bad missing launcher was not caught');
    }
    console.log('RED caught: a missing Windows launcher is named.');
    console.log('PASS root-shape selftest: 2/2 known-bads detected through a real Git index; clean control restored by isolation.');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
if (process.argv.includes('--selftest')) selftest();
if (!checkRepo(root)) process.exitCode = 1;

console.log('BOUNDARY: this check governs tracked root names and required launch/documentation doors only. It does not inspect file contents, untracked files, ignored IDE state, runtime behavior, generated-artifact freshness, merge authority, or release readiness.');
