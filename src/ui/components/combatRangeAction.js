import { combatRangeActionPlan } from '../models/CombatRangeActionModel.js';

// A temporary action attachment, never an authored card or a second price rule.
export function combatRangeAction(preview, { onChoose, disabled = false, ...options } = {}) {
  const plan = combatRangeActionPlan(preview, options);
  if (!plan) return null;
  const root = document.createElement('div');
  root.className = 'combat-range-action';
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
