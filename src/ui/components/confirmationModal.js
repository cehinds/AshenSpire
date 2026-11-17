// Shared themed confirmation surface for reversible, potentially destructive choices.
// Nothing is committed until the primary button is pressed.
import { t as translate } from '../strings.js';
import {
    UI_COMPONENTS,
    markUiComponent,
} from './uiComponents.js';
import {
    modalHead,
    modalFooter,
    el as buildElement,
    prose,
    stampModalSize,
} from '../kit/index.js';
import { registerModal, topModal } from '../modalState.js';
import { ModalModelFor } from '../models/ModalModel.js';

let activeClose = null;
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

function classWhen(baseClass, condition, extraClass)
{
    return condition ? `${baseClass} ${extraClass}` : baseClass;
}

function isFocusReturnTarget(element)
{
    return element instanceof HTMLElement && element.isConnected;
}

function isLiveTabStop(control)
{
    return control.getAttribute('tabindex') !== '-1' && !control.disabled && !control.hidden;
}

function makeButton({ className, label })
{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
}

function holdNavigationInputShield({ veil, durationMs })
{
    veil.className += ` ${CLASS.inputShield}`;
    veil.setAttribute('aria-hidden', 'true');

    let timer = null;
    let released = false;
    const release = () =>
    {
        if (released)
        {
            return;
        }
        released = true;
        if (timer != null)
        {
            clearTimeout(timer);
        }
        SHIELD_EVENTS.forEach((type) =>
        {
            veil.removeEventListener(type, consume, true);
        });
        KEY_EVENTS.forEach((type) =>
        {
            window.removeEventListener(type, consume, true);
        });
        veil.remove();
    };
    const consume = (event) =>
    {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        // A real second click can carry detail 2 after the button is gone; release once it lands on the shield.
        if (event.type === EVENT.click && Number(event.detail) > 1)
        {
            queueMicrotask(release);
        }
    };
    SHIELD_EVENTS.forEach((type) =>
    {
        veil.addEventListener(type, consume, true);
    });
    KEY_EVENTS.forEach((type) =>
    {
        window.addEventListener(type, consume, true);
    });

    const armRelease = () =>
    {
        timer = setTimeout(release, Math.max(0, Number(durationMs) || 0));
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
    return Object.freeze({ release, afterDestinationPaint });
}

export function CloseConfirmationModal({ restoreFocus = false } = {})
{
    activeClose?.({ restoreFocus });
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
    onCancel = () => {},
    returnFocusElement = document.activeElement,
    component = UI_COMPONENTS.confirmationModal,
    inputShieldMs = CONFIRMATION_INPUT_SHIELD_MS,
    confirmEnabled = true,
} = {})
{
    // One active decision: reopening replaces the stale one without committing or cancelling it.
    CloseConfirmationModal();

    const isDanger = tone === TONE_DANGER;
    const veil = document.createElement('div');
    veil.className = CLASS.veil;

    // The eyebrow is the caller's consequence tag or nothing, never a generic category word.
    const dialog = document.createElement('section');
    dialog.className = classWhen(CLASS.dialog, isDanger, CLASS.danger);
    stampModalSize(dialog, MODAL_SIZE);
    ModalModelFor('confirm').apply(dialog);
    dialog.setAttribute('role', isDanger ? 'alertdialog' : 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', ELEMENT_ID.dialogTitle);
    dialog.setAttribute('aria-describedby', ELEMENT_ID.copy);
    dialog.tabIndex = -1;
    markUiComponent(dialog, component, tone);

    const header = modalHead({
        eyebrow: consequence,
        title: title || 'Confirm action',
        titleId: ELEMENT_ID.dialogTitle,
        closeLabel: cancelLabel,
        onClose: () => cancel(),
    });
    header.querySelector?.(SELECTOR.modalClose)?.classList.add(CLASS.close);
    header.querySelector?.(SELECTOR.modalEyebrow)?.classList.add(CLASS.eyebrowTag);

    // Optional: the exact thing the answer acts on. Absent, it draws nothing.
    const targetLine = target
        ? buildElement(
            'p',
            {
                class: CLASS.target,
                id: ELEMENT_ID.target,
            },
            String(target),
        )
        : null;
    if (targetLine)
    {
        dialog.setAttribute('aria-describedby', `${ELEMENT_ID.target} ${ELEMENT_ID.copy}`);
    }
    const messageNode = prose(message || '', {
        id: ELEMENT_ID.copy,
        class: CLASS.copy,
    });

    const detailsPanel = document.createElement('div');
    detailsPanel.className = CLASS.details;
    detailsPanel.hidden = !detailsHtml && !detailsNode;
    // Callers build detailsHtml only from escaped, model-owned values.
    if (detailsHtml)
    {
        detailsPanel.innerHTML = detailsHtml;
    }
    // A live node, for a choice made inside the modal (the card upgrade's options).
    if (detailsNode)
    {
        detailsPanel.append(detailsNode);
    }

    const cancelButton = makeButton({ className: CLASS.cancel, label: cancelLabel });
    markUiComponent(cancelButton, UI_COMPONENTS.confirmationCancel, 'neutral');
    // Danger keeps the red; every other confirmation is emphasised as the way forward.
    const confirmButton = makeButton({
        className: classWhen(CLASS.confirm, isDanger, CLASS.confirmDanger),
        label: confirmLabel,
    });
    confirmButton.hidden = !confirmEnabled;
    markUiComponent(confirmButton, UI_COMPONENTS.confirmationAction, tone);
    // House order: way out on the left, way forward on the right.
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
        [targetLine, messageNode, detailsPanel],
    );
    const bodyNode = buildElement(
        'div',
        {
            class: CLASS.body,
        },
        bodyPanel,
    );
    dialog.append(header, bodyNode, footer);
    veil.appendChild(dialog);
    document.body.appendChild(veil);

    const unregisterModal = registerModal('confirmation', dialog);
    let closed = false;
    const close = ({ restoreFocus = true, retainInputShield = false } = {}) =>
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
        if (activeClose === close)
        {
            activeClose = null;
        }
        if (restoreFocus && isFocusReturnTarget(returnFocusElement))
        {
            returnFocusElement.focus({ preventScroll: true });
        }
        // Last: releasing the last modal runs whenNoOverlay() waiters,
        // and one of those may replace the element focus just returned to.
        unregisterModal();
    };
    activeClose = close;

    const cancel = () =>
    {
        if (closed)
        {
            return;
        }
        close();
        onCancel();
    };

    function onKeydown(event)
    {
        // A modal opened above this one owns Escape and Tab.
        const topOpenModal = topModal();
        if (topOpenModal && topOpenModal.element !== dialog)
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
        // The Tab trap wraps over visible controls only (the confirm button is hidden when blocked).
        // Details tab stops are read now, in DOM order, because a live node re-renders on a pick.
        const detailsTabStops = detailsNode
            ? [...detailsPanel.querySelectorAll(SELECTOR.detailsTabStops)].filter(isLiveTabStop)
            : [];
        const confirmTabStops = confirmEnabled ? [confirmButton] : [];
        const tabOrder = [
            ...detailsTabStops,
            cancelButton,
            ...confirmTabStops,
        ];
        const focusedIndex = tabOrder.indexOf(document.activeElement);
        if (event.shiftKey && focusedIndex <= 0)
        {
            event.preventDefault();
            tabOrder[tabOrder.length - 1].focus({ preventScroll: true });
        }
        else if (!event.shiftKey && focusedIndex === tabOrder.length - 1)
        {
            event.preventDefault();
            tabOrder[0].focus({ preventScroll: true });
        }
    }

    cancelButton.addEventListener(EVENT.click, cancel);
    confirmButton.addEventListener(EVENT.click, () =>
    {
        if (!confirmEnabled || closed)
        {
            return;
        }
        close({ restoreFocus: false, retainInputShield: true });
        const shield = holdNavigationInputShield({ veil, durationMs: inputShieldMs });
        window.dispatchEvent(new CustomEvent(CONFIRMATION_COMMIT_EVENT, {
            detail: {
                component,
                tone,
            },
        }));
        let awaitingDestination = false;
        try
        {
            const destination = onConfirm?.();
            if (destination && typeof destination.then === 'function')
            {
                awaitingDestination = true;
                // Keep the shield until the accepted operation settles (it may wait on a storage lock).
                const { afterDestinationPaint } = shield;
                Promise.resolve(destination).then(afterDestinationPaint, afterDestinationPaint);
            }
        }
        finally
        {
            // Two paints let the new surface's hit-test tree settle before the shield timer starts.
            if (!awaitingDestination)
            {
                shield.afterDestinationPaint();
            }
        }
    });

    // Scrim and answer clicks count only if the press began there: a touch's trailing click
    // after the opening gesture would otherwise cancel or commit the review it just opened.
    // Keyboard and synthetic activations carry detail 0 and pass untouched.
    // Duck-typed: the contract test runs in a minimal DOM with no `Element`.
    const answerButtonOf = (eventTarget) =>
    {
        const canQuery = typeof eventTarget?.closest === 'function';
        return canQuery ? eventTarget.closest(SELECTOR.answers) : null;
    };
    let pressBeganOnScrim = false;
    let pressBeganOnAnswer = null;
    veil.addEventListener(EVENT.pointerDown, (event) =>
    {
        pressBeganOnScrim = event.target === veil;
        pressBeganOnAnswer = answerButtonOf(event.target);
    }, true);
    veil.addEventListener(EVENT.click, (event) =>
    {
        const answerButton = answerButtonOf(event.target);
        const pressedAnswerButton = pressBeganOnAnswer;
        pressBeganOnAnswer = null;
        if (answerButton && event.detail > 0 && pressedAnswerButton !== answerButton)
        {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const scrimWasPressed = pressBeganOnScrim;
        pressBeganOnScrim = false;
        if (event.target === veil && scrimWasPressed)
        {
            cancel();
        }
    }, true);
    window.addEventListener('keydown', onKeydown, true);
    // Deferred so the confirmation, not the covered screen, owns final focus after a menu closes.
    setTimeout(() =>
    {
        if (closed)
        {
            return;
        }
        // With options to choose from, focus starts on the picked one; otherwise on Back.
        const picked = detailsNode ? detailsPanel.querySelector(SELECTOR.pickedOption) : null;
        (picked || cancelButton).focus({ preventScroll: true });
    }, 0);

    return Object.freeze({
        veil,
        dialog,
        cancelButton,
        confirmButton,
        close,
        cancel,
    });
}
