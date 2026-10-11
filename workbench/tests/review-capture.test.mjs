// node --test workbench/tests/review-capture.test.mjs — the Visual capture job:
// its params are allowlisted, and it runs the game's own screenshot tool into
// the project state folder, never the repo tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JOBS, JobRunner, reviewCaptureParams } from '../core/jobs.mjs';
import { SCREENS } from '../modules/review/model.mjs';

const refused = (fn, status = 400) => assert.throws(fn, (e) => e.status === status);

test('capture params default to every screen on the desk, and keep the screen order', () => {
  const p = reviewCaptureParams({});
  assert.equal(p.device, 'desk');
  assert.deepEqual(p.screens, SCREENS.map((s) => s.id));
  assert.deepEqual(reviewCaptureParams({ screens: ['map', 'title', 'map'] }).screens, ['title', 'map']);
});

test('capture params refuse an unknown device, an empty or non-list screen set, and any screen not in the allowlist', () => {
  refused(() => reviewCaptureParams({ device: 'watch' }));
  refused(() => reviewCaptureParams({ device: '../desk' }));
  refused(() => reviewCaptureParams({ screens: [] }));
  refused(() => reviewCaptureParams({ screens: 'title' }));
  refused(() => reviewCaptureParams({ screens: ['title', '../../etc/passwd'] }));
  refused(() => reviewCaptureParams({ screens: ['title', '--out=/tmp/x'] }));
});

test('the capture job runs tools/screenshot.mjs at the device size, into the project state folder, with the chosen screens', () => {
  const [step] = JOBS['review-capture'].steps('/repo', { params: { screens: ['title', 'map'], device: 'phone' }, stateDir: '/state/p1' });
  assert.deepEqual(step.args, [
    'tools/screenshot.mjs', '--out', path.join('/state/p1', 'review', 'captures'),
    '--viewport', '390x844', '--prefix', 'phone-', '--only', 'title,map',
  ]);
});

test('the job is never given a path inside the repo tree by default', () => {
  const [step] = JOBS['review-capture'].steps('/repo', { stateDir: '/state/p1' });
  const out = step.args[step.args.indexOf('--out') + 1];
  assert.equal(out.startsWith('/state/p1'), true);
  assert.equal(out.startsWith('/repo'), false);
});

test('a bad capture request is refused before the job starts: no run, no slot taken', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-capture-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const runner = new JobRunner({ root: dir, stateFile: path.join(dir, 'state', 'jobs.json') });
  refused(() => runner.start('review-capture', { device: 'watch' }));
  refused(() => runner.start('review-capture', { screens: ['../x'] }));
  assert.equal(runner.runs.length, 0);
  assert.equal(runner.active.size, 0);
});

test('the job list still describes the capture job with its default command', () => {
  const runner = new JobRunner({ root: '/repo', stateFile: '/state/p1/jobs.json' });
  const def = runner.defs().find((d) => d.id === 'review-capture');
  assert.equal(def.label, 'Visual capture');
  assert.match(def.commands[0], /^node tools\/screenshot\.mjs --out \/state\/p1\/review\/captures --viewport 1280x800 --prefix desk- --only /);
});

test('null params mean the defaults, and a non-object params value is a 400 with a clear message', () => {
  const stateDir = '/state/p1';
  const defaults = JOBS['review-capture'].steps('/repo', { params: {}, stateDir });
  assert.deepEqual(JOBS['review-capture'].steps('/repo', { params: null, stateDir }), defaults);
  assert.throws(() => JOBS['review-capture'].steps('/repo', { params: 'desk', stateDir }), (e) => e.status === 400 && /must be an object/.test(e.message));
  assert.throws(() => reviewCaptureParams(['title']), (e) => e.status === 400);
});

test('the runner refuses a non-object params before a run starts, and accepts null as defaults', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-capture-null-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const runner = new JobRunner({ root: dir, stateFile: path.join(dir, 'state', 'jobs.json') });
  assert.doesNotThrow(() => JOBS['review-capture'].steps(dir, { params: null, stateDir: dir }));
  assert.throws(() => runner.start('review-capture', 'desk'), (e) => e.status === 400);
  assert.equal(runner.runs.length, 0);
});
