import { openModal, button, el as buildElement } from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { optionRowList } from './optionRowList.js';
import { t as translate } from '../strings.js';

const CLICK_EVENT = 'click';
const SLOT_OPTION_ATTRIBUTE = 'data-slot-option';
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
            className: 'equip-slot-option',
        };
    });
}

function buildEquipButton()
{
    return button({
        label: translate('common.confirm'),
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

export function OpenSlotChoiceModal({ options, selectedId = null, onChoose, onBack, opener, host })
{
    const backButton = buildBackButton();
    const selectedSlotId = options.some(option => option.id === selectedId && !option.disabled) ? selectedId : null;
    let slotList = null;
    let hasChosen = false;

    function findFirstEnabledRow()
    {
        const slotRows = slotList?.querySelectorAll(
            `[${SLOT_OPTION_ATTRIBUTE}]`,
        ) || [];
        const selectedRow = [...slotRows].find(
            (slotRow) => !slotRow.disabled && slotRow.getAttribute(SLOT_OPTION_ATTRIBUTE) === selectedSlotId,
        );
        const firstEnabledRow = [...slotRows].find(
            (slotRow) => !slotRow.disabled,
        );
        return selectedRow || firstEnabledRow || null;
    }

    function selectSlot(slotId)
    {
        if (hasChosen) return;
        hasChosen = true;
        modal.close();
        onChoose?.(slotId);
    }

    function renderSlotList(host)
    {
        slotList = optionRowList(
            buildSlotRowModels(options),
            {
                idAttr: SLOT_OPTION_ATTRIBUTE,
                selectedId: selectedSlotId,
                onSelect: selectSlot,
            },
        );
        host.append(slotList);
    }

    const modal = openBackableModal({
        backButton,
        opener,
        host,
        onClose: () => { if (!hasChosen) onBack?.(); },
        title: translate('armoury.slot.title'),
        className: 'option-choice equip-slot-choice',
        initialFocus: findFirstEnabledRow,
        body: renderSlotList,
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
    host,
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
        if (hasEquipped) return;
        hasEquipped = true;
        modal.close();
        onEquip?.();
    }

    const modal = openBackableModal({
        backButton,
        primaryButton: equipButton,
        opener,
        host,
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
