import assert from 'node:assert/strict';
import test from 'node:test';
import { SEED_KEY } from '../src/model/settingsDefaults.js';
import { CreateSettingsDraftModel, CommitNumberRow } from '../src/ui/models/SettingsDraftModel.js';
import { SETTINGS_ROWS } from '../src/ui/models/SettingsRowsModel.js';
import { allResettableKeys } from '../src/ui/screens/settings.js';

const musicPromotion = { promoted: { musicVolume: 40 } };

function recordWrites(complete = () => ({ ok: true }))
{
    const writes = [];
    return {
        writes,
        save(changes)
        {
            writes.push(structuredClone(changes));
            return complete(writes.length);
        },
    };
}

test('Undo survives reopening the same profile and only restores the seed ownership the reset moved', async () =>
{
    const draft = CreateSettingsDraftModel({ now: () => 100 });
    const settings = { musicVolume: 68, sfxVolume: 30, [SEED_KEY]: { sfxVolume: 30 } };
    const { save, writes } = recordWrites();
    const snapshot = draft.ResetKeys(settings, save, ['musicVolume'], 'Music reset', musicPromotion);
    assert.deepEqual(snapshot, { musicVolume: 68 }, 'a synchronous save returns a synchronous snapshot');
    assert.deepEqual(writes, [{ musicVolume: 40, [SEED_KEY]: { sfxVolume: 30, musicVolume: 40 } }]);

    const reopened = structuredClone(settings);
    reopened.sfxVolume = 90;
    delete reopened[SEED_KEY].sfxVolume;
    const offer = draft.PendingUndo();
    assert.equal(offer.label, 'Music reset');
    assert.equal(offer.until, 8100);
    assert.deepEqual(await draft.Undo(reopened, save, offer), { accepted: true, saved: true });
    assert.deepEqual(reopened, { musicVolume: 68, sfxVolume: 90, [SEED_KEY]: {} });
    assert.deepEqual(writes[1], { musicVolume: 68, [SEED_KEY]: {} });
    assert.equal(settings.musicVolume, 40, 'Undo changes the reopened settings object');
    assert.equal(draft.PendingUndo(), null);
});

test('a reset that only transfers promotion ownership remains undoable', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 40 };
    const { save, writes } = recordWrites();
    draft.ResetKeys(settings, save, ['musicVolume'], 'Follow promoted music', musicPromotion);
    assert.deepEqual(settings, { musicVolume: 40, [SEED_KEY]: { musicVolume: 40 } });
    await draft.Undo(settings, save, draft.PendingUndo());
    assert.deepEqual(settings, { musicVolume: 40, [SEED_KEY]: {} });
    assert.deepEqual(writes[1], { [SEED_KEY]: {} });
});

test('the configured Undo window is the default and tests may still override it', () =>
{
    const configured = CreateSettingsDraftModel({ now: () => 100 });
    configured.OfferUndo('Configured', { musicVolume: 68 });
    assert.equal(configured.PendingUndo().until, 8100);

    const overridden = CreateSettingsDraftModel({ undoMs: 2500, now: () => 100 });
    overridden.OfferUndo('Test override', { musicVolume: 68 });
    assert.equal(overridden.PendingUndo().until, 2600);
});

test('an expired captured Undo cannot apply before the display timer or next paint runs', async () =>
{
    let now = 100;
    const draft = CreateSettingsDraftModel({ now: () => now });
    const settings = { musicVolume: 40 };
    draft.OfferUndo('Music reset', { musicVolume: 68 });
    const captured = draft.PendingUndo();
    now = captured.until + 1;
    const { save, writes } = recordWrites();
    assert.deepEqual(await draft.Undo(settings, save, captured), { accepted: false, saved: false });
    assert.deepEqual(settings, { musicVolume: 40 });
    assert.deepEqual(writes, []);
    assert.equal(draft.PendingUndo(), null);
});

