// The card counter's words and state: each count shows "/limit" only when CARD_LIMITS sets a cap.
import {
    CheckCardLimits,
    CountCardParts,
    DEFAULT_CARD_LIMIT_RULES,
    HasCardLimit,
} from '../../../src/model/cardLimits.js';
import { FillTemplate } from '../../../src/model/textTemplate.js';

function countText(wording, count, limit)
{
    const template = HasCardLimit(limit)
        ? wording.capped
        : wording.uncapped;
    return FillTemplate(template, { count, limit });
}

/** { text, title, over, problems } for `card`; `over` is true only when a set cap is passed. */
export function CardLimitsSummary(card, ui, rules = DEFAULT_CARD_LIMIT_RULES)
{
    const wording = ui.text.cardLimits;
    const parts = CountCardParts(card, rules);
    const problems = CheckCardLimits([card], rules);
    const counts = [
        countText(wording.effects, parts.effects, rules.maxEffects),
        countText(wording.drawbacks, parts.drawbacks.length, rules.maxDrawbacks),
    ];
    return {
        text: counts.join(wording.separator),
        title: parts.drawbacks.join(ui.text.listSeparator),
        over: problems.length > 0,
        problems,
    };
}
