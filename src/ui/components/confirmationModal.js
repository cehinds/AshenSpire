// Shared themed confirmation surface for reversible, potentially destructive
// choices. The action is not committed until the primary button is pressed.

import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

let activeClose = null;
export const CONFIRMATION_COMMIT_EVENT = 'ashenspire:confirmation-commit';

export function closeConfirmationModal({ restoreFocus = false } = {}) {
  activeClose?.({ restoreFocus });
}

export function openConfirmationModal({
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Back',
  consequence = '',
  tone = 'normal',
  onConfirm,
  onCancel = () => {},
  returnFocusElement = document.activeElement,
  component = UI.confirmationModal,
} = {}) {
  // One service, one active decision. Repeated activation replaces the stale
  // surface without committing or reporting a cancellation that was not made.
  closeConfirmationModal();

  const veil = document.createElement('div');
  veil.className = 'modal-veil confirmation-veil';

  const dialog = document.createElement('section');
  dialog.className = `modal confirmation-modal${tone === 'danger' ? ' danger' : ''}`;
  dialog.setAttribute('role', tone === 'danger' ? 'alertdialog' : 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'confirmation-modal-title');
  dialog.setAttribute('aria-describedby', 'confirmation-modal-copy');
  dialog.tabIndex = -1;
  markUiComponent(dialog, component, tone);

  const header = document.createElement('header');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'confirmation-eyebrow';
  eyebrow.textContent = consequence;
  eyebrow.hidden = !consequence;
  const heading = document.createElement('h2');
  heading.id = 'confirmation-modal-title';
  heading.textContent = title || 'Confirm action';
  header.append(eyebrow, heading);

  const copy = document.createElement('p');
  copy.id = 'confirmation-modal-copy';
  copy.className = 'confirmation-copy';
  copy.textContent = message || '';

  const footer = document.createElement('footer');
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'subtle confirmation-cancel';
  cancelButton.textContent = cancelLabel;
  markUiComponent(cancelButton, UI.confirmationCancel, 'neutral');
  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = `subtle confirmation-confirm${tone === 'danger' ? ' danger' : ''}`;
  confirmButton.textContent = confirmLabel;
  markUiComponent(confirmButton, UI.confirmationAction, tone);
  footer.append(cancelButton, confirmButton);
  dialog.append(header, copy, footer);
  veil.appendChild(dialog);
  document.body.appendChild(veil);

  let closed = false;
  const close = ({ restoreFocus = true } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown, true);
    veil.remove();
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
    const controls = [cancelButton, confirmButton];
    const at = controls.indexOf(document.activeElement);
    if (event.shiftKey && at <= 0) {
      event.preventDefault();
      confirmButton.focus({ preventScroll: true });
    } else if (!event.shiftKey && at === controls.length - 1) {
      event.preventDefault();
      cancelButton.focus({ preventScroll: true });
    }
  }

  cancelButton.addEventListener('click', cancel);
  confirmButton.addEventListener('click', () => {
    if (closed) return;
    close({ restoreFocus: false });
    window.dispatchEvent(new CustomEvent(CONFIRMATION_COMMIT_EVENT, {
      detail: { component, tone },
    }));
    onConfirm?.();
  });
  veil.addEventListener('click', (event) => {
    if (event.target === veil) cancel();
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
