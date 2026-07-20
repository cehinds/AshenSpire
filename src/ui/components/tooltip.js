// src/ui/components/tooltip.js — one shared tooltip, ≤150 ms hover (SPEC §7.3)

let tipEl = null;
let showTimer = null;

function ensure() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'tooltip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function position(x, y) {
  const el = ensure();
  const pad = 14;
  const r = el.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + r.width > innerWidth - 8) left = x - r.width - pad;
  if (top + r.height > innerHeight - 8) top = y - r.height - pad;
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${Math.max(4, top)}px`;
}

/**
 * attachTooltip(el, contentFn) — contentFn() → HTML string (computed at show
 * time so numbers are always live). Shows on pointer hover AND on the
 * keyboard/gamepad focus cursor (input.js dispatches gpfocus/gpblur when the
 * gp-focus cursor lands on / leaves an element), so controller players get
 * every tooltip a mouse would.
 */
export function attachTooltip(el, contentFn) {
  const show = (x, y) => {
    const html = contentFn();
    if (!html) return;
    const t = ensure();
    t.innerHTML = html;
    t.style.display = 'block';
    position(x, y);
  };
  el.addEventListener('pointerenter', (ev) => {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(ev.clientX, ev.clientY), 140);
  });
  el.addEventListener('pointermove', (ev) => {
    if (tipEl && tipEl.style.display === 'block') position(ev.clientX, ev.clientY);
  });
  el.addEventListener('pointerleave', () => {
    clearTimeout(showTimer);
    if (tipEl) tipEl.style.display = 'none';
  });
  el.addEventListener('gpfocus', () => {
    clearTimeout(showTimer);
    const r = el.getBoundingClientRect();
    showTimer = setTimeout(() => show(r.right, r.top), 160);
  });
  el.addEventListener('gpblur', hideTooltip);
}

export function hideTooltip() {
  clearTimeout(showTimer);
  if (tipEl) tipEl.style.display = 'none';
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
