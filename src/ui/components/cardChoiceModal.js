import { t as translate } from '../strings.js';
import { OpenChoiceModal } from './choiceModal.js';

const CARD_CHOICE_KIND = 'cardChoice';
const ROW_CLASS = 'card-choice-option';
const ACTIVE_ROW_CLASS = `${ROW_CLASS} is-active`;
const ACTIVE_NAME_SUFFIX = ' (active)';
const TITLE_KEYS = Object.freeze({
    stance: 'cardChoice.stanceTitle',
    mode: 'cardChoice.modeTitle',
});
const FALLBACK_TITLE_KEY = 'common.choose';

function buildChoiceRow(option)
{
    const isActive = !!option.active;
    const nameSuffix = isActive
        ? ACTIVE_NAME_SUFFIX
        : '';
    return {
        id: option.id,
        className: isActive
            ? ACTIVE_ROW_CLASS
            : ROW_CLASS,
        name: `${option.name}${nameSuffix}`,
        text: option.tooltip || '',
        disabled: isActive,
    };
}

function readTitle(planKind)
{
    const titleKey = Object.hasOwn(TITLE_KEYS, planKind)
        ? TITLE_KEYS[planKind]
        : FALLBACK_TITLE_KEY;
    return translate(titleKey);
}

export function openCardChoiceModal({
    plan,
    cardName = translate('card.artPlaceholder'),
    opener = document.activeElement,
    onChoose,
    onClosed = null,
})
{
    return OpenChoiceModal({
        kind: CARD_CHOICE_KIND,
        rows: plan.options.map(buildChoiceRow),
        eyebrow: cardName,
        title: readTitle(plan.kind),
        closeLabel: `${translate('common.cancel')} ${cardName}`,
        opener,
        onClosed,
        onCommit: onChoose,
    });
}
