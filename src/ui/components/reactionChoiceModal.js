import { intentDamageRead } from '../models/CombatIntentModel.js';
import { el } from '../kit/index.js';
import { t } from '../strings.js';
import { OpenChoiceModal } from './choiceModal.js';
import { SummarizeOrNull, PlayingCardArtworkOrNull } from './choiceRowSources.js';
import { summarizeCardOption } from '../models/CardOptionSummaryModel.js';

const REACTION_KIND = 'reactionChoice';
const RESOLVE_LABEL_KEY = 'combat.reaction.resolve';
const INCOMING_DAMAGE_CLASS = 'reaction-incoming-damage';
const SKIP_COST_CLASS = 'reaction-skip-cost';
const STACK_LABEL_CLASS = 'reaction-stack-label';
const STACK_LIST_CLASS = 'reaction-stack';

const ENEMY_SIDE = 'enemy';
const COUNT_PREFIX = '×';
const FALLBACK_KEY_PREFIX = 'fallback:';

function toTitleWords(identifier)
{
    const spacedWords = String(identifier || '').replace(
        /([a-z])([A-Z])/g,
        '$1 $2',
    );
    return spacedWords.replace(
        /^./,
        (firstLetter) => firstLetter.toUpperCase(),
    );
}

function buildOptionKey({ option, row, fallback: isFallback }, index)
{
    if (isFallback)
    {
        return `${FALLBACK_KEY_PREFIX}${index}`;
    }

    return JSON.stringify([
        option.cardId,
        row.name,
        row.costs || [],
        (row.line || []).map((part) => [
            part.label,
            part.value,
        ]),
        row.text ?? null,
        row.html ?? null,
        option.choiceName ?? null,
        option.play?.upcastTier ?? null,
        option.play?.rangeRoute ?? null,
        option.play?.targetId ?? null,
        option.sourceId ?? null,
    ]);
}

function withCountChip({ row, count })
{
    if (count <= 1)
    {
        return row;
    }

    return {
        ...row,
        count: `${COUNT_PREFIX}${count}`,
    };
}

export function committedReactionStack(reactionStack, groupKey)
{
    if (
        !reactionStack
        || reactionStack.groupKey !== groupKey
    )
    {
        return [];
    }

    return [...(reactionStack.entries || [])].reverse();
}

export function reactionStackEntryName(entry, registries)
{
    if (entry?.side === ENEMY_SIDE)
    {
        const enemy = registries?.enemies?.get(entry.enemyId);
        const moveName = enemy?.moves?.[entry.moveId]?.name || toTitleWords(entry.moveId);
        return enemy?.name
            ? `${enemy.name}: ${moveName}`
            : moveName;
    }

    return registries?.cards?.get(entry?.cardId)?.name || entry?.cardId || '';
}

function isStackedCardOf(entry, ownerId)
{
    return (
        entry.side !== ENEMY_SIDE
        && (
            ownerId == null
            || entry.ownerId === ownerId
        )
    );
}

export const stackedCardIds = (reactionStack, ownerId = null) =>
    new Set(
        (reactionStack?.entries || [])
            .filter((entry) => isStackedCardOf(entry, ownerId))
            .map((entry) => entry.cardInstanceId),
    );

export function reactionOptionArtwork(option, registries = null)
{
    if (!option?.cardId)
    {
        return null;
    }

    return PlayingCardArtworkOrNull(
        option.cardId,
        registries?.cards?.get?.(option.cardId),
        registries,
    );
}

export const reactionOptionArt = (option, registries = null) =>
    reactionOptionArtwork(option, registries)?.path || null;

export function collapseIdenticalOptions(entries)
{
    const groups = new Map();

    for (const entry of entries)
    {
        const optionKey = buildOptionKey(entry, entries.indexOf(entry));
        const group = groups.get(optionKey);

        if (group)
        {
            group.count += 1;
        }
        else
        {
            groups.set(optionKey, {
                row: entry.row,
                count: 1,
            });
        }
    }

    return [...groups.values()].map(withCountChip);
}

function renderIncomingDamage(host, pending, isStacked)
{
    if (Number.isFinite(pending.incomingHp))
    {
        const loseHpLine = el('p', {
            class: INCOMING_DAMAGE_CLASS,
            text: t('combat.reaction.loseHp', { amount: pending.incomingHp }),
        });
        host.append(loseHpLine);
        return;
    }

    const incoming = intentDamageRead(pending.intentPreview);

    if (!incoming)
    {
        return;
    }

    const incomingLine = el('p', {
        class: INCOMING_DAMAGE_CLASS,
        text: `${incoming.label} · ${incoming.summary}`,
    });
    host.append(incomingLine);

    if (!isStacked)
    {
        const skipCostLine = el('p', {
            class: SKIP_COST_CLASS,
            text: t('combat.reaction.skipCost', { amount: incoming.label }),
        });
        host.append(skipCostLine);
    }
}

function renderCommittedStack(host, stack)
{
    const stackLabel = el('p', {
        className: STACK_LABEL_CLASS,
        text: t('combat.reaction.stack'),
    });
    const stackList = el('ol', {
        className: STACK_LIST_CLASS,
        'data-reaction-stack': String(stack.length),
    });

    for (const entry of stack)
    {
        const stackEntry = el('li', {
            text: String(entry.name),
            'data-reaction-stack-entry': '',
        });
        stackList.append(stackEntry);
    }

    host.append(
        stackLabel,
        stackList,
    );
}

function buildReactionEntry(option, summarize, registries)
{
    const summary = SummarizeOrNull(option, summarize);
    const baseRow = summary || summarizeCardOption(
        null,
        null,
        option,
    );
    const hpAfterReaction = Number.isFinite(option.incomingHp)
        ? [t('combat.reaction.loseHp', { amount: option.incomingHp })]
        : [];
    const row = {
        ...baseRow,
        costs: [
            ...(baseRow.costs || []),
            ...hpAfterReaction,
        ],
        id: option.id,
        artAsset: reactionOptionArt(option, registries),
        artComposition: reactionOptionArtwork(option, registries),
        chip: t('combat.reactions.label'),
    };
    return {
        option,
        fallback: !summary,
        row,
    };
}

export function openReactionChoiceModal({
    pending,
    onAnswer,
    onClosed,
    stack = [],
    summarize = null,
    registries = null,
})
{
    const isStacked = Array.isArray(stack) && stack.length > 0;
    const resolveLabel = isStacked
        ? t(RESOLVE_LABEL_KEY)
        : undefined;
    let isDismissed = false;

    function renderReactionIntro(host)
    {
        renderIncomingDamage(
            host,
            pending,
            isStacked,
        );

        if (isStacked)
        {
            renderCommittedStack(host, stack);
        }
    }

    function answer(optionId)
    {
        if (!isDismissed)
        {
            onAnswer({
                offerId: pending.id,
                optionId,
            });
        }
    }

    const reactionEntries = pending.options.map((option) =>
        buildReactionEntry(
            option,
            summarize,
            registries,
        )
    );
    const shell = OpenChoiceModal({
        kind: REACTION_KIND,
        rows: collapseIdenticalOptions(reactionEntries),
        eyebrow: t('combat.reaction.eyebrow'),
        title: t('combat.reaction.title'),
        cancelLabel: resolveLabel,
        renderBeforeList: renderReactionIntro,
        onClosed,
        onCommit: answer,
        onCancelled: () => answer(null),
    });
    return {
        ...shell,
        dismiss()
        {
            isDismissed = true;
            shell.close();
        },
    };
}
