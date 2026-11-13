/** Keeps explicit saves, continuing autosaves and candidate writes distinct. */
export function CreateRunPersistence({ readCurrent, stampSkillBonuses, saveRun, reportFailure })
{
    function persist()
    {
        const { registries, run, rng, slot } = readCurrent();
        stampSkillBonuses(registries, run);
        saveRun(run, rng, slot);
    }

    function persistOrWarn()
    {
        try
        {
            persist();
            return true;
        }
        catch (error)
        {
            reportFailure(error);
            return false;
        }
    }

    return {
        Persist: persist,
        PersistOrWarn: persistOrWarn,
        PersistContinuing()
        {
            // Reward doors treat false as refusal. An accepted reward stays accepted.
            persistOrWarn();
        },
        SaveCombatCandidate(next, committedRng)
        {
            try
            {
                saveRun(next, committedRng, readCurrent().slot);
                return { ok: true };
            }
            catch (error)
            {
                reportFailure(error);
                return { ok: true, durable: false };
            }
        },
    };
}
