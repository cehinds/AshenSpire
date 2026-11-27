// Effect and drawback limits per card, read from CARD_LIMITS in content/source/actionCosts.json.
import { CARD_LIMITS, DRAWBACK_KEYWORD_TAGS, DRAWBACK_OPS, KEYWORD_TAGS } from '../content/actionCosts.js';

const APPLY_STATUS_OP = 'applyStatus';
const SELF_TARGET = 'self';
const SELF_SUFFIX = ' on self';

/** The rules the checks use; tests and the Studio pass their own to try other limits. */
export const DEFAULT_CARD_LIMIT_RULES = Object.freeze({
    maxEffects: CARD_LIMITS.maxEffects,
    maxDrawbacks: CARD_LIMITS.maxDrawbacks,
    selfDebuffStatuses: CARD_LIMITS.selfDebuffStatuses,
    drawbackOps: DRAWBACK_OPS,
    drawbackKeywordTags: DRAWBACK_KEYWORD_TAGS,
    keywordTags: KEYWORD_TAGS,
});

function effectDrawback(effect, rules)
{
    if (rules.drawbackOps[effect.op])
    {
        return effect.op;
    }
    const isSelfDebuff = effect.op === APPLY_STATUS_OP
        && effect.target === SELF_TARGET
        && rules.selfDebuffStatuses.includes(effect.status);
    return isSelfDebuff
        ? `${effect.status}${SELF_SUFFIX}`
        : null;
}

/** Counts one card face: { effects, drawbacks } where drawbacks lists what counted. */
export function CountCardParts(card, rules = DEFAULT_CARD_LIMIT_RULES)
{
    const effects = Array.isArray(card.effects)
        ? card.effects
        : [];
    const keywords = Array.isArray(card.keywords)
        ? card.keywords
        : [];
    const fromEffects = effects
        .map((effect) => effectDrawback(effect, rules))
        .filter(Boolean);
    const fromKeywords = keywords.filter((keyword) => rules.drawbackKeywordTags.includes(rules.keywordTags[keyword]));
    return {
        effects: effects.length,
        drawbacks: [
            ...fromEffects,
            ...fromKeywords,
        ],
    };
}

function faceProblems(card, face, label, rules)
{
    const parts = CountCardParts(face, rules);
    const name = `${card.id} (${card.name || card.id})${label}`;
    const problems = [];
    if (parts.effects > rules.maxEffects)
    {
        problems.push(`${name} has ${parts.effects} effects. The limit is ${rules.maxEffects} (maxEffects).`);
    }
    if (parts.drawbacks.length > rules.maxDrawbacks)
    {
        problems.push(`${name} has ${parts.drawbacks.length} drawbacks: ${parts.drawbacks.join(', ')}. The limit is ${rules.maxDrawbacks} (maxDrawbacks).`);
    }
    return problems;
}

/** Every card over a limit, as plain sentences; the upgraded face is checked too. */
export function CheckCardLimits(cards, rules = DEFAULT_CARD_LIMIT_RULES)
{
    const problems = [];
    for (const card of cards)
    {
        problems.push(...faceProblems(card, card, '', rules));
        if (card.upgrade)
        {
            const upgraded = {
                ...card,
                ...card.upgrade,
            };
            problems.push(...faceProblems(card, upgraded, ' upgraded', rules));
        }
    }
    return problems;
}
