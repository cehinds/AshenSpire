import { esc } from './tooltip.js';
import { assetUrl } from '../assetmap.js';

let activeFlaskActionMenu = null;

/** One data-owned identity fragment; every surface may add its own surrounding copy. */
export function flaskIdentityHtml(def, { showName = true, className = '' } = {}) {
  const art = def.artAsset
    ? `<img class="flask-art-image" src="${esc(assetUrl(def.artAsset))}" alt="">`
    : `<span class="flask-art-glyph">${esc(def.icon)}</span>`;
  return `<span class="flask-identity ${esc(className)}" data-flask-art="${esc(def.artKey)}" style="--flask-tint:${esc(def.tint)}" aria-label="${esc(def.name)}">`
    + `<span class="flask-art" aria-hidden="true">${art}</span>`
    + (showName ? `<span class="flask-name">${esc(def.name)}</span>` : '')
    + '</span>';
}

export function flaskPresentation(def, options = {}) {
  const el = document.createElement(options.tag || 'span');
  el.className = options.hostClass || '';
  el.innerHTML = flaskIdentityHtml(def, options);
  return el;
}

/**
 * Shared, placement-independent flask action menu. The caller supplies the
 * plan and owns mutations; selection and inspection are inert here.
 */
export function mountFlaskActionMenu(anchor, { def, plan, onAction, onCancel, wireAction } = {}) {
  if (!anchor || !def || !plan) throw new Error('mountFlaskActionMenu requires anchor, def, and plan');
  // One menu at a time, and close through its lifecycle so its window-level
  // controller Cancel listener cannot survive after the DOM has gone.
  if (activeFlaskActionMenu) activeFlaskActionMenu.close({ cancelled: true });
  const root = document.createElement('div');
  root.className = 'flask-action-menu';
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', `${def.name} actions`);
  root.innerHTML = `<strong>${esc(def.name)}</strong>`
    + `<div class="flask-action-detail" hidden>${esc(def.textTemplate || '')}</div>`;
  const buttons = [];
  let closed = false;
  const close = ({ cancelled = false } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onGlobalCancel);
    root.remove();
    if (activeFlaskActionMenu?.root === root) activeFlaskActionMenu = null;
    if (cancelled && onCancel) onCancel();
    if (anchor.isConnected && typeof anchor.focus === 'function') anchor.focus();
  };
  // Gamepad Cancel is a synthesized Escape dispatched on window by input.js,
  // not on the focused button. Root bubbling covers physical keyboard Escape;
  // this mounted listener is the parity seam for pad B / Back.
  const onGlobalCancel = (ev) => {
    if (ev.key !== 'Escape' && ev.key !== 'Backspace') return;
    ev.preventDefault();
    close({ cancelled: true });
  };
  for (const row of plan.actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'flask-action';
    button.dataset.flaskAction = row.id;
    button.dataset.focusable = 'true';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-disabled', String(!row.enabled));
    button.textContent = row.label;
    if (!row.enabled) {
      button.dataset.unavailableReason = row.reason;
      button.title = row.reason;
    }
    const invoke = () => {
      if (!row.enabled) return;
      if (row.id === 'inspect') {
        root.querySelector('.flask-action-detail').hidden = false;
        return;
      }
      if (onAction) onAction(row.id);
      close();
    };
    const wired = wireAction ? wireAction(row, button, invoke) : false;
    if (!wired) button.addEventListener('click', invoke);
    root.appendChild(button);
    buttons.push(button);
  }
  const move = (delta) => {
    const at = Math.max(0, buttons.indexOf(document.activeElement));
    buttons[(at + delta + buttons.length) % buttons.length].focus();
  };
  root.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' || ev.key === 'Backspace') { ev.preventDefault(); close({ cancelled: true }); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); move(1); }
    else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); move(-1); }
    else if (ev.key === 'Home') { ev.preventDefault(); buttons[0]?.focus(); }
    else if (ev.key === 'End') { ev.preventDefault(); buttons.at(-1)?.focus(); }
  });
  window.addEventListener('keydown', onGlobalCancel);
  (anchor.closest('.combat,.mapscreen') || document.body).appendChild(root);
  (buttons.find((button) => button.getAttribute('aria-disabled') === 'false') || buttons[0])?.focus();
  activeFlaskActionMenu = Object.freeze({ root, buttons: Object.freeze(buttons), close });
  return activeFlaskActionMenu;
}
