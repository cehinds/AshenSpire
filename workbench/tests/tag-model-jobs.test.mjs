// node --test workbench/tests/tag-model-jobs.test.mjs — the Tag model jobs are listed
// as unavailable with a note when docs/tag-model is absent, available when it is there,
// and the two jobs share one lock group so they never run at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobRunner, JOBS, TAG_MODEL, TAG_MODEL_MISSING } from '../core/jobs.mjs';

const tmpRoot = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-tag-model-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('both Tag model jobs are unavailable, with the landing note, when docs/tag-model is absent', (t) => {
  const root = tmpRoot(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  for (const id of ['tag-model', 'tag-model-check']) {
    const def = runner.defs().find((d) => d.id === id);
    assert.equal(def.available, false, id);
    assert.equal(def.note, TAG_MODEL_MISSING, id);
  }
  assert.equal(runner.defs().find((d) => d.id === 'tag-model').label, 'Tag model: build, check, compile');
  assert.equal(runner.defs().find((d) => d.id === 'tag-model-check').label, 'Tag model: check');
});

test('starting an absent Tag model job fails with the note and runs no step', async (t) => {
  const root = tmpRoot(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  const started = runner.start('tag-model-check');
  for (let i = 0; i < 200 && runner.active.has('tag-model-check'); i += 1) await new Promise((r) => setTimeout(r, 10));
  const run = runner.get(started.runId);
  assert.equal(run.status, 'failed');
  assert.match(run.log, /docs\/tag-model is not on this branch yet/);
});

test('the Tag model jobs are available when a root has the tools, and run build, check, compile in order', (t) => {
  const root = tmpRoot(t);
  fs.mkdirSync(path.join(root, 'docs/tag-model/tools'), { recursive: true });
  for (const f of ['build.mjs', 'check.mjs', 'compile.mjs']) fs.writeFileSync(path.join(root, 'docs/tag-model/tools', f), '');
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  const full = runner.defs().find((d) => d.id === 'tag-model');
  assert.equal(full.available, true);
  assert.deepEqual(full.commands, [
    'node docs/tag-model/tools/build.mjs',
    'node docs/tag-model/tools/check.mjs',
    'node docs/tag-model/tools/compile.mjs',
  ]);
  assert.equal(runner.defs().find((d) => d.id === 'tag-model-check').available, true);
});

test('the two Tag model jobs share one lock group', () => {
  assert.equal(JOBS['tag-model'].lock, TAG_MODEL);
  assert.equal(JOBS['tag-model-check'].lock, TAG_MODEL);
  assert.notEqual(TAG_MODEL, 'generated-sources');
});

/** A root with the tag model tools, and a game .build-lock held by this live process (a game build running). */
function rootWithHeldBuildLock(t) {
  const root = tmpRoot(t);
  fs.mkdirSync(path.join(root, 'docs/tag-model/tools'), { recursive: true });
  for (const f of ['build.mjs', 'check.mjs', 'compile.mjs']) fs.writeFileSync(path.join(root, 'docs/tag-model/tools', f), 'process.exitCode = 0;');
  fs.writeFileSync(path.join(root, '.build-lock'), JSON.stringify({ pid: process.pid, holder: 'Game build', startedAt: Date.now() }));
  return root;
}

test('a held game .build-lock does not block the tag-model check job', async (t) => {
  const root = rootWithHeldBuildLock(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  const started = runner.start('tag-model-check');
  for (let i = 0; i < 300 && runner.active.has('tag-model-check'); i += 1) await new Promise((r) => setTimeout(r, 10));
  assert.equal(runner.get(started.runId).status, 'passed');
});

test('the tag-model job takes no cross-process lock: the .build-lock file is not created or changed by it', async (t) => {
  const root = tmpRoot(t);
  fs.mkdirSync(path.join(root, 'docs/tag-model/tools'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/tag-model/tools/check.mjs'), 'process.exitCode = 0;');
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  const started = runner.start('tag-model-check');
  assert.equal(fs.existsSync(path.join(root, '.build-lock')), false, 'no lock file while it runs');
  for (let i = 0; i < 300 && runner.active.has('tag-model-check'); i += 1) await new Promise((r) => setTimeout(r, 10));
  assert.equal(runner.get(started.runId).status, 'passed');
  assert.equal(fs.existsSync(path.join(root, '.build-lock')), false, 'and none after it');
});
