// src/ui/components/trayComponents.js — THE FOLDING TRAY, on the kit.
//
// A tray is a docked region that folds to its header. The header is a kit Row
// (a caret Glyph, the name as Title·S, the count as StatusText) beside an
// IconButton for the view toggle; the body is a kit Pane. The frame is the
// kit's `tray()` (`.as-tray`, styles/kit.css FOLDING TRAY). Nothing here draws
// a shape of its own — `.folding-tray`, `.tray-*`, `.region-fold`, `.rf-*`,
// `[data-fold]`, `[data-collapsed]`, `[data-sized]`, `[data-tray-edge]` stay
// on the kit elements because the tools read them.
import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { markUiComponent } from './uiComponents.js';
import { traySizeService } from '../services/TraySizeService.js';
import { TRAY_FOLD_GLYPH as GLYPHS } from './foldGlyph.js';
import { el, tray as trayFrame, row, glyph, titleS, statusText, iconButton, pane } from '../kit/index.js';

/** The header's count, as the tools read it: "×3 items", or the summary sentence. */
function countText(tray) {
  return tray.summary ? tray.summary : `×${tray.count} ${tray.itemType}${tray.count === 1 ? '' : 's'}`;
}

export function renderTray(model, { onToggle = null, onSort = null, onResize = null, renderContent = null, sizeService = traySizeService } = {}) {
  const headerModel = childModel(model, UI.trayHeader);
  const resizeModel = childModel(model, UI.trayResizeHandle);
  const contentModel = childModel(model, UI.trayContent);
  const tray = model.properties;
  const state = tray.expanded ? 'open' : 'closed';
  const vertical = tray.edge === 'top' || tray.edge === 'bottom';
  const rememberedSize = tray.expanded && tray.resizable ? sizeService.read(tray.id, tray.edge) : null;

  // THE FOLD CONTROL is the Row: caret + name + count, the whole header a tap.
  const fold = row({
    glyph: GLYPHS[tray.edge][state],
    labelNode: titleS(tray.name, { tag: 'span', class: 'r-label tray-title rf-label' }),
    status: countText(tray),
    tag: 'button',
    className: 'tray-fold region-fold',
    attrs: { dataset: { fold: tray.id }, 'aria-controls': `tray-content-${tray.id}` },
  });
  // Set by name, not through the builder's attrs bag: tools/onefold.mjs counts
  // the files that construct an expander, and a count that cannot see this one
  // is a count that lies.
  fold.setAttribute('aria-expanded', tray.expanded ? 'true' : 'false');
  fold.querySelector('.as-glyph').classList.add('tray-caret', 'rf-caret');
  fold.querySelector('.as-status').classList.add(tray.summary ? 'tray-summary' : 'tray-count', 'rf-count');
  if (onToggle) fold.addEventListener('click', () => onToggle(tray.id));

  const header = el('div', { class: 'tray-header region-head' }, fold);
  markUiComponent(header, headerModel.component, headerModel.variant);

  let sort = null;
  if (tray.sortable && tray.expanded) {
    sort = iconButton({ glyph: '⊞', label: tray.sortLabel, className: 'tray-sort' });
    if (onSort) sort.addEventListener('click', () => onSort(tray.id));
    else sort.disabled = true;
    header.appendChild(sort);
  }

  const content = pane({ attrs: { class: 'tray-content', id: `tray-content-${tray.id}` } });
  content.hidden = !tray.expanded;
  markUiComponent(content, contentModel.component, contentModel.variant);
  if (renderContent) renderContent(content, contentModel.children);

  const root = trayFrame({
    edge: tray.edge, collapsed: !tray.expanded, sized: !!rememberedSize, head: header, body: content,
    className: `folding-tray tray-${tray.edge}`,
    attrs: { dataset: { trayId: tray.id, resizable: tray.resizable ? '1' : '0' }, role: model.accessibility.role, 'aria-label': model.accessibility.label },
  });
  markUiComponent(root, model.component, model.variant);
  if (rememberedSize) root.style[vertical ? 'height' : 'width'] = `${rememberedSize}px`;

  let resizeHandle = null;
  if (tray.expanded && tray.resizable) {
    resizeHandle = el('div', { class: 'tray-resize-handle', tabindex: '0', role: resizeModel.accessibility.role, 'aria-label': resizeModel.accessibility.label, 'aria-orientation': resizeModel.accessibility.orientation });
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
      const delta = ({ ArrowUp: -16, ArrowLeft: -16, ArrowDown: 16, ArrowRight: 16 })[event.key];
      if (delta == null) return;
      const relevant = vertical ? event.key === 'ArrowUp' || event.key === 'ArrowDown' : event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      if (!relevant) return;
      event.preventDefault();
      const current = vertical ? root.getBoundingClientRect().height : root.getBoundingClientRect().width;
      const direction = tray.edge === 'bottom' || tray.edge === 'right' ? -1 : 1;
      finish(resizeTo(current + (delta * direction)));
    });
    root.appendChild(resizeHandle);
  }
  return { element: root, header, fold, sort, content, resizeHandle };
}
