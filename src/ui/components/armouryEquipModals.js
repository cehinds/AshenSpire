// The Armoury's equip flow for an Inventory item: a "Choose a slot" modal, then a
// confirm modal for an empty position (here) or the compare modal for an occupied one.
// Escape / the header close / the veil answer Back; the host owns the equip and refusals.
import {
    openModal,
    button,
    el as buildElement,
} from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import {
    optionRowList,
    markOptionRows,
} from './optionRowList.js';
import { t as translate } from '../strings.js';

const CLICK_EVENT = 'click';
const SLOT_OPTION_ATTRIBUTE = 'data-slot-option';
const NO_SCROLL = Object.freeze({ preventScroll: true });
const BACK_LABEL_KEY = 'common.back';
const EQUIP_LABEL_KEY = 'armoury.picker.act.equip';

/** A Back button: the exit every way out of these modals lands on. */
function createBackButton()
{
    return button({
        label: translate(BACK_LABEL_KEY),
        role: 'exit',
    });
}

/** Opens an md modal with a Back exit and the shared focus / close wiring. */
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

/** Opens the "Choose a slot" modal; onChoose(id) runs after it has closed. */
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
            const optionRows = optionList?.querySelectorAll(`[${SLOT_OPTION_ATTRIBUTE}]`) || [];
            return [...optionRows].find((optionRow) => !optionRow.disabled) || null;
        },
        body(host)
        {
            const slotRows = options.map((option) => ({
                id: option.id,
                name: option.label,
                text: option.disabled && option.hint ? option.hint : option.sub,
                disabled: !!option.disabled,
                className: 'equip-slot-option',
            }));
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

/** Opens the empty-position confirm: the item's card, Back / Equip. */
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
    // Every way out but Equip lands on the list it came from (modalReturn.js).
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
            const renderedCard = renderEquipmentCard(registries, item, {
                inspection: false,
                interactive: false,
                level: 'inspect',
                surface: 'armoury',
            });
            host.append(buildElement(
                'div',
                { class: 'equip-confirm-card' },
                [renderedCard.card],
            ));
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
