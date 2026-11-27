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

function timedOutCheck(timeoutMs)
{
    const seconds = Math.round(timeoutMs / MILLISECONDS_PER_SECOND);
    return failedCheck('checkTimedOut', { seconds });
}

/** CollectCheck on a worker; settles only after the worker has exited, so no build outlives it. */
export function RunContentCheck(root, options = {})
{
    const {
        createWorker = startWorker,
        timeoutMs = CONTENT_API.checkTimeoutMs,
    } = options;
    return new Promise((resolvePromise, rejectPromise) =>
    {
        const worker = createWorker(root);
        let outcome = null;
        let failure = null;
        // The worker stops past the cap, but exits only once its running step's child has exited.
        const timer = setTimeout(() =>
        {
            outcome = timedOutCheck(timeoutMs);
            worker.terminate();
        }, timeoutMs);
        worker.once(WORKER_EVENTS.message, (result) =>
        {
            outcome ??= result;
        });
        worker.once(WORKER_EVENTS.error, (error) =>
        {
            failure = error;
        });
        worker.once(WORKER_EVENTS.exit, (code) =>
        {
            clearTimeout(timer);
            if (failure && !outcome)
            {
                rejectPromise(failure);
                return;
            }
            resolvePromise(outcome ?? failedCheck('checkStopped', { code }));
        });
    });
}

if (!isMainThread && workerData?.root)
{
    parentPort.postMessage(CollectCheck(workerData.root));
}
