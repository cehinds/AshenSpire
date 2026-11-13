import { SEED_KEY, sameSetting } from '../../model/settingsDefaults.js';
import { uiConfig } from '../../config/generated/ui.js';
import { normalizeTunedNumber } from './CardSizeModel.js';

/** Create the shared settings draft owner for reset, undo, and number commits. */
export function CreateSettingsDraftModel(
    { undoMs = uiConfig.presentation.settingsUndo.behavior.windowMs, now = () => Date.now() } = {},
)
{
    let undoOffer = null;
    let profileGeneration = 0;
    // A later-started successful reset can replace an earlier offer. Expiry alone does not supersede it.
    let operationOrder = 0;
    let latestOfferOrder = 0;

    function publishUndo(label, snapshot, seed, order)
    {
        const hasSeed = seed && Object.keys(seed).length > 0;
        if ((!snapshot || !Object.keys(snapshot).length) && !hasSeed)
        {
            return;
        }
        if (order < latestOfferOrder)
        {
            return;
        }
        undoOffer = {
            label,
            snapshot: snapshot || {},
            seed: hasSeed ? seed : null,
            generation: profileGeneration,
            until: now() + undoMs,
        };
        latestOfferOrder = order;
    }

    function offerUndo(label, snapshot, seed = null)
    {
        publishUndo(label, snapshot, seed, ++operationOrder);
    }

    function pendingUndo(at = now())
    {
        if (undoOffer && (at > undoOffer.until || undoOffer.generation !== profileGeneration))
        {
            undoOffer = null;
        }
        return undoOffer;
    }

    function expireUndoOffer(offer)
    {
        if (!offer || undoOffer !== offer)
        {
            return false;
        }
        undoOffer = null;
        return true;
    }

    function dropUndoOffer()
    {
        profileGeneration += 1;
        undoOffer = null;
        latestOfferOrder = ++operationOrder;
    }

    function resetKeys(settings, onChange, keys, label = 'Reset', { promoted = {} } = {})
    {
        const generation = profileGeneration;
        const order = ++operationOrder;
        const snapshot = {};
        const changed = {};
        const seedBefore = settings[SEED_KEY];
        for (const key of keys)
        {
            snapshot[key] = settings[key];
            if (Object.hasOwn(promoted, key))
            {
                settings[key] = promoted[key];
                changed[key] = promoted[key];
            }
            else
            {
                delete settings[key];
                changed[key] = undefined;
            }
        }
        if (
            !keys.includes('combatPacingPreset')
            && keys.some(key => ['combatStepPause', 'animationStepDuration'].includes(key))
        )
        {
            snapshot.combatPacingPreset = settings.combatPacingPreset;
            settings.combatPacingPreset = 'custom';
            changed.combatPacingPreset = 'custom';
        }
        const snapshotKeys = Object.keys(snapshot);
        const moved = snapshotKeys.filter(key => snapshot[key] !== changed[key]);
        const back = keys.filter(key => Object.hasOwn(promoted, key));
        if (back.length)
        {
            const record = settings[SEED_KEY] && typeof settings[SEED_KEY] === 'object'
                ? settings[SEED_KEY]
                : {};
            const next = { ...record };
            for (const key of back)
            {
                next[key] = promoted[key];
            }
            for (const key of keys)
            {
                if (!Object.hasOwn(promoted, key))
                {
                    delete next[key];
                }
            }
            settings[SEED_KEY] = next;
            changed[SEED_KEY] = next;
        }

        const rollback = () =>
        {
            const backChanges = {};
            for (const [key, value] of Object.entries(snapshot))
            {
                backChanges[key] = value;
                if (value === undefined)
                {
                    delete settings[key];
                }
                else
                {
                    settings[key] = value;
                }
            }
            const currentSeed = settings[SEED_KEY];
            const restoredSeed = mergeSeedOwnership(currentSeed, seedBefore, snapshotKeys);
            if (
                Object.hasOwn(changed, SEED_KEY)
                || Object.keys(BuildSeedPatch(currentSeed, restoredSeed)).length
            )
            {
                backChanges[SEED_KEY] = restoredSeed;
                if (restoredSeed === undefined)
                {
                    delete settings[SEED_KEY];
                }
                else
                {
                    settings[SEED_KEY] = restoredSeed;
                }
            }
            try
            {
                const result = onChange(backChanges);
                if (result && typeof result.then === 'function')
                {
                    result.catch(() =>
                    {});
                }
            }
            catch
            {
                // The rollback write is the single bounded retry at the save boundary.
            }
        };

        const settle = result =>
        {
            if (profileGeneration !== generation)
            {
                return snapshot;
            }
            if (result?.ok === false)
            {
                rollback();
                return snapshot;
            }
            const undo = Object.fromEntries(moved.map(key => [key, snapshot[key]]));
            const seed = Object.hasOwn(changed, SEED_KEY)
                ? BuildSeedPatch(seedBefore, changed[SEED_KEY])
                : null;
            publishUndo(label, undo, seed, order);
            return snapshot;
        };

        let result;
        try
        {
            result = onChange(changed);
        }
        catch
        {
            return settle({ ok: false });
        }
        return result && typeof result.then === 'function'
            ? result.then(settle, () => settle({ ok: false }))
            : settle(result);
    }

    function undo(settings, onChange, offer)
    {
        if (!offer || pendingUndo() !== offer)
        {
            return { accepted: false, saved: false };
        }
        const generation = profileGeneration;
        const activationOrder = ++operationOrder;
        latestOfferOrder = activationOrder;
        undoOffer = null;
        const restore = {};
        const current = { [SEED_KEY]: settings[SEED_KEY] };
        for (const [key, value] of Object.entries(offer.snapshot))
        {
            current[key] = settings[key];
            if (value === undefined)
            {
                delete settings[key];
            }
            else
            {
                settings[key] = value;
            }
            restore[key] = value;
        }
        if (offer.seed)
        {
            restore[SEED_KEY] = ApplySeedPatch(current[SEED_KEY], offer.seed);
            settings[SEED_KEY] = restore[SEED_KEY];
        }

        const settle = result =>
        {
            if (profileGeneration !== generation)
            {
                return { accepted: true, saved: result?.ok !== false };
            }
            if (result?.ok !== false)
            {
                return { accepted: true, saved: true };
            }
            for (const [key, value] of Object.entries(current))
            {
                if (key === SEED_KEY)
                {
                    continue;
                }
                if (value === undefined)
                {
                    delete settings[key];
                }
                else
                {
                    settings[key] = value;
                }
            }
            const touchedSeedKeys = new Set([
                ...Object.keys(offer.snapshot).filter(key => key !== SEED_KEY),
                ...Object.keys(offer.seed || {}),
            ]);
            const restoredSeed = mergeSeedOwnership(
                settings[SEED_KEY],
                current[SEED_KEY],
                touchedSeedKeys,
            );
            const compensation = { ...current, [SEED_KEY]: restoredSeed };
            if (restoredSeed === undefined)
            {
                delete settings[SEED_KEY];
            }
            else
            {
                settings[SEED_KEY] = restoredSeed;
            }
            const finishRollback = () =>
            {
                if (
                    profileGeneration === generation && !undoOffer
                    && latestOfferOrder === activationOrder
                )
                {
                    undoOffer = offer;
                }
                return { accepted: true, saved: false };
            };
            try
            {
                const rollback = onChange(compensation);
                return rollback && typeof rollback.then === 'function'
                    ? rollback.then(finishRollback, finishRollback)
                    : finishRollback();
            }
            catch
            {
                // The rollback write is the single bounded retry at the save boundary.
                return finishRollback();
            }
        };

        let result;
        try
        {
            result = onChange(restore);
        }
        catch
        {
            return settle({ ok: false });
        }
        return result && typeof result.then === 'function'
            ? result.then(settle, () => settle({ ok: false }))
            : settle(result);
    }

    return Object.freeze({
        OfferUndo: offerUndo,
        PendingUndo: pendingUndo,
        ExpireUndoOffer: expireUndoOffer,
        DropUndoOffer: dropUndoOffer,
        ResetKeys: resetKeys,
        Undo: undo,
    });
}

