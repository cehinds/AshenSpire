// Shared themed confirmation surface for reversible, potentially destructive
// choices. The action is not committed until the primary button is pressed.

import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { modalHead, modalFooter, el, prose } from '../kit/index.js';

let activeClose = null;
export const CONFIRMATION_COMMIT_EVENT = 'ashenspire:confirmation-commit';
export const CONFIRMATION_INPUT_SHIELD_MS = 600;

function holdNavigationInputShield({ veil, durationMs }) {
  veil.className += ' confirmation-input-shield';
  veil.setAttribute('aria-hidden', 'true');

  let timer = null;
  let released = false;
  const shieldEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'];
  const keyEvents = ['keydown', 'keyup'];
  const release = () => {
    if (released) return;
    released = true;
    if (timer != null) clearTimeout(timer);
    shieldEvents.forEach((type) => veil.removeEventListener(type, consume, true));
    keyEvents.forEach((type) => window.removeEventListener(type, consume, true));
    veil.remove();
  };
  const consume = (event) => {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    // A real second physical click may carry detail 2 even though the original
    // button was removed. Release only after that activation has landed on the
    // shield; otherwise the timeout covers the platform double-click window.
    if (event.type === 'click' && Number(event.detail) > 1) queueMicrotask(release);
  };
  shieldEvents.forEach((type) => veil.addEventListener(type, consume, true));
  keyEvents.forEach((type) => window.addEventListener(type, consume, true));

  const armRelease = () => { timer = setTimeout(release, Math.max(0, Number(durationMs) || 0)); };
  const afterDestinationPaint = () => {
    if (typeof window.requestAnimationFrame !== 'function') return armRelease();
    window.requestAnimationFrame(() => window.requestAnimationFrame(armRelease));
  };
  return Object.freeze({ release, afterDestinationPaint });
}

export function closeConfirmationModal({ restoreFocus = false } = {}) {
  activeClose?.({ restoreFocus });
}

