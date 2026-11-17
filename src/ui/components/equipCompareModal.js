// The Replace comparison: the equipped item on the left, the candidate on the right,
// and the facts that move listed under them. It borrows the card-upgrade modal's
// frame and faces. The host owns the equip.
import {
    el as buildElement,
    modalHead,
    modalFooter,
    button,
    eyebrow,
    statRow,
    stampModalSize,
} from '../kit/index.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { deltaNode } from './smithPaneParts.js';
import { t as translate } from '../strings.js';
import { UI_COMPONENTS } from '../models/UiComponentId.js';
import { ModalModelFor } from '../models/ModalModel.js';

const VERDICT_DIRECTION = Object.freeze({
    better: 'up',
    worse: 'down',
    same: 'flat',
    changed: 'flat',
});
const SIDE = Object.freeze({
    current: 'current',
    next: 'new',
});
const BACK_LABEL_KEY = 'common.back';
const TITLE_ID = 'equip-compare-title';
const NO_SCROLL = Object.freeze({ preventScroll: true });
const ARIA_MODAL_SELECTOR = '[aria-modal="true"]';
const CLICK_EVENT = 'click';

function focusableButtons(root)
{
    const buttons = root.querySelectorAll('button:not([disabled])');
    return [...buttons].filter((node) => !node.hidden && node.getClientRects().length);
}

/** One comparison row: the label, then `before → after` coloured by its verdict. */
export function CompareRowNode(compareRow)
{
    const delta = deltaNode(String(compareRow.before), String(compareRow.after));
    delta.dataset.dir = VERDICT_DIRECTION[compareRow.verdict] || 'flat';
    return statRow({
        flat: true,
        nameNode: buildElement('b', { class: 'sr-name', text: compareRow.label }),
        values: [delta],
        className: `equip-compare-row is-${compareRow.verdict}`,
        attrs: {
            dataset: {
                compareRow: compareRow.id,
                verdict: compareRow.verdict,
            },
        },
    });
}

/** One item card with its name and a "current" / "new" caption. */
function buildFace(registries, side, entry)
{
    const whichKey = side === SIDE.current ? 'armoury.compare.current' : 'armoury.compare.new';
    const equipmentCard = renderEquipmentCard(registries, entry.item, {
        interactive: false,
        inspection: false,
        level: 'inspect',
        surface: 'armoury',
    });
    const caption = buildElement(
        'figcaption',
        { class: 'equip-compare-caption' },
        [
            buildElement('b', { text: entry.name }),
            buildElement(
                'span',
                {
                    class: 'equip-compare-which',
                    text: translate(whichKey),
                },
            ),
        ],
    );
    return buildElement(
        'figure',
        {
            class: `card-upgrade-face equip-compare-face ${side}`,
            dataset: { compareSide: side },
        },
        [
            equipmentCard.card,
            caption,
        ],
    );
}

/** Only the topmost modal answers the keyboard. */
function isTopmostModal(modal)
{
    return [...document.querySelectorAll(ARIA_MODAL_SELECTOR)].at(-1) === modal;
}

/** Keeps Tab inside the modal, wrapping at both ends. */
function trapTab(event, modal)
{
    const buttons = focusableButtons(modal);
    if (!buttons.length)
    {
        return;
    }
    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === firstButton)
    {
        event.preventDefault();
        lastButton.focus();
    }
    else if (!event.shiftKey && document.activeElement === lastButton)
    {
        event.preventDefault();
        firstButton.focus();
    }
    else if (!modal.contains(document.activeElement))
    {
        event.preventDefault();
        (event.shiftKey ? lastButton : firstButton).focus();
    }
}

/** Mounts the Replace comparison into host and returns { close }. */
export function MountEquipCompareModal(
    host,
    {
        registries,
        title,
        current,
        next,
        rows,
        onBack,
        onEquip,
        returnFocusElement,
    },
)
{
    const returnFocus = returnFocusElement instanceof HTMLElement
        ? returnFocusElement
        : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const veil = document.createElement('div');
    veil.className = 'modal-veil smith-modal-veil equip-compare-veil';
    const modal = document.createElement('section');
    modal.className = 'modal card-upgrade-modal equip-compare-modal';
    stampModalSize(modal, 'lg');
    ModalModelFor('compare').apply(modal);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', TITLE_ID);
    modal.tabIndex = -1;
    modal.dataset.component = UI_COMPONENTS.armouryEquipCompareModal;

    const headElement = modalHead({
        title,
        titleId: TITLE_ID,
        closeLabel: translate(BACK_LABEL_KEY),
    });
    const arrowNode = buildElement('span', {
        class: 'equip-compare-arrow',
        'aria-hidden': 'true',
        text: '→',
    });
    const facesRow = buildElement(
        'div',
        { class: 'card-upgrade-faces equip-compare-faces' },
        [
            buildFace(registries, SIDE.current, current),
            arrowNode,
            buildFace(registries, SIDE.next, next),
        ],
    );
    const changedRows = rows.filter((compareRow) => compareRow.verdict !== 'same');
    const unchangedRows = rows.filter((compareRow) => compareRow.verdict === 'same');
    const rowsList = buildElement(
        'div',
        {
            class: 'equip-compare-rows',
            dataset: { component: UI_COMPONENTS.armouryEquipCompareRows },
        },
        [
            eyebrow(translate('armoury.compare.title')),
            ...changedRows.map(CompareRowNode),
            ...unchangedRows.map(CompareRowNode),
        ],
    );
    const bodyElement = buildElement(
        'div',
        { class: 'modal-body equip-compare-body' },
        [
            facesRow,
            rowsList,
        ],
    );
    const backButton = button({
        label: translate(BACK_LABEL_KEY),
        role: 'exit',
        className: 'subtle equip-compare-back',
    });
    const equipButton = button({
        label: translate('armoury.picker.act.equip'),
        weight: 'primary',
        className: 'equip-compare-equip',
    });
    const footer = modalFooter({
        secondary: [backButton],
        primary: equipButton,
        className: 'equip-compare-foot',
        size: 'medium',
    });
    modal.append(
        headElement,
        bodyElement,
        footer,
    );
    veil.appendChild(modal);
    host.appendChild(veil);

    let isClosed = false;
    function close({ restoreFocus = true } = {})
    {
        if (isClosed)
        {
            return;
        }
        isClosed = true;
        window.removeEventListener('keydown', onKeydown, true);
        veil.remove();
        if (restoreFocus && returnFocus?.isConnected)
        {
            returnFocus.focus(NO_SCROLL);
        }
    }
    const goBack = () =>
    {
        close();
        onBack?.();
    };
    const confirmEquip = () =>
    {
        close({ restoreFocus: false });
        onEquip?.();
    };
    function onKeydown(event)
    {
        if (event.defaultPrevented || event.repeat)
        {
            return;
        }
        if (!isTopmostModal(modal))
        {
            return;
        }
        if (event.key === 'Escape')
        {
            event.preventDefault();
            event.stopPropagation();
            goBack();
            return;
        }
        if (event.key === 'Tab')
        {
            trapTab(event, modal);
        }
    }
    veil.addEventListener(CLICK_EVENT, (event) =>
    {
        if (event.target === veil)
        {
            goBack();
        }
    });
    backButton.addEventListener(CLICK_EVENT, goBack);
    equipButton.addEventListener(CLICK_EVENT, confirmEquip);
    modal.querySelector('.modal-close')?.addEventListener(CLICK_EVENT, goBack);
    window.addEventListener('keydown', onKeydown, true);
    queueMicrotask(() => equipButton.focus(NO_SCROLL));
    return { close };
}
