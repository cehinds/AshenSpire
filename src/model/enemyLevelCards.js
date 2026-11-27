// Enemy level cards (owner, 2026-11-20; docs/plans/enemy-level-scaling.md, "Level-card lists"): each floor step an
// enemy gains one card from its list in games/ashenspire/packs/core/enemyLevelCards.json, a boss gains two. The pick
// is a deterministic hash-shuffle of the top of the list: no RNG stream, so the same seed key always gives the same
// cards, and a step-2 pick always holds the step-1 card. Pure data in, data out; combat wiring lives elsewhere.

/** How many entries from the top of a list take part in the shuffle. */
export const LEVEL_CARD_TOP = 4;
/** Prefix of every level-card move id. */
export const LEVEL_MOVE_PREFIX = 'level.';

// FNV-1a, as src/model/levels.js hashString.
function hashString(value)
{
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1)
    {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function entriesFor(list, enemyId)
{
    if (Array.isArray(list))
    {
        return list;
    }
    return (list && Array.isArray(list[enemyId])) ? list[enemyId] : [];
}

/**
 * The first `count` level cards of an enemy: the top LEVEL_CARD_TOP entries in hash order for `seedKey`, then the
 * rest in list order. `list` is the whole level-card map or one enemy's array. Never repeats an entry.
 */
export function LevelCardsFor(list, enemyId, count, seedKey)
{
    const entries = entriesFor(list, enemyId);
    const take = Math.max(0, Math.min(Number.isSafeInteger(count) ? count : 0, entries.length));
    const top = entries.slice(0, LEVEL_CARD_TOP)
        .map((entry, at) => ({ entry, at, key: hashString(`${seedKey}|${enemyId}|${entry.id}`) }))
        .sort((a, b) => a.key - b.key || a.at - b.at)
        .map(({ entry }) => entry);
    return [...top, ...entries.slice(LEVEL_CARD_TOP)].slice(0, take);
}

/** The level-card move id for an entry: "level." plus the part of its id after ".level." (else the whole id). */
export function LevelMoveId(entry)
{
    const marker = '.level.';
    const at = entry.id.indexOf(marker);
    return `${LEVEL_MOVE_PREFIX}${at < 0 ? entry.id : entry.id.slice(at + marker.length)}`;
}

/** { moveId: move } for picked entries, each move a fresh copy. */
export function LevelCardMoves(entries)
{
    return Object.fromEntries((entries || []).map(entry => [
        LevelMoveId(entry),
        {
            ...entry.move,
            ...(entry.move.effects ? { effects: entry.move.effects.map(effect => ({ ...effect })) } : {}),
        },
    ]));
}
