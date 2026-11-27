// The owner tools stop a build or check step that hangs and report it as failed.
// The note and marks come from ownerText.json and the limits from ownerTools.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FormatText, OWNER_TEXT, OWNER_TOOLS } from '../tools/owner/ownerConfig.mjs';
import { RunNode, RunSteps } from '../tools/owner/ownerProcess.mjs';

const SHORT_TIMEOUT_MS = 500;
const MILLISECONDS_PER_SECOND = 1000;
const NEWLINE = '\n';
const HANGING_SCRIPT = [
    '-e',
    'setTimeout(() => {}, 60000)',
];
const QUICK_SCRIPT = [
    '-e',
    'process.exit(0)',
];
const TIMEOUT_NOTE = FormatText(OWNER_TEXT.process.timedOut, {
    seconds: Math.round(SHORT_TIMEOUT_MS / MILLISECONDS_PER_SECOND),
});

test('a node run past its timeout is stopped and fails with the configured note', () =>
{
    const result = RunNode(HANGING_SCRIPT, undefined, { timeoutMs: SHORT_TIMEOUT_MS });
    assert.equal(result.ok, false);
    assert.ok(result.output.endsWith(TIMEOUT_NOTE), result.output);
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
        failedStep: steps[1].label,
    });
    assert.deepEqual(lines.slice(0, 2), [
        `${OWNER_TEXT.marks.pass} ${steps[0].label}`,
        `${OWNER_TEXT.marks.fail} ${steps[1].label}`,
    ]);
    assert.ok(lines.join(NEWLINE).includes(TIMEOUT_NOTE));
});

test('every owner step has a timeout, and a step may set a longer one', () =>
{
    assert.ok(OWNER_TOOLS.limits.stepTimeoutMs > 0);
    const allSteps = [
        ...OWNER_TOOLS.buildSteps,
        ...OWNER_TOOLS.checkSteps,
        ...OWNER_TOOLS.testSteps,
    ];
    for (const step of allSteps.filter((candidate) => candidate.timeoutMs !== undefined))
    {
        assert.ok(step.timeoutMs > 0, step.label);
    }
});
