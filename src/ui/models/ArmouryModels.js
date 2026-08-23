import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

function armouryViewSwitcherModel({ views, activeView }) {
  return componentModel(UI.armouryViewSwitcher, {
    variant: activeView,
    properties: { views: views.map((id) => ({ id, active: id === activeView })) },
    accessibility: { role: 'tablist', label: 'Armoury view' },
    behaviors: views.map((id) => behaviorModel(`select-armoury-${id}`, {
      event: 'click',
      command: 'select-armoury-view',
      payload: { id },
    })),
  });
}

function armouryHeaderModel({ views, activeView }) {
  return componentModel(UI.armouryHeader, {
    properties: { title: 'ARMOURY' },
    behaviors: [behaviorModel('close-armoury', { event: 'click', command: 'close-armoury' })],
    children: [armouryViewSwitcherModel({ views, activeView })],
  });
}

function armouryBodyModel({ view, figure, slots }) {
  return componentModel(UI.armouryBody, {
    variant: view,
    properties: { view, figure: !!figure, slots },
  });
}

function armouryInventoryModel() {
  return componentModel(UI.armouryInventory, {
    accessibility: { role: 'region', label: 'Inventory' },
  });
}

function armouryStatsPanelModel() {
  return componentModel(UI.armouryStatsPanel, {
    accessibility: { role: 'region', label: 'Attributes and resources' },
  });
}

function armouryCardStripModel() {
  return componentModel(UI.armouryCardStrip, {
    accessibility: { role: 'region', label: 'Equipment cards' },
  });
}

export function armouryPanelModel({ view, views, layout, picking = false, notice = '' }) {
  return componentModel(UI.armouryPanel, {
    variant: view,
    properties: {
      view,
      picking: !!picking,
      notice,
      figure: !!layout?.figure,
      slots: layout?.slots || 'none',
    },
    accessibility: { role: 'dialog', label: 'Armoury', modal: true },
    children: [
      armouryHeaderModel({ views, activeView: view }),
      armouryBodyModel({ view, figure: layout?.figure, slots: layout?.slots || 'none' }),
      armouryInventoryModel(),
      armouryStatsPanelModel(),
      armouryCardStripModel(),
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

export function inventoryItemCardModel(row, { selected = false, draggable = false } = {}) {
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
    },
    behaviors: [behaviorModel(`inspect-${row.key}`, {
      event: 'click',
      command: 'inspect-inventory-item',
      payload: { key: row.key, id: row.id },
    })],
  });
}

export function inventoryDetailCardModel({ row, art, description, mods, instruction = '' }) {
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
    },
  });
}
