// One DOM frame for player and enemy combatants. The screen supplies rendered
// slots and interaction callbacks; this component owns only stable structure,
// role semantics, and component identity.
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

const ownedClasses = new WeakMap();

// Reuse the frame, its focus/input listeners, and the animation's sprite host.
// Only screen-owned slots are replaced. Effects below .sprite survive a beat.
export function updateCombatantFrame(frame, { classNames = [], leading = [], blockBadge = null, name = null, meters = null, trailing = [] }) {
  for (const value of ownedClasses.get(frame) || []) if (!classNames.includes(value)) frame.classList.remove(value);
  for (const value of classNames.filter(Boolean)) frame.classList.add(value);
  ownedClasses.set(frame, classNames.filter(Boolean));
  const leadingHost = frame.querySelector('.combatant-leading');
  leadingHost.replaceChildren(...leading.filter(Boolean));
  const card = frame.querySelector('.combatant-card');
  const spriteHost = card.querySelector(':scope > .sprite');
  spriteHost.querySelector(':scope > .block-badge')?.remove();
  if (blockBadge) spriteHost.appendChild(blockBadge);
  for (const child of [...card.children]) if (child !== spriteHost) child.remove();
  if (name) {
    markUiComponent(name, UI.combatantNameplate, frame.classList.contains('player') ? 'player' : 'enemy');
    card.appendChild(name);
  }
  if (meters) card.appendChild(meters);
  appendAll(card, trailing.filter(n => n?.classList.contains('statuses')));
  appendAll(card, trailing.filter(n => !n?.classList.contains('statuses')));
  return frame;
}

function appendAll(parent, nodes) {
  for (const node of nodes || []) if (node) parent.appendChild(node);
}

// Snapshot clients keep their existing input listeners while adopting the
// same measured sprite / name / meter structure as local combat.
export function adoptCombatantFrame(frame) {
  const stack = document.createElement('div'); stack.className = 'combatant-stack';
  const leading = document.createElement('div'); leading.className = 'combatant-leading';
  const card = document.createElement('div'); card.className = 'combatant-card';
  for (const child of [...frame.children]) (child.matches('.intent, .combatant-info') ? leading : card).append(child);
  stack.append(leading, card); frame.append(stack);
  const role = frame.classList.contains('player') ? 'player' : 'enemy';
  markUiComponent(frame, UI.combatantFrame, role);
  const name = card.querySelector('.nm');
  if (name) markUiComponent(name, UI.combatantNameplate, role);
}

export function combatantFrame({
  role,
  entityId,
  classNames = [],
  leading = [],
  sprite,
  blockBadge = null,
  name = null,
  meters = null,
  trailing = [],
} = {}) {
  if (role !== 'player' && role !== 'enemy') throw new Error(`Unknown combatant role: ${role}`);
  if (!sprite) throw new Error('combatantFrame requires a sprite');

  const frame = document.createElement('article');
  frame.className = ['combatant', role, ...classNames.filter(Boolean)].join(' ');
  ownedClasses.set(frame, classNames.filter(Boolean));
  frame.dataset.eid = entityId;
  markUiComponent(frame, UI.combatantFrame, role);
  frame.dataset.uiBackgroundComponent = UI.componentBackground;
  frame.dataset.uiRoleComponent = role === 'player'
    ? UI.playerCombatantFrame
    : UI.enemyCombatantFrame;

  const stack = document.createElement('div');
  stack.className = 'combatant-stack';

  const leadingHost = document.createElement('div');
  leadingHost.className = 'combatant-leading';
  appendAll(leadingHost, leading);
  stack.appendChild(leadingHost);

  const card = document.createElement('div');
  card.className = 'combatant-card';

  const spriteHost = document.createElement('div');
  spriteHost.className = 'sprite';
  markUiComponent(spriteHost, UI.combatantSprite, role);
  spriteHost.appendChild(sprite);
  if (blockBadge) spriteHost.appendChild(blockBadge);
  card.appendChild(spriteHost);

  if (name) {
    markUiComponent(name, UI.combatantNameplate, role);
    card.appendChild(name);
  }
  if (meters) card.appendChild(meters);
  appendAll(card, trailing.filter(n => n?.classList.contains('statuses')));
  appendAll(card, trailing.filter(n => !n?.classList.contains('statuses')));
  stack.appendChild(card);
  frame.appendChild(stack);
  return frame;
}
