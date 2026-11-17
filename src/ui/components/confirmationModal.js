import { t as translate } from '../strings.js';
import { UI_COMPONENTS, markUiComponent } from './uiComponents.js';
import { modalHead, modalFooter, el as buildElement, prose, stampModalSize } from '../kit/index.js';
import { registerModal, topModal } from '../modalState.js';
import { ModalModelFor } from '../models/ModalModel.js';

export const CONFIRMATION_COMMIT_EVENT = 'ashenspire:confirmation-commit';
export const CONFIRMATION_INPUT_SHIELD_MS = 600;

const TONE_DANGER = 'danger';
const TONE_NORMAL = 'normal';
const MODAL_SIZE = 'sm';
const FOOTER_SIZE = 'long';
const EVENT = Object.freeze({
    click: 'click',
    pointerDown: 'pointerdown',
});
const SHIELD_EVENTS = Object.freeze([
    EVENT.pointerDown,
    'pointerup',
    'mousedown',
    'mouseup',
    EVENT.click,
    'dblclick',
    'touchstart',
    'touchend',
]);
const KEY_EVENTS = Object.freeze([
    'keydown',
    'keyup',
]);
const CLASS = Object.freeze({
    veil: 'modal-veil confirmation-veil',
    inputShield: 'confirmation-input-shield',
    dialog: 'modal confirmation-modal',
    danger: 'danger',
    close: 'confirmation-close',
    eyebrowTag: 'confirmation-eyebrow',
    target: 'as-title-s confirmation-target',
    copy: 'confirmation-copy',
    details: 'confirmation-details as-detailcard muted',
    cancel: 'subtle confirmation-cancel',
    confirm: 'confirmation-confirm',
    confirmDanger: 'subtle danger',
    footer: 'confirmation-footer',
    bodyPanel: 'as-decide confirmation-body',
    body: 'modal-body',
});
const ELEMENT_ID = Object.freeze({
    dialogTitle: 'confirmation-modal-title',
    target: 'confirmation-modal-target',
    copy: 'confirmation-modal-copy',
});
const SELECTOR = Object.freeze({
    modalClose: '.modal-close',
    modalEyebrow: '.modal-eyebrow',
    answers: '.confirmation-close, .confirmation-cancel, .confirmation-confirm',
    detailsTabStops: 'button, [tabindex], input, select',
    pickedOption: '[aria-checked="true"]',
});

let closeActiveConfirmation = null;

function appendClassWhen(baseClass, condition, extraClass)
{
    return condition ? `${baseClass} ${extraClass}` : baseClass;
}

function isFocusReturnTarget(element)
{
    return element instanceof HTMLElement && element.isConnected;
}

function isLiveTabStop(control)
{
    return (
        control.getAttribute('tabindex') !== '-1'
        && !control.disabled
        && !control.hidden
    );
}

function findLiveDetailsTabStops(detailsPanel)
{
    const detailsControls = [...detailsPanel.querySelectorAll(SELECTOR.detailsTabStops)];
    return detailsControls.filter(isLiveTabStop);
}

function focusWithoutScrolling(control)
{
    control.focus({ preventScroll: true });
}

function findAnswerButton(eventTarget)
{
    const canQuery = typeof eventTarget?.closest === 'function';
    return canQuery
        ? eventTarget.closest(SELECTOR.answers)
        : null;
}

function isRepeatClick(event)
{
    return (
        event.type === EVENT.click
        && Number(event.detail) > 1
    );
}

function buildButton({ className, label })
{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
}

function buildVeil()
{
    const veil = document.createElement('div');
    veil.className = CLASS.veil;
    return veil;
}

function buildDialog({ isDanger, component, tone })
{
    const dialog = document.createElement('section');
    dialog.className = appendClassWhen(
        CLASS.dialog,
        isDanger,
        CLASS.danger,
    );
    stampModalSize(dialog, MODAL_SIZE);
    ModalModelFor('confirm').apply(dialog);
    const dialogRole = isDanger
        ? 'alertdialog'
        : 'dialog';
    dialog.setAttribute('role', dialogRole);
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', ELEMENT_ID.dialogTitle);
    dialog.setAttribute('aria-describedby', ELEMENT_ID.copy);
    dialog.tabIndex = -1;
    markUiComponent(dialog, component, tone);
    return dialog;
}

function buildTargetLine(target)
{
    if (!target)
    {
        return null;
    }
    return buildElement(
        'p',
        {
            class: CLASS.target,
            id: ELEMENT_ID.target,
        },
        String(target),
    );
}

function buildDetailsPanel({ detailsHtml, detailsNode })
{
    const detailsPanel = document.createElement('div');
    detailsPanel.className = CLASS.details;
    detailsPanel.hidden = !detailsHtml && !detailsNode;
    if (detailsHtml)
    {
        detailsPanel.innerHTML = detailsHtml;
    }
    if (detailsNode)
    {
        detailsPanel.append(detailsNode);
    }
    return detailsPanel;
}

