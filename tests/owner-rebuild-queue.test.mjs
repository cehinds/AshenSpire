// npm run play's enemy sheet watcher: saves during a rebuild queue one more instead of being lost.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OWNER_TOOLS } from '../tools/owner/ownerConfig.mjs';
import { CreateRebuildQueue } from '../tools/owner/rebuildQueue.mjs';

const DELAY_MS = OWNER_TOOLS.play.rebuildDelayMs;

/** Timers that run only when the test says so. */
function manualTimers()
{
    const waiting = new Map();
    let nextId = 1;
    return {
        setTimeout(callback)
        {
            const id = nextId++;
            waiting.set(id, callback);
            return id;
        },
        clearTimeout(id)
        {
            waiting.delete(id);
        },
        RunAll()
        {
            const due = [...waiting.values()];
            waiting.clear();
            due.forEach((callback) => callback());
        },
        get count()
        {
            return waiting.size;
        },
    };
}

test('quick saves become one rebuild', () =>
{
    const timers = manualTimers();
    const rebuilt = [];
    const queue = CreateRebuildQueue({
        rebuild: (file) => rebuilt.push(file),
        delayMs: DELAY_MS,
        timers,
    });
    queue.Notify('a.json');
    queue.Notify('b.json');
    timers.RunAll();
    assert.deepEqual(rebuilt, ['b.json']);
});

test('a save during a rebuild runs one more rebuild after it', () =>
{
    const timers = manualTimers();
    const rebuilt = [];
    const queue = CreateRebuildQueue({
        rebuild: (file) => rebuilt.push(file),
        delayMs: DELAY_MS,
        timers,
    });
    queue.Notify('huskBrute.json');
    timers.RunAll();
    queue.Notify('huskBrute.json');
    queue.Notify('ashGolem.json');
    timers.RunAll();
    timers.RunAll();
    assert.deepEqual(rebuilt, ['huskBrute.json', 'ashGolem.json']);
    timers.RunAll();
    assert.equal(timers.count, 0);
});
