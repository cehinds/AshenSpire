// An enemy instance's move set (owner, 2026-11-20; docs/plans/enemy-level-scaling.md, "Level-card lists"): the shared
// registry definition's moves, then the instance's own `extraMoves` (its level-card moves, picked once at spawn and saved
// with the fight). The shared definition is never changed. An instance with extra moves reads a per-instance view of
// the definition, cached on the instance; one without reads the registry definition itself, exactly as before.

const views = new WeakMap();

function hasExtraMoves(enemy)
{
    const extra = enemy?.extraMoves;
    return extra !== null && typeof extra === 'object' && Object.keys(extra).length > 0;
}

// The registry row by id; a registry without has() (a test stub) is asked directly.
function registryRow(registries, enemyId)
{
    const enemies = registries?.enemies;
    if (!enemies || enemyId == null)
    {
        return undefined;
    }
    if (typeof enemies.has === 'function')
    {
        return enemies.has(enemyId) ? enemies.get(enemyId) : undefined;
    }
    return enemies.get?.(enemyId);
}

/** The definition an enemy instance acts from: the registry row, with the instance's extra moves after its own. */
export function enemyDefinitionOf(registries, enemy)
{
    const def = registryRow(registries, enemy?.enemyId);
    if (!def || !hasExtraMoves(enemy))
    {
        return def;
    }
    const cached = views.get(enemy);
    if (cached && cached.def === def && cached.extra === enemy.extraMoves)
    {
        return cached.view;
    }
    const view = Object.freeze({ ...def, moves: Object.freeze({ ...(def.moves || {}), ...enemy.extraMoves }) });
    views.set(enemy, { def, extra: enemy.extraMoves, view });
    return view;
}

/** Every move the instance can use, its extra moves included. */
export function enemyMovesOf(registries, enemy)
{
    return enemyDefinitionOf(registries, enemy)?.moves;
}

/** One move of the instance by id, an extra move included; undefined when it has none by that id. */
export function enemyMoveOf(registries, enemy, moveId)
{
    // One move by id, without walking the move set: the instance's own first, then its row's.
    if (hasExtraMoves(enemy) && Object.hasOwn(enemy.extraMoves, moveId))
    {
        return enemy.extraMoves[moveId];
    }
    return registryRow(registries, enemy?.enemyId)?.moves?.[moveId];
}

/**
 * The move an event names. `enemy` is the instance when the caller has it; else the instance is found in the fight
 * by `instanceId`, and a fight without it (a replay of a finished fight) falls back to the registry row.
 */
export function enemyEventMoveOf(registries, { enemy = null, enemies = [], instanceId = null, enemyId = null, moveId })
{
    const instance = enemy || (instanceId != null ? (enemies || []).find(row => row?.id === instanceId) : null);
    if (instance && (enemyId == null || instance.enemyId === enemyId))
    {
        return enemyMoveOf(registries, instance, moveId);
    }
    return registryRow(registries, enemyId)?.moves?.[moveId];
}
