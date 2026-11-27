// The Game content store: an edit made while a save is in flight stays unsaved and is sent next time.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContentStore } from '../tools/score-studio/contentEditor/contentStore.js';
import { UI_CONFIG } from './helpers/content-editor-config.mjs';

const PATH = 'games/ashenspire/packs/core/routes.json';
const INDENT = UI_CONFIG.sizes.jsonIndent;
const ORIGINAL = {
    maxBranches: 1,
};

function asText(value)
{
    return `${JSON.stringify(value, null, INDENT)}\n`;
}

/** A ContentApi stand-in whose save replies only when the test says so. */
function delayedApi()
{
    const api = {
        sent: [],
        reply: null,
        ReadFile: async () => asText(ORIGINAL),
        SaveFile: (path, text) =>
        {
            api.sent.push(text);
            return new Promise((resolve) =>
            {
                api.reply = resolve;
            });
        },
    };
    return api;
}

test('an edit made while a save is in flight stays unsaved and is sent next time', async () =>
{
    const api = delayedApi();
    const store = new ContentStore(api, INDENT, () => {});
    const value = await store.Load(PATH);
    value.maxBranches = 2;
    store.MarkChanged(PATH);
    const saving = store.SaveAll();
    await new Promise((resolve) => setImmediate(resolve));
    value.maxBranches = 3;
    store.MarkChanged(PATH);
    api.reply({ ok: true });
    await saving;
    assert.equal(api.sent[0], asText({ maxBranches: 2 }));
    assert.deepEqual(store.DirtyPaths(), [PATH]);
    const second = store.SaveAll();
    await new Promise((resolve) => setImmediate(resolve));
    api.reply({ ok: true });
    await second;
    assert.equal(api.sent[1], asText({ maxBranches: 3 }));
    assert.deepEqual(store.DirtyPaths(), []);
});
