// src/ui/components/armouryComponents.js — the Armoury's renderers, on the kit.
//
// The shell is the kit's door (modalHead tabs, the close IconButton, the body
// under the hairline). Every part inside is a kit piece: an inventory row is an
// OptionCard face (kit §03 `face`) with its category as a Tag and its count and
// equipped state as StatePills; the open item is an ArtWell beside a DetailCard
// of facts; a set cell is an OptionCard with an ArtWell. `.armoury-*`,
// `.inventory-*`, `.equip-slot`, `.es-*` stay on the kit elements because the
// tools read them; styles/kit.css draws nothing for those names.
import { childModel, descendantModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { esc, attachTooltip } from './tooltip.js';
import { markUiComponent } from './uiComponents.js';
import { modalHead } from './modalShell.js';
import {
  el, blocker, face, pill, tagChip, artWell, titleS, eyebrow, prose, flavour, kitLine, kitItem, optionCard, options, statusText,
} from '../kit/index.js';

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
  // the hairline is the surface's own body. The two splitters are the kit's
  // `.as-splitter`; a refusal shown in place is the kit's Blocker.
  wrap.innerHTML = `
    <div class="modal armoury${model.properties.picking ? ' picking' : ''}" data-size="xl" data-figure="${model.properties.figure ? '1' : '0'}" data-slots="${esc(model.properties.slots)}" data-view="${esc(model.properties.view)}" role="dialog" aria-modal="true" aria-label="${esc(model.accessibility.label)}">
      <div class="modal-body armoury-shell-body">
      <div class="armoury-subject armoury-content">
        <div class="armoury-body">
          <div class="armoury-left"></div>
          <div class="armoury-hybrid-splitter as-splitter" data-component="armoury.hybridPaneSplitter" role="separator" aria-label="Resize Character and Armaments panes" aria-orientation="vertical" tabindex="0"></div>
          <div class="armoury-right"></div>
        </div>
        <div class="armoury-pane-splitter as-splitter" data-component="armoury.paneSplitter" role="separator" aria-label="Resize Armaments and Inventory panes" aria-orientation="vertical" tabindex="0"></div>
        <section class="armoury-inventory"></section>
      </div>
      <div class="armoury-trays">
        <div class="armoury-strip"></div>
        <section class="armoury-stats-tray"></section>
      </div>
      </div>
    </div>`;
  if (model.properties.notice) {
    wrap.querySelector('.armoury-shell-body').prepend(blocker(model.properties.notice, { attrs: { class: 'armoury-notice', role: 'status' } }));
  }
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

/** The image dies quietly if the file is missing — the single-file dist and file:// play depend on this. */
function fallbackOnError(well, glyphText) {
  const image = well.querySelector('img');
  if (image) image.addEventListener('error', () => image.replaceWith(Object.assign(document.createElement('span'), { textContent: glyphText })));
  return well;
}

/** An inventory row's FACE: the item's name, its category as a Tag, its count and equipped state as StatePills. */
export function renderInventoryItemCard(model) {
  const row = model.properties;
  const equipped = row.equippedLabels.length
    ? (row.equippedLabels.length === 1 && row.equippedLabels[0] === 'Equipped'
      ? 'Equipped'
      : `Equipped: ${row.equippedLabels.join(' / ')}`)
    : '';
  const element = face({
    nameNode: el('span', { class: 'on' }, el('span', { class: 'inventory-name ec-name', text: row.name })),
    trail: [
      tagChip({ label: row.category, attrs: { class: 'inventory-category' } }),
      pill({ label: `×${row.count}`, attrs: { class: 'inventory-count' } }),
      equipped ? pill({ label: equipped, on: true, attrs: { class: 'inventory-equipped' } }) : null,
    ],
    className: `inventory-face${row.selected ? ' on' : ''}`,
    attrs: {
      dataset: {
        inventoryItem: row.key, itemId: row.id, itemCategory: row.category, itemCount: String(row.count),
        ...(row.holdAction ? { cardClass: 'inventoryItem', holdCapable: 'true' } : {}),
      },
    },
  });
  element.draggable = row.draggable;
  markUiComponent(element, model.component, model.variant);
  return element;
}

/** The open item: an ArtWell beside its facts — Title·S, Eyebrow kind line, prose, mods as a KitLine, Tags, the instruction as Flavour. */
export function renderInventoryDetailCard(model, { comparisonHtml = '', action = null } = {}) {
  const detail = model.properties;
  const element = el('div', { class: 'inventory-detail' });
  if (detail.holdAction) {
    element.dataset.cardClass = 'inventoryItem';
    element.dataset.holdCapable = 'true';
  }
  const model3d = detail.art.kind === 'image'
    ? artWell({ src: detail.art.value, alt: '', attrs: { class: 'inventory-model' } })
    : artWell({ glyph: detail.art.value, attrs: { class: 'inventory-model' } });
  fallbackOnError(model3d, detail.fallbackIcon);
  const information = el('div', { class: 'inventory-information' }, [
    titleS(detail.name, { tag: 'h4' }),
    eyebrow(`${detail.category} · ${detail.rarity} · ${detail.count} owned`, { class: 'inventory-kind' }),
    prose(detail.description),
    detail.mods.length ? kitLine(detail.mods.map((mod) => kitItem({ glyph: '◆', name: mod })), { class: 'inventory-mods' }) : null,
    detail.tags.length ? el('div', { class: 'tags inventory-tags' }, detail.tags.map((tag) => tagChip({ label: tag }))) : null,
    detail.instruction ? flavour(detail.instruction, { class: 'inventory-instruction' }) : null,
  ]);
  if (comparisonHtml) information.insertAdjacentHTML('beforeend', comparisonHtml);
  element.append(model3d, information);
  markUiComponent(element, model.component, model.variant);
  if (action) information.appendChild(action);
  return element;
}

/** A slot: its label as an Eyebrow (with the swap rule's word beside it when sealed), then its set cells. */
export function renderEquipmentSlot(model, { renderCell = null, showHeader = true } = {}) {
  const slot = model.properties;
  const element = el('div', { class: `equip-slot${showHeader ? '' : ' armoury-equipment-slot-component'}` });
  if (showHeader) {
    const head = el('div', { class: 'es-head' }, eyebrow(slot.label, { class: 'es-label' }));
    if (!slot.rule.ok) {
      const sealed = statusText(slot.rule.word, { class: 'es-sealed' });
      attachTooltip(sealed, () => esc(slot.rule.reason));
      head.appendChild(sealed);
    }
    element.appendChild(head);
  }
  const sets = options([], { class: 'es-sets' });
  element.appendChild(sets);
  markUiComponent(element, model.component, model.variant);
  const cells = model.children.map((cellModel) => {
    const cell = renderCell ? renderCell(cellModel) : renderEquipmentSetCell(cellModel);
    if (renderCell) markUiComponent(cell, cellModel.component, cellModel.variant);
    sets.appendChild(cell);
    return { model: cellModel, element: cell };
  });
  return { element, cells };
}

/** A set cell is an OptionCard: the piece's art in an ArtWell, its name, gold when it is the active set. */
export function renderEquipmentSetCell(model) {
  const cellData = model.properties;
  let element;
  if (cellData.state === 'next') {
    element = optionCard({ glyph: '🔒', name: cellData.rung.name, arrow: false, disabled: true, className: 'es-cell locked compact' });
  } else {
    const well = cellData.piece
      ? fallbackOnError(artWell({ src: cellData.piece.image, alt: '', small: true }), '⚔')
      : artWell({ glyph: '＋', small: true, attrs: { class: 'es-empty' } });
    element = optionCard({
      art: well, name: cellData.piece ? cellData.piece.name : 'Empty', arrow: false, selected: !!cellData.active,
      className: `es-cell compact${cellData.active ? ' on' : ''}${cellData.piece ? '' : ' empty'}`,
    });
  }
  markUiComponent(element, model.component, model.variant);
  return element;
}
