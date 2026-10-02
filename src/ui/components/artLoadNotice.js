// src/ui/components/artLoadNotice.js — the title's "the art could not be
// loaded" notice and its Retry (docs/EXTERNAL-ASSETS-PLAN.md step 5).
//
// A small panel inside the title screen, never a dialog: nothing behind it is
// blocked and focus is not taken from the title. The message is a polite live
// region; the Retry button is a plain control in the title's own focus order
// (inside #app, so the controller cursor reaches it). While a Retry runs the
// button is disabled and the message says so; a Retry that fails again keeps
// focus on the button. The view owns no state: the composition root hands it a
// model (ArtLoadNoticeModel) and the one command.

import { childModel } from '../models/ComponentModel.js';
import { esc } from './tooltip.js';

/** The notice's markup for a model. */
export function artLoadNoticeHtml(model) {
  const retry = childModel(model, 'art-load-notice-retry');
  const busy = !!retry.properties.busy;
  return `<aside class="art-load-notice" data-component="art-load-notice" data-state="${esc(model.variant)}" aria-labelledby="art-load-notice-text">
      <p class="art-load-notice-text" id="art-load-notice-text" role="${esc(model.accessibility.role)}" aria-live="${esc(model.accessibility.live)}">${esc(model.properties.message)}</p>
      <button type="button" class="as-btn art-load-notice-retry" data-component="art-load-notice-retry" data-art-notice-retry
        aria-description="${esc(retry.accessibility.description)}"${busy ? ' disabled aria-busy="true"' : ''}>${esc(retry.properties.label)}</button>
    </aside>`;
}

/**
 * mountArtLoadNotice(root, { model, onRetry }) → the notice element. Puts the
 * notice at the end of `root` (the title screen), replacing one already there:
 * the title redraws its own markup, and the composition root draws the notice
 * again each time, in whatever state it is in. When focus was inside the old
 * notice it stays there: on Retry once it can be pressed again, else on the
 * message. `onRetry` runs on a press while the button is enabled.
 */
export function mountArtLoadNotice(root, { model, onRetry } = {}) {
  if (!root || typeof root.querySelector !== 'function' || !model) return null;
  const old = root.querySelector('.art-load-notice');
  const hadFocus = !!old && old.contains(globalThis.document?.activeElement);
  old?.remove();
  root.insertAdjacentHTML('beforeend', artLoadNoticeHtml(model));
  const el = root.querySelector('.art-load-notice');
  const button = el?.querySelector('[data-art-notice-retry]');
  button?.addEventListener('click', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onRetry?.();
  });
  if (hadFocus) {
    if (button && !button.disabled) button.focus({ preventScroll: true });
    else {
      const text = el?.querySelector('.art-load-notice-text');
      text?.setAttribute('tabindex', '-1');
      text?.focus({ preventScroll: true });
    }
  }
  return el;
}
