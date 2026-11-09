import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CreateCombatPlayback } from '../src/ui/components/combatPlayback.js';
import { IsCurrentCombatMount } from '../src/ui/components/combatMount.js';

function playbackHarness(playTimeline, { frames = true, isCurrentMount = () => true } = {})
{
    const paints = [];
    const scheduledFrames = [];
    const cancelledFrames = [];
    const timers = [];
    const cancelledTimers = [];
    const failures = [];
    const playback = CreateCombatPlayback({
        playTimeline,
        isCurrentMount,
        requestFrame: frames && (callback => scheduledFrames.push(callback)),
        cancelFrame: id => cancelledFrames.push(id),
        setTimer: (callback, delay) => timers.push({ callback, delay }),
        clearTimer: id => cancelledTimers.push(id),
        renderBeat: flags => paints.push(flags),
        reportStartFailure: error => failures.push(error),
    });
    return { playback, paints, scheduledFrames, cancelledFrames, timers, cancelledTimers, failures };
}

test('playback repaints once per frame, carries hand dirtiness into geometry, and discards pending work', () =>
{
    const { playback, paints, scheduledFrames, cancelledFrames } = playbackHarness();
    playback.QueueBeatRender({ geometry: false, hand: false });
    playback.QueueBeatRender({ geometry: false, hand: true });
    assert.equal(scheduledFrames.length, 1);
    assert.deepEqual(paints, []);
    scheduledFrames[0]();
    assert.deepEqual(paints, [{ geometry: false, hand: true }]);

    playback.QueueBeatRender({ geometry: false, hand: true });
    playback.QueueBeatRender({ geometry: true, hand: false });
    assert.deepEqual(paints[1], { geometry: true, hand: true });
    scheduledFrames[1]();
    playback.QueueBeatRender({ geometry: false, hand: false });
    playback.DiscardBeatRender();
    scheduledFrames[2]();
    assert.equal(paints.length, 2);
    assert.deepEqual(cancelledFrames, [1, 2, 3]);

    const immediate = playbackHarness(null, { frames: false });
    immediate.playback.QueueBeatRender({ geometry: false, hand: true });
    assert.deepEqual(immediate.paints, [{ geometry: false, hand: true }]);
});

test('synchronous completion may start a second timeline before the first handle returns', () =>
{
    const trace = [];
    let firstDone, secondContext, secondDone;
    const { playback, failures } = playbackHarness(([event], ctx, done) =>
    {
        if (event === 'first')
        {
            firstDone = done;
            done();
            return { cancel: () => trace.push('unexpected first cancel') };
        }
        secondContext = ctx;
        secondDone = done;
        return { cancel: () => { trace.push('second cancel'); ctx.onFlush(); done(); } };
    });
    playback.Start(['first'], {}, () =>
    {
        trace.push('first finish');
        playback.Start(['second'], {
            onFlush: () => trace.push('second flush'),
            onBeatApplied: () => trace.push('second beat'),
        }, () => trace.push('second finish'));
    });
    firstDone();
    secondContext.onBeatApplied();
    playback.Dispose();
    playback.Dispose();
    secondContext.onBeatApplied();
    secondDone();
    assert.deepEqual(trace, ['first finish', 'second beat', 'second cancel']);
    assert.deepEqual(failures, []);
});

test('detach during startup cancels the returned handle and releases its queued repaint', () =>
{
    const trace = [];
    const { playback, scheduledFrames, cancelledFrames, paints } = playbackHarness((events, ctx, done) =>
    {
        playback.QueueBeatRender({ geometry: false, hand: true });
        playback.Dispose();
        return { cancel: () => { trace.push('cancel'); ctx.onFlush(); done(); } };
    });
    playback.Start([], { onFlush: () => trace.push('flush') }, () => trace.push('finish'));
    scheduledFrames[0]();
    assert.deepEqual(cancelledFrames, [1]);
    assert.deepEqual(paints, []);
    assert.deepEqual(trace, ['cancel']);
});

