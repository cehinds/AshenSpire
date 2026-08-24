import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

function quickMenuCaptionModel({ mode, label }) {
  return componentModel(UI.quickMenuCaption, {
    variant: mode,
    properties: { label },
  });
}

function quickMenuRowModel(row) {
  return componentModel(UI.quickMenuRow, {
    variant: row.act,
    properties: {
      act: row.act,
      tab: row.tab || '',
      icon: row.icon || '',
      label: row.label || '',
      badge: row.badge || '',
      tip: row.tip || '',
      tone: row.tone || '',
      active: !!row.on,
      control: row.control || '',
      checked: !!row.checked,
      disabled: !!row.disabled,
      condition: row.condition || '',
      separatorBefore: !!row.sep,
    },
    // These rows live inside a role=menu. A switch role is not a valid owned
    // child there; menuitemcheckbox keeps the stateful control in the menu's
    // accessibility tree while retaining aria-checked.
    accessibility: { role: row.control === 'switch' ? 'menuitemcheckbox' : 'menuitem', label: row.label || row.act },
    behaviors: [behaviorModel(`activate-${row.act}`, {
      event: 'click',
      command: 'activate-menu-row',
      payload: { act: row.act, tab: row.tab || '' },
    })],
  });
}

export function quickMenuPanelModel({ context, mode, caption, rows }) {
  return componentModel(UI.quickMenuPanel, {
    variant: context,
    properties: { context, mode },
    accessibility: { role: 'menu', label: 'Quick menu' },
    children: [quickMenuCaptionModel({ mode, label: caption }), ...rows.map(quickMenuRowModel)],
  });
}

function menuTabModel(tab, active = false) {
  return componentModel(UI.menuTab, {
    variant: tab.id,
    properties: { id: tab.id, label: tab.label, active },
    accessibility: { role: 'tab', label: tab.label, selected: active },
    behaviors: [behaviorModel(`select-${tab.id}`, {
      event: 'click',
      command: 'select-menu-tab',
      payload: { id: tab.id },
    })],
  });
}

function menuTabStripModel({ tabs, activeId = '', folded = false }) {
  return componentModel(UI.menuTabStrip, {
    variant: folded ? 'folded' : 'visible',
    properties: { folded },
    accessibility: { role: 'tablist', label: 'Run menu' },
    children: tabs.map((tab) => menuTabModel(tab, tab.id === activeId)),
  });
}

function menuPanelModel(id = '') {
  return componentModel(UI.menuPanel, {
    variant: id,
    properties: { id },
    accessibility: { role: 'tabpanel', label: id || 'Menu panel' },
  });
}

export function menuOverlayModel({ tabs, activeId = '', folded = false, mirrored = false }) {
  return componentModel(UI.menuOverlay, {
    variant: folded ? 'folded' : (mirrored ? 'mirrored' : 'tabs'),
    properties: { folded, mirrored, activeId },
    accessibility: { role: 'dialog', label: 'Run menu', modal: true },
    behaviors: [behaviorModel('close-menu', { event: 'click', command: 'close-menu' })],
    children: [
      menuTabStripModel({ tabs, activeId, folded }),
      menuPanelModel(activeId),
    ],
  });
}
