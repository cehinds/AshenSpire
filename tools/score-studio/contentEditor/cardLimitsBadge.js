// The live card counter, red with the reason only when a card passes a cap CARD_LIMITS sets.
import { CardLimitsSummary } from './cardLimitsSummary.js';
import { El } from './dom.js';

/** Fills `host` with the counter and any limit sentences for `card`; words come from `ui`. */
export function RenderCardLimits(host, card, ui)
{
    const summary = CardLimitsSummary(card, ui);
    const counter = El('span', {
        className: ui.classes.limits,
        text: summary.text,
        title: summary.title,
    });
    counter.classList.toggle(ui.classes.limitsOver, summary.over);
    const sentences = summary.problems.map((problem) =>
    {
        return El('div', { className: ui.classes.limitsProblem, text: problem });
    });
    host.replaceChildren(counter, ...sentences);
}