export function openConfirmationModal({
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Back',
  consequence = '',
  detailsHtml = '',
  tone = 'normal',
  onConfirm,
  onCancel = () => {},
  returnFocusElement = document.activeElement,
  component = UI.confirmationModal,
  inputShieldMs = CONFIRMATION_INPUT_SHIELD_MS,
  confirmEnabled = true,
} = {}) {
  // One service, one active decision. Repeated activation replaces the stale
  // surface without committing or reporting a cancellation that was not made.
  closeConfirmationModal();

  const veil = document.createElement('div');
  veil.className = 'modal-veil confirmation-veil';

  // BODY C — one question, two answers, at the sm rung: the shell's head
  // (the consequence as eyebrow, the act as title, the one close box), the
  // message as prose, what is at stake in a DetailCard, the foot's two buttons.
  const dialog = document.createElement('section');
  dialog.className = `modal confirmation-modal${tone === 'danger' ? ' danger' : ''}`;
  dialog.dataset.size = 'sm';
  dialog.setAttribute('role', tone === 'danger' ? 'alertdialog' : 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'confirmation-modal-title');
  dialog.setAttribute('aria-describedby', 'confirmation-modal-copy');
  dialog.tabIndex = -1;
  markUiComponent(dialog, component, tone);

  const header = modalHead({
    eyebrow: consequence || (tone === 'danger' ? 'Careful' : 'Confirm'),
    title: title || 'Confirm action',
    titleId: 'confirmation-modal-title',
    closeLabel: cancelLabel,
    onClose: () => cancel(),
  });
  header.querySelector?.('.modal-close')?.classList.add('confirmation-close');

  const copy = prose(message || '', { id: 'confirmation-modal-copy', class: 'confirmation-copy' });

  const details = document.createElement('div');
  details.className = 'confirmation-details as-detailcard muted';
  details.hidden = !detailsHtml;
  // Callers build this only from escaped, model-owned presentation values.
  // Keeping the detail region in the shared modal is what makes costs and
  // consequences uniform rather than a collection of screen-owned dialogs.
  if (detailsHtml) details.innerHTML = detailsHtml;

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'subtle confirmation-cancel';
  cancelButton.textContent = cancelLabel;
  markUiComponent(cancelButton, UI.confirmationCancel, 'neutral');
  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  // `.danger` still reads as danger and keeps the red; every other confirmation
  // is a way FORWARD and now says so with the emphasis rather than by sitting
  // second in a row of two identical buttons.
  confirmButton.className = `confirmation-confirm${tone === 'danger' ? ' subtle danger' : ''}`;
  confirmButton.textContent = confirmLabel;
  confirmButton.hidden = !confirmEnabled;
  markUiComponent(confirmButton, UI.confirmationAction, tone);
  // The house order, from the one home: way out left, way forward right.
  const footer = modalFooter({ secondary: [cancelButton], primary: confirmButton, className: 'confirmation-footer', size: 'long' });
  const body = el('div', { class: 'modal-body' }, el('div', { class: 'as-decide confirmation-body' }, [copy, details]));
  dialog.append(header, body, footer);
  veil.appendChild(dialog);
  document.body.appendChild(veil);

  let closed = false;
  const close = ({ restoreFocus = true, retainInputShield = false } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown, true);
    if (retainInputShield) dialog.remove();
    else veil.remove();
    if (activeClose === close) activeClose = null;
    if (restoreFocus && returnFocusElement instanceof HTMLElement && returnFocusElement.isConnected) {
      returnFocusElement.focus({ preventScroll: true });
    }
  };
  activeClose = close;

  const cancel = () => {
    if (closed) return;
    close();
    onCancel();
  };

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel();
      return;
    }
    if (event.key !== 'Tab') return;
    // The trap wraps over the VISIBLE controls only. When the option is
    // blocked (an unaffordable Smithing upgrade), `confirmEnabled` is false,
    // the confirm button is hidden, and `controls` is Back alone — so Shift+Tab
    // from Back must land on the last entry of `controls`, never on a hidden
    // button that would leave the dialog with no visible focus.
    const controls = [cancelButton, ...(confirmEnabled ? [confirmButton] : [])];
    const at = controls.indexOf(document.activeElement);
    if (event.shiftKey && at <= 0) {
      event.preventDefault();
      controls[controls.length - 1].focus({ preventScroll: true });
    } else if (!event.shiftKey && at === controls.length - 1) {
      event.preventDefault();
      controls[0].focus({ preventScroll: true });
    }
  }

  cancelButton.addEventListener('click', cancel);
  confirmButton.addEventListener('click', () => {
    if (!confirmEnabled) return;
    if (closed) return;
    close({ restoreFocus: false, retainInputShield: true });
    const shield = holdNavigationInputShield({ veil, durationMs: inputShieldMs });
    window.dispatchEvent(new CustomEvent(CONFIRMATION_COMMIT_EVENT, {
      detail: { component, tone },
    }));
    try {
      onConfirm?.();
    } finally {
      // Destination callbacks synchronously replace the app surface today.
      // Two paints let its hit-test tree settle before the bounded shield timer
      // begins; a physical second click is swallowed and may release it sooner.
      shield.afterDestinationPaint();
    }
  });
  // A SCRIM CLICK CANCELS ONLY WHEN THE PRESS BEGAN ON THE SCRIM. With the
  // hold dial off, a control opens this review on pointerup, and the browser
  // then dispatches that same touch's trailing click at the point of release
  // — which is now the scrim (the finger never moved; the veil did). Cancelling
  // on it closed the review in the same gesture that opened it, so an
  // off-dial tap on the title's ✕ opened nothing a player could see. Measured
  // with real touch events (tools/holdconfirm.mjs, the title's dial-off leg):
  // pointerdown on the ✕, MODAL-ADDED, pointerup, click on the veil, REMOVED.
  // A press that begins on the scrim is the player's; a click that arrives
  // without one is the opening gesture's echo.
  let scrimPressed = false;
  veil.addEventListener('pointerdown', (event) => { scrimPressed = event.target === veil; });
  veil.addEventListener('click', (event) => {
    const pressedHere = scrimPressed;
    scrimPressed = false;
    if (event.target === veil && pressedHere) cancel();
  });
  window.addEventListener('keydown', onKeydown, true);
  // Quick-menu actions close their list after awaiting the controller result,
  // and that close restores focus to the launcher. Run after that microtask so
  // the standing confirmation, not the covered screen, owns final focus.
  setTimeout(() => {
    if (!closed) cancelButton.focus({ preventScroll: true });
  }, 0);

  return Object.freeze({ veil, dialog, cancelButton, confirmButton, close, cancel });
}
