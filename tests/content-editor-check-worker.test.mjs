// A check that runs past its cap settles only after its worker and the worker's child have exited.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Worker } from 'node:worker_threads';
import { ApiMessage } from '../tools/content-editor-config.mjs';
import { RunContentCheck } from '../tools/content-editor-check.mjs';

const CAP_MS = 200;
const CHILD_DELAY_MS = 1500;
const AFTER_RETURN_WAIT_MS = 2500;
const MILLISECONDS_PER_SECOND = 1000;
const MARKER_NAME = 'late-write.txt';

/** A real worker whose step is a child that writes `markerPath` only after a delay. */
function slowBuildWorker(markerPath)
{
    const write = `require('fs').writeFileSync(${JSON.stringify(markerPath)}, 'late')`;
    const childScript = `setTimeout(() => ${write}, ${CHILD_DELAY_MS})`;
    const spawnChild = `require('child_process')`
        + `.spawnSync(process.execPath, ['-e', ${JSON.stringify(childScript)}]);`;
    const report = `require('worker_threads').parentPort.postMessage({ ok: true, lines: [] });`;
    const workerScript = `${spawnChild}${report}`;
    return new Worker(workerScript, { eval: true });
}

test('after a check past its cap returns, its build writes nothing more', async () =>
{
    const folder = mkdtempSync(join(tmpdir(), 'content-check-'));
    const marker = join(folder, MARKER_NAME);
    try
    {
        const result = await RunContentCheck(folder, {
            createWorker: () => slowBuildWorker(marker),
            timeoutMs: CAP_MS,
        });
        const seconds = Math.round(CAP_MS / MILLISECONDS_PER_SECOND);
        assert.deepEqual(result, {
            ok: false,
            lines: [ApiMessage('checkTimedOut', { seconds })],
        });
        const writtenAtReturn = existsSync(marker);
        await new Promise((resolve) => setTimeout(resolve, AFTER_RETURN_WAIT_MS));
        assert.equal(existsSync(marker), writtenAtReturn);
    }
    finally
    {
        rmSync(folder, { recursive: true, force: true });
    }
});
