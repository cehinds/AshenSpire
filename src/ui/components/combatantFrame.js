// One DOM frame for player and enemy combatants. The screen supplies rendered
// slots and interaction callbacks; this component owns only stable structure,
// role semantics, and component identity.
import { markSpriteArt } from './spriteArtFlags.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { artworkAnchor } from '../models/IdentityModel.js';
import { markBuilt, reconcileList } from '../domWrite.js';
import { refreshIconTray, fitBadgeRowTray } from './iconTray.js';

const ownedClasses = new WeakMap();

// The HUD's status tray lives in the meters' badge row (components/combatHealth.js), beside the defense badges. It is a node of its own,
// reconciled by the statuses slot, and marked so a morph of the meters (an HP or Block change) leaves it where it stands.
const badgeRowOf = (frame) => frame.querySelector('.combat-health-badges');
function seatStatuses(frame, trays) {
  const row = badgeRowOf(frame);
  if (!row) return false;
  for (const tray of trays) row.appendChild(tray);
  return true;
}

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
  const trays = trailing.filter(n => n?.classList.contains('statuses'));
  if (!seatStatuses(frame, trays)) appendAll(frame.classList.contains('enemy') ? leadingHost : widget, trays);
  appendAll(widget, trailing.filter(n => !n?.classList.contains('statuses')));
  if (action) leadingHost.appendChild(action);
  if (actionFocused) action.focus({ preventScroll: true });
  return frame;
}

