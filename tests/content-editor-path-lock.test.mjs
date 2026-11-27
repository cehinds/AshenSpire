// The per-file lock behind content saves: one task per path at a time; a failure frees the path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WithPathLock } from '../tools/content-editor-path-lock.mjs';

const PATH = 'games/ashenspire/packs/core/routes.json';
const OTHER_PATH = 'content/source/relics.json';

function gate()
{
    let open;
    const opened = new Promise((resolve) =>
    {
        open = resolve;
    });
    return {
        opened,
        open,
    };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('a second task on the same path waits until the first has finished', async () =>
{
    const events = [];
    const first = gate();
    const running = WithPathLock(PATH, async () =>
    {
        events.push('first start');
        await first.opened;
        events.push('first end');
    });
    const queued = WithPathLock(PATH, async () =>
    {
        events.push('second start');
    });
    const elsewhere = WithPathLock(OTHER_PATH, async () =>
    {
        events.push('other path');
    });
    await settle();
    assert.deepEqual(events, ['first start', 'other path']);
    first.open();
    await Promise.all([running, queued, elsewhere]);
    assert.deepEqual(events, ['first start', 'other path', 'first end', 'second start']);
});

test('a failed task passes its error on and still lets the next task run', async () =>
{
    const failure = new Error('stale');
    await assert.rejects(WithPathLock(PATH, async () =>
    {
        throw failure;
    }), failure);
    assert.equal(await WithPathLock(PATH, async () => 'ran'), 'ran');
});
