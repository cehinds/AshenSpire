/** Resolves the active card or flask through the live target plan. */
export function PendingCombatTargetPlan(instanceId, selectedFlask, enemies, cardTargets)
{
    return selectedFlask != null && !instanceId
        ? { mode: 'enemy', legalIds: enemies.filter(enemy => enemy.alive).map(enemy => enemy.id) }
        : cardTargets(instanceId);
}

/** Rechecks a painted target against the current input and action state. */
export function ResolveTargetHudAction(id, {
    combat,
    busy,
    inputBusy,
    enemyPlayback,
    hasCardChoice,
    veilIsOpen,
    selected,
    selfArm,
    selectedFlask,
    readTargetPlan,
})
{
    if (
        inputBusy() || enemyPlayback || combat.result || combat.phase !== 'player'
        || combat.pendingReaction || hasCardChoice(combat) || veilIsOpen()
        || !(selected || selfArm || selectedFlask != null)
        || !readTargetPlan().legalIds.includes(id)
    )
    {
        if (selected || selfArm || selectedFlask != null)
        {
            const why = busy
                ? 'busy'
                : enemyPlayback
                ? 'enemy playback'
                : combat.result
                ? 'combat over'
                : combat.phase !== 'player'
                ? `phase ${combat.phase}`
                : combat.pendingReaction
                ? 'pending reaction'
                : hasCardChoice(combat)
                ? 'pending card choice'
                : veilIsOpen()
                ? 'veil open'
                : 'not a legal target';
            return { type: 'refused', reason: why };
        }
        return null;
    }
    if (selected)
    {
        return { type: 'playCard', cardInstanceId: selected, targetId: id };
    }
    if (selfArm)
    {
        return { type: 'playCard', cardInstanceId: selfArm, targetId: null };
    }
    return { type: 'useFlask', slot: selectedFlask, targetId: id };
}
