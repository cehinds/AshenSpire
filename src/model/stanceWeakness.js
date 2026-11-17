// The stance weakness an enemy shows under its figure (owner, playtest 2026-11-17, items 31 and 35): Prepared is weak to
// melee, Idle (no stance) is weak to all damage. Presentation only: the damage rule lives with the stance rules.
const PREPARED_MANEUVERS = new Set(['prepared', 'casting', 'cast', 'spell']);
const IDLE_MANEUVERS = new Set(['neutral', 'idle']);

/** { stance: 'prepared' | 'neutral', to: 'melee' | 'all' } for a stance row with a stance weakness, else null. */
export function StanceWeaknessFor(stance)
{
    if (!stance || stance.broken || stance.staggered)
    {
        return null;
    }
    const maneuver = stance.maneuver ?? 'neutral';
    if (PREPARED_MANEUVERS.has(maneuver))
    {
        return { stance: 'prepared', to: 'melee' };
    }
    if (IDLE_MANEUVERS.has(maneuver))
    {
        return { stance: 'neutral', to: 'all' };
    }
    return null;
}
