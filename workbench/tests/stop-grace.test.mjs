// node --test workbench/tests/stop-grace.test.mjs — the Workbench's job and tool stops use the
// same SIGTERM grace as the Editor's group stop (tools/lib/process-tree.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STOP_GRACE_MS as JOB_GRACE_MS } from '../core/jobs.mjs';
import { STOP_GRACE_MS, KILL_WAIT_MS } from '../../tools/lib/process-tree.mjs';

test('the Workbench job stop shares the group stop grace period', () => {
  assert.equal(JOB_GRACE_MS, STOP_GRACE_MS);
  assert.equal(typeof KILL_WAIT_MS, 'number');
});
