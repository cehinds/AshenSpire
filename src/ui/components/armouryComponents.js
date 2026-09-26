import { assetUrl } from '../assetmap.js';
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
import { modalHead, stampModalSize } from './modalShell.js';
import {
  el, blocker, face, pill, tagChip, artWell, titleS, eyebrow, prose, flavour, kitLine, kitItem, optionCard, options, statusText,
  railItem, categoryNav, modalFooter,
} from '../kit/index.js';

export function renderArmouryOverlay(model) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-veil armoury-overlay';
  markUiComponent(wrap, model.component, model.variant);
  wrap.style.setProperty('--equip-equipped-tag-color', model.properties.equippedTagColor || 'var(--gold)');
  return wrap;
}

export function renderArmouryPanel(model, wrap, { back = null, primary = null } = {}) {
  const header = childModel(model, UI.armouryHeader);
  const switcher = childModel(header, UI.armouryViewSwitcher);
  const body = descendantModel(model, UI.armouryBody);
  const inventory = descendantModel(model, UI.armouryInventory);
  const cards = descendantModel(model, UI.armouryCardStrip);
  const stats = descendantModel(model, UI.armouryStatsPanel);
  // W1e: THE ARMOURY IS A W1 WORKSPACE ON THE KIT'S SHELL. The head carries
  // the one title and the close IconButton in the corner every door uses. The
  // views are the kit's W1 category navigation (kit categoryNav: a rail beside
  // the pane on wide hosts, one [Category ▾] selector above it on compact
  // ones), never a strip of head tabs nor a grid of cells. The pane is
  // the active view's body; the footer holds Back and, when the selected item
  // has one, its action. The rail items keep the tab semantics and the
  // `data-surface="armouryView"` / `data-member` / `data-modal-tab` hooks the
  // tools read. A refusal shown in place is the kit's Blocker.
  wrap.innerHTML = `
    <div class="modal armoury${model.properties.picking ? ' picking' : ''}" data-wireframe="W1" data-wireframe-child="W1e" data-figure="${model.properties.figure ? '1' : '0'}" data-slots="${esc(model.properties.slots)}" data-view="${esc(model.properties.view)}" role="dialog" aria-modal="true" aria-labelledby="armoury-title">
      <div class="modal-body armoury-shell-body">
        <div class="as-railed armoury-railed">
          <div class="as-pane armoury-pane" id="armoury-pane" role="tabpanel">
            <div class="armoury-subject armoury-content">
              <div class="armoury-body">
                <div class="armoury-left"></div>
                <div class="armoury-right"></div>
              </div>
              <section class="armoury-inventory"></section>
            </div>
            <div class="armoury-trays">
              <div class="armoury-strip"></div>
              <section class="armoury-stats-tray"></section>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  const pane = wrap.querySelector('.armoury-pane');
  if (model.properties.notice) {
    pane.prepend(blocker(model.properties.notice, { attrs: { class: 'armoury-notice', role: 'status' } }));
  }
  const nav = categoryNav({
    items: switcher.properties.views.map((view) => railItem({
      label: view.label, current: !!view.active, member: view.id, id: `armoury-view-${view.id}`, className: 'armoury-view',
      attrs: { dataset: { modalTab: view.id, focusable: 'true' }, 'aria-controls': 'armoury-pane' },
    })),
    ariaLabel: switcher.accessibility.label, toggleId: 'armoury-view-select',
    railAttrs: { class: 'armoury-views', dataset: { surface: 'armouryView' } },
  });
  const railNode = nav.rail;
  pane.before(railNode);
  nav.attach(wrap.querySelector('.armoury-railed'));
  const selectedView = railNode.querySelector('[aria-selected="true"]');
  if (selectedView) pane.setAttribute('aria-labelledby', selectedView.id);
  const head = modalHead({
    title: header.properties.title,
    titleId: 'armoury-title',
    showMenuButton: false,
    closeLabel: header.properties.closeLabel,
  });
  head.classList.add('armoury-head');
  const close = head.querySelector('.modal-close');
  close.id = 'armoury-close';
  close.classList.add('armoury-close');
  wrap.querySelector('.armoury').prepend(head);
  const panel = wrap.querySelector('.armoury');
  // W1e's rung through the shell's one stamp rather than a literal in the
  // markup above, so the Armoury answers the modal width choice (Settings →
  // Advanced → Wireframes → Modals) like every other door.
  stampModalSize(panel, 'xl');
  // The footer: Back bottom-left, the primary bottom-right; alone, Back spans
  // the foot. `setPrimary` swaps the primary slot when the selection changes.
  const setPrimary = (primaryNode) => {
    const foot = modalFooter({ secondary: back ? [back] : [], primary: primaryNode, size: 'medium' });
    foot.classList.add('armoury-foot');
    const current = panel.querySelector(':scope > .armoury-foot');
    if (current) current.replaceWith(foot); else panel.appendChild(foot);
    return foot;
  };
  setPrimary(primary);
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
    trays: wrap.querySelector('.armoury-trays'),
    close: wrap.querySelector('.armoury-close'),
    viewButtons: [...wrap.querySelectorAll('[data-surface="armouryView"] [data-member]')],
    rail: railNode,
    nav,
    pane,
    setPrimary,
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
    art: row.artAsset
      ? fallbackOnError(artWell({ src: assetUrl(row.artAsset), alt: '', small: true, attrs: { class: 'inventory-item-art' } }), row.icon)
      : artWell({ glyph: row.icon || '◆', small: true, attrs: { class: 'inventory-item-art' } }),
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