test('profile replacement invalidates a captured Undo even when the settings object is reused', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 40 };
    draft.OfferUndo('Old music reset', { musicVolume: 68 });
    const captured = draft.PendingUndo();
    draft.DropUndoOffer();
    settings.musicVolume = 81;
    draft.OfferUndo('New profile music reset', { musicVolume: 91 });
    const { save, writes } = recordWrites();

    assert.deepEqual(await draft.Undo(settings, save, captured), { accepted: false, saved: false });
    assert.deepEqual(settings, { musicVolume: 81 });
    assert.deepEqual(writes, []);
    const replacement = draft.PendingUndo();
    assert.equal(replacement.label, 'New profile music reset');
    assert.deepEqual(await draft.Undo(settings, save, replacement), { accepted: true, saved: true });
    assert.deepEqual(settings, { musicVolume: 91 });
    assert.deepEqual(writes, [{ musicVolume: 91 }]);
});

for (const [style, refuse] of [
    ['synchronous refusal', () => ({ ok: false })],
    ['synchronous exception', () => { throw new Error('storage interrupted'); }],
    ['asynchronous rejection', () => Promise.reject(new Error('storage interrupted'))],
])
{
    test(`${style} rolls back Reset and Undo through one bounded compensating write`, async () =>
    {
        const draft = CreateSettingsDraftModel();
        const previous = { musicVolume: 68, [SEED_KEY]: { sfxVolume: 30 } };
        const settings = structuredClone(previous);
        const reset = recordWrites(count => count === 1 ? refuse() : { ok: true });

        const snapshot = await draft.ResetKeys(settings, reset.save, ['musicVolume'], 'Music reset', musicPromotion);
        assert.deepEqual(snapshot, { musicVolume: 68 });
        assert.deepEqual(settings, previous);
        assert.deepEqual(reset.writes, [
            { musicVolume: 40, [SEED_KEY]: { sfxVolume: 30, musicVolume: 40 } },
            previous,
        ]);
        assert.equal(draft.PendingUndo(), null);

        draft.ResetKeys(settings, () => ({ ok: true }), ['musicVolume'], 'Music reset', musicPromotion);
        const afterReset = structuredClone(settings);
        const offer = draft.PendingUndo();
        const undo = recordWrites(count => count === 1 ? refuse() : { ok: true });
        assert.deepEqual(await draft.Undo(settings, undo.save, offer), { accepted: true, saved: false });
        assert.deepEqual(settings, afterReset);
        assert.deepEqual(undo.writes, [previous, afterReset]);
        assert.equal(draft.PendingUndo()?.label, 'Music reset', 'the still-current offer can be retried');
        assert.deepEqual(await draft.Undo(settings, undo.save, draft.PendingUndo()), { accepted: true, saved: true });
        assert.deepEqual(settings, previous);
        assert.equal(draft.PendingUndo(), null);
    });
}

for (const replace of [false, true])
{
    const profile = replace ? 'replacement profile' : 'same profile';
    test(`an older successful Reset cannot replace a newer Undo offer in the ${profile}`, async () =>
    {
        const draft = CreateSettingsDraftModel();
        const settings = { musicVolume: 68, sfxVolume: 30 };
        const completion = Promise.withResolvers();
        const { save, writes } = recordWrites(() => completion.promise);
        const pending = draft.ResetKeys(settings, save, ['musicVolume'], 'Old music reset', musicPromotion);
        assert.equal(draft.PendingUndo(), null, 'the pending reset has not been saved');
        if (replace)
        {
            draft.DropUndoOffer();
            settings.musicVolume = 81;
        }
        draft.OfferUndo('New effects reset', { sfxVolume: 70 });
        completion.resolve({ ok: true });

        assert.deepEqual(await pending, { musicVolume: 68 });
        assert.equal(writes.length, 1);
        assert.equal(settings.musicVolume, replace ? 81 : 40);
        assert.equal(draft.PendingUndo()?.label, 'New effects reset');
    });

    test(`a failed older Undo preserves the successor offer in the ${profile}`, async () =>
    {
        const draft = CreateSettingsDraftModel();
        const settings = { musicVolume: 40, sfxVolume: 30 };
        draft.OfferUndo('Old music reset', { musicVolume: 68 });
        const completion = Promise.withResolvers();
        const { save, writes } = recordWrites(count => count === 1 ? completion.promise : { ok: true });
        const pending = draft.Undo(settings, save, draft.PendingUndo());
        assert.equal(settings.musicVolume, 68);
        if (replace)
        {
            draft.DropUndoOffer();
            settings.musicVolume = 81;
        }
        draft.OfferUndo('New effects reset', { sfxVolume: 70 });
        completion.resolve({ ok: false });

        assert.deepEqual(await pending, { accepted: true, saved: false });
        assert.equal(settings.musicVolume, replace ? 81 : 40);
        assert.deepEqual(writes, replace ? [{ musicVolume: 68 }] : [
            { musicVolume: 68 },
            { musicVolume: 40, [SEED_KEY]: undefined },
        ]);
        assert.equal(draft.PendingUndo()?.label, 'New effects reset');
    });
}