function buildCancelButton(cancelLabel)
{
    const cancelButton = buildButton({
        className: CLASS.cancel,
        label: cancelLabel,
    });
    markUiComponent(cancelButton, UI_COMPONENTS.confirmationCancel, 'neutral');
    return cancelButton;
}

function buildConfirmButton({
    confirmLabel,
    isDanger,
    confirmEnabled,
    tone,
})
{
    const confirmButton = buildButton({
        className: appendClassWhen(CLASS.confirm, isDanger, CLASS.confirmDanger),
        label: confirmLabel,
    });
    confirmButton.hidden = !confirmEnabled;
    markUiComponent(confirmButton, UI_COMPONENTS.confirmationAction, tone);
    return confirmButton;
}

function markVeilAsInputShield(veil)
{
    veil.className += ` ${CLASS.inputShield}`;
    veil.setAttribute('aria-hidden', 'true');
}

function addInputShieldListeners(veil, consume)
{
    SHIELD_EVENTS.forEach((type) =>
    {
        veil.addEventListener(type, consume, true);
    });
    KEY_EVENTS.forEach((type) =>
    {
        window.addEventListener(type, consume, true);
    });
}

function removeInputShieldListeners(veil, consume)
{
    SHIELD_EVENTS.forEach((type) =>
    {
        veil.removeEventListener(type, consume, true);
    });
    KEY_EVENTS.forEach((type) =>
    {
        window.removeEventListener(type, consume, true);
    });
}

function holdNavigationInputShield({ veil, durationMs })
{
    markVeilAsInputShield(veil);

    let releaseTimer = null;
    let released = false;
    const release = () =>
    {
        if (released)
        {
            return;
        }
        released = true;
        if (releaseTimer != null)
        {
            clearTimeout(releaseTimer);
        }
        removeInputShieldListeners(veil, consume);
        veil.remove();
    };
    const consume = (event) =>
    {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        if (isRepeatClick(event))
        {
            queueMicrotask(release);
        }
    };
    addInputShieldListeners(veil, consume);

    const armRelease = () =>
    {
        const delayMs = Math.max(0, Number(durationMs) || 0);
        releaseTimer = setTimeout(release, delayMs);
    };
    const afterDestinationPaint = () =>
    {
        if (typeof window.requestAnimationFrame !== 'function')
        {
            return armRelease();
        }
        window.requestAnimationFrame(() =>
        {
            window.requestAnimationFrame(armRelease);
        });
    };
    return Object.freeze({
        release,
        afterDestinationPaint,
    });
}

export function CloseConfirmationModal({ restoreFocus = false } = {})
{
    closeActiveConfirmation?.({ restoreFocus });
}

