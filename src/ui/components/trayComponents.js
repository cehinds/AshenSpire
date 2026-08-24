import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { esc } from './tooltip.js';
import { markUiComponent } from './uiComponents.js';

const GLYPHS = Object.freeze({
  top: Object.freeze({ closed: 'v', open: '^' }),
  right: Object.freeze({ closed: '<', open: '>' }),
  bottom: Object.freeze({ closed: '^', open: 'v' }),
  left: Object.freeze({ closed: '>', open: '<' }),
});

export function renderTray(model, { onToggle = null, onSort = null, renderContent = null } = {}) {
  const headerModel = childModel(model, UI.trayHeader);
  const contentModel = childModel(model, UI.trayContent);
  const tray = model.properties;
  const state = tray.expanded ? 'open' : 'closed';
  const root = document.createElement('section');
  root.className = `folding-tray tray-${esc(tray.edge)}`;
  root.dataset.trayId = tray.id;
  root.dataset.trayEdge = tray.edge;
  root.dataset.collapsed = tray.expanded ? '0' : '1';
  root.setAttribute('role', model.accessibility.role);
  root.setAttribute('aria-label', model.accessibility.label);
  markUiComponent(root, model.component, model.variant);

  const header = document.createElement('div');
  header.className = 'tray-header region-head';
  markUiComponent(header, headerModel.component, headerModel.variant);
  const fold = document.createElement('button');
  fold.type = 'button';
  fold.className = 'tray-fold region-fold';
  fold.dataset.fold = tray.id;
  fold.setAttribute('aria-expanded', tray.expanded ? 'true' : 'false');
  fold.setAttribute('aria-controls', `tray-content-${tray.id}`);
  fold.innerHTML = `<span class="tray-caret rf-caret" aria-hidden="true">${esc(GLYPHS[tray.edge][state])}</span>`
    + `<span class="tray-title rf-label">${esc(tray.name)}</span>`
    + `<span class="tray-count rf-count">×${tray.count} ${esc(tray.itemType)}${tray.count === 1 ? '' : 's'}</span>`;
  if (onToggle) fold.addEventListener('click', () => onToggle(tray.id));
  header.appendChild(fold);

  let sort = null;
  if (tray.sortable) {
    sort = document.createElement('button');
    sort.type = 'button';
    sort.className = 'tray-sort';
    sort.setAttribute('aria-label', tray.sortLabel);
    sort.title = tray.sortLabel;
    sort.textContent = '⊞';
    if (onSort) sort.addEventListener('click', () => onSort(tray.id));
    else sort.disabled = true;
    header.appendChild(sort);
  }

  const content = document.createElement('div');
  content.className = 'tray-content';
  content.id = `tray-content-${tray.id}`;
  content.hidden = !tray.expanded;
  markUiComponent(content, contentModel.component, contentModel.variant);
  if (renderContent) renderContent(content, contentModel.children);
  root.append(header, content);
  return { element: root, header, fold, sort, content };
}
