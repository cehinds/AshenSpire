import { dataClone, GameConfigError } from '../../engine/kernel/gameConfig.js';
import { deriveEnemyMoves, resolveEnemyMoveSources } from './enemyMoveSources.js';

const cardOverlayFields = ['coreOffense', 'coreSp'];
const hasCardOverlay = hint => cardOverlayFields.some(field => hint[field] === 'card');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pointerPart = value => value.replaceAll('~', '~0').replaceAll('/', '~1');
const moveKey = (enemyId, moveId) => JSON.stringify([enemyId, moveId]);

/** Validate the hint fields used by the Core enemy adapter at an authoring or projection boundary. */
export function EnemyCardHintProblems(hints, { path = '$/cardHints', moveIds } = {})
{
    if (hints === undefined)
    {
        return [];
    }
    if (!record(hints))
    {
        return [{ path, message: 'expected a map of card hints' }];
    }

    const problems = [];
    for (const [cardId, hint] of Object.entries(hints))
    {
        const at = `${path}/${pointerPart(cardId)}`;
        if (!record(hint))
        {
            problems.push({ path: at, message: 'expected a card hint object' });
            continue;
        }
        for (const field of cardOverlayFields)
        {
            if (hint[field] !== undefined && hint[field] !== 'card')
            {
                problems.push({ path: `${at}/${field}`, message: 'expected "card" when set' });
            }
        }
        if (
            hint.legacyMove !== undefined
            || hasCardOverlay(hint)
        )
        {
            const movePath = `${at}/legacyMove`;
            if (typeof hint.legacyMove !== 'string' || !hint.legacyMove.trim())
            {
                problems.push({ path: movePath, message: 'expected a nonempty move ID' });
            }
            else if (moveIds && !moveIds.has(hint.legacyMove))
            {
                problems.push({ path: movePath, message: `unknown move '${hint.legacyMove}'` });
            }
        }
        if (hint.aiWeight !== undefined && (!Number.isFinite(hint.aiWeight) || hint.aiWeight < 0))
        {
            problems.push({
                path: `${at}/aiWeight`,
                message: 'expected a nonnegative finite weight',
            });
        }
        if (
            hint.maxConsecutive !== undefined
            && (!Number.isSafeInteger(hint.maxConsecutive) || hint.maxConsecutive < 1)
        )
        {
            problems.push({ path: `${at}/maxConsecutive`, message: 'expected a positive integer' });
        }
    }
    return problems;
}

function rangeMove(row, owned, cards, field, bands)
{
    const moveId = row[field];
    const entry = Object.entries(row.cardHints || {}).find(([id, hint]) =>
        owned.has(id) && hint.legacyMove === moveId
    );
    const card = entry && cards.get(entry[0]);
    const effect = card?.effects?.[0];
    const retreat = bands === 1;
    if (
        !card || !Number.isSafeInteger(card.staminaCost) || card.staminaCost < 0
        || card.manaCost !== 0
        || card.effects?.length !== 1 || effect?.op !== 'moveEngagement'
        || effect.target !== 'enemy' || effect.bands !== bands
    )
    {
        throw new GameConfigError(
            `$/content/enemies/${pointerPart(row.id)}/${field}`,
            `requires an owned, explicitly priced one-band ${retreat ? 'retreat' : 'closing'} card`,
        );
    }
    const hint = entry[1];
    const move = retreat
        ? {
            intent: 'buff',
            sp: card.staminaCost,
            weight: 0,
            retreatWeight: hint.aiWeight ?? 0,
            ...(hint.maxConsecutive ? { maxConsecutive: hint.maxConsecutive } : {}),
            effects: dataClone(card.effects),
        }
        : {
            intent: 'buff',
            sp: card.staminaCost,
            weight: hint.aiWeight ?? 0,
            effects: dataClone(card.effects),
        };
    const tags = [
        ...(card.tags || []).filter(tag => !tag.startsWith('classification.')),
        'classification.enemyMove',
    ];
    return {
        move,
        tags: tags.map(tagId => ({ family: 'enemyMove', scope: row.id, objectId: moveId, tagId })),
    };
}

function applyCardOverlay(moves, hint, source, owned, path)
{
    const moveId = hint.legacyMove;
    if (hint.coreOffense === 'card')
    {
        const hits = Array.isArray(source?.effects)
            ? source.effects.filter(effect => effect?.op === 'damage')
            : [];
        if (
            !owned || hits.length !== 1 || !Number.isSafeInteger(hits[0].amount)
            || !Number.isSafeInteger(hits[0].hits ?? 1) || moves[moveId].damage === undefined
        )
        {
            throw new GameConfigError(
                `${path}/coreOffense`,
                'requires one whole-number damage effect on the card and a move with authored damage',
            );
        }
        moves[moveId] = { ...moves[moveId], damage: hits[0].amount, hits: hits[0].hits ?? 1 };
    }
    if (hint.coreSp === 'card')
    {
        if (
            !owned || !source || !Number.isSafeInteger(source.staminaCost)
            || source.staminaCost < 0
        )
        {
            throw new GameConfigError(
                `${path}/coreSp`,
                'requires an owned card with a whole-number staminaCost',
            );
        }
        moves[moveId] = { ...moves[moveId], sp: source.staminaCost };
    }
}

