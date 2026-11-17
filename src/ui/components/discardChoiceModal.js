import { t as translate } from '../strings.js';
import { el as buildElement } from '../kit/index.js';
import { summarizeCardOption } from '../models/CardOptionSummaryModel.js';
import { OpenChoiceModal } from './choiceModal.js';

const DISCARD_KIND = 'discardChoice';
const SINGULAR_NOUN = 'card';
const PLURAL_NOUN = 'cards';

function summarizeDiscardCard(card, summarize)
{
    let summary = null;

    try
    {
        summary = summarize?.(card) ?? null;
    }
    catch
    {
        summary = null;
    }

    return summary || summarizeCardOption(
        null,
        null,
        {
            id: card.instanceId,
            name: card.name,
        },
    );
}

function readDefaultTitle(count)
{
    const noun = count === 1
        ? SINGULAR_NOUN
        : PLURAL_NOUN;
    return translate('combat.discard.title', {
        count,
        noun,
    });
}

export function openDiscardChoiceModal({
    cards,
    count,
    cardName,
    onChoose,
    onClosed,
    title,
    prompt,
    confirmLabel,
    ordered = false,
    summarize = null,
})
{
    function renderPrompt(host)
    {
        const promptText = prompt || translate('combat.discard.prompt');
        host.appendChild(buildElement('p', { text: promptText }));
    }

    return OpenChoiceModal({
        kind: DISCARD_KIND,
        rows: cards.map((card) => summarizeDiscardCard(card, summarize)),
        eyebrow: cardName || translate('combat.discard.resolving'),
        title: title || readDefaultTitle(count),
        commitLabel: confirmLabel || `${translate('combat.discard')} ${count}`,
        selectionLimit: count,
        isOrdered: ordered,
        renderBeforeList: renderPrompt,
        onClosed,
        onCommit: onChoose,
    });
}
