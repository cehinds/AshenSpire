import { childModel, descendantModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { esc } from './tooltip.js';
import { markUiComponent } from './uiComponents.js';
import { modalHead } from './modalShell.js';

export function renderArmouryOverlay(model) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-veil armoury-overlay';
  markUiComponent(wrap, model.component, model.variant);
  wrap.style.setProperty('--equip-equipped-tag-color', model.properties.equippedTagColor || 'var(--gold)');
  return wrap;
}

export function renderArmouryPanel(model, wrap) {
  const header = childModel(model, UI.armouryHeader);
  const switcher = childModel(header, UI.armouryViewSwitcher);
  const body = descendantModel(model, UI.armouryBody);
  const inventory = descendantModel(model, UI.armouryInventory);
  const cards = descendantModel(model, UI.armouryCardStrip);
  const stats = descendantModel(model, UI.armouryStatsPanel);
  // THE ARMOURY IS AN XL DOOR ON THE KIT'S SHELL: the views are the head's tab
  // strip (a tab strip is what marks a door as a place), the close is the
  // IconButton in the same corner as every other door, and everything under
  // the hairline is the surface's own body. `.armoury-*` stays on the parts
  // because the tools read them; the shape is the shell's.
  wrap.innerHTML = `
    <div class="modal armoury${model.properties.picking ? ' picking' : ''}" data-size="xl" data-figure="${model.properties.figure ? '1' : '0'}" data-slots="${esc(model.properties.slots)}" data-view="${esc(model.properties.view)}" role="dialog" aria-modal="true" aria-label="${esc(model.accessibility.label)}">
      <div class="modal-body armoury-shell-body">
      ${model.properties.notice ? `<p class="as-status armoury-notice">${esc(model.properties.notice)}</p>` : ''}
      <div class="armoury-subject armoury-content">
        <div class="armoury-body">
          <div class="armoury-left"></div>
          <div class="armoury-hybrid-splitter" data-component="armoury.hybridPaneSplitter" role="separator" aria-label="Resize Character and Armaments panes" aria-orientation="vertical" tabindex="0"></div>
          <div class="armoury-right"></div>
        </div>
        <div class="armoury-pane-splitter" data-component="armoury.paneSplitter" role="separator" aria-label="Resize Armaments and Inventory panes" aria-orientation="vertical" tabindex="0"></div>
        <section class="armoury-inventory"></section>
      </div>
      <div class="armoury-trays">
        <div class="armoury-strip"></div>
        <section class="armoury-stats-tray"></section>
      </div>
      </div>
    </div>`;
  const head = modalHead({
    tabs: switcher.properties.views.map((view) => ({ id: view.id, label: view.label, selected: !!view.active })),
    showMenuButton: false,
    closeLabel: 'Close Armoury',
  });
  head.classList.add('armoury-head');
  head.setAttribute('aria-label', header.properties.title);
  const strip = head.querySelector('.modal-tabs');
  strip.classList.add('armoury-views');
  strip.dataset.surface = 'armouryView';
  strip.setAttribute('aria-label', switcher.accessibility.label);
  strip.querySelectorAll('.modal-tab').forEach((tabButton, index) => {
    const view = switcher.properties.views[index];
    tabButton.dataset.member = view.id;
    if (view.active) tabButton.classList.add('on');
  });
  const close = head.querySelector('.modal-close');
  close.id = 'armoury-close';
  close.classList.add('armoury-close');
  wrap.querySelector('.armoury').prepend(head);
  const panel = wrap.querySelector('.armoury');
  markUiComponent(panel, model.component, model.variant);
  markUiComponent(wrap.querySelector('.armoury-head'), header.component, header.variant);
  markUiComponent(wrap.querySelector('.armoury-views'), switcher.component, switcher.variant);
  markUiComponent(wrap.querySelector('.armoury-body'), body.component, body.variant);
  markUiComponent(wrap.querySelector('.armoury-inventory'), inventory.component, inventory.variant);
  markUiComponent(wrap.querySelector('.armoury-strip'), cards.component, cards.variant);
  markUiComponent(wrap.querySelector('.armoury-stats-tray'), stats.component, stats.variant);
  return {
    panel,
    left: wrap.querySelector('.armoury-left'),
    right: wrap.querySelector('.armoury-right'),
    subject: wrap.querySelector('.armoury-subject'),
    inventory: wrap.querySelector('.armoury-inventory'),
    strip: wrap.querySelector('.armoury-strip'),
    statsTray: wrap.querySelector('.armoury-stats-tray'),
    paneSplitter: wrap.querySelector('.armoury-pane-splitter'),
    hybridSplitter: wrap.querySelector('.armoury-hybrid-splitter'),
    trays: wrap.querySelector('.armoury-trays'),
    close: wrap.querySelector('.armoury-close'),
    viewButtons: [...wrap.querySelectorAll('[data-surface="armouryView"] [data-member]')],
  };
}

