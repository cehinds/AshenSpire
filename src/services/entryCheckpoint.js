const entryCheckpointFallbackMs = 500;

/** Owns the one deferred combat-entry write and the RNG used for that write. */
export function CreateEntryCheckpoint({ getRun, clearTimer, setTimer, requestFrame, reportFailure })
{
    let pending = null;

    function flush()
    {
        const entry = pending;
        if (!entry)
        {
            return false;
        }
        pending = null;
        clearTimer(entry.timer);
        const run = getRun();
        const entered = run?.combatEntered;
        if (
            run !== entry.run || entry.combat.result || !entered || entered.snapshot
            || entered.nodeId !== entry.nodeId || entered.encounterId !== entry.encounterId
        )
        {
            return false;
        }

        const liveRng = entry.combat.rng;
        entry.combat.rng = entry.checkpointRng;
        try
        {
            entry.durable(entry.combat);
        }
        catch (error)
        {
            // Keep the entry eligible for retry unless a replacement already owns the queue.
            if (!pending)
            {
                pending = entry;
            }
            throw error;
        }
        finally
        {
            entry.combat.rng = liveRng;
        }
        return true;
    }

    function flushSafely()
    {
        try
        {
            flush();
        }
        catch (error)
        {
            reportFailure(error);
        }
    }

    return {
        Queue(entry)
        {
            pending = { ...entry, timer: 0 };
        },
        Flush: flush,
        FlushSafely: flushSafely,
        Schedule()
        {
            const entry = pending;
            if (!entry)
            {
                return;
            }
            const flushIfCurrent = () =>
            {
                if (pending === entry)
                {
                    flushSafely();
                }
            };
            entry.timer = setTimer(flushIfCurrent, entryCheckpointFallbackMs);
            requestFrame(() => setTimer(flushIfCurrent, 0));
        },
        Supersede()
        {
            if (pending)
            {
                clearTimer(pending.timer);
            }
            pending = null;
        },
    };
}