function mergeSeedOwnership(current, before, keys)
{
    const next = { ...(current && typeof current === 'object' ? current : {}) };
    const previous = before && typeof before === 'object' ? before : {};
    for (const key of keys)
    {
        if (Object.hasOwn(previous, key))
        {
            next[key] = previous[key];
        }
        else
        {
            delete next[key];
        }
    }
    return Object.keys(BuildSeedPatch(before, next)).length ? next : before;
}

/** Return the row's normalized number using its existing metadata and bounds. */
export function ResolveNumberRow(settings, row)
{
    if (!row)
    {
        throw new Error('resolveNumberRow: no row');
    }
    const fallback = row.defaultFor ? row.defaultFor(settings) : row.def;
    const raw = (settings || {})[row.key];
    if (row.integer !== false)
    {
        return normalizeTunedNumber(raw, { min: row.min, max: row.max, def: Number(fallback) });
    }
    const numeric = raw === '' || raw === null || raw === undefined
        ? Number(fallback)
        : Number(raw);
    if (!Number.isFinite(numeric))
    {
        return Number(fallback);
    }
    const clamped = Math.min(row.max, Math.max(row.min, numeric));
    const step = Number(row.step) || 0.01;
    const precision = Math.max(0, String(step).split('.')[1]?.length || 0);
    return Number(clamped.toFixed(precision));
}

