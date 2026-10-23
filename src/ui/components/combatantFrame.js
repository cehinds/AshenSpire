// One DOM frame for player and enemy combatants. The screen supplies rendered
// slots and interaction callbacks; this component owns only stable structure,
// role semantics, and component identity.
import { markSpriteArt } from './spriteArtFlags.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { classicAppearance } from '../displayAppearance.js';
import { artworkAnchor } from '../models/IdentityModel.js';

const ownedClasses = new WeakMap();

// WCI1/WCI2: the nameplate sits in the card directly above the meters (HP
// first); the sprite host is the combatant's artwork, standing on its baseline.
function markName(name, role) {
  markUiComponent(name, UI.combatantNameplate, role);
  name.dataset.identityPart = 'name';
}

// Reuse the frame, its focus/input listeners, and the animation's sprite host.
// Only screen-owned slots are replaced. Effects below .sprite survive a beat.
export function updateCombatantFrame(frame, { classNames = [], leading = [], blockBadge = null, name = null, meters = null, trailing = [] }) {
  for (const value of ownedClasses.get(frame) || []) if (!classNames.includes(value)) frame.classList.remove(value);
  for (const value of classNames.filter(Boolean)) frame.classList.add(value);
  ownedClasses.set(frame, classNames.filter(Boolean));
  // The action glyph owns a live selection callback and is reconciled by
  // syncPlayerActionIntent. Rebuilding HUD slots must not defeat that
  // maneuver guard and schedule another geometry pass for the same glyph.
  const action = frame.classList.contains('player') ? frame.querySelector('.player-action-intent') : null;
  const actionFocused = action && document.activeElement === action;
  frame.querySelector(':scope > .target-hud-overhead-meters')?.remove();
  const leadingHost = frame.querySelector('.combatant-leading');
  leadingHost.replaceChildren(...leading.filter(Boolean));
  const card = frame.querySelector('.combatant-card');
  const spriteHost = card.querySelector(':scope > .sprite');
  spriteHost.querySelector(':scope > .block-badge')?.remove();
  if (blockBadge) spriteHost.appendChild(blockBadge);
  for (const child of [...card.children]) if (child !== spriteHost) child.remove();
  const widget = frame.classList.contains('player') ? playerWidget(leadingHost) : card;
  if (name) {
    markName(name, frame.classList.contains('player') ? 'player' : 'enemy');
    widget.appendChild(name);
  }
  if (meters) widget.appendChild(meters);
  appendAll(frame.classList.contains('enemy') && !classicAppearance() ? leadingHost : widget,
    trailing.filter(n => n?.classList.contains('statuses')));
  appendAll(widget, trailing.filter(n => !n?.classList.contains('statuses')));
  if (action) leadingHost.appendChild(action);
  if (actionFocused) action.focus({ preventScroll: true });
  return frame;
}

function appendAll(parent, nodes) {
  for (const node of nodes || []) if (node) parent.appendChild(node);
}

function playerWidget(leadingHost) {
  const widget = document.createElement('div'); widget.className = 'combatant-mini-hud';
  leadingHost.append(widget);
  return widget;
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
  if (name) markName(name, role);
  const sprite = card.querySelector(':scope > .sprite');
  if (sprite) markArtwork(sprite);
  if (role === 'enemy' && !classicAppearance()) {
    for (const status of card.querySelectorAll(':scope > .statuses')) leading.append(status);
  }
  if (role === 'player') {
    const widget = playerWidget(leading);
    for (const child of [...card.children]) if (child !== sprite) widget.append(child);
  }
}

function markArtwork(spriteHost) {
  spriteHost.dataset.identityPart = 'artwork';
  spriteHost.dataset.artworkAnchor = artworkAnchor('combatant');
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
  markArtwork(spriteHost);
  spriteHost.appendChild(sprite);
  markSpriteArt(spriteHost);
  if (blockBadge) spriteHost.appendChild(blockBadge);
  card.appendChild(spriteHost);
  const widget = role === 'player' ? playerWidget(leadingHost) : card;
  if (name) {
    markName(name, role);
    widget.appendChild(name);
  }
  if (meters) widget.appendChild(meters);
  appendAll(role === 'enemy' && !classicAppearance() ? leadingHost : widget,
    trailing.filter(n => n?.classList.contains('statuses')));
  appendAll(widget, trailing.filter(n => !n?.classList.contains('statuses')));
  stack.appendChild(card);
  frame.appendChild(stack);
  return frame;
}

// The contextual desktop HUD keeps only HP beside the overhead intent. Move
// the shared live meter nodes, including their tooltips, instead of cloning a
// second health display or changing the sprite's frame geometry.
export function setCombatantTargetHud(frame, enabled) {
  const leading = frame.querySelector('.combatant-leading');
  const rack = frame.querySelector(':scope > .target-hud-overhead-meters');
  if (!leading) return;
  if (enabled) {
    if (rack) {
      for (const intent of leading.querySelectorAll(':scope > .intent, :scope > .player-action-intent')) rack.prepend(intent);
      return;
    }
    const meters = frame.querySelector('.combatant-card .meters, .combatant-mini-hud .meters');
    if (!meters) return;
    for (const slot of [meters, ...frame.querySelectorAll('.nm')]) { slot.style.removeProperty('transform'); slot.style.removeProperty('translate'); slot.style.removeProperty('position'); slot.style.removeProperty('left'); slot.style.removeProperty('top'); }
    const host = document.createElement('div'); host.className = 'target-hud-overhead-meters';
    host.append(...leading.querySelectorAll(':scope > .intent, :scope > .player-action-intent'), meters); frame.append(host);
  } else if (rack) {
    const parent = frame.classList.contains('player') ? leading.querySelector('.combatant-mini-hud') : frame.querySelector('.combatant-card');
    for (const intent of rack.querySelectorAll(':scope > .intent, :scope > .player-action-intent')) leading.append(intent);
    if (parent) parent.append(...rack.childNodes);
    rack.remove();
  }
}