// The slot-level counterpart of updateCombatantFrame: update only the slots passed (`leading`, `name`, `meters`,
// `statuses`, `chips`; `classNames` reconciles the frame's classes) and leave every other node in place. A slot whose
// node already stands where it belongs (the intent and the meters live in the target-HUD overhead rack while it
// exists) is morphed in place, so a value change writes text and widths and replaces nothing (owner, 2026-11-06).
// The nodes land exactly where a full update puts them, so the frame's outerHTML matches a fresh combatantFrame()
// built from the same slots, with the rack holding the intent and meters as the target HUD arranges them.
// Returns how many nodes it added, removed or replaced (0 for a pure value change); `true` for a class-only write.
// A proc bar or arcane row carries listeners a rebuild cannot hand over, so meters holding one are replaced.
const meterMorphable = (live, fresh) => !live.querySelector('.procbar, .arcane') && !fresh.querySelector('.procbar, .arcane');
export function updateCombatantSlots(frame, { classNames, leading, name, meters, statuses, chips } = {}) {
  const wantsNodes = leading !== undefined || name !== undefined || meters !== undefined
    || statuses !== undefined || chips !== undefined;
  if (classNames) {
    const next = classNames.filter(Boolean);
    for (const value of ownedClasses.get(frame) || []) if (!next.includes(value)) frame.classList.remove(value);
    for (const value of next) frame.classList.add(value);
    ownedClasses.set(frame, next);
  }
  if (!wantsNodes) return 0;
  const isPlayer = frame.classList.contains('player');
  const rack = frame.querySelector(':scope > .target-hud-overhead-meters');
  const leadingHost = frame.querySelector('.combatant-leading');
  const card = frame.querySelector('.combatant-card');
  const spriteHost = [...card.children].find(node => node.classList.contains('sprite'));
  const widget = isPlayer ? [...leadingHost.children].find(node => node.classList.contains('combatant-mini-hud')) : card;
  // The player has no selected panel, so its status tray lives in its overhead rack (under the HP row) while the rack exists.
  const statusHostBefore = !isPlayer ? leadingHost : (rack || widget);
  const isStatuses = (node) => node.classList?.contains('statuses');
  const isAction = (node) => node.classList?.contains('player-action-intent');
  const isIntent = (node) => node.classList?.contains('intent');
  const isName = (node) => node.dataset?.identityPart === 'name';
  const isMeters = (node) => node.classList?.contains('meters');
  const kids = (host) => [...host.children];
  const find = (host, test) => kids(host).find(test) || null;
  const isLeading = (node) => node !== widget && !isStatuses(node) && !isAction(node);
  // Without the rack (the target HUD is off) the slots are replaced as they always were.
  if (!rack) return replaceSlots({ leadingHost, widget, spriteHost, statusHost: badgeRowOf(frame) || statusHostBefore, isPlayer, leading, name, meters, statuses, chips });
  let swaps = 0;
  if (leading !== undefined) {
    const next = leading.filter(Boolean);
    // With the rack up the intent lives in it; the rest of the leading nodes (Inspect, the target key) stay in the host.
    const nextIntent = rack ? next.filter(isIntent) : [];
    const nextRest = rack ? next.filter(node => !isIntent(node)) : next;
    if (rack) swaps += reconcileList(rack, kids(rack).filter(isIntent), nextIntent, rack.firstChild);
    swaps += reconcileList(leadingHost, kids(leadingHost).filter(isLeading).filter(node => !(rack && isIntent(node))), nextRest,
      kids(leadingHost).find(node => !isLeading(node)) || null);
  }
  if (name !== undefined) {
    const live = find(widget, isName);
    if (name) markName(name, isPlayer ? 'player' : 'enemy');
    swaps += reconcileList(widget, live ? [live] : [], name ? [name] : [], isPlayer ? widget.firstChild : spriteHost.nextSibling, { morphable: () => false });
  }
  if (meters !== undefined) {
    const host = rack || widget, live = find(host, isMeters) || (rack ? find(widget, isMeters) : null);
    const anchor = rack ? null : (() => { const nameNode = find(widget, isName); return nameNode ? nameNode.nextSibling : (isPlayer ? widget.firstChild : spriteHost.nextSibling); })();
    // The tray rides in the badge row; a morph keeps it (data-morph-keep), a replaced meters strip hands it to the new row, fitted at once.
    const keptTray = live ? live.querySelector('.statuses') : null;
    swaps += reconcileList(live ? live.parentNode : host, live ? [live] : [], meters ? [meters] : [], anchor, { morphable: meterMorphable });
    const newRow = badgeRowOf(frame);
    if (keptTray && newRow && !newRow.contains(keptTray)) { newRow.appendChild(keptTray); refreshIconTray(keptTray); }
  }
  if (statuses !== undefined) {
    // The status tray stays; its icons are written in place and only a status gained or lost adds or removes one.
    const list = statuses ? [].concat(statuses).filter(Boolean) : [];
    const statusHost = badgeRowOf(frame) || statusHostBefore;
    let anchor;
    if (statusHost === badgeRowOf(frame)) anchor = null;
    else if (statusHost === leadingHost) anchor = find(leadingHost, isAction);
    else if (statusHost === rack) anchor = null;
    else {
      const holder = find(widget, isMeters) || find(widget, isName);
      anchor = holder ? holder.nextSibling : (isPlayer ? widget.firstChild : spriteHost.nextSibling);
    }
    // The anchor must not be one of the nodes being reconciled.
    const live = kids(statusHost).filter(isStatuses);
    if (live.includes(anchor)) anchor = live.at(-1).nextSibling;
    const changed = reconcileList(statusHost, live, list, anchor);
    swaps += changed;
    if (statusHost === rack) markRackStatuses(rack);
    // A tray whose icons were added, removed or replaced must not fit from its old items.
    if (changed) live.forEach((tray, index) => { if (tray.isConnected !== false && list[index]) refreshIconTray(tray, list[index]); });
  }
  // The badges that show decide how much room the status tray has: refit it now, not at the next stage pass.
  if (meters !== undefined || statuses !== undefined) {
    const row = badgeRowOf(frame), tray = row?.querySelector(':scope > .statuses');
    if (tray && frame.isConnected) fitBadgeRowTray(tray);
  }
  if (chips !== undefined) {
    for (const node of kids(widget)) {
      if (node !== spriteHost && !isName(node) && !isMeters(node) && !isStatuses(node)) { node.remove(); swaps++; }
    }
    appendAll(widget, [].concat(chips || []).filter(Boolean));
  }
  return swaps;
}

