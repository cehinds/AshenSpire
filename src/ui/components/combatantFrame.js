// One DOM frame for player and enemy combatants. The screen supplies rendered
// slots and interaction callbacks; this component owns only stable structure,
// role semantics, and component identity.
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

function appendAll(parent, nodes) {
  for (const node of nodes || []) if (node) parent.appendChild(node);
}

// The trailing order has one home: the status tray first, then every other
// chip, on a fresh frame and on a patched one alike.
function appendTrailing(card, trailing) {
  appendAll(card, trailing.filter(n => n?.classList.contains('statuses')));
  appendAll(card, trailing.filter(n => !n?.classList.contains('statuses')));
}

/**
 * replaceCombatantTrailing(frame, trailing) — swap what follows the meters on
 * a live frame (the status tray, the player's stance/evade/dodge chips) and
 * leave the sprite, nameplate and meters where they are. The per-beat patch
 * in combat.js uses this so a hit re-draws a tray, not a combatant. Returns
 * false when the frame has no card to patch.
 */
export function replaceCombatantTrailing(frame, trailing = []) {
  const card = frame?.querySelector('.combatant-card');
  if (!card) return false;
  for (const child of [...card.children]) if (!child.matches('.sprite, .nm, .meters')) child.remove();
  appendTrailing(card, trailing);
  return true;
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
  appendTrailing(card, trailing);
  stack.appendChild(card);
  frame.appendChild(stack);
  return frame;
}
