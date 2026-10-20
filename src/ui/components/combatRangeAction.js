import { uiZoom } from '../fx.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { combatRangeActionPlan } from '../models/CombatRangeActionModel.js';

// A temporary action attachment, never an authored card or a second price rule.
export function combatRangeAction(preview, { onChoose, disabled = false, ...options } = {}) {
  const plan = combatRangeActionPlan(preview, options);
  if (!plan) return null;
  const root = document.createElement('div');
  root.className = 'combat-range-action';
  markUiComponent(root, UI.combatRangeAction);
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Attack approach');
  // Native controls own their keyboard, including co-op's seat-switch Tab key.
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) root.addEventListener(type, event => event.stopPropagation());
  const choices = document.createElement('div'); choices.className = 'combat-range-choices';
  for (const route of plan.routes) {
    const button = document.createElement('button'); button.type = 'button';
    button.dataset.rangeRoute = route.id;
    button.setAttribute('aria-pressed', String(route.selected));
    button.disabled = disabled || !route.available;
    button.textContent = [route.label, route.total, route.reason].filter(Boolean).join(' · ');
    button.addEventListener('click', () => onChoose?.(route.id));
    choices.append(button);
  }
  root.append(choices);
  const selected = plan.routes.find(route => route.selected);
  if (selected) {
    const odds = document.createElement('div'); odds.className = 'combat-range-odds';
    odds.setAttribute('aria-live', 'polite');
    for (const target of selected.odds) { const row = document.createElement('div'); row.textContent = target.text; odds.append(row); }
    root.append(odds);
  }
  return root;
}

// Keep physical targets outside the scaled/rotated card face and its scroller.
// Reposition only for layout/selection changes, never on a playback frame loop.
export function mountCombatRangeAction(card, preview, options) {
  const node = combatRangeAction(preview, options);
  const host = card?.closest('.hand-overlay');
  if (!node || !host) return () => {};
  host.append(node);
  let queued = null;
  const place = () => {
    queued = null;
    if (!card.isConnected || !node.isConnected) return;
    const zoom = uiZoom();
    const box = card.getBoundingClientRect(), parent = host.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    const center = Math.max(8 + width / 2, Math.min(window.innerWidth - 8 - width / 2, box.left + box.width / 2));
    Object.assign(node.style, { width: `${width / zoom}px`, left: `${(center - parent.left) / zoom}px`, top: `${(box.top - parent.top) / zoom}px` });
  };
  const schedule = () => { if (queued == null) queued = requestAnimationFrame(place); };
  const resize = globalThis.ResizeObserver && new ResizeObserver(schedule);
  resize?.observe(host); resize?.observe(card);
  const changes = globalThis.MutationObserver && new MutationObserver(schedule);
  changes?.observe(card, { attributes: true, attributeFilter: ['style', 'class'] });
  window.addEventListener('resize', schedule);
  card.addEventListener('transitionend', schedule);
  schedule();
  return () => {
    if (queued != null) cancelAnimationFrame(queued);
    resize?.disconnect(); changes?.disconnect();
    window.removeEventListener('resize', schedule);
    card.removeEventListener('transitionend', schedule);
    node.remove();
  };
}
