import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { completedFleet, repeatedCompleteFleets } from '../tools/runsim-selftest-policy.mjs';

const report = 'RESULT: 8 runs over 4 classes (2 fixed seeds each), every one to a win or a death — 0 wins, 0 crashes, 0 soft-locks.\n';
const child = (output, code = 0) => spawnSync(process.execPath, ['-e', 'process.stdout.write(process.argv[1]); process.exit(Number(process.argv[2]));', output, String(code)], { encoding: 'utf8' });

test('determinism requires two successful complete subprocesses', () => {
  const first = child(report), second = child(report);
  assert.equal(repeatedCompleteFleets(first, second), true);
  assert.equal(repeatedCompleteFleets(first, child(report, 1)), false);
});

test('matching truncated reports cannot pass determinism', () => {
  const truncated = child(report.trimEnd().slice(0, -1));
  assert.equal(completedFleet(truncated), false);
  assert.equal(repeatedCompleteFleets(truncated, truncated), false);
});

test('failed and absent completion reports remain failures', () => {
  assert.equal(completedFleet(child('RESULT: FAILED — 1 crash.\n')), false);
  assert.equal(completedFleet(child('fleet started\n')), false);
});

test('a timed out subprocess is rejected with its actual error', () => {
  const result = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 10000);'], { encoding: 'utf8', timeout: 100 });
  assert.equal(result.error?.code, 'ETIMEDOUT');
  assert.equal(completedFleet(result), false);
});
