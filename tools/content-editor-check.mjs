// Runs the owner's build and check steps in a worker thread so the server keeps answering.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { ApiMessage, CONTENT_API } from './content-editor-config.mjs';
import { OWNER_TOOLS, RunSteps } from './owner/ownerSteps.mjs';

const NEWLINE = '\n';
const MILLISECONDS_PER_SECOND = 1000;
const WORKER_EVENTS = {
    message: 'message',
    error: 'error',
    exit: 'exit',
};

/** Runs build then check steps with `runSteps`; returns { ok, lines }. */
export function CollectCheck(root, runSteps = RunSteps)
{
    const lines = [];
    const collect = (text) =>
    {
        lines.push(...String(text).split(NEWLINE));
    };
    const steps = [
        ...OWNER_TOOLS.buildSteps,
        ...OWNER_TOOLS.checkSteps,
    ];
    const result = runSteps(steps, root, collect);
    return {
        ok: result.ok,
        lines,
    };
}

function failedCheck(messageName, values)
{
    return {
        ok: false,
        lines: [ApiMessage(messageName, values)],
    };
}

function startWorker(root)
{
    return new Worker(new URL(import.meta.url), { workerData: { root } });
}

/** CollectCheck on a worker; a timeout or an exit without a result ends it as failed. */
export function RunContentCheck(root, options = {})
{
    const {
        createWorker = startWorker,
        timeoutMs = CONTENT_API.checkTimeoutMs,
    } = options;
    return new Promise((resolvePromise, rejectPromise) =>
    {
        const worker = createWorker(root);
        let settled = false;
        const finish = (deliver, value) =>
        {
            if (settled)
            {
                return;
            }
            settled = true;
            clearTimeout(timer);
            deliver(value);
        };
        const timer = setTimeout(() =>
        {
            const seconds = Math.round(timeoutMs / MILLISECONDS_PER_SECOND);
            finish(resolvePromise, failedCheck('checkTimedOut', { seconds }));
            worker.terminate();
        }, timeoutMs);
        worker.once(WORKER_EVENTS.message, (result) => finish(resolvePromise, result));
        worker.once(WORKER_EVENTS.error, (error) => finish(rejectPromise, error));
        worker.once(WORKER_EVENTS.exit, (code) =>
        {
            finish(resolvePromise, failedCheck('checkStopped', { code }));
        });
    });
}

if (!isMainThread && workerData?.root)
{
    parentPort.postMessage(CollectCheck(workerData.root));
}
