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

function isVisibleButton(candidateButton)
{
    return !candidateButton.hidden
        && candidateButton.getClientRects().length;
}

function findFocusableButtons(root)
{
    const enabledButtons = root.querySelectorAll('button:not([disabled])');
    return [...enabledButtons].filter(isVisibleButton);
}

function buildCompareFace(registries, side, sideEquipment)
{
    const captionKey = side === SIDE.current
        ? CURRENT_CAPTION_KEY
        : NEW_CAPTION_KEY;
    const equipmentCard = renderEquipmentCard(
        registries,
        sideEquipment.item,
        {
            interactive: false,
            inspection: false,
            level: 'inspect',
            surface: 'armoury',
        },
    );
    const caption = buildElement(
        'figcaption',
        { class: 'equip-compare-caption' },
        [
            buildElement('b', { text: sideEquipment.name }),
            buildElement(
                'span',
                {
                    class: 'equip-compare-which',
                    text: translate(captionKey),
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

function trapTabFocus(event, modal)
{
    const focusableButtons = findFocusableButtons(modal);
    if (!focusableButtons.length)
    {
        return;
    }

    const firstButton = focusableButtons[0];
    const lastButton = focusableButtons[focusableButtons.length - 1];
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

function readReturnFocus(returnFocusElement)
{
    const activeElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return returnFocusElement instanceof HTMLElement
        ? returnFocusElement
        : activeElement;
}

function buildVeil()
{
    const veil = document.createElement('div');
    veil.className = 'modal-veil smith-modal-veil equip-compare-veil';
    return veil;
}

function buildDialog()
{
    const modal = document.createElement('section');
    modal.className = 'modal card-upgrade-modal equip-compare-modal';
    stampModalSize(modal, 'lg');
    ModalModelFor('compare').apply(modal);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', TITLE_ID);
    modal.tabIndex = -1;
    modal.dataset.component = UI_COMPONENTS.armouryEquipCompareModal;
    return modal;
}

function buildFacesRow(registries, current, next)
{
    const arrow = buildElement('span', {
        class: 'equip-compare-arrow',
        'aria-hidden': 'true',
        text: '→',
    });
    return buildElement(
        'div',
        { class: 'card-upgrade-faces equip-compare-faces' },
        [
            buildCompareFace(registries, SIDE.current, current),
            arrow,
            buildCompareFace(registries, SIDE.next, next),
        ],
    );
}

function buildCompareRowsList(compareRows)
{
    const changedRows = compareRows.filter(
        (compareRow) => compareRow.verdict !== UNCHANGED_VERDICT,
    );
    const unchangedRows = compareRows.filter(
        (compareRow) => compareRow.verdict === UNCHANGED_VERDICT,
    );
    return buildElement(
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
}

function buildBackButton()
{
    return button({
        label: translate(BACK_LABEL_KEY),
        role: 'exit',
        className: 'subtle equip-compare-back',
    });
}

function buildEquipButton()
{
    return button({
        label: translate('common.confirm'),
        weight: 'primary',
        className: 'equip-compare-equip',
    });
}

function fillDialog(
    modal,
    {
        registries,
        title,
        current,
        next,
        rows,
    },
)
{
    const headElement = modalHead({
        title,
        titleId: TITLE_ID,
        closeLabel: translate(BACK_LABEL_KEY),
    });
    const bodyElement = buildElement(
        'div',
        { class: 'modal-body equip-compare-body' },
        [
            buildFacesRow(registries, current, next),
            buildCompareRowsList(rows),
        ],
    );
    const backButton = buildBackButton();
    const equipButton = buildEquipButton();
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
    return {
        backButton,
        equipButton,
    };
}

export function CompareRowNode(compareRow)
{
    const deltaBadge = deltaNode(
        String(compareRow.before),
        String(compareRow.after),
    );
    deltaBadge.dataset.dir = VERDICT_DIRECTION[compareRow.verdict] || 'flat';
    return statRow({
        flat: true,
        nameNode: buildElement('b', {
            class: 'sr-name',
            text: compareRow.label,
        }),
        values: [deltaBadge],
        className: `equip-compare-row is-${compareRow.verdict}`,
        attrs: {
            dataset: {
                compareRow: compareRow.id,
                verdict: compareRow.verdict,
            },
        },
    });
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
    const returnFocus = readReturnFocus(returnFocusElement);
    const veil = buildVeil();
    const modal = buildDialog();
    const {
        backButton,
        equipButton,
    } = fillDialog(modal, {
        registries,
        title,
        current,
        next,
        rows,
    });
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
            handleKeydown,
            true,
        );
        veil.remove();
        if (
            restoreFocus
            && returnFocus?.isConnected
        )
        {
            returnFocus.focus(NO_SCROLL);
        }
    }

    function goBack()
    {
        close();
        onBack?.();
    }

    function confirmEquip()
    {
        if (isClosed) return;
        close({ restoreFocus: false });
        onEquip?.();
    }

    function handleKeydown(event)
    {
        if (
            event.defaultPrevented
            || event.repeat
        )
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
            trapTabFocus(event, modal);
        }
    }

    function bindListeners()
    {
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
            handleKeydown,
            true,
        );
    }

    bindListeners();
    queueMicrotask(() => equipButton.focus(NO_SCROLL));
    return { close };
}
