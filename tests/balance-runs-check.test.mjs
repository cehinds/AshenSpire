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
