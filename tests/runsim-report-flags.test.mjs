// tools/runsim.mjs --mana-ab and --seat-tiers (FINISH §4: *The Mana-aware A/B
// balance run*, SPEC §5.5.1; *Seat-tier tolerance is stated*, SPEC §13.3).
// The output shape on a tiny fleet; the measurements themselves are run by hand
// and recorded in docs/BALANCE.md (docs/balance-runs.md), never in CI.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';

const run = (...args) => {
  const r = spawnSync(process.execPath, ['tools/runsim.mjs', ...args], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 120000,
  });
  assert.equal(r.status, 0, `runsim ${args.join(' ')} exited ${r.status}\n${r.stderr}`);
  return r.stdout;
};
const REG = createRegistries(contentBundle);
const classes = REG.classes.all();

test('--mana-ab prints both arms with a win rate and Mana spent per class', () => {
  const out = run('2', '--mana-ab');
  const table = out.slice(out.indexOf('MANA A/B'));
  assert.ok(out.includes('MANA A/B'), 'no MANA A/B table');
  for (const cls of classes) {
    const re = new RegExp(`^  ${cls.name}\\s+(\\d+)/2 \\([\\d.]+%\\)\\s+([\\d.]+)\\s+(\\d+)/2 \\([\\d.]+%\\)\\s+([\\d.]+)\\s+-?[\\d.]+ pts$`, 'm');
    assert.match(table, re, `no A/B row for ${cls.name}`);
  }
  assert.match(table, /^  all\s+\d+\/\d+ \([\d.]+%\)/m);
  // Each arm is a whole fleet: two RESULT lines, each the plain fleet's shape.
  assert.equal((out.match(/^RESULT: \d+ runs over \d+ classes/gm) || []).length, 2);
  assert.match(out, /^MANA-AB: \d+ classes x 2 seeds, two arms/m);
});

test('the ON arm is the shipped game: its wins equal a plain fleet on the same seeds', () => {
  const plain = run('2');
  const ab = run('2', '--mana-ab');
  const onHalf = ab.slice(ab.indexOf('-'.repeat(72)));
  for (const cls of classes) {
    const wins = (text) => (text.match(new RegExp(`^${cls.name}\\s+full-run wins\\s+(\\d+)/2`, 'm')) || [])[1];
    assert.equal(wins(onHalf), wins(plain), `${cls.name}: ON arm drifted from the plain fleet`);
  }
});

test('--seat-tiers prints the configured multipliers from content and a row per tier', () => {
  const out = run('2', '--seat-tiers', '--seeded-seats');
  const tiers = Object.keys(REG.balance.seatTiers).map(Number).filter(Number.isInteger);
  assert.match(out, /^SEAT TIERS — seat order: seeded per run/m);
  const line = out.match(/^  configured balance\.seatTiers: (.*)$/m);
  assert.ok(line, 'no seatTiers line');
  assert.equal(line[1], tiers.map((t) => `${t}: ${REG.balance.seatTiers[t]}`).join(', '));
  assert.match(out, /^  configured balance\.bossTiers: 1: hp [\d.]+ damage [\d.]+/m);
  for (const cls of classes) {
    assert.match(out, new RegExp(`^  ${cls.name}\\s+tier 1 \\d+/\\d+ \\(`, 'm'), `no per-tier row for ${cls.name}`);
  }
  // Every class's runs open tier 1: the pooled row reached count is the fleet.
  assert.match(out, new RegExp(`^  per tier, every class: tier 1 \\d+/${2 * classes.length} \\(`, 'm'));
});
