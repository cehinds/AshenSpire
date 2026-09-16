// src/ui/components/menuComponents.js — the two menus, drawn from the kit.
//
// THE QUICK MENU IS THE KIT'S POPOVER: an Eyebrow cap and hairline-grouped Rows
// (Glyph + label + StatusText + StatePill / Keycap). THE IN-RUN OVERLAY IS
// BODY A'S SHELL: a tab strip in the head with the two icon boxes, the body
// the tab fills, and a foot on the button ladder. Nothing here draws a shape;
// the behaviour hooks the launcher and the tools read (`.qn-row`, `.qn-label`,
// `.qn-condition`, `.qn-state`, `.ov-tab`, `#ov-*`) ride on the kit's parts.

import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { attachTooltip, esc } from './tooltip.js';
import { markUiComponent } from './uiComponents.js';
import {
  el, modalHead, modalFooter, button, popover, row, statusText, pill, keycap, eyebrow,
} from '../kit/index.js';

const TONE = { danger: 'loss', loss: 'loss', on: 'current', current: 'current' };

export function renderQuickMenu(model, { onActivate }) {
  const veil = document.createElement('div');
  veil.className = 'modal-veil qn-veil';

  const captionModel = childModel(model, UI.quickMenuCaption);
  const groups = [];
  let group = [];
  for (const rowModel of model.children.filter((child) => child.component === UI.quickMenuRow)) {
    const item = rowModel.properties;
    if (item.separatorBefore && group.length) { groups.push(group); group = []; }
    const trail = [];
    if (item.control === 'switch') trail.push(pill({ label: item.checked ? 'On' : 'Off', on: !!item.checked, attrs: { class: 'qn-state' } }));
    if (item.badge) trail.push(keycap(String(item.badge), { class: 'qn-badge' }));
    const rowEl = row({
      glyph: item.icon,
      labelNode: el('span', { class: 'r-label qn-label', text: item.label }),
      trail,
      tone: TONE[item.tone] || (item.active ? 'current' : ''),
      disabled: !!item.disabled,
      className: `qn-row${item.tone ? ` ${item.tone}` : ''}${item.active ? ' on' : ''}`,
      attrs: {
        role: rowModel.accessibility.role,
        dataset: { act: item.act, member: item.act, ...(item.tab ? { tab: item.tab } : {}) },
        'aria-checked': item.control === 'switch' ? String(!!item.checked) : null,
      },
    });
    // The condition line is live status text; it sits between label and trail.
    if (item.control === 'switch') {
      const condition = statusText(item.condition || '', { class: 'qn-condition', 'aria-live': 'polite' });
      rowEl.insertBefore(condition, rowEl.querySelector('.r-trail'));
    }
    if (item.disabled) rowEl.setAttribute('aria-disabled', 'true');
    markUiComponent(rowEl, rowModel.component, rowModel.variant);
    if (item.tip) attachTooltip(rowEl, () => `<div class="tt-title">${esc(item.label)}</div>${esc(item.tip)}`);
    rowEl.addEventListener('click', (event) => {
      event.stopPropagation();
      onActivate(item, rowEl);
    });
    group.push(rowEl);
  }
  if (group.length) groups.push(group);

  const panel = popover({ caption: captionModel.properties.label, groups, className: 'qn-panel' });
  panel.dataset.surface = 'menuAct';
  panel.setAttribute('role', model.accessibility.role);
  panel.setAttribute('aria-label', model.accessibility.label);
  markUiComponent(panel, model.component, model.variant);
  const caption = panel.querySelector('.as-pop-cap');
  caption.classList.add('qn-cap');
  markUiComponent(caption, captionModel.component, captionModel.variant);
  veil.appendChild(panel);
  return { veil, panel };
}

export function renderMenuOverlay(model) {
  const stripModel = childModel(model, UI.menuTabStrip);
  const footerModel = childModel(model, UI.menuFooter);
  const veil = document.createElement('div');
  veil.className = 'modal-veil';

  const overlay = el('div', {
    class: 'modal overlay-modal', dataset: { size: 'lg' },
    role: 'dialog', 'aria-modal': 'true', 'aria-label': model.accessibility.label,
  });
  const head = modalHead({
    tabs: stripModel.children.map((tab) => ({ id: tab.properties.id, label: tab.properties.label, selected: !!tab.properties.active })),
    showMenuButton: !!model.properties.mirrored,
    menuLabel: 'Go to…',
    closeLabel: 'Close menu',
  });
  head.classList.add('overlay-head');
  const strip = head.querySelector('.modal-tabs');
  strip.classList.add('overlay-tabs');
  strip.dataset.surface = 'overlayTab';
  strip.setAttribute('aria-label', stripModel.accessibility.label);
  if (model.properties.folded) strip.hidden = true;
  strip.querySelectorAll('.modal-tab').forEach((tabButton, index) => {
    const tabModel = stripModel.children[index];
    tabButton.classList.add('ov-tab');
    if (tabModel.properties.active) tabButton.classList.add('on');
    tabButton.dataset.member = tabModel.properties.id;
    markUiComponent(tabButton, tabModel.component, tabModel.variant);
  });
  if (model.properties.folded) {
    // The strip folds into ONE switcher button when the layout is narrow; the
    // tab set behind it is unchanged (Law 3 clause 1a).
    const switcher = button({ label: '', id: 'ov-switch', className: 'ov-switch', attrs: { 'aria-haspopup': 'menu' } });
    head.insertBefore(switcher, head.querySelector('.modal-head-actions'));
  }
  const actions = head.querySelector('.modal-head-actions');
  actions.classList.add('overlay-actions');
  const menuButton = actions.querySelector('.modal-iconbtn');
  if (menuButton) { menuButton.id = 'ov-quicknav'; menuButton.title = 'Go to…'; }
  actions.querySelector('.modal-close').id = 'ov-close';

  const body = el('div', { class: 'modal-body overlay-body', role: 'tabpanel' });

  const quit = button({ label: 'Save and Quit', id: 'ov-quit', className: 'subtle' });
  const save = button({ label: 'Save Game', id: 'ov-save', weight: 'primary' });
  const footer = modalFooter({ note: 'Progress saves to the active slot.', secondary: [quit], primary: save, className: 'overlay-footer', size: 'medium' });
  footer.querySelector('.modal-foot-note')?.classList.add('overlay-footer-note');
  footer.querySelector('.modal-foot-actions').classList.add('overlay-footer-actions');

  overlay.append(head, body, footer);
  veil.appendChild(overlay);

  markUiComponent(overlay, model.component, model.variant);
  markUiComponent(strip, stripModel.component, stripModel.variant);
  markUiComponent(body, UI.menuPanel, model.properties.activeId);
  markUiComponent(footer, footerModel.component, footerModel.variant);
  markUiComponent(save, childModel(footerModel, UI.saveGameControl).component);
  markUiComponent(quit, childModel(footerModel, UI.saveQuitControl).component);
  return { veil, overlay, strip, body };
}

export function updateMenuSelection(root, tabs, id) {
  root.querySelectorAll('.ov-tab').forEach((tabButton) => {
    const active = tabButton.dataset.member === id;
    tabButton.classList.toggle('on', active);
    tabButton.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const switcher = root.querySelector('#ov-switch');
  if (switcher) switcher.textContent = `${tabs.find((tab) => tab.id === id)?.label || id} ▾`;
  const body = root.querySelector('.overlay-body');
  body.innerHTML = '';
  markUiComponent(body, UI.menuPanel, id);
  return body;
}

// The eyebrow atom, for a caller that captions a section of its own.
export const menuEyebrow = eyebrow;
