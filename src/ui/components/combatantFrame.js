// One DOM frame for player and enemy combatants. The screen supplies rendered
// slots and interaction callbacks; this component owns only stable structure,
// role semantics, and component identity.
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

function appendAll(parent, nodes) {
  for (const node of nodes || []) if (node) parent.appendChild(node);
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
  frame.dataset.uiRoleComponent = role === 'player'
    ? UI.playerCombatantFrame
    : UI.enemyCombatantFrame;

  appendAll(frame, leading);

  const spriteHost = document.createElement('div');
  spriteHost.className = 'sprite';
  spriteHost.appendChild(sprite);
  if (blockBadge) spriteHost.appendChild(blockBadge);
  frame.appendChild(spriteHost);

  if (name) frame.appendChild(name);
  if (meters) frame.appendChild(meters);
  appendAll(frame, trailing);
  return frame;
}
