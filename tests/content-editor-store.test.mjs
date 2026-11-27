// The Game content store: saves run one at a time and never lose an edit made while one is pending.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContentStore } from '../tools/score-studio/contentEditor/contentStore.js';
import { API_CONFIG, UI_CONFIG } from './helpers/content-editor-config.mjs';

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

test('a second Save while one is pending waits and sends from the text the first wrote', async () =>
{
    const api = delayedApi();
    const store = new ContentStore(api, INDENT, () => {});
    const value = await store.Load(PATH);
    value.maxBranches = 2;
    store.MarkChanged(PATH);
    const first = store.SaveAll();
    await new Promise((resolve) => setImmediate(resolve));
    value.maxBranches = 3;
    store.MarkChanged(PATH);
    const second = store.SaveAll();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.sent.length, 1);
    api.reply({ ok: true });
    await first;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.sent.length, 2);
    assert.equal(api.sent[1], asText({ maxBranches: 3 }));
    api.reply({ ok: true });
    await second;
    assert.deepEqual(store.DirtyPaths(), []);
    assert.equal(value.maxBranches, 3);
});

test('a stale reply keeps an edit typed after the request was sent', async () =>
{
    const api = delayedApi();
    const staleError = Object.assign(new Error(API_CONFIG.messages.staleFile), { stale: true });
    api.SaveFile = () => new Promise((resolve, reject) =>
    {
        api.reply = () => reject(staleError);
    });
    const store = new ContentStore(api, INDENT, () => {});
    const value = await store.Load(PATH);
    value.maxBranches = 2;
    store.MarkChanged(PATH);
    const saving = store.SaveAll();
    await new Promise((resolve) => setImmediate(resolve));
    value.maxBranches = 3;
    store.MarkChanged(PATH);
    api.reply();
    const result = await saving;
    assert.deepEqual(result.refused, [staleError.message]);
    assert.equal(store.Root(PATH).maxBranches, 3);
    assert.deepEqual(store.DirtyPaths(), [PATH]);
});

/** A ContentApi stand-in whose reads reply in the order the test chooses. */
function delayedReads()
{
    const api = {
        reads: [],
        ReadFile: () => new Promise((resolve) =>
        {
            api.reads.push(resolve);
        }),
        SaveFile: async () => ({ ok: true }),
    };
    return api;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('overlapping loads of one file share one read, and an edit after it is kept', async () =>
{
    const api = delayedReads();
    const store = new ContentStore(api, INDENT, () => {});
    const firstLoad = store.Load(PATH);
    const secondLoad = store.Load(PATH);
    assert.equal(api.reads.length, 1);
    api.reads[0](asText(ORIGINAL));
    const value = await firstLoad;
    assert.equal(await secondLoad, value);
    value.maxBranches = 4;
    store.MarkChanged(PATH);
    assert.equal(await store.Load(PATH), value);
    assert.equal(store.Root(PATH).maxBranches, 4);
    assert.deepEqual(store.DirtyPaths(), [PATH]);
});

test('a reload that finishes after an edit does not replace the edit', async () =>
{
    const api = delayedReads();
    const store = new ContentStore(api, INDENT, () => {});
    const loading = store.Load(PATH);
    api.reads[0](asText(ORIGINAL));
    const value = await loading;
    const reloading = store.ReloadClean();
    await settle();
    value.maxBranches = 5;
    store.MarkChanged(PATH);
    api.reads[1](asText({ maxBranches: 9 }));
    assert.deepEqual(await reloading, []);
    assert.equal(store.Root(PATH).maxBranches, 5);
    assert.deepEqual(store.DirtyPaths(), [PATH]);
});

test('Revert drops unsaved edits, but keeps one typed while the file was being read', async () =>
{
    const api = delayedReads();
    const store = new ContentStore(api, INDENT, () => {});
    const loading = store.Load(PATH);
    api.reads[0](asText(ORIGINAL));
    const value = await loading;
    value.maxBranches = 6;
    store.MarkChanged(PATH);
    const reverting = store.RevertAll();
    await settle();
    api.reads[1](asText(ORIGINAL));
    await reverting;
    assert.deepEqual(store.Root(PATH), ORIGINAL);
    assert.deepEqual(store.DirtyPaths(), []);
    store.Root(PATH).maxBranches = 7;
    store.MarkChanged(PATH);
    const late = store.RevertAll();
    await settle();
    store.Root(PATH).maxBranches = 8;
    store.MarkChanged(PATH);
    api.reads[2](asText(ORIGINAL));
    await late;
    assert.equal(store.Root(PATH).maxBranches, 8);
    assert.deepEqual(store.DirtyPaths(), [PATH]);
});
