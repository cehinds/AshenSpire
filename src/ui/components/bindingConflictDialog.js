// Shared Controls rebind conflict dialog. It owns dialog semantics, containment
// and focus return; the screen supplies the three semantic decisions.
import { esc } from './tooltip.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

export function mountBindingConflictDialog(host, model, {
  onChooseAnother,
  onReplace,
  onCancel,
  returnFocusElement,
}) {
  const returnFocus = returnFocusElement instanceof HTMLElement
    ? returnFocusElement
    : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const veil = document.createElement('div');
  veil.className = 'modal-veil binding-conflict-veil';
  const dialog = document.createElement('section');
  dialog.className = 'modal binding-conflict-dialog';
  dialog.setAttribute('role', model.accessibility.role);
  dialog.setAttribute('aria-modal', String(model.accessibility.modal));
  dialog.setAttribute('aria-labelledby', 'binding-conflict-title');
  dialog.setAttribute('aria-describedby', 'binding-conflict-copy binding-conflict-consequence');
  dialog.tabIndex = -1;
  markUiComponent(dialog, UI.bindingConflictDialog, model.variant);
  dialog.innerHTML = `
    <span class="binding-conflict-eyebrow">Controls</span>
    <h2 id="binding-conflict-title">${esc(model.properties.title)}</h2>
    <p id="binding-conflict-copy" class="binding-conflict-copy">${esc(model.properties.message)}</p>
    <p id="binding-conflict-consequence" class="binding-conflict-consequence">${esc(model.properties.consequence)}</p>
    <div class="binding-conflict-actions">
      <button type="button" class="subtle binding-conflict-choose">${esc(model.properties.chooseLabel)}</button>
      <button type="button" class="binding-conflict-replace">${esc(model.properties.replaceLabel)}</button>
      <button type="button" class="subtle binding-conflict-cancel">${esc(model.properties.cancelLabel)}</button>
    </div>`;
  veil.appendChild(dialog);
  host.appendChild(veil);

  let closed = false;
  function close({ restoreFocus = true } = {}) {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown, true);
    veil.remove();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function decide(callback) {
    close();
    callback();
  }
  function onKeydown(event) {
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable(dialog);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  dialog.querySelector('.binding-conflict-choose').addEventListener('click', () => decide(onChooseAnother));
  dialog.querySelector('.binding-conflict-replace').addEventListener('click', () => decide(onReplace));
  dialog.querySelector('.binding-conflict-cancel').addEventListener('click', () => decide(onCancel));
  veil.addEventListener('click', (event) => {
    if (event.target === veil) decide(onCancel);
  });
  window.addEventListener('keydown', onKeydown, true);
  queueMicrotask(() => dialog.querySelector('.binding-conflict-choose')?.focus({ preventScroll: true }));

  return { close };
}
