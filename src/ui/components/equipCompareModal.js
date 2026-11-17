// The Replace comparison modal: equipped item against the candidate.
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
const CURRENT_CAPTION_KEY = 'armoury.compare.current';
const NEW_CAPTION_KEY = 'armoury.compare.new';
const UNCHANGED_VERDICT = 'same';

function isVisibleButton(node)
{
    return !node.hidden && node.getClientRects().length;
}

function focusableButtons(root)
{
    const buttons = root.querySelectorAll('button:not([disabled])');
    return [...buttons].filter(isVisibleButton);
}

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

function buildFace(registries, side, entry)
{
    const whichKey = side === SIDE.current
        ? CURRENT_CAPTION_KEY
        : NEW_CAPTION_KEY;
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

function isTopmostModal(modal)
{
    return [...document.querySelectorAll(ARIA_MODAL_SELECTOR)].at(-1) === modal;
}

function trapTab(event, modal)
{
    const buttons = focusableButtons(modal);
    if (!buttons.length)
    {
        return;
    }

    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];
    const activeElement = document.activeElement;
    const wrapsBackward = event.shiftKey && activeElement === firstButton;
    const wrapsForward = !event.shiftKey && activeElement === lastButton;

    if (wrapsBackward)
    {
        event.preventDefault();
        lastButton.focus();
    }
    else if (wrapsForward)
    {
        event.preventDefault();
        firstButton.focus();
    }
    else if (!modal.contains(activeElement))
    {
        event.preventDefault();
        const entryButton = event.shiftKey
            ? lastButton
            : firstButton;
        entryButton.focus();
    }
}

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
    const activeElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnFocus = returnFocusElement instanceof HTMLElement
        ? returnFocusElement
        : activeElement;

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
    const changedRows = rows.filter(
        (compareRow) => compareRow.verdict !== UNCHANGED_VERDICT,
    );
    const unchangedRows = rows.filter(
        (compareRow) => compareRow.verdict === UNCHANGED_VERDICT,
    );
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
        window.removeEventListener(
            'keydown',
            onKeydown,
            true,
        );
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
    window.addEventListener(
        'keydown',
        onKeydown,
        true,
    );
    queueMicrotask(() => equipButton.focus(NO_SCROLL));
    return { close };
}
