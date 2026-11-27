// Effect and drawback limits per card, read from CARD_LIMITS in actionCosts.json.
import {
    CARD_LIMITS,
    DRAWBACK_KEYWORD_TAGS,
    DRAWBACK_OPS,
    KEYWORD_TAGS,
} from '../content/actionCosts.js';

const APPLY_STATUS_OP = 'applyStatus';
const SELF_TARGET = 'self';
const SELF_SUFFIX = ' on self';
const UPGRADED_SUFFIX = ' upgraded';
const LIST_JOINER = ', ';

/** The rules the checks use; tests and the Studio pass their own to try other limits. */
export const DEFAULT_CARD_LIMIT_RULES = Object.freeze({
    maxEffects: CARD_LIMITS.maxEffects,
    maxDrawbacks: CARD_LIMITS.maxDrawbacks,
    selfDebuffStatuses: CARD_LIMITS.selfDebuffStatuses,
    drawbackOps: DRAWBACK_OPS,
    drawbackKeywordTags: DRAWBACK_KEYWORD_TAGS,
    keywordTags: KEYWORD_TAGS,
});

function listOf(value)
{
    return Array.isArray(value)
        ? value
        : [];
}

function effectDrawback(effect, rules)
{
    if (rules.drawbackOps[effect.op])
    {
        return effect.op;
    }
    const isSelfDebuff = effect.op === APPLY_STATUS_OP
        && effect.target === SELF_TARGET
        && rules.selfDebuffStatuses.includes(effect.status);
    if (!isSelfDebuff)
    {
        return null;
    }
    return `${effect.status}${SELF_SUFFIX}`;
}

function isDrawbackKeyword(keyword, rules)
{
    const tag = rules.keywordTags[keyword];
    return rules.drawbackKeywordTags.includes(tag);
}

function effectsProblem(
    name,
    count,
    rules,
)
{
    if (count <= rules.maxEffects)
    {
        return null;
    }
    return `${name} has ${count} effects. The limit is ${rules.maxEffects} (maxEffects).`;
}

function drawbacksProblem(
    name,
    drawbacks,
    rules,
)
{
    if (drawbacks.length <= rules.maxDrawbacks)
    {
        return null;
    }
    const listed = drawbacks.join(LIST_JOINER);
    const limit = `The limit is ${rules.maxDrawbacks} (maxDrawbacks).`;
    return `${name} has ${drawbacks.length} drawbacks: ${listed}. ${limit}`;
}

function faceProblems(
    face,
    label,
    rules,
)
{
    const parts = CountCardParts(face, rules);
    const name = `${face.id} (${face.name || face.id})${label}`;
    const problems = [
        effectsProblem(
            name,
            parts.effects,
            rules,
        ),
        drawbacksProblem(
            name,
            parts.drawbacks,
            rules,
        ),
    ];
    return problems.filter(Boolean);
}

/** Counts one card face: { effects, drawbacks } where drawbacks lists what counted. */
export function CountCardParts(card, rules = DEFAULT_CARD_LIMIT_RULES)
{
    const effects = listOf(card.effects);
    const fromEffects = effects
        .map((effect) => effectDrawback(effect, rules))
        .filter(Boolean);
    const fromKeywords = listOf(card.keywords)
        .filter((keyword) => isDrawbackKeyword(keyword, rules));
    return {
        effects: effects.length,
        drawbacks: [
            ...fromEffects,
            ...fromKeywords,
        ],
    };
}

/** Every card over a limit, as plain sentences; the upgraded face is checked too. */
export function CheckCardLimits(cards, rules = DEFAULT_CARD_LIMIT_RULES)
{
    const problems = [];
    for (const card of cards)
    {
        problems.push(...faceProblems(
            card,
            '',
            rules,
        ));
        if (!card.upgrade)
        {
            continue;
        }
        const upgraded = {
            ...card,
            ...card.upgrade,
        };
        problems.push(...faceProblems(
            upgraded,
            UPGRADED_SUFFIX,
            rules,
        ));
    }
    return problems;
}
