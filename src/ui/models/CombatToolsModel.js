import { componentModel } from './ComponentModel.js';
import { behaviorModel } from './BehaviorModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export const COMBAT_LOG_SIZES = Object.freeze(['Small', 'Medium', 'Large']);
export function combatLogHeight({ size = 'Small', cardHeight, viewportHeight, dockTop, menuBottom, gap = 8 }) {
  const available = Math.max(0, dockTop - menuBottom - gap);
  let small = Math.min(available, cardHeight / 2);
  let medium = Math.min(available, viewportHeight / 2);
  // On a phone the half-viewport height can exceed all available space.
  // Keep three distinct stops instead of making Medium and Large identical.
  if (medium >= available || medium <= small) {
    small = Math.min(small, available / 3);
    medium = (small + available) / 2;
  }
  const wanted = size === 'Large' ? available : size === 'Medium' ? medium : small;
  return Math.max(0, Math.min(available, wanted));
}
export function combatLogSnapSize(height, heights) {
  return COMBAT_LOG_SIZES.reduce((nearest, size) => Math.abs(heights[size] - height) < Math.abs(heights[nearest] - height) ? size : nearest, 'Small');
}
export function combatLogDragScale({ heights, viewportHeight, handleBottom }) {
  const travel = Math.max(24, Math.min(120, viewportHeight - handleBottom - 8));
  return Math.max(1, (heights.Large - heights.Small) / travel);
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