/** Overlay the Core profile's authored movement and opt-in card rules onto shared enemy moves. */
export function ProjectEnemyContent(bundle, content, sharedBundle, cloneMove)
{
    if (!Array.isArray(bundle.enemies))
    {
        return;
    }
    const authored = new Map((content.enemies || []).map(row => [row.id, row]));
    const cards = new Map((content.enemyCards || []).map(row => [row.id, row]));
    const sources = resolveEnemyMoveSources(sharedBundle);
    const flat = new Map((sources.enemyMoves || []).map(
        ({ id, enemyId, ...move }) => [moveKey(enemyId, id), move],
    ));
    const rangeOverrides = new Map();
    const movementKeys = new Set();
    const additions = [];
    const nonrangeOverlays = new Map();
    let projected = false;
    bundle.enemies = bundle.enemies.map(def =>
    {
        const row = authored.get(def.id);
        if (!row)
        {
            return def;
        }
        const hasRange = row.rangeClosingMove !== undefined;
        const sharedMoves = Object.entries(def.moves || {});
        const moveIds = new Set(sharedMoves.map(([id]) => id));
        if (hasRange)
        {
            moveIds.add(row.rangeClosingMove);
            if (row.rangeRetreatMove !== undefined)
            {
                moveIds.add(row.rangeRetreatMove);
            }
        }

        const path = `$/content/enemies/${pointerPart(def.id)}/cardHints`;
        const [problem] = EnemyCardHintProblems(row.cardHints, { path, moveIds });
        if (problem)
        {
            throw new GameConfigError(problem.path, problem.message);
        }
        const hints = Object.entries(row.cardHints || {});
        if (
            !hasRange
            && !hints.some(([, hint]) => hasCardOverlay(hint))
        )
        {
            return def;
        }

        const moves = Object.fromEntries(sharedMoves.map(([id, move]) =>
        {
            const source = flat.get(moveKey(def.id, id));
            return [id, source ? cloneMove(source) : move];
        }));
        const owned = new Set(row.defaultDeck || []);
        const reserve = new Set(row.unlockCards || []);
        if (hasRange)
        {
            for (const [field, bands] of [['rangeClosingMove', -1], ['rangeRetreatMove', 1]])
            {
                const moveId = row[field];
                if (moveId === undefined)
                {
                    continue;
                }
                const { move, tags } = rangeMove(row, owned, cards, field, bands);
                moves[moveId] = move;
                movementKeys.add(moveKey(row.id, moveId));
                additions.push(...tags);
            }
        }
        for (const [id, hint] of hints)
        {
            const source = cards.get(id);
            const ownsCard = owned.has(id) || reserve.has(id);
            if (hasCardOverlay(hint))
            {
                applyCardOverlay(moves, hint, source, ownsCard, `${path}/${pointerPart(id)}`);
                if (!hasRange)
                {
                    nonrangeOverlays.set(moveKey(def.id, hint.legacyMove), moves[hint.legacyMove]);
                }
            }
            if (
                hasRange && ownsCard && Object.hasOwn(moves, hint.legacyMove)
                && source?.range !== undefined
            )
            {
                rangeOverrides.set(moveKey(def.id, hint.legacyMove), source.range);
            }
        }
        projected = true;
        if (!hasRange)
        {
            return { ...def, moves };
        }
        return {
            ...def,
            moves,
            startingRange: row.startingRange,
            rangeClosingMove: row.rangeClosingMove,
            ...(row.rangeRetreatMove === undefined
                ? {}
                : { rangeRetreatMove: row.rangeRetreatMove }),
            rangeRoutePolicy: row.rangeRoutePolicy,
        };
    });

    if (!projected)
    {
        return;
    }
    if (!movementKeys.size && sources === sharedBundle)
    {
        // A card-only overlay leaves unrelated explicit shared move rows and their order intact.
        bundle.enemyMoves = bundle.enemyMoves.map(row =>
        {
            const overlay = nonrangeOverlays.get(moveKey(row.enemyId, row.id));
            return overlay ? { ...overlay, id: row.id, enemyId: row.enemyId } : row;
        });
    }
    else
    {
        bundle.enemyMoves = deriveEnemyMoves(bundle.enemies);
    }
    if (!movementKeys.size && !rangeOverrides.size)
    {
        return;
    }
    bundle.tagging = [
        ...(bundle.tagging || []).filter(row =>
            !(row.family === 'enemyMove'
                && (movementKeys.has(moveKey(row.scope, row.objectId))
                    || rangeOverrides.has(moveKey(row.scope, row.objectId)))
                && /^(range|reach):/.test(row.tagId))
        ),
        ...additions,
        ...[...rangeOverrides].map(([key, range]) =>
        {
            const [scope, objectId] = JSON.parse(key);
            return { family: 'enemyMove', scope, objectId, tagId: `range:${range}` };
        }),
    ];
}
