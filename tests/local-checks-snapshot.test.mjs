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

for (const present of [true, false]) {
  test(present ? 'actual local runner retains upstream dev/test rather than stale local branch aliases'
    : 'actual local runner preserves absent upstream refs despite local dev/test branches', async () => {
    const storage = process.platform === 'win32' ? 'D:/repos/.codex/tmp' : tmpdir();
    await mkdir(storage, { recursive: true });
    const fixture = await mkdtemp(path.join(storage, 'local-checks-origin-'));
    const author = path.join(fixture, 'author'), output = path.join(fixture, 'result');
    const globalConfig = path.join(fixture, 'global.gitconfig');
    await writeFile(globalConfig, '[core]\n\tautocrlf = true\n');
    const env = { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' };
    for (const folder of ['src', 'tests', 'tools', 'content/source']) await mkdir(path.join(author, folder), { recursive: true });
    const git = async (...argv) => (await exec('git', argv, { cwd: author, env, windowsHide: true })).stdout.trim();
    const commit = async message => { await git('add', '.'); await git('commit', '-m', message); return git('rev-parse', 'HEAD'); };
    await git('init', '-b', 'dev');
    await git('config', 'user.name', 'Origin snapshot regression');
    await git('config', 'user.email', 'snapshot@example.invalid');
    await git('config', 'core.autocrlf', 'false');
    const csvPath = path.join(author, 'content/source/uiStrings.csv');
    await writeFile(csvPath, 'id,short\nold,Old\n');
    await copyFile(new URL('../tools/local-checks.mjs', import.meta.url), path.join(author, 'tools/local-checks.mjs'));
    const stale = await commit('Old local dev base');
    await git('branch', 'test');
    await git('switch', '-c', 'fixture-candidate');
    const csv = 'id,short\nold,Old\nalready-promoted,Already promoted\n';
    await writeFile(csvPath, csv);
    const upstreamDev = await commit('Upstream already contains the migrated row');
    await writeFile(path.join(author, 'src/upstream-test.txt'), 'independent upstream test\n');
    const upstreamTest = await commit('Distinct upstream test context');
    const expectedRefs = present ? [
      { ref: 'refs/remotes/origin/HEAD', sha: upstreamDev, symbolic: 'refs/remotes/origin/dev' },
      { ref: 'refs/remotes/origin/dev', sha: upstreamDev, symbolic: null },
      { ref: 'refs/remotes/origin/test', sha: upstreamTest, symbolic: null },
    ] : [];
    if (present) {
      await git('update-ref', 'refs/remotes/origin/dev', upstreamDev);
      await git('update-ref', 'refs/remotes/origin/test', upstreamTest);
      await git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/dev');
    }
    await writeFile(path.join(author, 'tests/reference-context.json'), JSON.stringify({ refs: expectedRefs, csv, present }));
    await writeFile(path.join(author, 'tests/combat-card-reference-context.test.mjs'), `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const expected=JSON.parse(readFileSync('tests/reference-context.json','utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
assert.equal(readFileSync('content/source/uiStrings.csv','utf8'),expected.csv);
assert.equal(git('for-each-ref','--format=%(refname)','refs/remotes/origin/'),expected.refs.map(r=>r.ref).join('\\n'));
for(const record of expected.refs){
  assert.equal(git('rev-parse',record.ref),record.sha);
  if(record.symbolic)assert.equal(git('symbolic-ref',record.ref),record.symbolic);
}
if(expected.present){
  // Same branch-delta semantics as the string gate: an already-promoted row
  // must not become a new row merely because the author's local dev is old.
  const ids=text=>text.split('\\n').slice(1).filter(Boolean).map(row=>row.split(',')[0]);
  const base=new Set(ids(git('show','origin/dev:content/source/uiStrings.csv')));
  assert.deepEqual(ids(expected.csv).filter(id=>!base.has(id)),[]);
}else{
  for(const branch of ['origin/dev','origin/test'])assert.throws(()=>git('rev-parse','--verify',branch));
}
`);
    const head = await commit('Committed runner reference regression');
    const beforeRefs = await git('show-ref');
    assert.equal(await git('rev-parse', 'dev'), stale);
    assert.equal(await git('rev-parse', 'test'), stale);
    await writeFile(csvPath, csv + 'dirty,Excluded author edit\n');
    const execution = await exec(process.execPath, ['tools/local-checks.mjs', '--suite', 'combat', '--output', output],
      { cwd: author, env, windowsHide: true }).then(result => ({ ...result, code: 0 }),
      error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
    const report = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8'));
    const log = report.checks[0] ? await readFile(report.checks[0].log, 'utf8') : report.error;
    assert.equal(execution.code, 0, `Runner failed; retained fixture: ${fixture}\n${log}`);
    assert.equal(report.status, 'passed');
    assert.equal(report.head, head);
    assert.deepEqual(report.originRefs, expectedRefs);
    assert.equal(await readFile(path.join(report.snapshot, 'content/source/uiStrings.csv'), 'utf8'), csv);
    const snapshotGit = async (...argv) => (await exec('git', argv, { cwd: report.snapshot, env, windowsHide: true })).stdout.trim();
    assert.equal(await snapshotGit('status', '--porcelain'), '');
    assert.equal(await snapshotGit('rev-parse', 'HEAD'), head);
    assert.equal(await snapshotGit('config', '--local', 'core.autocrlf'), 'false');
    assert.equal(await snapshotGit('config', '--local', 'core.eol'), 'lf');
    assert.equal(await git('show-ref'), beforeRefs, 'snapshot repair never updates author refs');
    assert.match(await readFile(csvPath, 'utf8'), /Excluded author edit/);
  });
}
