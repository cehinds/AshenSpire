// Gallery density changes tile widths, never the page or inspector transform.
export const DEFAULT_GALLERY_SIZE = 185;
export const MIN_GALLERY_SIZE = 110;
export const MAX_GALLERY_SIZE = 360;
export const GALLERY_ZOOM_KEYS = Object.freeze({ cards: 'ashenspire:scoreStudioGalleryZoom:cards:v1', items: 'ashenspire:scoreStudioGalleryZoom:items:v1' });

const normalizedSize = value => {
  const n = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.max(MIN_GALLERY_SIZE, Math.min(MAX_GALLERY_SIZE, Math.round(n))) : DEFAULT_GALLERY_SIZE;
};

export function initGalleryZoom({ document: doc = globalThis.document, storage, onCardsResize, onItemsResize } = {}) {
  if (!doc) throw new Error('Gallery zoom requires a document');
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  const kinds = ['cards', 'items'], sizes = {}, wheelTargets = {}, controls = {};
  for (const kind of kinds) {
    let saved;
    try { saved = storage?.getItem(GALLERY_ZOOM_KEYS[kind]); } catch { /* Optional persistence. */ }
    sizes[kind] = wheelTargets[kind] = normalizedSize(saved);
    const prefix = kind === 'cards' ? 'card' : 'item';
    controls[kind] = { grid: doc.getElementById(`${kind}-grid`), slider: doc.getElementById(`${prefix}-scale-slider`), output: doc.getElementById(`${prefix}-zoom-value`), reset: doc.getElementById(`${prefix}-zoom-reset`), resize: kind === 'cards' ? onCardsResize : onItemsResize };
  }
  function checkKind(kind) { if (!kinds.includes(kind)) throw new Error(`Unknown gallery '${kind}'`); }
  function scrollContainer(grid) {
    for (let node = grid; node && node !== doc; node = node.parentElement || node.parentNode) {
      const style = doc.defaultView?.getComputedStyle?.(node);
      if (style && /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    }
    return doc.scrollingElement || doc.body;
  }
  function anchorFor(grid, event) {
    const tile = event.target?.closest?.('.studio-card-tile, .item-grid-tile, .studio-add-card-tile');
    if (!tile || !grid.contains?.(tile)) return null;
    const rect = tile.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { tile, scroll: scrollContainer(grid), x: event.clientX, y: event.clientY,
      fx: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      fy: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  }
  function apply(kind, value, anchor) {
    checkKind(kind);
    const size = normalizedSize(value), control = controls[kind], changed = sizes[kind] !== size;
    sizes[kind] = wheelTargets[kind] = size;
    control.grid?.style.setProperty(kind === 'cards' ? '--card-tile-width' : '--item-tile-width', `${size}px`);
    if (control.slider) control.slider.value = String(size);
    const percent = `${Math.round(size / DEFAULT_GALLERY_SIZE * 100)}%`;
    if (control.output) control.output.textContent = percent;
    if (control.slider) control.slider.setAttribute('aria-valuetext', percent);
    try { storage?.setItem(GALLERY_ZOOM_KEYS[kind], String(size)); } catch { /* Zoom still works without storage. */ }
    if (anchor?.tile.isConnected && anchor.scroll) {
      const next = anchor.tile.getBoundingClientRect();
      anchor.scroll.scrollLeft += next.left + anchor.fx * next.width - anchor.x;
      anchor.scroll.scrollTop += next.top + anchor.fy * next.height - anchor.y;
    }
    if (changed) control.resize?.(size);
    return size;
  }
  for (const kind of kinds) {
    const { grid, slider, reset } = controls[kind];
    if (slider) {
      slider.min = String(MIN_GALLERY_SIZE); slider.max = String(MAX_GALLERY_SIZE); slider.step = '1';
      slider.addEventListener('input', () => apply(kind, slider.value));
    }
    reset?.addEventListener('click', () => apply(kind, DEFAULT_GALLERY_SIZE));
    grid?.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey || event.defaultPrevented) return;
      const delta = event.deltaY || event.deltaX || 0;
      if (!Number.isFinite(delta) || delta === 0) return;
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? grid.clientHeight || 800 : 1;
      const pixels = Math.max(-240, Math.min(240, delta * units));
      const target = Math.max(MIN_GALLERY_SIZE, Math.min(MAX_GALLERY_SIZE, wheelTargets[kind] * Math.exp(-pixels * .002)));
      const next = normalizedSize(target);
      // The gesture belongs to this gallery even at a limit; prevent native
      // browser page zoom while the pointer is over its grid.
      event.preventDefault();
      if (next !== sizes[kind]) apply(kind, next, anchorFor(grid, event));
      wheelTargets[kind] = target;
    }, { passive: false });
    apply(kind, sizes[kind]);
  }
  return { setSize: (kind, value) => apply(kind, value), getSize: kind => { checkKind(kind); return sizes[kind]; }, reset: kind => apply(kind, DEFAULT_GALLERY_SIZE) };
}
