// Effect and drawback limits per card, read from CARD_LIMITS in actionCosts.json.
import {
    CARD_LIMITS,
    DRAWBACK_KEYWORD_TAGS,
    DRAWBACK_OPS,
    KEYWORD_TAGS,
} from '../content/actionCosts.js';
import { FillTemplate } from './textTemplate.js';

const APPLY_STATUS_OP = 'applyStatus';
const SELF_TARGET = 'self';
const NO_FACE = '';

/** The rules the checks use; tests and the Studio pass their own to try other limits. */
export const DEFAULT_CARD_LIMIT_RULES = Object.freeze({
    maxEffects: CARD_LIMITS.maxEffects,
    maxDrawbacks: CARD_LIMITS.maxDrawbacks,
    selfDebuffStatuses: CARD_LIMITS.selfDebuffStatuses,
    drawbackOps: DRAWBACK_OPS,
    drawbackKeywordTags: DRAWBACK_KEYWORD_TAGS,
    keywordTags: KEYWORD_TAGS,
    text: CARD_LIMITS.text,
    drawbackOpRequires: CARD_LIMITS.drawbackOpRequires,
});

/** A null or missing cap in CARD_LIMITS means no limit. */
export function HasCardLimit(limit)
{
    return Number.isFinite(limit);
}

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
        const required = rules.drawbackOpRequires?.[effect.op];
        const counts = !required || effect[required] !== undefined;
        return counts
            ? effect.op
            : null;
    }
    const isSelfDebuff = effect.op === APPLY_STATUS_OP
        && effect.target === SELF_TARGET
        && rules.selfDebuffStatuses.includes(effect.status);
    if (!isSelfDebuff)
    {
        return null;
    }
    return FillTemplate(rules.text.selfDebuff, { status: effect.status });
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
    if (!HasCardLimit(rules.maxEffects) || count <= rules.maxEffects)
    {
        return null;
    }
    return FillTemplate(rules.text.tooManyEffects, {
        name,
        count,
        limit: rules.maxEffects,
    });
}

function drawbacksProblem(
    name,
    drawbacks,
    rules,
)
{
    if (!HasCardLimit(rules.maxDrawbacks) || drawbacks.length <= rules.maxDrawbacks)
    {
        return null;
    }
    return FillTemplate(rules.text.tooManyDrawbacks, {
        name,
        count: drawbacks.length,
        listed: drawbacks.join(rules.text.listJoiner),
        limit: rules.maxDrawbacks,
    });
}

function faceProblems(
    face,
    faceLabel,
    rules,
)
{
    const parts = CountCardParts(face, rules);
    const name = FillTemplate(rules.text.cardName, {
        id: face.id,
        name: face.name || face.id,
        face: faceLabel,
    });
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

/** Drawbacks on a scored face: the authored list when projected from a card, else inferred. */
export function CountFaceDrawbacks(face, rules = DEFAULT_CARD_LIMIT_RULES)
{
    if (Array.isArray(face.drawbacks))
    {
        return face.drawbacks;
    }
    const fromOps = Object.keys(rules.drawbackOps).filter((op) => face[op] > 0);
    const fromKeywords = listOf(face.kw)
        .filter((keyword) => isDrawbackKeyword(keyword, rules));
    const fromStatuses = listOf(face.statuses)
        .filter(([status, , target]) => target === SELF_TARGET
            && rules.selfDebuffStatuses.includes(status))
        .map(([status]) => FillTemplate(rules.text.selfDebuff, { status }));
    return [
        ...fromOps,
        ...fromStatuses,
        ...fromKeywords,
    ];
}

/** Every card over a limit, as plain sentences; the upgraded face is checked too. */
export function CheckCardLimits(cards, rules = DEFAULT_CARD_LIMIT_RULES)
{
    const problems = [];
    for (const card of cards)
    {
        problems.push(...faceProblems(
            card,
            NO_FACE,
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
            rules.text.upgradedFace,
            rules,
        ));
    }
    return problems;
}
