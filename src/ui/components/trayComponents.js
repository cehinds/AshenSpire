import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { esc } from './tooltip.js';
import { markUiComponent } from './uiComponents.js';
import { traySizeService } from '../services/TraySizeService.js';
import { TRAY_FOLD_GLYPH as GLYPHS } from './foldGlyph.js';


export function renderTray(model, { onToggle = null, onSort = null, onResize = null, renderContent = null, sizeService = traySizeService } = {}) {
  const headerModel = childModel(model, UI.trayHeader);
  const resizeModel = childModel(model, UI.trayResizeHandle);
  const contentModel = childModel(model, UI.trayContent);
  const tray = model.properties;
  const state = tray.expanded ? 'open' : 'closed';
  const root = document.createElement('section');
  root.className = `folding-tray tray-${esc(tray.edge)}`;
  root.dataset.trayId = tray.id;
  root.dataset.trayEdge = tray.edge;
  root.dataset.collapsed = tray.expanded ? '0' : '1';
  root.dataset.resizable = tray.resizable ? '1' : '0';
  root.setAttribute('role', model.accessibility.role);
  root.setAttribute('aria-label', model.accessibility.label);
  markUiComponent(root, model.component, model.variant);

  const vertical = tray.edge === 'top' || tray.edge === 'bottom';
  const rememberedSize = tray.expanded && tray.resizable ? sizeService.read(tray.id, tray.edge) : null;
  root.dataset.sized = rememberedSize ? '1' : '0';
  if (rememberedSize) root.style[vertical ? 'height' : 'width'] = `${rememberedSize}px`;

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
    + (tray.summary
      ? `<span class="tray-summary rf-count">${esc(tray.summary)}</span>`
      : `<span class="tray-count rf-count">×${tray.count} ${esc(tray.itemType)}${tray.count === 1 ? '' : 's'}</span>`);
  if (onToggle) fold.addEventListener('click', () => onToggle(tray.id));
  header.appendChild(fold);

  let sort = null;
  if (tray.sortable && tray.expanded) {
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

  let resizeHandle = null;
  if (tray.expanded && tray.resizable) {
    resizeHandle = document.createElement('div');
    resizeHandle.className = 'tray-resize-handle';
    resizeHandle.tabIndex = 0;
    resizeHandle.setAttribute('role', resizeModel.accessibility.role);
    resizeHandle.setAttribute('aria-label', resizeModel.accessibility.label);
    resizeHandle.setAttribute('aria-orientation', resizeModel.accessibility.orientation);
    markUiComponent(resizeHandle, resizeModel.component, resizeModel.variant);

    const resizeTo = (requested) => {
      const hostSize = vertical ? root.parentElement?.clientHeight : root.parentElement?.clientWidth;
      const maximum = Math.max(tray.minExpandedSize, (hostSize || requested) - 8);
      const size = Math.min(maximum, Math.max(tray.minExpandedSize, requested));
      root.dataset.sized = '1';
      root.style[vertical ? 'height' : 'width'] = `${size}px`;
      return size;
    };
    const finish = (size) => {
      const saved = sizeService.write(tray.id, tray.edge, size);
      onResize?.(tray.id, saved);
    };
    resizeHandle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      const startPoint = vertical ? event.clientY : event.clientX;
      const startSize = vertical ? root.getBoundingClientRect().height : root.getBoundingClientRect().width;
      const direction = tray.edge === 'bottom' || tray.edge === 'right' ? -1 : 1;
      let active = event.pointerType !== 'touch';
      let lastSize = startSize;
      const activate = () => {
        active = true;
        resizeHandle.dataset.dragging = '1';
        try { resizeHandle.setPointerCapture?.(event.pointerId); } catch { /* synthetic/test pointers have no native capture */ }
      };
      const hold = active ? null : setTimeout(activate, 180);
      if (active) activate();
      const move = (nextEvent) => {
        if (!active || nextEvent.pointerId !== event.pointerId) return;
        nextEvent.preventDefault();
        const point = vertical ? nextEvent.clientY : nextEvent.clientX;
        lastSize = resizeTo(startSize + ((point - startPoint) * direction));
      };
      const end = (nextEvent) => {
        if (nextEvent.pointerId !== event.pointerId) return;
        if (hold) clearTimeout(hold);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        delete resizeHandle.dataset.dragging;
        if (active) finish(lastSize);
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
    resizeHandle.addEventListener('keydown', (event) => {
      const delta = ({ ArrowUp:-16, ArrowLeft:-16, ArrowDown:16, ArrowRight:16 })[event.key];
      if (delta == null) return;
      const relevant = vertical ? event.key === 'ArrowUp' || event.key === 'ArrowDown' : event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      if (!relevant) return;
      event.preventDefault();
      const current = vertical ? root.getBoundingClientRect().height : root.getBoundingClientRect().width;
      const direction = tray.edge === 'bottom' || tray.edge === 'right' ? -1 : 1;
      finish(resizeTo(current + (delta * direction)));
    });
  }
  root.append(header, content, ...(resizeHandle ? [resizeHandle] : []));
  return { element: root, header, fold, sort, content, resizeHandle };
}