for (const [order, effectsSaved] of [
    [['music', 'effects'], true],
    [['effects', 'music'], true],
    [['music', 'effects'], false],
])
{
    test(`overlapping Resets settled ${order.join(' then ')} retain the latest successful offer (Effects saved: ${effectsSaved})`, async () =>
    {
        const draft = CreateSettingsDraftModel();
        const settings = { musicVolume: 68, sfxVolume: 77 };
        const music = Promise.withResolvers();
        const effects = Promise.withResolvers();
        const musicPending = draft.ResetKeys(settings, () => music.promise, ['musicVolume'], 'Music reset', musicPromotion);
        const effectsWrite = recordWrites(count => count === 1 ? effects.promise : { ok: true });
        const effectsPending = draft.ResetKeys(settings, effectsWrite.save, ['sfxVolume'], 'Effects reset', { promoted: { sfxVolume: 30 } });
        assert.equal(draft.PendingUndo(), null);
        const settles = {
            music: async () => { music.resolve({ ok: true }); await musicPending; },
            effects: async () => { effects.resolve({ ok: effectsSaved }); await effectsPending; },
        };
        for (const key of order) await settles[key]();

        assert.equal(draft.PendingUndo()?.label, effectsSaved ? 'Effects reset' : 'Music reset');
        assert.deepEqual(settings, {
            musicVolume: 40, sfxVolume: effectsSaved ? 30 : 77,
            [SEED_KEY]: effectsSaved ? { musicVolume: 40, sfxVolume: 30 } : { musicVolume: 40 },
        });
    });
}

test('failed Undo restores its seed entry without taking ownership from a newer Effects reset', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 68, sfxVolume: 77 };
    draft.ResetKeys(settings, () => ({ ok: true }), ['musicVolume'], 'Music reset', musicPromotion);
    const refusal = Promise.withResolvers();
    const { save, writes } = recordWrites(count => count === 1 ? refusal.promise : { ok: true });
    const pending = draft.Undo(settings, save, draft.PendingUndo());
    assert.deepEqual(settings, { musicVolume: 68, sfxVolume: 77, [SEED_KEY]: {} });

    draft.ResetKeys(settings, () => ({ ok: true }), ['sfxVolume'], 'Effects reset', { promoted: { sfxVolume: 30 } });
    const successor = draft.PendingUndo();
    assert.equal(successor?.label, 'Effects reset');
    refusal.resolve({ ok: false });

    assert.deepEqual(await pending, { accepted: true, saved: false });
    const seed = { sfxVolume: 30, musicVolume: 40 };
    assert.deepEqual(settings, { musicVolume: 40, sfxVolume: 30, [SEED_KEY]: seed });
    assert.deepEqual(writes, [
        { musicVolume: 68, [SEED_KEY]: {} },
        { musicVolume: 40, [SEED_KEY]: seed },
    ]);
    assert.equal(draft.PendingUndo(), successor);
});

