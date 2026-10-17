// node --test workbench/tests/game-profile-jobs.test.mjs — the game profile and HUD layout jobs are
// allowlisted with their exact steps, unavailable with a note when their tool is absent, and
// content-build runs the game profile compiler after its own step when that tool exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobRunner, JOBS, GENERATED } from '../core/jobs.mjs';

const tmpRoot = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-game-profile-jobs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('the game profile and HUD layout jobs exist in the generated lock group with their labels', () => {
  assert.equal(JOBS['game-config'].lock, GENERATED);
  assert.equal(JOBS['game-config-check'].lock, GENERATED);
  assert.equal(JOBS['hud-layout'].lock, GENERATED);
  assert.equal(JOBS['game-config'].label, 'Game profiles');
  assert.equal(JOBS['game-config-check'].label, 'Check game profiles');
  assert.equal(JOBS['hud-layout'].label, 'HUD layout');
  assert.equal(JOBS['game-config'].description, 'Compile games/ashenspire and engine/ modules into src/content/generated/gameProfiles.js and game.lock.json.');
});

test('each job runs exactly its tool command: build, check, and the HUD layout write', () => {
  const steps = (id) => JOBS[id].steps('/unused').map((s) => s.args);
  assert.deepEqual(steps('game-config'), [['tools/game-config.mjs', 'build']]);
  assert.deepEqual(steps('game-config-check'), [['tools/game-config.mjs', 'check']]);
  assert.deepEqual(steps('hud-layout'), [['tools/hud-layout-css.mjs', '--write']]);
});

test('content-build runs the game profile build after its content step, as an optional step', () => {
  const steps = JOBS['content-build'].steps('/unused');
  assert.deepEqual(steps.map((s) => s.args), [['tools/framework-data-build.mjs'], ['tools/content-build.mjs'], ['tools/game-config.mjs', 'build']]);
  assert.equal(steps[0].optional, true);
  assert.equal(steps[1].optional, undefined, 'content-build itself is required');
  assert.equal(steps[2].optional, true, 'a checkout without the game profile compiler skips it');
});

test('the three jobs are unavailable with a note when their tool is absent, and available when it is there', (t) => {
  const root = tmpRoot(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, 'state', 'jobs.json') });
  for (const id of ['game-config', 'game-config-check', 'hud-layout']) {
    const def = runner.defs().find((d) => d.id === id);
    assert.equal(def.available, false, id);
    assert.match(def.note, /is not in this checkout yet/, id);
  }
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  for (const file of ['game-config.mjs', 'hud-layout-css.mjs']) fs.writeFileSync(path.join(root, 'tools', file), '');
  const available = Object.fromEntries(runner.defs().map((d) => [d.id, d.available]));
  assert.equal(available['game-config'], true);
  assert.equal(available['game-config-check'], true);
  assert.equal(available['hud-layout'], true);
  assert.deepEqual(runner.defs().find((d) => d.id === 'hud-layout').commands, ['node tools/hud-layout-css.mjs --write']);
});
