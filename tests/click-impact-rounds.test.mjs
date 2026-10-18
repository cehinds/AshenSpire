// The click-impact probe re-measures ONCE when a median misses its budget and
// judges the re-measurement (tools/click-impact-rounds.mjs; CI flake, 2026-10-18).
// A stub stands in for the browser drive: it returns scripted rounds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeRounds, judgeRound, median } from '../tools/click-impact-rounds.mjs';

const BUDGETS = { budgetMs: 400, numberBudgetMs: 750 };
const within = { samples: [230, 240, 220], numbers: [650, 660, 640] };
const overNumber = { samples: [230, 240, 220], numbers: [760, 780, 740] };
const overContact = { samples: [430, 440, 420], numbers: [650, 660, 640] };

const run = async (rounds, opts = {}) => {
  const lines = [];
  const errors = [];
  let calls = 0;
  const result = await judgeRounds(async (n) => { calls += 1; return rounds[n - 1]; }, {
    ...BUDGETS, ...opts, log: (l) => lines.push(l), error: (l) => errors.push(l),
  });
  return { ...result, lines, errors, calls };
};

test('median handles odd and even counts', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.deepEqual(judgeRound(within, 400, 750), { contact: 230, number: 650, contactOkay: true, numberOkay: true });
});

test('a first round within budget is judged at once and not re-measured', async () => {
  const r = await run([within, overNumber]);
  assert.equal(r.exitCode, 0);
  assert.equal(r.calls, 1);
  assert.ok(r.lines.includes('2 passed, 0 failed'));
});

test('a first round over budget and a second within budget exits 0, printing both rounds', async () => {
  const r = await run([overNumber, within]);
  assert.equal(r.exitCode, 0);
  assert.equal(r.calls, 2);
  const both = r.lines.find((l) => /round 1: .*over budget; round 2: .*within budget/.test(l));
  assert.ok(both, `a line names both rounds: ${r.lines.join(' | ')}`);
  assert.ok(r.lines.includes('2 passed, 0 failed'), 'one counted verdict, from the judged round');
  assert.equal(r.lines.filter((l) => /\d+ passed, \d+ failed/.test(l)).length, 1);
});

test('both rounds over budget exits 1', async () => {
  const r = await run([overNumber, overContact]);
  assert.equal(r.exitCode, 1);
  assert.equal(r.calls, 2);
  assert.ok(r.lines.includes('1 passed, 1 failed'), 'the second round is the one judged (contact over, number within)');
});

test('--rounds 1 is the single-shot behaviour', async () => {
  const r = await run([overNumber, within], { rounds: 1 });
  assert.equal(r.exitCode, 1);
  assert.equal(r.calls, 1);
  assert.ok(!r.lines.some((l) => /round \d:/.test(l)), 'no round labels in single-shot mode');
});

test('a first round that cannot measure is exit 2, never a pass', async () => {
  const r = await run([{ samples: [200, 210], numbers: [600, 610] }, within]);
  assert.equal(r.exitCode, 2);
  assert.equal(r.calls, 1);
  assert.match(r.errors[0], /only 2 play\(s\) measured in round 1; need 3/);
});

test('a re-measure that cannot measure leaves the first round\'s verdict (1)', async () => {
  const r = await run([overNumber, { samples: [], numbers: [] }]);
  assert.equal(r.exitCode, 1);
  assert.ok(r.lines.some((l) => /round 2: could not measure/.test(l)));
});
