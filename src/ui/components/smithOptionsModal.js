import { el as buildElement } from '../kit/index.js';
import { t as translate } from '../strings.js';
import { OpenChoiceModal } from './choiceModal.js';

const OPTIONS_KIND = 'smithOptions';
const KEEP_KIND = 'smithKeep';
const PRICE_CLASS = 'smith-options-price';
const KEEP_NOTE_CLASS = 'smith-keep-note';
const KEEP_RESULT_CLASS = 'smith-keep-result';
const EMPTY_PROPERTY_LIST = '-';
const PROPERTY_SEPARATOR = '; ';

export function BuildSmithPriceLine(price)
{
    return buildElement('p', {
        class: PRICE_CLASS,
        text: price,
    });
}

function renderPriceLine(host, price)
{
    if (price)
    {
        host.append(BuildSmithPriceLine(price));
    }
}

function buildOptionRows(options)
{
    return options.map((option) => ({
        id: option.id,
        name: option.name,
        text: option.text || '',
        line: [],
        costs: [],
        disabled: !!option.disabled,
    }));
}

function buildKeepRows(rows)
{
    return rows.map((row) => ({
        id: row.key,
        name: row.text,
        text: '',
        line: [],
        costs: [],
    }));
}

function describeQuote(quote)
{
    if (
        !quote.ok
        && !quote.newProperties.length
    )
    {
        return quote.reason;
    }

    const newPropertyTexts = quote.newProperties.map((property) => property.text);
    const newPropertyList = newPropertyTexts.join(PROPERTY_SEPARATOR) || EMPTY_PROPERTY_LIST;
    const summary = translate(
        'blacksmith.category.new',
        { list: newPropertyList },
    );
    return quote.ok
        ? summary
        : `${summary} ${quote.reason}`;
}

export function OpenSmithOptionsModal({
    title,
    eyebrow = '',
    price = '',
    options,
    opener = document.activeElement,
    onChoose,
    onClosed = null,
})
{
    return OpenChoiceModal({
        kind: OPTIONS_KIND,
        rows: buildOptionRows(options),
        eyebrow,
        title,
        opener,
        renderBeforeList: (host) => renderPriceLine(host, price),
        onClosed,
        onCommit: onChoose,
    });
}

export function OpenSmithKeepModal({
    title,
    eyebrow = '',
    price = '',
    rows,
    limit,
    quoteFor,
    opener = document.activeElement,
    onConfirm,
})
{
    const resultLine = buildElement('p', { class: KEEP_RESULT_CLASS });
    let latestQuote = null;

    function renderKeepIntro(host)
    {
        renderPriceLine(host, price);

        if (rows.length)
        {
            const keepNote = buildElement('p', {
                class: KEEP_NOTE_CLASS,
                text: translate('blacksmith.category.keep', { limit }),
            });
            host.append(keepNote);
        }
    }

    function showQuote(keptKeys)
    {
        latestQuote = quoteFor([...keptKeys]);
        resultLine.textContent = describeQuote(latestQuote);
    }

    const initialSelection = rows.length
        ? [rows[0].key]
        : [];

    return OpenChoiceModal({
        kind: KEEP_KIND,
        rows: buildKeepRows(rows),
        eyebrow,
        title,
        opener,
        selectionLimit: limit,
        initialSelection,
        renderBeforeList: renderKeepIntro,
        renderAfterList: (host) => host.append(resultLine),
        onSelectionChange: showQuote,
        canCommit: () => !!latestQuote?.ok,
        onCommit: onConfirm,
    });
}
