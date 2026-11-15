// A selected view changes game geometry in place. It does not emulate browser
// capabilities, reload the document, or replace the current run.
export const VIEW_PRESETS = Object.freeze({
  desktop: Object.freeze({ width: 1440, height: 900 }),
  mobile: Object.freeze({ width: 390, height: 844 }),
  widescreen: Object.freeze({ width: 2560, height: 1080 }),
  tablet: Object.freeze({ width: 1180, height: 820 }),
});

export function resolveViewViewport(preset, width, height) {
  const key = String(preset || 'auto').toLowerCase();
  let dimensions = VIEW_PRESETS[key];
  // The tablet canvas follows the device: 1180x820 landscape, 820x1180 portrait.
  if (dimensions && key === 'tablet' && height > width) dimensions = { width: dimensions.height, height: dimensions.width };
  if (!dimensions) return { preset: 'auto', width, height, scale: 1, left: 0, top: 0 };
  const scale = Math.min(width / dimensions.width, height / dimensions.height);
  return { preset: key, ...dimensions, scale,
    left: (width - dimensions.width * scale) / 2,
    top: (height - dimensions.height * scale) / 2 };
}

// Reading innerWidth/innerHeight flushes pending style and layout, and a drag asks
// for the viewport on every pointer move. The answer only changes with a resize
// or a pinch, which arrive with a new frame, so it is kept for the frame it was read in
// (20 ms at most), and only for the live window: a test's stand-in window
// is read every time.
let viewportCache = null;

export function logicalViewport(win = globalThis.window) {
  const preset = win?.document?.documentElement?.dataset?.viewPreset;
  if (VIEW_PRESETS[preset])
  {
    const { viewWidth, viewHeight } = win.document.documentElement.dataset;
    if (Number(viewWidth) > 0 && Number(viewHeight) > 0) return { width: Number(viewWidth), height: Number(viewHeight) };
    return VIEW_PRESETS[preset];
  }
  const live = win === globalThis.window && win?.document?.timeline;
  const frame = live ? win.document.timeline.currentTime : null;
  if (frame != null) {
    if (viewportCache && viewportCache.frame === frame && performance.now() - viewportCache.at < 20) return viewportCache.value;
  }
  const value = { width: win?.innerWidth ?? 0,
    height: win?.visualViewport?.scale === 1 ? win.visualViewport.height : win?.innerHeight ?? 0 };
  if (frame != null) viewportCache = { frame, at: performance.now(), value: Object.freeze(value) };
  return frame != null ? viewportCache.value : value;
}

export function viewScale(win = globalThis.window) {
  return Number(win?.document?.documentElement?.dataset?.viewScale) || 1;
}

// THE CANVAS BOX (owner, 2026-11-14: "each should have it's own configuration
// that's relative"). Inside a form factor every combat element is laid out in
// the canvas's own px; the real window only sets the uniform scale and the
// letterbox offset of <html>'s transform. getBoundingClientRect and pointer
// coordinates are in scaled real px, so layout code converts them with
// CanvasRect before mixing them with authored px constants. Without a canvas
// (Auto outside combat) the box is the window and the conversion is identity.
export function CanvasBox(win = globalThis.window) {
  const data = win?.document?.documentElement?.dataset;
  const { width, height } = logicalViewport(win);
  if (!VIEW_PRESETS[data?.viewPreset]) return { preset: 'auto', width, height, scale: 1, left: 0, top: 0 };
  return { preset: data.viewPreset, width, height, scale: Number(data.viewScale) || 1,
    left: Number(data.viewLeft) || 0, top: Number(data.viewTop) || 0 };
}