/** Describe a refused typed value using the actual settings row's domain. */
export function TypedNumberRefusal(row, raw)
{
    if (!row || row.type !== 'number')
    {
        return null;
    }
    const text = String(raw ?? '').trim();
    if (text === '')
    {
        return null;
    }
    const typed = Number(text);
    if (!Number.isFinite(typed))
    {
        return null;
    }
    const wanted = row.integer !== false ? Math.floor(typed) : typed;
    if (wanted >= row.min && wanted <= row.max)
    {
        return null;
    }
    const used = ResolveNumberRow({ [row.key]: raw }, row);
    return `${row.label}: ${
        JSON.stringify(typed)
    } is outside ${row.min}\u2013${row.max} and was refused.`
        + `${row.boundsNote ? ` ${row.boundsNote}` : ''}`
        + ` The value in use is ${used}; every other setting you changed is still applied.`;
}

/** Resolve one typed number and its user-visible refusal as a single decision. */
export function CommitNumberRow(settings, row, raw)
{
    return {
        value: ResolveNumberRow({ [row.key]: raw }, row),
        refusal: TypedNumberRefusal(row, raw),
    };
}

/** Capture the prior ownership of only the changed settings keys. */
export function BuildSeedPatch(before, after)
{
    const a = before && typeof before === 'object' ? before : {};
    const b = after && typeof after === 'object' ? after : {};
    const patch = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
    {
        if (Object.hasOwn(a, key) !== Object.hasOwn(b, key) || !sameSetting(a[key], b[key]))
        {
            patch[key] = Object.hasOwn(a, key) ? { value: a[key] } : null;
        }
    }
    return patch;
}

/** Restore those ownership entries into the current promotion record. */
export function ApplySeedPatch(record, patch)
{
    const next = { ...(record && typeof record === 'object' ? record : {}) };
    for (const [key, entry] of Object.entries(patch || {}))
    {
        if (entry)
        {
            next[key] = entry.value;
        }
        else
        {
            delete next[key];
        }
    }
    return next;
}
