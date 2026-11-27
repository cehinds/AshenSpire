// The owner tools stop a build or check step that hangs and report it as failed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OWNER_TOOLS } from '../tools/owner/ownerConfig.mjs';
import { RunNode, RunSteps } from '../tools/owner/ownerProcess.mjs';

const SHORT_TIMEOUT_MS = 500;
const HANGING_SCRIPT = [
    '-e',
    'setTimeout(() => {}, 60000)',
];
const QUICK_SCRIPT = [
    '-e',
    'console.log("done")',
];

test('a node run past its timeout is stopped and fails with a plain note', () =>
{
    const started = Date.now();
    const result = RunNode(HANGING_SCRIPT, undefined, { timeoutMs: SHORT_TIMEOUT_MS });
    assert.equal(result.ok, false);
    assert.match(result.output, /Stopped after 1 seconds without finishing\./);
    assert.ok(Date.now() - started < 30000);
    assert.equal(RunNode(QUICK_SCRIPT).ok, true);
});

test('a step that times out is reported as the failed step', () =>
{
    const lines = [];
    const steps = [
        {
            label: 'Quick step',
            args: QUICK_SCRIPT,
        },
        {
            label: 'Hanging step',
            args: HANGING_SCRIPT,
            timeoutMs: SHORT_TIMEOUT_MS,
        },
    ];
    const result = RunSteps(steps, undefined, (line) => lines.push(line));
    assert.deepEqual(result, {
        ok: false,
        failedStep: 'Hanging step',
    });
    assert.match(lines.join('\n'), /FAIL Hanging step[\s\S]*Stopped after/);
});

test('every owner step has a timeout, and the core tests get a longer one', () =>
{
    assert.ok(OWNER_TOOLS.limits.stepTimeoutMs > 0);
    const coreTests = OWNER_TOOLS.testSteps[0];
    assert.ok(coreTests.timeoutMs > OWNER_TOOLS.limits.stepTimeoutMs);
});