// A real-window rect (an element's getBoundingClientRect, or any
// {left, top, width, height}) in canvas px. Reads no layout beyond the rect.
export function CanvasRect(source, win = globalThis.window) {
  const rect = typeof source?.getBoundingClientRect === 'function' ? source.getBoundingClientRect() : source;
  const data = win?.document?.documentElement?.dataset;
  const canvas = VIEW_PRESETS[data?.viewPreset];
  const scale = canvas ? Number(data.viewScale) || 1 : 1;
  const offsetX = canvas ? Number(data.viewLeft) || 0 : 0, offsetY = canvas ? Number(data.viewTop) || 0 : 0;
  const left = (rect.left - offsetX) / scale, top = (rect.top - offsetY) / scale;
  const width = rect.width / scale, height = rect.height / scale;
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
}

// DOMRects and pointer coordinates are physical pixels, including letterboxing.
export function viewViewportBox(win = globalThis.window) {
  const root = win?.document?.documentElement;
  if (!VIEW_PRESETS[root?.dataset?.viewPreset]) {
    const { width, height } = logicalViewport(win);
    return { left: 0, top: 0, width, height, right: width, bottom: height };
  }
  const rect = root.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
}

export function applyViewViewport(preset, width, height, root = document.documentElement) {
  const view = resolveViewViewport(preset, width, height);
  root.dataset.viewPreset = view.preset;
  root.dataset.viewScale = String(view.scale);
  root.dataset.viewWidth = String(view.width);
  root.dataset.viewHeight = String(view.height);
  root.dataset.viewLeft = String(view.left);
  root.dataset.viewTop = String(view.top);
  for (const axis of ['w', 'h']) {
    const property = `--view-v${axis}`;
    if (view.preset === 'auto') root.style.removeProperty(property);
    else root.style.setProperty(property, `${(axis === 'w' ? view.width : view.height) / 100}px`);
  }
  root.style.setProperty('--view-width', `${view.width}px`);
  root.style.setProperty('--view-height', `${view.height}px`);
  root.style.setProperty('--view-fit', String(view.scale));
  root.style.setProperty('--view-left', `${view.left}px`);
  root.style.setProperty('--view-top', `${view.top}px`);
  return view;
}

// Geometric media queries follow the chosen game view. Pointer, motion and
// other browser capabilities continue to use native matchMedia directly.
export function matchViewMedia(query, win = window) {
  // Minimal DOM hosts (including headless renderer tests) have no game frame.
  // Preserve their native query and listener contract rather than inventing size.
  if (!win.document?.documentElement) return (win.matchMedia || globalThis.matchMedia)(query);
  const matches = () => {
    const { width, height } = logicalViewport(win);
    return query.split(/\s+and\s+/).every(part => {
      const dimension = part.match(/\((min|max)-(width|height):\s*([\d.]+)px\)/);
      if (dimension) {
        const value = dimension[2] === 'width' ? width : height;
        return dimension[1] === 'min' ? value >= Number(dimension[3]) : value <= Number(dimension[3]);
      }
      const orientation = part.match(/\(orientation:\s*(portrait|landscape)\)/);
      if (orientation) return orientation[1] === 'portrait' ? height >= width : width > height;
      throw new Error(`Unsupported game viewport query: ${query}`);
    });
  };
  const listeners = new Map();
  const result = {
    get matches() { return matches(); }, media: query,
    addEventListener(type, listener) {
      if (type !== 'change' || listeners.has(listener)) return;
      let previous = matches();
      const notify = () => {
        const next = matches();
        if (next !== previous) { previous = next; listener({ matches: next, media: query }); }
      };
      const observer = new win.ResizeObserver(notify);
      observer.observe(win.document.documentElement);
      win.addEventListener('resize', notify);
      listeners.set(listener, () => { observer.disconnect(); win.removeEventListener('resize', notify); });
    },
    removeEventListener(type, listener) {
      if (type !== 'change') return;
      listeners.get(listener)?.(); listeners.delete(listener);
    },
  };
  result.addListener = listener => result.addEventListener('change', listener);
  result.removeListener = listener => result.removeEventListener('change', listener);
  return result;
}
