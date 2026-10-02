// src/ui/components/artLoadNotice.js — the title's "the art could not be
// loaded" notice and its Retry (docs/EXTERNAL-ASSETS-PLAN.md step 5).
//
// A small panel inside the title screen, never a dialog: nothing behind it is
// blocked and focus is not taken from the title. The message is a polite live
// region; the Retry button is a plain control in the title's own focus order
// (inside #app, so the controller cursor reaches it). It is the FIRST child of
// the title root, so reading, Tab and cursor order meet it before the menu, as
// it is drawn at the top. ONE live node per title root: a state change rewrites
// its text in place (screen readers announce a change to a live region already
// in the page, not one that arrives with its words), and a state not yet
// announced is written a moment after the node appears. While a Retry runs the
// button is aria-disabled (not disabled, which would drop the focus on it) and
// the message says so. The view owns no state: the composition root hands it a
// model (ArtLoadNoticeModel) and the one command.

import { childModel } from '../models/ComponentModel.js';
import { esc } from './tooltip.js';

/** The notice's markup for a model; `text: false` leaves the live message empty, to be written in place. */
export function artLoadNoticeHtml(model, { text = true } = {}) {
  const retry = childModel(model, 'art-load-notice-retry');
  const busy = !!retry.properties.busy;
  return `<aside class="art-load-notice" data-component="art-load-notice" data-state="${esc(model.variant)}" aria-labelledby="art-load-notice-text">
      <p class="art-load-notice-text" id="art-load-notice-text" role="${esc(model.accessibility.role)}" aria-live="${esc(model.accessibility.live)}">${text ? esc(model.properties.message) : ''}</p>
      <button type="button" class="as-btn art-load-notice-retry" data-component="art-load-notice-retry" data-art-notice-retry
        aria-description="${esc(retry.accessibility.description)}"${busy ? ' aria-disabled="true" aria-busy="true"' : ''}>${esc(retry.properties.label)}</button>
    </aside>`;
}

// The state whose words were last announced, across title redraws: a title
// that redraws itself (a modal opening) draws the notice again with its words
// already in place, so the same state is not announced twice.
let announced = null;

/**
 * mountArtLoadNotice(root, { model, onRetry }) → the notice element. Draws the
 * notice as the first child of `root` (the title screen), or updates the one
 * already there in place. `onRetry` runs on a press while Retry is not busy.
 */
export function mountArtLoadNotice(root, { model, onRetry, announceDelayMs = 80, schedule = (fn, ms) => setTimeout(fn, ms) } = {}) {
  if (!root || typeof root.querySelector !== 'function' || !model) return null;
  let el = root.querySelector(':scope > .art-load-notice');
  const fresh = !el;
  const message = String(model.properties.message);
  const unannounced = announced !== model.variant;
  if (fresh) {
    root.insertAdjacentHTML('afterbegin', artLoadNoticeHtml(model, { text: !unannounced }));
    el = root.querySelector(':scope > .art-load-notice');
    const button = el?.querySelector('[data-art-notice-retry]');
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      if (button.getAttribute('aria-disabled') === 'true') return;
      el.ashenOnRetry?.();
    });
  }
  if (!el) return null;
  el.ashenOnRetry = onRetry;
  el.dataset.state = model.variant;
  const retry = childModel(model, 'art-load-notice-retry');
  const button = el.querySelector('[data-art-notice-retry]');
  if (button) {
    if (retry.properties.busy) { button.setAttribute('aria-disabled', 'true'); button.setAttribute('aria-busy', 'true'); }
    else { button.removeAttribute('aria-disabled'); button.removeAttribute('aria-busy'); }
  }
  const text = el.querySelector('.art-load-notice-text');
  // Every write to the message takes a ticket; a delayed write lands only if
  // no newer one came since (a Retry pressed inside the delay must not have
  // its "Loading art…" overwritten by the older failure; Codex on #1471).
  const ticket = (el.ashenWriteTicket || 0) + 1;
  el.ashenWriteTicket = ticket;
  if (text && unannounced) {
    // Written after the node is in the page, so the change is announced.
    // A state counts as announced only once its words have landed in a node
    // in the page: a title redrawn inside the delay draws a fresh node, which
    // arms the delay again (review of #1471).
    if (fresh) {
      const variant = model.variant;
      schedule(() => {
        if (!text.isConnected || el.ashenWriteTicket !== ticket) return;
        text.textContent = message;
        announced = variant;
      }, announceDelayMs);
    } else { text.textContent = message; announced = model.variant; }
  } else if (text && text.textContent !== message) text.textContent = message;
  return el;
}

/** For tests: forget what was announced. */
export function resetArtLoadNotice() { announced = null; }
