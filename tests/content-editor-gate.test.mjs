// The server gate: a check waits for saves in flight, and saves wait for a running check.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiMessage } from '../tools/content-editor-config.mjs';
import { CONTENT_STATUS } from '../tools/content-editor-error.mjs';
import { ContentGate } from '../tools/content-editor-gate.mjs';

const BUSY_MESSAGE = 'checkBusy';
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred()
{
    let finish;
    const done = new Promise((resolve) =>
    {
        finish = resolve;
    });
    return {
        done,
        finish,
    };
}

test('a check starts only after the saves in flight have finished', async () =>
{
    const gate = new ContentGate();
    const events = [];
    const write = deferred();
    const saving = gate.RunSave(async () =>
    {
        events.push('save start');
        await write.done;
        events.push('save end');
    });
    const checking = gate.RunCheck(async () =>
    {
        events.push('check');
    }, BUSY_MESSAGE);
    await settle();
    assert.deepEqual(events, ['save start']);
    write.finish();
    await Promise.all([saving, checking]);
    assert.deepEqual(events, ['save start', 'save end', 'check']);
});

test('a save waits for a running check, and a second check is refused', async () =>
{
    const gate = new ContentGate();
    const events = [];
    const build = deferred();
    const checking = gate.RunCheck(async () =>
    {
        events.push('check start');
        await build.done;
        events.push('check end');
    }, BUSY_MESSAGE);
    await settle();
    const saving = gate.RunSave(async () =>
    {
        events.push('save');
    });
    await assert.rejects(gate.RunCheck(async () => {}, BUSY_MESSAGE), {
        status: CONTENT_STATUS.conflict,
        message: ApiMessage(BUSY_MESSAGE),
    });
    await settle();
    assert.deepEqual(events, ['check start']);
    build.finish();
    await Promise.all([checking, saving]);
    assert.deepEqual(events, ['check start', 'check end', 'save']);
});