test('completing one live timeline leaves its overlapping peer owned until detach', () =>
{
    const trace = [];
    const timelines = [];
    const { playback } = playbackHarness(([name], ctx, done) =>
    {
        timelines.push({ ctx, done });
        return { cancel: () => { trace.push(`cancel ${name}`); ctx.onFlush(); done(); } };
    });
    playback.Start(['first'], { onFlush: () => trace.push('flush first') }, () => trace.push('finish first'));
    playback.Start(['second'], { onFlush: () => trace.push('flush second') }, () => trace.push('finish second'));
    timelines[0].ctx.onFlush();
    timelines[0].done();
    timelines[0].done();
    playback.Dispose();
    timelines[1].ctx.onFlush();
    timelines[1].done();
    assert.deepEqual(trace, ['flush first', 'finish first', 'cancel second']);
});

test('start failure reports the error and completes the attached screen once', () =>
{
    const failure = new Error('timeline setup failed');
    const { playback, failures } = playbackHarness(() => { throw failure; });
    let finished = 0;
    playback.Start([], {}, () => finished++);
    playback.Dispose();
    assert.deepEqual(failures, [failure]);
    assert.equal(finished, 1);
});

test('the combat screen hands off a terminal result once and only while it owns the mount', () =>
{
    const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
    const start = source.indexOf('    const finishPlayback = () => {');
    const end = source.indexOf('    playback.Start(', start);
    assert.ok(start >= 0 && end > start);
    const screenFinish = source.slice(start, end);
    const finishFromScreen = new Function('scope', `
        const { playback, combatEl, combat, playQueue, targetHud, onEnd, COMBAT_TIMING } = scope;
        let disp, heldTurnHand, enemyPlayback, endTurnAfterQueue, fightOver;
        const menuBtn = null;
        const keyHandler = () => {};
        const handStrip = { teardown() {} };
        const applyVisualEvents = () => {}, setBusy = () => {}, finishRender = () => {};
        const showPendingDiscard = () => {}, renderPlayQueue = () => {}, closeQuickNav = () => {};
        const removeEventListener = () => {}, releaseRangeAction = () => {};
        const events = [];
        ${screenFinish}
        return finishPlayback;
    `);

    for (const exit of ['attached', 'replaced before observer', 'disposed'])
    {
        const combatEl = { isConnected: true, dataset: { targetHud: 'core' } };
        let current = combatEl;
        const app = { querySelector: () => current };
        const combat = { result: 'victory' };
        const calls = [];
        const playQueue = ['queued card'];
        const delay = 210;
        let finishTimeline;
        const { playback, timers, cancelledTimers } = playbackHarness((events, ctx, done) =>
        {
            finishTimeline = done;
            return {};
        }, { isCurrentMount: () => IsCurrentCombatMount(app, combatEl) });
        const finish = finishFromScreen({
            playback, combatEl, combat, playQueue, COMBAT_TIMING: { fightEndDelayMs: delay },
            targetHud: { release: () => { delete combatEl.dataset.targetHud; } },
            onEnd: (...args) => calls.push(args),
        });
        playback.Start([], {}, finish);
        finishTimeline();
        finishTimeline();
        assert.deepEqual(playQueue, []);
        assert.equal(combatEl.dataset.targetHud, 'core');
        assert.equal(timers.length, 1);
        assert.equal(timers[0].delay, delay);
        assert.deepEqual(calls, []);

        if (exit === 'replaced before observer') current = { isConnected: true };
        if (exit === 'disposed') playback.Dispose();
        timers[0].callback();
        timers[0].callback();
        assert.deepEqual(calls, exit === 'attached' ? [['victory', combat]] : [], exit);
        assert.deepEqual(cancelledTimers, exit === 'disposed' ? [1] : [], exit);
    }
});