test('failed Reset removes its seed entry without taking ownership from a newer Effects reset', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 68, sfxVolume: 77 };
    const refusal = Promise.withResolvers();
    const { save, writes } = recordWrites(count => count === 1 ? refusal.promise : { ok: true });
    const pending = draft.ResetKeys(settings, save, ['musicVolume'], 'Music reset', musicPromotion);
    assert.deepEqual(settings, { musicVolume: 40, sfxVolume: 77, [SEED_KEY]: { musicVolume: 40 } });

    draft.ResetKeys(settings, () => ({ ok: true }), ['sfxVolume'], 'Effects reset', { promoted: { sfxVolume: 30 } });
    const successor = draft.PendingUndo();
    assert.equal(successor?.label, 'Effects reset');
    refusal.resolve({ ok: false });

    assert.deepEqual(await pending, { musicVolume: 68 });
    const seed = { sfxVolume: 30 };
    assert.deepEqual(settings, { musicVolume: 68, sfxVolume: 30, [SEED_KEY]: seed });
    assert.deepEqual(writes, [
        { musicVolume: 40, [SEED_KEY]: { musicVolume: 40 } },
        { musicVolume: 68, [SEED_KEY]: seed },
    ]);
    assert.equal(draft.PendingUndo(), successor);
});

test('an absent Undo cannot save or invalidate a pending reset', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 68 };
    const completion = Promise.withResolvers();
    const { save, writes } = recordWrites(() => completion.promise);
    const pending = draft.ResetKeys(settings, save, ['musicVolume'], 'Music reset', musicPromotion);
    assert.equal(draft.ExpireUndoOffer(null), false);
    assert.deepEqual(await draft.Undo(settings, save, draft.PendingUndo()), { accepted: false, saved: false });
    assert.equal(writes.length, 1);
    completion.resolve({ ok: true });
    await pending;
    assert.equal(draft.PendingUndo()?.label, 'Music reset');
});

test('expiry of a previous offer does not supersede a pending successful reset', async () =>
{
    let now = 100;
    const draft = CreateSettingsDraftModel({ now: () => now });
    const settings = { musicVolume: 68 };
    draft.OfferUndo('Previous effects reset', { sfxVolume: 70 });
    const previous = draft.PendingUndo();
    now = previous.until - 1;
    const completion = Promise.withResolvers();
    const pending = draft.ResetKeys(settings, () => completion.promise, ['musicVolume'], 'Music reset', musicPromotion);
    now = previous.until + 1;
    assert.equal(draft.ExpireUndoOffer(previous), true);
    assert.equal(draft.PendingUndo(), null);
    completion.resolve({ ok: true });
    await pending;
    assert.equal(draft.PendingUndo()?.label, 'Music reset');
    assert.equal(draft.ExpireUndoOffer(previous), false, 'a late timer cannot clear the new offer');
});

test('failed Undo settles after async compensation and keeps a successor offered during that write', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 40, sfxVolume: 30 };
    draft.OfferUndo('Music reset', { musicVolume: 68 });
    const rollback = Promise.withResolvers();
    const { save, writes } = recordWrites(count => count === 1 ? { ok: false } : rollback.promise);
    let settled = false;
    const pending = Promise.resolve(draft.Undo(settings, save, draft.PendingUndo())).then(result =>
    {
        settled = true;
        return result;
    });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(draft.PendingUndo(), null);
    assert.equal(settings.musicVolume, 40);
    assert.deepEqual(writes, [
        { musicVolume: 68 },
        { musicVolume: 40, [SEED_KEY]: undefined },
    ]);

    draft.OfferUndo('New effects reset', { sfxVolume: 70 });
    rollback.reject(new Error('compensating write failed'));
    assert.deepEqual(await pending, { accepted: true, saved: false });
    assert.equal(writes.length, 2, 'failed compensation does not retry again');
    assert.equal(draft.PendingUndo()?.label, 'New effects reset');
});

