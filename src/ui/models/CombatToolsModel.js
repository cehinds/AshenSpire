import { componentModel } from './ComponentModel.js';
import { behaviorModel } from './BehaviorModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export const COMBAT_LOG_SIZES = Object.freeze(['Small', 'Medium', 'Large']);
export function combatLogHeight({ size = 'Small', cardHeight, viewportHeight, dockTop, menuBottom, gap = 8 }) {
  const available = Math.max(0, dockTop - menuBottom - gap);
  const wanted = size === 'Large' ? available : size === 'Medium' ? viewportHeight / 2 : cardHeight / 2;
  return Math.max(0, Math.min(available, wanted));
}
export function combatToolsModel({ supported, enabled, disabled = false, open = false, size = 'Small', entries = [] }) {
  return componentModel(UI.combatTools, { children: [
    componentModel(UI.combatLogDrawer, { properties: { open, size, entries }, behaviors: [
      behaviorModel('toggleLog', { event: 'activate', policy: 'Read-only public receipts, grouped by round' }),
      behaviorModel('resizeLog', { event: 'activate', policy: 'Small, Medium, Large; bounded below actual menu buttons' }),
    ] }),
    componentModel(UI.reactionToggle, { properties: { enabled: !!supported && enabled, disabled: !supported || disabled }, behaviors: [
      behaviorModel('setReactions', { event: 'activate', policy: 'Owned optional prompts only; armed Counters remain active' }),
    ] }),
  ] });
}
