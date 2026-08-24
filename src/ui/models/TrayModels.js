import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const EDGES = Object.freeze(['top', 'right', 'bottom', 'left']);

function trayHeaderModel({ id, name, count, itemType, edge, expanded, sortable, sortLabel }) {
  const behaviors = [behaviorModel(`toggle-${id}`, {
    event: 'click',
    command: 'toggle-tray',
    payload: { id },
  })];
  if (sortable) behaviors.push(behaviorModel(`sort-${id}`, {
    event: 'click',
    command: 'sort-tray',
    payload: { id },
  }));
  return componentModel(UI.trayHeader, {
    variant: edge,
    properties: { id, name, count, itemType, edge, expanded, sortable, sortLabel },
    accessibility: { label: `${name}, ${count} ${itemType}${count === 1 ? '' : 's'}` },
    behaviors,
  });
}

function trayContentModel({ id, edge, expanded, items }) {
  return componentModel(UI.trayContent, {
    variant: edge,
    properties: { id, expanded },
    children: items,
  });
}

export function trayModel({
  id,
  name,
  count = 0,
  itemType = 'item',
  edge = 'bottom',
  expanded = false,
  sortable = false,
  sortLabel = 'Sort',
  items = [],
} = {}) {
  if (!id || typeof id !== 'string') throw new Error('Tray id is required');
  if (!name || typeof name !== 'string') throw new Error(`${id} tray name is required`);
  if (!EDGES.includes(edge)) throw new Error(`${id} tray edge must be one of ${EDGES.join(', ')}`);
  if (!Number.isInteger(count) || count < 0) throw new Error(`${id} tray count must be a non-negative integer`);
  return componentModel(UI.foldingTray, {
    variant: edge,
    properties: { id, name, count, itemType, edge, expanded: !!expanded, sortable: !!sortable, sortLabel },
    accessibility: { role: 'region', label: name },
    behaviors: [behaviorModel(`toggle-${id}`, {
      event: 'click',
      command: 'toggle-tray',
      payload: { id },
    })],
    children: [
      trayHeaderModel({ id, name, count, itemType, edge, expanded: !!expanded, sortable: !!sortable, sortLabel }),
      trayContentModel({ id, edge, expanded: !!expanded, items }),
    ],
  });
}

export const TRAY_EDGES = EDGES;