test('a Reset rejected after replacement does not apply an old rollback to the new profile', async () =>
{
    const draft = CreateSettingsDraftModel();
    const settings = { musicVolume: 68, [SEED_KEY]: { sfxVolume: 30 } };
    const completion = Promise.withResolvers();
    const { save, writes } = recordWrites(count => count === 1 ? completion.promise : { ok: true });
    const pending = draft.ResetKeys(settings, save, ['musicVolume'], 'Old reset', musicPromotion);
    draft.DropUndoOffer();
    settings.musicVolume = 81;
    settings[SEED_KEY] = { musicVolume: 81 };
    completion.reject(new Error('old write interrupted'));
    await pending;
    assert.deepEqual(settings, { musicVolume: 81, [SEED_KEY]: { musicVolume: 81 } });
    assert.equal(writes.length, 1);
    assert.equal(draft.PendingUndo(), null);
});

test('resetting one pacing row clears its preset in the same write, and a grouped reset owns the preset explicitly', async () =>
{
    const draft = CreateSettingsDraftModel();
    const initial = { combatStepPause: 250, animationStepDuration: 325, combatPacingPreset: 'mobile-fast' };
    const settings = { ...initial };
    const { save, writes } = recordWrites();
    draft.ResetKeys(settings, save, ['combatStepPause'], 'Pacing row reset', { promoted: {} });
    assert.deepEqual(writes[0], { combatStepPause: undefined, combatPacingPreset: 'custom' });
    assert.deepEqual(settings, { animationStepDuration: 325, combatPacingPreset: 'custom' });
    await draft.Undo(settings, save, draft.PendingUndo());
    assert.deepEqual(settings, initial);

    draft.ResetKeys(settings, save, Object.keys(initial), 'Pacing group reset', { promoted: {} });
    assert.deepEqual(writes[2], { combatStepPause: undefined, animationStepDuration: undefined, combatPacingPreset: undefined });
    assert.deepEqual(settings, {});
    await draft.Undo(settings, save, draft.PendingUndo());
    assert.deepEqual(settings, initial);
});

test('Reset all and Undo apply real row, hidden and retired keys while leaving unrelated settings alone', async () =>
{
    const draft = CreateSettingsDraftModel();
    const initial = {
        reduceFlashes: true,
        'gameConfig.presentation.showFormationGrid': false,
        'recovery.hp.afterCombat': 50,
        prologueSeen: true,
    };
    const settings = { ...initial };
    const { save, writes } = recordWrites();
    draft.ResetKeys(settings, save, allResettableKeys(settings), 'All settings reset', { promoted: {} });
    assert.deepEqual(settings, { prologueSeen: true });
    assert.equal(writes.length, 1);
    assert.ok(!Object.hasOwn(writes[0], 'prologueSeen'));
    await draft.Undo(settings, save, draft.PendingUndo());
    assert.deepEqual(settings, initial);
    assert.equal(writes.length, 2);
});

test('typed numeric settings use real row defaults, fraction precision, and refusal bounds', () =>
{
    const speed = SETTINGS_ROWS.find(row => row.key === 'combatSpeed');
    const pause = SETTINGS_ROWS.find(row => row.key === 'combatStepPause');
    for (const raw of ['', 'unreadable'])
    {
        assert.deepEqual(CommitNumberRow({}, speed, raw), { value: speed.def, refusal: null });
    }
    assert.deepEqual(CommitNumberRow({}, speed, '1.25'), { value: 1.25, refusal: null });
    assert.deepEqual(CommitNumberRow({}, pause, '250.8'), { value: 250, refusal: null });
    const above = speed.max + 1;
    const clamped = CommitNumberRow({}, speed, String(above));
    assert.equal(clamped.value, speed.max);
    assert.ok(clamped.refusal.includes(`${above}`) && clamped.refusal.includes(`${speed.min}–${speed.max}`));
    assert.ok(clamped.refusal.includes(`The value in use is ${speed.max}`));
});
