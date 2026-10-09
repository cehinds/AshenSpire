import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);

test('shared local QA freezes committed LF source despite global Windows CRLF conversion', async () => {
  const storage = process.platform === 'win32' ? 'D:/repos/.codex/tmp' : tmpdir();
  await mkdir(storage, { recursive: true });
  // Retain the tiny fixture and report as failure evidence; never edit global Git settings.
  const fixture = await mkdtemp(path.join(storage, 'local-checks-snapshot-'));
  const author = path.join(fixture, 'author');
  const output = path.join(fixture, 'result');
  const globalConfig = path.join(fixture, 'global.gitconfig');
  await writeFile(globalConfig, '[core]\n\tautocrlf = true\n');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' };
  const git = async (...argv) => (await exec('git', argv, { cwd: author, env, windowsHide: true })).stdout.trim();
  for (const folder of ['src', 'tests', 'tools']) await mkdir(path.join(author, folder), { recursive: true });
  await git('init');
  await git('config', 'user.name', 'Snapshot regression');
  await git('config', 'user.email', 'snapshot@example.invalid');
  await git('config', 'core.autocrlf', 'false');
  const canonical = 'export const committed = true;\n// Canonical source extraction depends on LF.\n';
  await writeFile(path.join(author, 'src/main.js'), canonical);
  await copyFile(new URL('../tools/local-checks.mjs', import.meta.url), path.join(author, 'tools/local-checks.mjs'));
  await writeFile(path.join(author, 'tests/combat-card-line-endings.test.mjs'),
    "import { readFileSync } from 'node:fs';\nimport assert from 'node:assert/strict';\n" +
    `assert.equal(readFileSync('src/main.js', 'utf8'), ${JSON.stringify(canonical)});\n`);
  await git('add', '.');
  await git('commit', '-m', 'Committed fixture for exact-head QA');
  const head = await git('rev-parse', 'HEAD');
  await writeFile(path.join(author, 'src/main.js'), '// Uncommitted author edit must stay excluded.\n');
  const execution = await exec(process.execPath, ['tools/local-checks.mjs', '--suite', 'combat', '--output', output],
    { cwd: author, env, windowsHide: true }).then(result => ({ ...result, code: 0 }),
    error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  const report = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8'));
  const log = report.checks[0] ? await readFile(report.checks[0].log, 'utf8') : report.error;
  assert.equal(execution.code, 0, `Runner failed; retained fixture: ${fixture}\n${log}`);
  assert.equal(report.status, 'passed');
  assert.equal(report.head, head);
  assert.equal(await readFile(path.join(report.snapshot, 'src/main.js'), 'utf8'), canonical);
  const snapshotGit = async (...argv) => (await exec('git', argv, { cwd: report.snapshot, env, windowsHide: true })).stdout.trim();
  assert.equal(await snapshotGit('config', '--local', 'core.autocrlf'), 'false');
  assert.equal(await snapshotGit('config', '--local', 'core.eol'), 'lf');
  assert.equal(await snapshotGit('rev-parse', 'HEAD'), head);
  assert.equal(await snapshotGit('status', '--porcelain'), '');
  assert.equal(await git('config', '--local', 'core.autocrlf'), 'false');
  assert.equal(await readFile(globalConfig, 'utf8'), '[core]\n\tautocrlf = true\n');
  assert.match(await readFile(path.join(author, 'src/main.js'), 'utf8'), /Uncommitted author edit/);
});
