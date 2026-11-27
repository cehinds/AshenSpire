// Switching sections mid-load: a load that finishes after a newer one never replaces the panes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LatestLoad } from '../tools/score-studio/contentEditor/latestLoad.js';
import { EDITOR_CONFIG } from './helpers/content-editor-config.mjs';

const [FIRST_SECTION, SECOND_SECTION] = EDITOR_CONFIG.sections.map((section) => section.id);

/** A load that resolves with `value` only when the test calls `finish`. */
function delayedLoad(value)
{
    let finish;
    const done = new Promise((resolve) =>
    {
        finish = () => resolve(value);
    });
    return {
        load: () => done,
        finish,
    };
}

test('an older section load that finishes last is dropped', async () =>
{
    const latest = new LatestLoad();
    const shown = [];
    const show = (section) => shown.push(section);
    const slow = delayedLoad(SECOND_SECTION);
    const quick = delayedLoad(FIRST_SECTION);
    const slowRun = latest.Run(slow.load, show);
    const quickRun = latest.Run(quick.load, show);
    quick.finish();
    assert.equal(await quickRun, true);
    slow.finish();
    assert.equal(await slowRun, false);
    assert.deepEqual(shown, [FIRST_SECTION]);
});

test('a single load is shown', async () =>
{
    const latest = new LatestLoad();
    const shown = [];
    const only = delayedLoad(FIRST_SECTION);
    const running = latest.Run(only.load, (section) => shown.push(section));
    only.finish();
    assert.equal(await running, true);
    assert.deepEqual(shown, [FIRST_SECTION]);
});
