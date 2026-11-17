// The stance weakness an enemy shows under its figure (owner, playtest 2026-11-17, items 31 and 35): Prepared is weak to
// melee, Idle (no stance) is weak to all damage. Presentation only: the damage rule is the fight's `stanceBenefits` block
// (version 1), and a chip shows only where that block carries the rule, so a legacy fight (every enemy neutral) or a
// fight created before the rule draws none.
const PREPARED_MANEUVERS = new Set(['prepared', 'casting', 'cast', 'spell']);
const IDLE_MANEUVERS = new Set(['neutral', 'idle']);
const weakens = multiplier => Number.isFinite(multiplier) && multiplier > 1;

/**
 * { stance: 'prepared' | 'neutral', to: 'melee' | 'all', multiplier } for a stance row with a stance weakness under
 * `rules` (the fight's stanceBenefits block), else null.
 */
export function StanceWeaknessFor(stance, rules)
{
    if (!stance || stance.broken || stance.staggered || rules?.version !== 1)
    {
        return null;
    }
    const maneuver = stance.maneuver ?? 'neutral';
    if (PREPARED_MANEUVERS.has(maneuver) && weakens(rules.prepared?.meleeDamageTakenMultiplier))
    {
        return { stance: 'prepared', to: 'melee', multiplier: rules.prepared.meleeDamageTakenMultiplier };
    }
    if (IDLE_MANEUVERS.has(maneuver) && weakens(rules.neutral?.damageTakenMultiplier))
    {
        return { stance: 'neutral', to: 'all', multiplier: rules.neutral.damageTakenMultiplier };
    }
    return null;
}
