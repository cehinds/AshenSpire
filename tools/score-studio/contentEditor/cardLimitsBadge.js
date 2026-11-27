// The live card limits counter, red with the reason when a card is over a limit.
import {
    CheckCardLimits,
    CountCardParts,
    DEFAULT_CARD_LIMIT_RULES,
} from '../../../src/model/cardLimits.js';
import { El } from './dom.js';
import { FillTemplate } from '../../../src/model/textTemplate.js';

/** Fills `host` with the counter and any limit sentences for `card`; words come from `ui`. */
export function RenderCardLimits(host, card, ui)
{
    const parts = CountCardParts(card);
    const problems = CheckCardLimits([card]);
    const counts = {
        effects: parts.effects,
        drawbacks: parts.drawbacks.length,
        maxEffects: DEFAULT_CARD_LIMIT_RULES.maxEffects,
        maxDrawbacks: DEFAULT_CARD_LIMIT_RULES.maxDrawbacks,
    };
    const counter = El('span', {
        className: ui.classes.limits,
        text: FillTemplate(ui.text.cardLimits, counts),
        title: parts.drawbacks.join(ui.text.listSeparator),
    });
    counter.classList.toggle(ui.classes.limitsOver, problems.length > 0);
    const sentences = problems.map((problem) =>
    {
        return El('div', { className: ui.classes.limitsProblem, text: problem });
    });
    host.replaceChildren(counter, ...sentences);
}
