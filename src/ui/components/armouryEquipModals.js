// The Armoury's equip flow modals: slot choice, then equip confirm.
import { openModal, button, el as buildElement } from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { optionRowList, markOptionRows } from './optionRowList.js';
import { t as translate } from '../strings.js';

const CLICK_EVENT = 'click';
const SLOT_OPTION_ATTRIBUTE = 'data-slot-option';
const NO_SCROLL = Object.freeze({ preventScroll: true });
const BACK_LABEL_KEY = 'common.back';
const EQUIP_LABEL_KEY = 'armoury.picker.act.equip';
const CARD_OPTIONS = Object.freeze({
    inspection: false,
    interactive: false,
    level: 'inspect',
    surface: 'armoury',
});

function createBackButton()
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

export function OpenSlotChoiceModal({ options, onChoose, opener })
{
    const backButton = createBackButton();
    const chooseButton = button({
        label: translate('common.choose'),
        weight: 'primary',
        disabled: true,
    });
    let optionList = null;
    let selectedSlotId = null;

    const modal = openBackableModal({
        backButton,
        primaryButton: chooseButton,
        opener,
        title: translate('armoury.slot.title'),
        className: 'option-choice equip-slot-choice',
        initialFocus: () =>
        {
            const optionRows = optionList?.querySelectorAll(
                `[${SLOT_OPTION_ATTRIBUTE}]`,
            ) || [];
            const firstEnabledRow = [...optionRows].find(
                (optionRow) => !optionRow.disabled,
            );
            return firstEnabledRow || null;
        },
        body(host)
        {
            const slotRows = options.map((option) =>
            {
                const showHint = option.disabled && option.hint;
                return {
                    id: option.id,
                    name: option.label,
                    text: showHint
                        ? option.hint
                        : option.sub,
                    disabled: !!option.disabled,
                    className: 'equip-slot-option',
                };
            });
            optionList = optionRowList(
                slotRows,
                {
                    idAttr: SLOT_OPTION_ATTRIBUTE,
                    onSelect: (slotId, optionRow) =>
                    {
                        selectedSlotId = slotId;
                        optionRow?.focus?.(NO_SCROLL);
                        markOptionRows(
                            optionList,
                            SLOT_OPTION_ATTRIBUTE,
                            [slotId],
                        );
                        chooseButton.disabled = false;
                    },
                },
            );
            host.append(optionList);
        },
    });
    chooseButton.addEventListener(CLICK_EVENT, () =>
    {
        if (selectedSlotId == null)
        {
            return;
        }
        modal.close();
        onChoose?.(selectedSlotId);
    });
    return modal;
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
    const backButton = createBackButton();
    const equipButton = button({
        label: translate(EQUIP_LABEL_KEY),
        weight: 'primary',
        className: 'equip-confirm-equip',
    });
    // Every way out but Equip returns to the list it came from.
    let hasEquipped = false;
    const modal = openBackableModal({
        backButton,
        primaryButton: equipButton,
        opener,
        onClose: () =>
        {
            if (!hasEquipped)
            {
                queueMicrotask(() => onBack?.());
            }
        },
        title: translate('armoury.confirm.title', {
            verb: translate(EQUIP_LABEL_KEY),
            name,
            slot: slotLabel,
        }),
        className: 'equip-confirm-modal',
        kind: 'compare',
        initialFocus: () => equipButton,
        body(host)
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
        },
    });
    equipButton.addEventListener(CLICK_EVENT, () =>
    {
        hasEquipped = true;
        modal.close();
        onEquip?.();
    });
    return modal;
}
