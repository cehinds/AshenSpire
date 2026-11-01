// One small shared toast: a polite live region that shows a sentence for about
// three seconds over the screen that raised it, then fades out (or, with
// reduced motion, is simply hidden). Never takes a click. One at a time: the
// newest replaces the last. The host screen redraws itself, so it calls
// `attach(parent)` after each draw to put the same node back while it still
// has time left (owner wireframe, 2026-11-01: the Armoury status line).
import { reducedMotionRequested } from '../motion.js';

export const TOAST_MS = 3000;
export const TOAST_FADE_MS = 300;

export function createToast({ ms = TOAST_MS, fadeMs = TOAST_FADE_MS, reduced = reducedMotionRequested } = {}) {
  let node = null, timer = null, fadeTimer = null;
  const ensure = () => {
    if (node) return node;
    node = document.createElement('div');
    node.className = 'as-toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.hidden = true;
    return node;
  };
  const hide = () => {
    clearTimeout(timer); clearTimeout(fadeTimer); timer = fadeTimer = null;
    if (!node) return;
    node.hidden = true;
    node.classList.remove('is-leaving');
    node.textContent = '';
    node.remove();
  };
  const leave = () => {
    timer = null;
    if (!node) return;
    if (reduced()) { hide(); return; }
    node.classList.add('is-leaving');
    fadeTimer = setTimeout(hide, fadeMs);
  };
  return {
    /** Shows `text`, replacing any toast already up, and restarts the clock. */
    show(text, parent = null) {
      if (!text) return null;
      const el = ensure();
      clearTimeout(timer); clearTimeout(fadeTimer); fadeTimer = null;
      el.classList.remove('is-leaving');
      el.textContent = String(text);
      el.hidden = false;
      if (parent) parent.appendChild(el);
      timer = setTimeout(leave, ms);
      return el;
    },
    /** Puts a toast still showing back into a freshly drawn `parent`. */
    attach(parent) {
      if (node && !node.hidden && parent) parent.appendChild(node);
    },
    hide,
    get node() { return node; },
  };
}