export function OpenConfirmationModal({
    title,
    message,
    confirmLabel = translate('common.continue'),
    cancelLabel = translate('common.back'),
    consequence = '',
    target = '',
    detailsHtml = '',
    detailsNode = null,
    tone = TONE_NORMAL,
    onConfirm,
    onCancel = () =>
    {},
    returnFocusElement = document.activeElement,
    component = UI_COMPONENTS.confirmationModal,
    inputShieldMs = CONFIRMATION_INPUT_SHIELD_MS,
    confirmEnabled = true,
} = {})
{
    CloseConfirmationModal();

    const isDanger = tone === TONE_DANGER;
    const veil = buildVeil();
    const dialog = buildDialog({
        isDanger,
        component,
        tone,
    });
    const header = buildHeader();
    const targetLine = buildTargetLine(target);
    if (targetLine)
    {
        const describedBy = `${ELEMENT_ID.target} ${ELEMENT_ID.copy}`;
        dialog.setAttribute('aria-describedby', describedBy);
    }
    const messageCopy = prose(message || '', {
        id: ELEMENT_ID.copy,
        class: CLASS.copy,
    });
    const detailsPanel = buildDetailsPanel({
        detailsHtml,
        detailsNode,
    });
    const cancelButton = buildCancelButton(cancelLabel);
    const confirmButton = buildConfirmButton({
        confirmLabel,
        isDanger,
        confirmEnabled,
        tone,
    });
    mountDialog();

    const unregisterModal = registerModal('confirmation', dialog);
    let closed = false;
    const close = ({
        restoreFocus = true,
        retainInputShield = false,
    } = {}) =>
    {
        if (closed)
        {
            return;
        }
        closed = true;
        window.removeEventListener('keydown', onKeydown, true);
        if (retainInputShield)
        {
            dialog.remove();
        }
        else
        {
            veil.remove();
        }
        if (closeActiveConfirmation === close)
        {
            closeActiveConfirmation = null;
        }
        if (restoreFocus && isFocusReturnTarget(returnFocusElement))
        {
            returnFocusElement.focus({ preventScroll: true });
        }
        // Last: releasing the last modal runs whenNoOverlay() waiters,
        // and one of those may replace the element focus just returned to.
        unregisterModal();
    };
    closeActiveConfirmation = close;

    const cancel = () =>
    {
        if (closed)
        {
            return;
        }
        close();
        onCancel();
    };

    cancelButton.addEventListener(EVENT.click, cancel);
    confirmButton.addEventListener(EVENT.click, commitConfirmation);
    listenForScrimAndAnswerClicks();
    window.addEventListener('keydown', onKeydown, true);
    setTimeout(focusInitialControl, 0);

    return Object.freeze({
        veil,
        dialog,
        cancelButton,
        confirmButton,
        close,
        cancel,
    });

    function buildHeader()
    {
        const modalHeader = modalHead({
            eyebrow: consequence,
            title: title || 'Confirm action',
            titleId: ELEMENT_ID.dialogTitle,
            closeLabel: cancelLabel,
            onClose: () => cancel(),
        });
        modalHeader.querySelector?.(SELECTOR.modalClose)?.classList.add(CLASS.close);
        modalHeader.querySelector?.(SELECTOR.modalEyebrow)?.classList.add(CLASS.eyebrowTag);
        return modalHeader;
    }

    function mountDialog()
    {
        const footer = modalFooter({
            secondary: [cancelButton],
            primary: confirmButton,
            className: CLASS.footer,
            size: FOOTER_SIZE,
        });
        const bodyPanel = buildElement(
            'div',
            {
                class: CLASS.bodyPanel,
            },
            [targetLine, messageCopy, detailsPanel],
        );
        const modalBody = buildElement(
            'div',
            {
                class: CLASS.body,
            },
            bodyPanel,
        );
        dialog.append(header, modalBody, footer);
        veil.appendChild(dialog);
        document.body.appendChild(veil);
    }

    function isCoveredByAnotherModal()
    {
        const topOpenModal = topModal();
        return (
            topOpenModal
            && topOpenModal.element !== dialog
        );
    }

    function readTabOrder()
    {
        const detailsTabStops = detailsNode
            ? findLiveDetailsTabStops(detailsPanel)
            : [];
        const confirmTabStops = confirmEnabled
            ? [confirmButton]
            : [];
        return [
            ...detailsTabStops,
            cancelButton,
            ...confirmTabStops,
        ];
    }

    function trapTabFocus(event)
    {
        const tabOrder = readTabOrder();
        const focusedIndex = tabOrder.indexOf(document.activeElement);
        const lastIndex = tabOrder.length - 1;
        if (
            event.shiftKey
            && focusedIndex <= 0
        )
        {
            event.preventDefault();
            focusWithoutScrolling(tabOrder[lastIndex]);
        }
        else if (
            !event.shiftKey
            && focusedIndex === lastIndex
        )
        {
            event.preventDefault();
            focusWithoutScrolling(tabOrder[0]);
        }
    }

    function onKeydown(event)
    {
        if (isCoveredByAnotherModal())
        {
            return;
        }
        if (event.key === 'Escape')
        {
            event.preventDefault();
            event.stopImmediatePropagation();
            cancel();
            return;
        }
        if (event.key !== 'Tab')
        {
            return;
        }
        trapTabFocus(event);
    }

    function dispatchCommitEvent()
    {
        const commitEvent = new CustomEvent(CONFIRMATION_COMMIT_EVENT, {
            detail: {
                component,
                tone,
            },
        });
        window.dispatchEvent(commitEvent);
    }

    function commitConfirmation()
    {
        if (
            !confirmEnabled
            || closed
        )
        {
            return;
        }
        close({ restoreFocus: false, retainInputShield: true });
        const shield = holdNavigationInputShield({ veil, durationMs: inputShieldMs });
        dispatchCommitEvent();
        let awaitingDestination = false;
        try
        {
            const destination = onConfirm?.();
            if (
                destination
                && typeof destination.then === 'function'
            )
            {
                awaitingDestination = true;
                const { afterDestinationPaint } = shield;
                Promise.resolve(destination).then(afterDestinationPaint, afterDestinationPaint);
            }
        }
        finally
        {
            if (!awaitingDestination)
            {
                shield.afterDestinationPaint();
            }
        }
    }

    function listenForScrimAndAnswerClicks()
    {
        let pressBeganOnScrim = false;
        let pressBeganOnAnswer = null;
        veil.addEventListener(EVENT.pointerDown, (event) =>
        {
            pressBeganOnScrim = event.target === veil;
            pressBeganOnAnswer = findAnswerButton(event.target);
        }, true);
        veil.addEventListener(EVENT.click, (event) =>
        {
            const answerButton = findAnswerButton(event.target);
            const pressedAnswerButton = pressBeganOnAnswer;
            pressBeganOnAnswer = null;
            if (
                answerButton
                && event.detail > 0
                && pressedAnswerButton !== answerButton
            )
            {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            const scrimWasPressed = pressBeganOnScrim;
            pressBeganOnScrim = false;
            if (
                event.target === veil
                && scrimWasPressed
            )
            {
                cancel();
            }
        }, true);
    }

    function focusInitialControl()
    {
        if (closed)
        {
            return;
        }
        const picked = detailsNode
            ? detailsPanel.querySelector(SELECTOR.pickedOption)
            : null;
        (picked || cancelButton).focus({ preventScroll: true });
    }
}
