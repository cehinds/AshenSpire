// Runs the owner's build and check steps in a worker thread so the server keeps answering.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { OWNER_TOOLS, RunSteps } from './owner/ownerSteps.mjs';

const NEWLINE = '\n';

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

/** CollectCheck on a worker thread; resolves to { ok, lines }. */
export function RunContentCheck(root)
{
    return new Promise((resolvePromise, rejectPromise) =>
    {
        const worker = new Worker(new URL(import.meta.url), { workerData: { root } });
        worker.once('message', resolvePromise);
        worker.once('error', rejectPromise);
    });
}

if (!isMainThread && workerData?.root)
{
    parentPort.postMessage(CollectCheck(workerData.root));
}
