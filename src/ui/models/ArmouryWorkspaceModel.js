// src/ui/models/ArmouryWorkspaceModel.js — W1e Armoury and W1n Inventory
// selection, projected without a DOM.
//
// The Armoury is a W1 workspace: a category rail (the saved view ids grid,
// rack, hybrid and cards, never renamed), an active pane that splits into an
// item collection beside the selected item's detail, and a footer holding
// Back plus the selected item's action when one exists.
//
// This file only PROJECTS facts the screen already has: the loadout queries'
// refusals (canEquip, equipTransitionReceipt) and the candidate receipt's
// requirement and role rows (equipmentSurfaceReceipt). It invents no item,
// stat or comparison and mutates nothing it is handed.
import { wireframeUi } from '../../content/wireframeUi.js';

/** The rail: one entry per declared view, in authored order; exactly one selected. */
export function armouryRailItems({ views = [], activeView = '', labels = {} } = {}) {
  if (!views.includes(activeView)) throw new Error(`Unknown Armoury view '${activeView}'`);
  return Object.freeze(views.map((id) => Object.freeze({
    id, label: labels[id] || id, selected: id === activeView,
  })));
}

/**
 * The active pane's split. Wide hosts place the collection and the detail in
 * columns; phone hosts stack them in rows. The shares come from wireframeUi.
 */
export function armouryPaneSplit({ responsive = 'desktop' } = {}, config = wireframeUi.armoury) {
  const phone = responsive === 'phone';
  const collection = phone ? config.compactCollectionShare : config.collectionShare;
  if (!(Number.isFinite(collection) && collection > 0 && collection < 1)) {
    throw new Error(`wireframeUi.armoury: collection share must be between 0 and 1 (got ${collection})`);
  }
  const detail = Math.round((1 - collection) * 10000) / 10000;
  return Object.freeze({
    axis: phone ? 'rows' : 'columns',
    collection,
    detail,
    collectionTrack: `${collection}fr`,
    detailTrack: `${detail}fr`,
  });
}

/**
 * The selected item's eligibility line.
 *
 *   none     the item has no equipment position (a relic, a potion): no line
 *   blocked  a loadout query refused the change; its own reason is the text
 *   short    the change is allowed, and the item's authored attribute minima
 *            are not met. Stated as a fact, never as a refusal: equipPiece does
 *            not refuse on requirements, so this line must not claim it does.
 *   ready    nothing stands in the way
 */
export function inventoryEligibility({ target = null, seal = null, transition = null, requirement = null } = {}) {
  if (!target) return Object.freeze({ state: 'none', reason: '', shortfalls: Object.freeze([]) });
  if (seal && seal.ok === false) return Object.freeze({ state: 'blocked', reason: String(seal.reason || ''), shortfalls: Object.freeze([]) });
  if (transition && transition.ok === false) {
    return Object.freeze({ state: 'blocked', reason: String(transition.reason || ''), shortfalls: Object.freeze([]) });
  }
  const shortfalls = Object.freeze((requirement?.failures || []).map((row) => Object.freeze({
    attributeId: row.attributeId, required: row.required, actual: row.actual,
  })));
  return Object.freeze({ state: shortfalls.length ? 'short' : 'ready', reason: '', shortfalls });
}

/**
 * The "compared with equipped" rows, from the candidate receipt the screen
 * already computes for its hold preview. `occupantName` is whatever currently
 * sits in the target position (null when it is empty). Only roles whose value
 * moves are listed; an unmoved comparison says so rather than listing zeros.
 */
export function inventoryComparison({ candidate = null, target = null, occupantName = null, roleLabels = {} } = {}) {
  if (!candidate || !target) return null;
  const slot = target.slotLabel || '';
  const relation = target.kind === 'unequip'
    ? { kind: 'removes', name: occupantName, slot }
    : occupantName
      ? { kind: 'replaces', name: occupantName, slot }
      : { kind: 'fills', name: null, slot };
  const roles = (candidate.roles || [])
    .filter((row) => row.beforeValue !== row.afterValue)
    .map((row) => Object.freeze({
      role: row.role, label: roleLabels[row.role] || row.role, before: row.beforeValue, after: row.afterValue,
    }));
  return Object.freeze({ relation: Object.freeze(relation), roles: Object.freeze(roles), unchanged: roles.length === 0 });
}

/**
 * The footer's primary action. W1e says "Equip if available": an item with no
 * equipment position has none, so the footer keeps Back alone. A refused
 * change keeps its control and its reason, the way the in-card action does.
 */
export function inventoryFooterPlan({ target = null, actionLabel = '', eligibility = null } = {}) {
  if (!target || !actionLabel) return Object.freeze({ primary: null });
  const blocked = eligibility?.state === 'blocked';
  return Object.freeze({
    primary: Object.freeze({ label: actionLabel, kind: target.kind, blocked, reason: blocked ? eligibility.reason : '' }),
  });
}
