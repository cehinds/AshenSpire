import { openModal, button, el as buildElement } from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { OpenChoiceModal } from './choiceModal.js';
import { t as translate } from '../strings.js';

const CLICK_EVENT = 'click';
const SLOT_CHOICE_KIND = 'slotChoice';
const ITEM_CHOICE_KIND = 'itemChoice';
const BACK_LABEL_KEY = 'common.back';
const EQUIP_LABEL_KEY = 'armoury.picker.act.equip';
const CARD_OPTIONS = Object.freeze({
    inspection: false,
    interactive: false,
    level: 'inspect',
    surface: 'armoury',
});

function buildBackButton()
{
    return button({
        label: translate(BACK_LABEL_KEY),
        role: 'exit',
    });
}

function openBackableModal({
    backButton,
    primaryButton,
    opener,
    ...modalOptions
})
{
    const modal = openModal({
        size: 'md',
        deferFocus: true,
        opener,
        closeLabel: translate(BACK_LABEL_KEY),
        secondary: [backButton],
        primary: primaryButton,
        ...modalOptions,
    });
    backButton.addEventListener(CLICK_EVENT, () => modal.close());
    return modal;
}

function buildSlotRowModels(slotOptions)
{
    return slotOptions.map((slotOption) =>
    {
        const showsHint = slotOption.disabled && slotOption.hint;
        return {
            id: slotOption.id,
            name: slotOption.label,
            text: showsHint
                ? slotOption.hint
                : slotOption.sub,
            disabled: !!slotOption.disabled,
        };
    });
}

function buildEquipButton()
{
    return button({
        label: translate(EQUIP_LABEL_KEY),
        weight: 'primary',
        className: 'equip-confirm-equip',
    });
}

function buildConfirmTitle(name, slotLabel)
{
    return translate('armoury.confirm.title', {
        verb: translate(EQUIP_LABEL_KEY),
        name,
        slot: slotLabel,
    });
}

function renderEquipCard(host, registries, item)
{
    const renderedCard = renderEquipmentCard(
        registries,
        item,
        CARD_OPTIONS,
    );
    const cardWrap = buildElement(
        'div',
        { class: 'equip-confirm-card' },
        [renderedCard.card],
    );
    host.append(cardWrap);
}

export function OpenSlotChoiceModal({ options, onChoose, opener })
{
    return OpenChoiceModal({
        kind: SLOT_CHOICE_KIND,
        rows: buildSlotRowModels(options),
        title: translate('armoury.slot.title'),
        opener,
        onCommit: onChoose,
    });
}

/**
 * OpenItemChoiceModal({ slotLabel, options, onChoose, opener }) — Replace / Choose item on a slot (owner, 2026-11-19):
 * the items that fit that slot as option rows in a modal, instead of a picker drawn under the slot rows.
 * `options`: { id, name, sub, status, disabled, hint }. Choosing one hands its id to `onChoose`.
 */
export function OpenItemChoiceModal({ slotLabel, options, onChoose, opener })
{
    return OpenChoiceModal({
        kind: ITEM_CHOICE_KIND,
        rows: options.map((option) => ({
            id: option.id,
            name: option.name,
            text: option.disabled && option.hint ? option.hint : option.sub,
            chip: option.status || '',
            disabled: !!option.disabled,
        })),
        title: translate('armoury.picker.title', { slot: slotLabel }),
        opener,
        onCommit: onChoose,
    });
}

export function OpenEquipConfirmModal({
    registries,
    item,
    name,
    slotLabel,
    onEquip,
    onBack,
    opener,
})
{
    const backButton = buildBackButton();
    const equipButton = buildEquipButton();
    let hasEquipped = false;

    function returnToListUnlessEquipped()
    {
        if (!hasEquipped)
        {
            queueMicrotask(() => onBack?.());
        }
    }

    function equipAndClose()
    {
        hasEquipped = true;
        modal.close();
        onEquip?.();
    }

    const modal = openBackableModal({
        backButton,
        primaryButton: equipButton,
        opener,
        onClose: returnToListUnlessEquipped,
        title: buildConfirmTitle(name, slotLabel),
        className: 'equip-confirm-modal',
        kind: 'compare',
        initialFocus: () => equipButton,
        body: (host) => renderEquipCard(host, registries, item),
    });
    equipButton.addEventListener(CLICK_EVENT, equipAndClose);
    return modal;
}