export function renderInventoryItemCard(model) {
  const row = model.properties;
  const element = document.createElement('span');
  element.className = `inventory-face${row.selected ? ' on' : ''}`;
  element.dataset.inventoryItem = row.key;
  element.dataset.itemId = row.id;
  element.dataset.itemCategory = row.category;
  element.dataset.itemCount = String(row.count);
  element.draggable = row.draggable;
  if (row.holdAction) {
    element.dataset.cardClass = 'inventoryItem';
    element.dataset.holdCapable = 'true';
  }
  const equipped = row.equippedLabels.length
    ? (row.equippedLabels.length === 1 && row.equippedLabels[0] === 'Equipped'
      ? 'Equipped'
      : `Equipped: ${row.equippedLabels.join(' / ')}`)
    : '';
  element.innerHTML = `<span class="inventory-name">${esc(row.name)}</span>`
    + `<span class="inventory-category">${esc(row.category)}</span>`
    + `<span class="inventory-count">×${row.count}</span>`
    + (equipped ? `<em class="inventory-equipped">${esc(equipped)}</em>` : '');
  markUiComponent(element, model.component, model.variant);
  return element;
}

export function renderInventoryDetailCard(model, { comparisonHtml = '', action = null } = {}) {
  const detail = model.properties;
  const element = document.createElement('div');
  element.className = 'inventory-detail';
  if (detail.holdAction) {
    element.dataset.cardClass = 'inventoryItem';
    element.dataset.holdCapable = 'true';
  }
  const art = detail.art.kind === 'image'
    ? `<img src="${esc(detail.art.value)}" alt="">`
    : `<span aria-hidden="true">${esc(detail.art.value)}</span>`;
  element.innerHTML = `<div class="inventory-model">${art}</div>`
    + `<div class="inventory-information"><h4>${esc(detail.name)}</h4>`
    + `<p class="inventory-kind">${esc(detail.category)} · ${esc(detail.rarity)} · ${detail.count} owned</p>`
    + `<p>${esc(detail.description)}</p>`
    + (detail.mods.length ? `<p class="inventory-mods">${detail.mods.map(esc).join(' · ')}</p>` : '')
    + (detail.tags.length ? `<div class="inventory-tags">${detail.tags.map((tag) => `<em>${esc(tag)}</em>`).join('')}</div>` : '')
    + (detail.instruction ? `<p class="inventory-instruction">${esc(detail.instruction)}</p>` : '')
    + comparisonHtml
    + '</div>';
  markUiComponent(element, model.component, model.variant);
  if (action) element.querySelector('.inventory-information').appendChild(action);
  const image = element.querySelector('img');
  if (image) image.addEventListener('error', () => image.replaceWith(Object.assign(document.createElement('span'), { textContent: detail.fallbackIcon })));
  return element;
}

export function renderEquipmentSlot(model, { renderCell = null, showHeader = true } = {}) {
  const slot = model.properties;
  const element = document.createElement('div');
  element.className = `equip-slot${showHeader ? '' : ' armoury-equipment-slot-component'}`;
  element.innerHTML = (showHeader
    ? `<div class="es-head"><span class="es-label">${esc(slot.label)}</span>`
      + (slot.rule.ok ? '' : `<span class="es-sealed" title="${esc(slot.rule.reason)}">${esc(slot.rule.word)}</span>`)
      + '</div>'
    : '') + '<div class="es-sets"></div>';
  markUiComponent(element, model.component, model.variant);
  const sets = element.querySelector('.es-sets');
  const cells = model.children.map((cellModel) => {
    const cell = renderCell ? renderCell(cellModel) : renderEquipmentSetCell(cellModel);
    if (renderCell) markUiComponent(cell, cellModel.component, cellModel.variant);
    sets.appendChild(cell);
    return { model: cellModel, element: cell };
  });
  return { element, cells };
}

export function renderEquipmentSetCell(model) {
  const cellData = model.properties;
  const element = document.createElement('button');
  element.type = 'button';
  if (cellData.state === 'next') {
    element.className = 'es-cell locked';
    element.innerHTML = `<span class="es-lock">🔒</span><span>${esc(cellData.rung.name)}</span>`;
  } else {
    element.className = `es-cell${cellData.active ? ' on' : ''}${cellData.piece ? '' : ' empty'}`;
    element.title = cellData.piece ? cellData.piece.name : 'Empty';
    element.innerHTML = cellData.piece
      ? `<img src="${esc(cellData.piece.image)}" alt=""><span>${esc(cellData.piece.name)}</span>`
      : '<span class="es-empty">＋</span>';
    const image = element.querySelector('img');
    if (image) image.addEventListener('error', () => image.replaceWith(Object.assign(document.createElement('span'), { textContent: '⚔' })));
  }
  markUiComponent(element, model.component, model.variant);
  return element;
}
