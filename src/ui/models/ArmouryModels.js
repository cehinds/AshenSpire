import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const DEFAULT_REGIONS = Object.freeze([
  Object.freeze({ id: 'slots', label: 'Slots', count: 0, unit: 'slot', edge: 'bottom', expanded: true }),
  Object.freeze({ id: 'inventory', label: 'Inventory', count: 0, unit: 'item', edge: 'bottom', expanded: false }),
  Object.freeze({ id: 'cards', label: 'Cards', count: 0, unit: 'card', edge: 'bottom', expanded: false }),
  Object.freeze({ id: 'stats', label: 'Stats', count: 0, unit: 'stat', edge: 'bottom', expanded: false }),
]);

function armouryViewSwitcherModel({ views, activeView, viewLabels = {} }) {
  return componentModel(UI.armouryViewSwitcher, {
    variant: activeView,
    properties: { views: views.map((id) => ({ id, label: viewLabels[id] || id, active: id === activeView })) },
    accessibility: { role: 'tablist', label: 'Armoury view' },
    behaviors: views.map((id) => behaviorModel(`select-armoury-${id}`, {
      event: 'click',
      command: 'select-armoury-view',
      payload: { id },
    })),
  });
}

function armouryHeaderModel({ views, activeView, viewLabels = {} }) {
  return componentModel(UI.armouryHeader, {
    properties: { title: 'ARMOURY' },
    behaviors: [behaviorModel('close-armoury', { event: 'click', command: 'close-armoury' })],
    children: [armouryViewSwitcherModel({ views, activeView, viewLabels })],
  });
}

function armouryBodyModel({ view, figure, slots }) {
  return componentModel(UI.armouryBody, {
    variant: view,
    properties: { view, figure: !!figure, slots },
  });
}

export function armouryInventoryModel() {
  return componentModel(UI.armouryInventory, {
    accessibility: { role: 'region', label: 'Inventory' },
  });
}

export function armouryStatsPanelModel() {
  return componentModel(UI.armouryStatsPanel, {
    accessibility: { role: 'region', label: 'Attributes and resources' },
  });
}

export function armouryCardStripModel() {
  return componentModel(UI.armouryCardStrip, {
    accessibility: { role: 'region', label: 'Equipment cards' },
  });
}

export function armouryPanelModel({ view, views, viewLabels = {}, layout, subject = 'slots', regions = DEFAULT_REGIONS, picking = false, notice = '' }) {
  const content = Object.freeze({
    slots: armouryBodyModel({ view, figure: layout?.figure, slots: layout?.slots || 'none' }),
    inventory: armouryInventoryModel(),
    cards: armouryCardStripModel(),
    stats: armouryStatsPanelModel(),
  });
  const regionModels = regions.map((region) => {
    const item = content[region.id];
    if (!item) throw new Error(`Unknown Armoury region model: ${region.id}`);
    return item;
  });
  return componentModel(UI.armouryPanel, {
    variant: view,
    properties: {
      view,
      picking: !!picking,
      notice,
      figure: !!layout?.figure,
      slots: layout?.slots || 'none',
      subject,
    },
    accessibility: { role: 'dialog', label: 'Armoury', modal: true },
    children: [
      armouryHeaderModel({ views, activeView: view, viewLabels }),
      ...regionModels,
    ],
  });
}

export function armouryOverlayModel({ panel, equippedTagColor = '' }) {
  return componentModel(UI.armouryOverlay, {
    properties: { equippedTagColor },
    accessibility: { role: 'presentation' },
    children: [panel],
  });
}

export function equipmentSetCellModel({ slotId, index, state, active = false, piece = null, rung = null }) {
  return componentModel(UI.equipmentSetCell, {
    variant: state === 'next' ? `${slotId}-locked` : slotId,
    properties: {
      slotId,
      index,
      state,
      active,
      piece: piece ? { id: piece.id, name: piece.name, image: piece.image || '' } : null,
      rung: rung ? { name: rung.name, hint: rung.hint } : null,
    },
    behaviors: [behaviorModel(`activate-${slotId}-${index}`, {
      event: 'click',
      command: 'activate-equipment-set',
      payload: { slotId, index },
    })],
  });
}

export function equipmentSlotModel({ slotId, label, rule, cells }) {
  return componentModel(UI.equipmentSlot, {
    variant: slotId,
    properties: { slotId, label, rule: { ok: !!rule.ok, word: rule.word || '', reason: rule.reason || '' } },
    children: cells,
  });
}

export function inventoryItemCardModel(row, { selected = false, draggable = false, classModel = null } = {}) {
  return componentModel(UI.inventoryItemCard, {
    variant: row.category,
    properties: {
      key: row.key,
      id: row.id,
      name: row.name,
      category: row.category,
      count: row.count,
      equippedLabels: [...row.equippedLabels],
      selected,
      draggable,
      holdAction: classModel?.holdAction === true,
    },
    behaviors: [behaviorModel(`inspect-${row.key}`, {
      event: 'click',
      command: 'inspect-inventory-item',
      payload: { key: row.key, id: row.id },
    })],
  });
}

export function inventoryDetailCardModel({ row, art, description, mods, instruction = '', classModel = null }) {
  return componentModel(UI.inventoryDetailCard, {
    variant: row.category,
    properties: {
      name: row.item.name,
      category: row.category,
      rarity: row.item.rarity || 'standard',
      count: row.count,
      description,
      tags: [...(row.item.tags || [])],
      mods: [...mods],
      instruction,
      art,
      fallbackIcon: row.item.icon || '◆',
      holdAction: classModel?.holdAction === true,
    },
  });
}
