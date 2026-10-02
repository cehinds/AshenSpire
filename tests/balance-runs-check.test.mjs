// tools/balance-runs-check.mjs: the configuration evidence recorded in
// docs/balance-runs.md (copied into docs/BALANCE.md §7) is checked against the
// live registries, so `node tools/balance.mjs --check` cannot stay green after
// balance.seatTiers or balance.bossTiers moves under a hand-recorded report.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { recordedMultiplierProblems } from '../tools/balance-runs-check.mjs';

const REG = createRegistries(contentBundle);
const recorded = readFileSync(new URL('../docs/balance-runs.md', import.meta.url), 'utf8');
const withBalance = (patch) => ({ ...REG, balance: { ...REG.balance, ...patch } });

test('the committed report agrees with the live seat and boss tiers', () => {
  assert.deepEqual(recordedMultiplierProblems(REG, recorded), []);
});

test('a moved balance.seatTiers row makes the recorded report stale', () => {
  const last = Math.max(...Object.keys(REG.balance.seatTiers).map(Number).filter(Number.isInteger));
  const reg = withBalance({ seatTiers: { ...REG.balance.seatTiers, [last]: REG.balance.seatTiers[last] + 0.25 } });
  const problems = recordedMultiplierProblems(reg, recorded);
  assert.ok(problems.some((p) => /balance\.seatTiers/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /Enemy HP/.test(p)), problems.join('\n'));
});

test('a moved balance.bossTiers row makes the recorded report stale', () => {
  const reg = withBalance({ bossTiers: { ...REG.balance.bossTiers, 2: { hp: 9, damage: 9 } } });
  const problems = recordedMultiplierProblems(reg, recorded);
  assert.ok(problems.some((p) => /balance\.bossTiers/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /Boss HP/.test(p)), problems.join('\n'));
});

test('a hand-edited multiplier cell, or a missing evidence table, is caught', () => {
  const edited = recorded.replace(/\| 2\.200 \| 1\.500 \|/, '| 2.000 | 1.500 |');
  assert.notEqual(edited, recorded, 'fixture: the report has no 2.200 / 1.500 boss row to edit');
  assert.ok(recordedMultiplierProblems(REG, edited).some((p) => /Boss HP/.test(p)));
  assert.ok(recordedMultiplierProblems(REG, '## 7. nothing here\n').length > 0);
});

test('a multiplier stated in prose is caught, so the fixed-order bosses sit in a checked table', () => {
  // The fixed-order boss scales used to be prose (`2.200 / 1.500`), which no
  // check read: replacing them with 9.999 / 9.999 passed (PR #1473 review).
  const prose = `${recorded}\nFixed seat order, tier 2 \`a2_bossStitchedKing\` (9.999 / 9.999) fought 840.\n`;
  assert.ok(recordedMultiplierProblems(REG, prose).some((p) => /stated in prose/.test(p)));
  assert.ok(recordedMultiplierProblems(REG, `${recorded}\nThe boss had hp × 9.9.\n`).some((p) => /stated in prose/.test(p)));
  // The fixed-order boss table itself is checked: a moved cell is named.
  const fixed = recorded.indexOf('Fixed seat order, the boss each tier fought');
  assert.ok(fixed > 0, 'fixture: the report has a fixed-order boss table');
  const edited = recorded.slice(0, fixed) + recorded.slice(fixed).replace('| 2 | marches | `a2_bossStitchedKing` | 2.200 | 1.500 |', '| 2 | marches | `a2_bossStitchedKing` | 9.999 | 9.999 |');
  assert.notEqual(edited, recorded, 'fixture: no fixed-order tier 2 boss row to edit');
  assert.ok(recordedMultiplierProblems(REG, edited).some((p) => /Boss HP × 9\.999/.test(p)));
});

test('a deleted tier/seat row is caught: each table covers its whole tier × seat set', () => {
  const seatRow = /^\| 2 \| reach \| [\d.]+ \| .*\|\n/m;
  assert.match(recorded, seatRow, 'fixture: no tier 2 reach Enemy HP × row');
  assert.ok(recordedMultiplierProblems(REG, recorded.replace(seatRow, '')).some((p) => /Seeded seat order Enemy HP × table: no row for tier 2 reach/.test(p)));
  const seededBoss = /^\| 3 \| marches \| `a2_bossStitchedKing` \|.*\n/m;
  assert.match(recorded, seededBoss, 'fixture: no seeded tier 3 marches boss row');
  assert.ok(recordedMultiplierProblems(REG, recorded.replace(seededBoss, '')).some((p) => /Seeded seat order boss table: no row for tier 3 marches/.test(p)));
  const fixedBoss = /^\| 3 \| reach \| `a3_bossRotValkyrie` \| [\d.]+ \| [\d.]+ \| 16 \|.*\n/m;
  assert.match(recorded, fixedBoss, 'fixture: no fixed-order tier 3 boss row');
  assert.ok(recordedMultiplierProblems(REG, recorded.replace(fixedBoss, '')).some((p) => /Fixed seat order boss table: no row for tier 3 reach/.test(p)));
});
