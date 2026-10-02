// runsim and measure-classes walk ONE run loop between fights (tools/simrun.mjs).
//
// measure-classes used to keep a copy of runsim's loop, and the copy fell
// behind (no XP, drafts, level-ups or event history): its runs left runsim's
// after the first few fights, `--check` at n=500 went red on wins (Rogue 0/500
// against runsim's 1/500), and its `path` and `shrine` plants were never caught
// because a fight that opened apart was counted, not compared. Both tools now
// call the shared loop, and --check fails on any fight that opens apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunLoop, PILOT, fleetSeed } from '../tools/simrun.mjs';

const registries = createRegistries(contentBundle);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const measure = (...args) => spawnSync(process.execPath, ['tools/measure-classes.mjs', ...args], {
  cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 300000,
});

test('runsim and measure-classes run the shared loop and keep no copy of it', () => {
  for (const path of ['tools/runsim.mjs', 'tools/measure-classes.mjs']) {
    const text = source(path);
    assert.match(text, /import \{[^}]*\bcreateRunLoop\b[^}]*\} from '\.\/simrun\.mjs'/, `${path} imports createRunLoop`);
    assert.match(text, /import \{[^}]*\bpayFightXp\b[^}]*\} from '\.\/simrun\.mjs'/, `${path} pays fight XP through simrun`);
    for (const copy of [/\bbuildActMap\(/, /\bfunction afterVictory\b/, /\bcreateLocationVisit\(/, /\brollCardRewardIds\(/]) {
      assert.doesNotMatch(text, copy, `${path} keeps a private piece of the run loop (${copy})`);
    }
  }
});

test('the pilot thresholds are named once and a caller can override them', () => {
  assert.deepEqual({ ...PILOT }, { pathHurtBelow: 0.55, restBelow: 0.6 });
  // A fight bot that loses at once: the run ends in its first fight, and the
  // loop says where. No pilot override can make the loop crash or loop.
  const seen = [];
  const loop = createRunLoop(registries, {
    fight: (run, rng, encId) => { seen.push(encId); return 'defeat'; },
    pilot: { pathHurtBelow: 1, restBelow: 0 },
  });
  const r = loop.simulateRun(registries.classes.all()[0].id, fleetSeed(1));
  assert.equal(r.victory, false);
  assert.equal(seen.length, 1, 'one fight, then the death');
  assert.match(r.deaths, new RegExp(`:${seen[0]}$`));
  assert.equal(r.deathInfo.enc, seen[0]);
});

// The clean --check's `run loop MATCH` lines are asserted in
// tests/simbot-decisions.test.mjs, beside its decisions lines, on the same run.

for (const plant of ['path', 'shrine']) {
  test(`the ${plant} plant (a run-loop drift) fails --check`, () => {
    const r = measure('5', '--check', `--mutate=${plant}`);
    assert.equal(r.status, 1, `the planted drift must fail --check\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /run loop DRIFT — [1-9]\d* fights opened on different state/);
  });
}

test('the starseerkit policy runs (its ordered lethal probe clones a live combat)', () => {
  // The probe skipped named doors only, so createCombat's `_emitEvent` helper
  // reached structuredClone and every starseerkit run died with DataCloneError.
  const r = measure('1', '--policy=starseerkit');
  assert.equal(r.status, 0, `starseerkit exited ${r.status}\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /DataCloneError/);
  assert.match(r.stdout, /starseerkit scope \+ paired-seed control/);
});
