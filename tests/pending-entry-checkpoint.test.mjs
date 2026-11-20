import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateEntryCheckpoint } from '../src/services/entryCheckpoint.js';

function harness()
{
    let run, nextTimer = 0;
    const notices = [], timers = new Map(), frames = [], cleared = [];
    const owner = CreateEntryCheckpoint({
        getRun: () => run,
        reportFailure: error => notices.push(error.message),
        clearTimer: id => cleared.push(id),
        setTimer(callback, delay)
        {
            const id = ++nextTimer;
            timers.set(id, { callback, delay });
            return id;
        },
        requestFrame: callback => frames.push(callback),
    });
    return { owner, notices, timers, frames, cleared, setRun: value => { run = value; } };
}

function queue(h, durable)
{
    const run = { combatEntered: { nodeId: 'n1', encounterId: 'e1', snapshot: null } };
    const combat = { rng: 'live', result: null };
    h.setRun(run);
    h.owner.Queue({ run, combat, durable, checkpointRng: 'entry', nodeId: 'n1', encounterId: 'e1' });
    return { run, combat };
}

test('paint and the 500 ms fallback share one entry with frozen RNG', () =>
{
    const h = harness(), seen = [];
    const { combat } = queue(h, candidate =>
    {
        seen.push(candidate.rng);
        return { ok: true, durable: false };
    });
    h.owner.Schedule();
    assert.equal(h.timers.get(1).delay, 500);
    assert.equal(h.frames.length, 1);
    h.frames[0]();
    assert.equal(h.timers.get(2).delay, 0);
    h.timers.get(2).callback();
    h.timers.get(1).callback();
    assert.deepEqual(seen, ['entry']);
    assert.deepEqual(h.cleared, [1]);
    assert.equal(combat.rng, 'live');
    assert.equal(h.owner.Flush(), false, 'a nonthrowing non-durable result consumes the entry');
});

test('a failed flush restores RNG and retries before the next write', () =>
{
    const h = harness(), seen = [];
    let fail = true;
    const { combat } = queue(h, candidate =>
    {
        if (fail)
        {
            throw new Error('quota');
        }
        seen.push(candidate.rng);
    });
    h.owner.Schedule();
    h.timers.get(1).callback();
    assert.deepEqual(h.notices, ['quota']);
    assert.equal(combat.rng, 'live');
    assert.throws(() => h.owner.Flush(), /quota/);
    fail = false;
    assert.equal(h.owner.Flush(), true);
    assert.deepEqual(seen, ['entry']);
    assert.equal(combat.rng, 'live');
});

test('an older throw and its callbacks cannot overwrite or flush a replacement', () =>
{
    const h = harness(), seen = [];
    const first = queue(h, () =>
    {
        queue(h, candidate => seen.push(candidate.rng));
        throw new Error('old entry failed');
    });
    h.owner.Schedule();
    assert.throws(() => h.owner.Flush(), /old entry failed/);
    assert.equal(first.combat.rng, 'live');
    h.frames[0]();
    h.timers.get(1).callback();
    h.timers.get(2).callback();
    assert.deepEqual(seen, []);
    assert.equal(h.owner.Flush(), true);
    assert.deepEqual(seen, ['entry']);
});

test('a different run at the same encounter, a changed fight, and explicit save discard the entry', () =>
{
    const h = harness();
    for (const change of [
        ({ run }) => h.setRun(structuredClone(run)),
        ({ run }) => { run.combatEntered.snapshot = {}; },
        ({ run }) => { run.combatEntered.nodeId = 'other'; },
        ({ run }) => { run.combatEntered.encounterId = 'other'; },
        ({ combat }) => { combat.result = 'victory'; },
        () => h.owner.Supersede(),
    ])
    {
        change(queue(h, () => assert.fail('stale entry must not write')));
        assert.equal(h.owner.Flush(), false);
    }
});