// The slot replacement used while the target-HUD rack is absent: each passed slot's old nodes are removed and the new ones inserted.
function replaceSlots({ leadingHost, widget, spriteHost, statusHost, isPlayer, leading, name, meters, statuses, chips }) {
  const isStatuses = (node) => node.classList?.contains('statuses');
  const isAction = (node) => node.classList?.contains('player-action-intent');
  const isName = (node) => node.dataset?.identityPart === 'name';
  const isMeters = (node) => node.classList?.contains('meters');
  const kids = (host) => [...host.children];
  const find = (host, test) => kids(host).find(test) || null;
  const isLeading = (node) => node !== widget && !isStatuses(node) && !isAction(node);
  if (leading !== undefined) {
    for (const node of kids(leadingHost)) if (isLeading(node)) node.remove();
    leadingHost.prepend(...leading.filter(Boolean));
  }
  if (name !== undefined) {
    find(widget, isName)?.remove();
    if (name) {
      markName(name, isPlayer ? 'player' : 'enemy');
      widget.insertBefore(name, isPlayer ? widget.firstChild : spriteHost.nextSibling);
    }
  }
  if (meters !== undefined) {
    const oldMeters = find(widget, isMeters);
    const tray = oldMeters?.querySelector('.statuses');
    oldMeters?.remove();
    if (meters) {
      const anchor = find(widget, isName);
      widget.insertBefore(meters, anchor ? anchor.nextSibling : (isPlayer ? widget.firstChild : spriteHost.nextSibling));
      const row = meters.querySelector?.('.combat-health-badges');
      if (tray && row && statuses === undefined) row.appendChild(tray);
    }
  }
  if (statuses !== undefined) {
    for (const node of kids(statusHost)) if (isStatuses(node)) node.remove();
    const list = statuses ? [].concat(statuses).filter(Boolean) : [];
    if (statusHost.classList?.contains('combat-health-badges')) {
      for (const node of list) statusHost.appendChild(node);
    } else if (statusHost === leadingHost) {
      const action = find(leadingHost, isAction);
      for (const node of list) leadingHost.insertBefore(node, action);
    } else {
      const anchor = find(widget, isMeters) || find(widget, isName);
      const before = anchor ? anchor.nextSibling : (isPlayer ? widget.firstChild : spriteHost.nextSibling);
      for (const node of list) widget.insertBefore(node, before);
    }
  }
  if (chips !== undefined) {
    for (const node of kids(widget)) {
      if (node !== spriteHost && !isName(node) && !isMeters(node) && !isStatuses(node)) node.remove();
    }
    appendAll(widget, [].concat(chips || []).filter(Boolean));
  }
  return 0;
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
  if (role === 'enemy') {
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
  stack.appendChild(card);
  frame.appendChild(stack);
  const trays = trailing.filter(n => n?.classList.contains('statuses'));
  if (!seatStatuses(frame, trays)) appendAll(role === 'enemy' ? leadingHost : widget, trays);
  appendAll(widget, trailing.filter(n => !n?.classList.contains('statuses')));
  // Remember what the builder wrote on each slot node, so a later in-place update drops only what the builder dropped.
  for (const node of [...leading, name, meters, ...trailing]) if (node) markBuilt(node);
  return frame;
}

// The contextual desktop HUD keeps only HP beside the overhead intent. Move
// the shared live meter nodes, including their tooltips, instead of cloning a
// second health display or changing the sprite's frame geometry.
// The player's tray in its rack is styled like a selected panel's `.target-hud-statuses`.
const markRackStatuses = rack => { for (const tray of rack.querySelectorAll(':scope > .statuses')) tray.classList.add('target-hud-statuses'); };
export function setCombatantTargetHud(frame, enabled) {
  const leading = frame.querySelector('.combatant-leading');
  const rack = frame.querySelector(':scope > .target-hud-overhead-meters');
  if (!leading) return;
  if (enabled) {
    if (rack) {
      for (const intent of leading.querySelectorAll(':scope > .intent, :scope > .player-action-intent')) rack.prepend(intent);
      if (frame.classList.contains('player')) { rack.append(...leading.querySelectorAll('.combatant-mini-hud > .statuses')); markRackStatuses(rack); }
      return;
    }
    const meters = frame.querySelector('.combatant-card .meters, .combatant-mini-hud .meters');
    if (!meters) return;
    for (const slot of [meters, ...frame.querySelectorAll('.nm')]) { slot.style.removeProperty('transform'); slot.style.removeProperty('translate'); slot.style.removeProperty('position'); slot.style.removeProperty('left'); slot.style.removeProperty('top'); }
    const host = document.createElement('div'); host.className = 'target-hud-overhead-meters';
    host.append(...leading.querySelectorAll(':scope > .intent, :scope > .player-action-intent'), meters);
    if (frame.classList.contains('player')) host.append(...leading.querySelectorAll('.combatant-mini-hud > .statuses'));
    frame.append(host); markRackStatuses(host);
  } else if (rack) {
    const parent = frame.classList.contains('player') ? leading.querySelector('.combatant-mini-hud') : frame.querySelector('.combatant-card');
    for (const intent of rack.querySelectorAll(':scope > .intent, :scope > .player-action-intent')) leading.append(intent);
    for (const tray of rack.querySelectorAll(':scope > .statuses')) tray.classList.remove('target-hud-statuses');
    if (parent) parent.append(...rack.childNodes);
    rack.remove();
  }
}
