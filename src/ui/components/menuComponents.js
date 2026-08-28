import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { attachTooltip, esc } from './tooltip.js';
import { markUiComponent } from './uiComponents.js';

export function renderQuickMenu(model, { onActivate }) {
  const veil = document.createElement('div');
  veil.className = 'modal-veil qn-veil';
  const panel = document.createElement('div');
  panel.className = 'qn-panel';
  panel.dataset.surface = 'menuAct';
  panel.setAttribute('role', model.accessibility.role);
  panel.setAttribute('aria-label', model.accessibility.label);
  markUiComponent(panel, model.component, model.variant);

  const captionModel = childModel(model, UI.quickMenuCaption);
  const caption = document.createElement('div');
  caption.className = 'qn-cap';
  caption.textContent = captionModel.properties.label;
  markUiComponent(caption, captionModel.component, captionModel.variant);
  panel.appendChild(caption);

  for (const rowModel of model.children.filter((child) => child.component === UI.quickMenuRow)) {
    const row = rowModel.properties;
    if (row.separatorBefore) panel.appendChild(Object.assign(document.createElement('div'), { className: 'qn-sep' }));
    const button = document.createElement('button');
    button.className = `qn-row${row.tone ? ` ${row.tone}` : ''}${row.active ? ' on' : ''}`;
    button.dataset.act = row.act;
    button.dataset.member = row.act;
    if (row.tab) button.dataset.tab = row.tab;
    button.innerHTML = `<span class="qn-ic">${esc(row.icon)}</span><span class="qn-label">${esc(row.label)}</span>`
      + (row.badge ? `<span class="qn-badge">${esc(row.badge)}</span>` : '');
    markUiComponent(button, rowModel.component, rowModel.variant);
    if (row.tip) attachTooltip(button, () => `<div class="tt-title">${esc(row.label)}</div>${esc(row.tip)}`);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onActivate(row, button);
    });
    panel.appendChild(button);
  }
  veil.appendChild(panel);
  return { veil, panel };
}

export function renderMenuOverlay(model) {
  const stripModel = childModel(model, UI.menuTabStrip);
  const footerModel = childModel(model, UI.menuFooter);
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal overlay-modal" role="dialog" aria-modal="true" aria-label="${esc(model.accessibility.label)}">
      <div class="overlay-head">
        <div class="overlay-tabs" data-surface="overlayTab"${model.properties.folded ? ' hidden' : ''} role="tablist" aria-label="${esc(stripModel.accessibility.label)}">
          ${stripModel.children.map((tab) => `<button class="ov-tab${tab.properties.active ? ' on' : ''}" data-member="${esc(tab.properties.id)}" role="tab" aria-selected="${tab.properties.active ? 'true' : 'false'}">${esc(tab.properties.label)}</button>`).join('')}
        </div>
        ${model.properties.folded ? '<button class="ov-switch" id="ov-switch" aria-haspopup="menu"></button>' : ''}
        <div class="overlay-actions">
          ${model.properties.mirrored ? '<button class="subtle" id="ov-quicknav" title="Go to…">☰</button>' : ''}
          <button class="subtle" id="ov-close" title="Close (Esc)">✕</button>
        </div>
      </div>
      <div class="overlay-body" role="tabpanel"></div>
      <footer class="overlay-footer">
        <span class="overlay-footer-note">Progress saves to the active slot.</span>
        <div class="overlay-footer-actions">
          <button class="subtle" id="ov-save" type="button">Save Game</button>
          <button class="subtle danger" id="ov-quit" type="button">Save &amp; Quit to Title</button>
        </div>
      </footer>
    </div>`;
  const overlay = veil.querySelector('.overlay-modal');
  const strip = veil.querySelector('.overlay-tabs');
  const body = veil.querySelector('.overlay-body');
  const footer = veil.querySelector('.overlay-footer');
  markUiComponent(overlay, model.component, model.variant);
  markUiComponent(strip, stripModel.component, stripModel.variant);
  stripModel.children.forEach((tabModel, index) => {
    markUiComponent(veil.querySelectorAll('.ov-tab')[index], tabModel.component, tabModel.variant);
  });
  markUiComponent(body, UI.menuPanel, model.properties.activeId);
  markUiComponent(footer, footerModel.component, footerModel.variant);
  markUiComponent(veil.querySelector('#ov-save'), childModel(footerModel, UI.saveGameControl).component);
  markUiComponent(veil.querySelector('#ov-quit'), childModel(footerModel, UI.saveQuitControl).component);
  return { veil, overlay, strip, body };
}

export function updateMenuSelection(root, tabs, id) {
  root.querySelectorAll('.ov-tab').forEach((button) => {
    const active = button.dataset.member === id;
    button.classList.toggle('on', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const switcher = root.querySelector('#ov-switch');
  if (switcher) switcher.textContent = `${tabs.find((tab) => tab.id === id)?.label || id} \u25be`;
  const body = root.querySelector('.overlay-body');
  body.innerHTML = '';
  markUiComponent(body, UI.menuPanel, id);
  return body;
}
