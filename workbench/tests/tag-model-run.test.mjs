// node --test workbench/tests/tag-model-run.test.mjs — after a tag-model save: the job the
// rule names runs (never the game build), the table files it changed are counted, and a
// busy job is reported as busy. The fixture's docs/tag-model/tools are small scripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobRunner } from '../core/jobs.mjs';
import { runAfterTagModelSave, changedTables, tableHashes } from '../core/tag-model-run.mjs';

const T = 'docs/tag-model/tables';
const LAYOUTS = `${T}/presentation/layouts.csv`;
const OK = 'process.exitCode = 0;';

function fixture(t, { build = '', check = OK } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-tag-run-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, T, 'presentation'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/tag-model/tools'), { recursive: true });
  fs.writeFileSync(path.join(root, T, 'values.csv'), 'id,value\nar,24\n');
  fs.writeFileSync(path.join(root, LAYOUTS), 'id,tag,band,width\nl1,desk,desktop,100\n');
  fs.writeFileSync(path.join(root, 'docs/tag-model/tools/build.mjs'), build);
  fs.writeFileSync(path.join(root, 'docs/tag-model/tools/check.mjs'), check);
  fs.writeFileSync(path.join(root, 'docs/tag-model/tools/compile.mjs'), OK);
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  return { root, runner };
}

// A build that regenerates one table: it adds a row to layouts.csv, as a re-extraction would.
const REGEN = `import fs from 'node:fs'; fs.appendFileSync('${LAYOUTS}', 'l2,phone,mobile,50\\n');`;

test('a presentation save runs the full job, and reports the table files the build changed', async (t) => {
  const { root, runner } = fixture(t, { build: REGEN });
  const sent = [];
  const report = await runAfterTagModelSave({ root, jobs: runner, paths: [LAYOUTS], send: (r) => sent.push(r) });
  assert.equal(report.job, 'tag-model');
  assert.equal(report.status, 'passed');
  assert.equal(report.label, 'Tag model: build, check, compile');
  assert.equal(report.updated, 1);
  assert.deepEqual(report.files, [LAYOUTS]);
  assert.deepEqual(sent, [report]);
});

test('an authored save runs only the check job, which changes no table', async (t) => {
  const { root, runner } = fixture(t, { build: REGEN });
  const report = await runAfterTagModelSave({ root, jobs: runner, paths: [`${T}/values.csv`] });
  assert.equal(report.job, 'tag-model-check');
  assert.equal(report.label, 'Tag model: check');
  assert.equal(report.status, 'passed');
  assert.equal(report.updated, 0);
  assert.equal(fs.readFileSync(path.join(root, LAYOUTS), 'utf8').includes('l2,phone'), false, 'the full build did not run');
});

test('a failing check is reported as failed with its message', async (t) => {
  const { root, runner } = fixture(t, { check: 'process.exitCode = 1;' });
  const report = await runAfterTagModelSave({ root, jobs: runner, paths: [`${T}/values.csv`] });
  assert.equal(report.status, 'failed');
  assert.equal(report.message, 'docs/tag-model/tools/check.mjs exited with 1');
});

test('a save while the same job runs is reported busy, not run twice', async (t) => {
  const slow = "await new Promise((r) => setTimeout(r, 400));";
  const { root, runner } = fixture(t, { build: slow });
  const first = runAfterTagModelSave({ root, jobs: runner, paths: [LAYOUTS] });
  const sent = [];
  const second = await runAfterTagModelSave({ root, jobs: runner, paths: [LAYOUTS], send: (r) => sent.push(r) });
  assert.equal(second.status, 'busy');
  assert.match(second.message, /already running/);
  assert.equal((await first).status, 'passed');
  assert.equal(sent.length, 1);
});

test('a save with no tag-model table starts no job', async (t) => {
  const { root, runner } = fixture(t);
  assert.equal(await runAfterTagModelSave({ root, jobs: runner, paths: ['content/source/items.csv'] }), null);
  assert.equal(runner.runs.length, 0);
});

test('changedTables lists added, removed and changed tables, sorted', () => {
  const before = new Map([['a.csv', '1'], ['b.csv', '2']]);
  const after = new Map([['b.csv', '3'], ['c.csv', '4']]);
  assert.deepEqual(changedTables(before, after), ['a.csv', 'b.csv', 'c.csv']);
  assert.deepEqual(changedTables(before, new Map(before)), []);
});

test('tableHashes covers the CSVs under the tables folder only', async (t) => {
  const { root } = fixture(t);
  const hashes = await tableHashes(root);
  assert.deepEqual([...hashes.keys()].sort(), [`${T}/presentation/layouts.csv`, `${T}/values.csv`]);
});
