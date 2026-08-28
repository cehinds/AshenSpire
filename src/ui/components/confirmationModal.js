import { esc } from './tooltip.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

/** Shared reversible confirmation. Nothing commits until the primary action. */
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
  const veil = document.createElement('div');
  veil.className = 'modal-veil confirmation-veil';
  const modal = document.createElement('section');
  modal.className = `modal confirmation-modal${tone === 'danger' ? ' danger' : ''}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'confirmation-modal-title');
  modal.tabIndex = -1;
  modal.innerHTML = `
    <header><span class="confirmation-eyebrow">${esc(consequence)}</span><h2 id="confirmation-modal-title">${esc(title)}</h2></header>
    <div class="confirmation-copy">${message}</div>
    <footer><button type="button" class="subtle confirmation-cancel">${esc(cancelLabel)}</button>
      <button type="button" class="confirmation-confirm${tone === 'danger' ? ' danger' : ''}">${esc(confirmLabel)}</button></footer>`;
  markUiComponent(modal, component, tone);
  markUiComponent(modal.querySelector('.confirmation-confirm'), UI.confirmationAction, tone);
  veil.appendChild(modal);
  document.body.appendChild(veil);
  const cancel = modal.querySelector('.confirmation-cancel');
  const confirm = modal.querySelector('.confirmation-confirm');
  let closed = false;

  const close = ({ restore = true } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', keydown, true);
    veil.remove();
    if (restore && returnFocusElement instanceof HTMLElement && returnFocusElement.isConnected) {
      returnFocusElement.focus({ preventScroll: true });
    }
  };
  const back = () => { close(); onCancel(); };
  function keydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      back();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = [cancel, confirm];
    const at = nodes.indexOf(document.activeElement);
    if (event.shiftKey && at <= 0) { event.preventDefault(); confirm.focus(); }
    else if (!event.shiftKey && at === nodes.length - 1) { event.preventDefault(); cancel.focus(); }
  }
  cancel.addEventListener('click', back);
  confirm.addEventListener('click', () => { close({ restore: false }); onConfirm?.(); });
  veil.addEventListener('click', (event) => { if (event.target === veil) back(); });
  window.addEventListener('keydown', keydown, true);
  queueMicrotask(() => cancel.focus({ preventScroll: true }));
  return { close };
}
