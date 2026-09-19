// ui-studio/model.mjs — the pure half of UI Studio. No DOM, no filesystem:
// the browser app, the local server and the Node tests all import this file.
//
// It owns
//   · the studio settings shape and its defaults (devices, grid, snapping,
//     breakpoints, the wireframe catalog) — everything the app lets you change;
//   · the game's own layout decision (wide / narrow / short-wide / short and
//     the zoom), ported from src/main.js so a device preset can say how the
//     game will actually lay itself out at that size;
//   · grid and guide snapping, band arithmetic (a scene's bands always sum to
//     100), and the region model that turns a config file into the rectangles
//     the canvas draws and drags;
//   · the sketch document (free wireframe boxes with per-breakpoint overrides);
//   · JSON path helpers, a formatter that keeps content/config's house style,
//     and an undo history.

export const SETTINGS_SCHEMA = 'ashenspire.ui-studio-settings/1';
export const SKETCH_SCHEMA = 'ashenspire.ui-sketch/1';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export const round = (v, places = 2) => Math.round(v * 10 ** places) / 10 ** places;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Device presets. `safe` is the OS safe-area inset in CSS px (portrait). */
export const DEFAULT_DEVICES = [
  { id: 'desktop-1080p', label: 'Desktop 1080p', width: 1920, height: 1080, category: 'desktop', enabled: true },
  { id: 'laptop-1440', label: 'Laptop 1440×900', width: 1440, height: 900, category: 'desktop', enabled: true },
  { id: 'desk-1280', label: 'Desk 1280×800 (sweep)', width: 1280, height: 800, category: 'desktop', enabled: true },
  { id: 'ipad-air', label: 'iPad Air', width: 820, height: 1180, category: 'tablet', enabled: false, dpr: 2 },
  { id: 'ipad-mini', label: 'iPad mini', width: 768, height: 1024, category: 'tablet', enabled: true, dpr: 2 },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, category: 'phone', enabled: true, dpr: 2, safe: { top: 20, bottom: 0 } },
  { id: 'iphone-14', label: 'iPhone 14 (sweep phone)', width: 390, height: 844, category: 'phone', enabled: true, dpr: 3, safe: { top: 47, bottom: 34 } },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', width: 393, height: 852, category: 'phone', enabled: false, dpr: 3, safe: { top: 59, bottom: 34 } },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932, category: 'phone', enabled: true, dpr: 3, safe: { top: 59, bottom: 34 } },
  { id: 'galaxy-s23', label: 'Galaxy S23', width: 360, height: 780, category: 'phone', enabled: true, dpr: 3, safe: { top: 24, bottom: 0 } },
  { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', width: 384, height: 824, category: 'phone', enabled: false, dpr: 3.5, safe: { top: 24, bottom: 0 } },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915, category: 'phone', enabled: true, dpr: 2.6, safe: { top: 24, bottom: 0 } },
  { id: 'responsive', label: 'Responsive (free size)', width: 1024, height: 768, category: 'responsive', enabled: true, resizable: true },
];

/**
 * Breakpoints are the studio's names for width/height ranges. The defaults
 * mirror the game's own modes (content/config/ui/tokens.json compactBelowPx
 * and balance.ui.uiScale.narrowMax); edit them freely, the studio only uses
 * them to pick a sketch box's override and to label a device.
 */
export const DEFAULT_BREAKPOINTS = [
  { id: 'narrow', label: 'Narrow (phone)', maxWidth: 520 },
  { id: 'compact', label: 'Compact (below 768)', minWidth: 521, maxWidth: 767 },
  { id: 'wide', label: 'Wide', minWidth: 768 },
];

/**
 * The wireframe catalog: which config file each approved wireframe edits, how
 * to draw it (the `draw` kind) and which ?shot= fixture opens the live game
 * on it. Users may add entries for any other file; those draw as `generic`.
 */
export const DEFAULT_WIREFRAMES = [
  { id: 'w4a', label: 'W4a · Combat', file: 'ui/scenes/w4a-combat.json', parent: 'ui/scenes/w4.json', draw: 'bands', shot: 'combat' },
  { id: 'w4b', label: 'W4b · Map', file: 'ui/scenes/w4b-map.json', parent: 'ui/scenes/w4.json', draw: 'map', shot: 'map' },
  { id: 'w4c', label: 'W4c · Dialogue', file: 'ui/scenes/w4c-dialogue.json', parent: 'ui/scenes/w4.json', draw: 'dialogue', shot: 'event' },
  { id: 'w1-choice', label: 'W1 · Choice body (modal frame)', file: 'ui/components/choiceBody.json', draw: 'choiceBody', shot: 'settings' },
  { id: 'w1-armoury', label: 'W1 · Armoury', file: 'ui/screens/armoury.json', draw: 'armoury', shot: 'armoury' },
  { id: 'w1-shop', label: 'W1 · Shop', file: 'ui/screens/shop.json', draw: 'shop', shot: 'shop' },
  { id: 'w1-smith', label: 'W1 · Smith', file: 'ui/screens/smith.json', draw: 'smith', shot: 'smith' },
  { id: 'card', label: 'Card face', file: 'ui/components/card.json', draw: 'card', shot: 'components' },
  { id: 'w4', label: 'W4 · Parent (minimums, breakpoint)', file: 'ui/scenes/w4.json', draw: 'generic', shot: 'combat' },
  { id: 'tokens', label: 'Design tokens', file: 'ui/tokens.json', draw: 'generic', shot: 'combat' },
];

export const DEFAULT_SETTINGS = {
  schema: SETTINGS_SCHEMA,
  grid: {
    sizePx: 8, subdivisions: 2, show: true, snap: true,
    snapToEdges: true, snapToBoxes: true, snapToSafeArea: true,
    thresholdPx: 6, bandStepPercent: 1, nudgePx: 1, nudgeLargePx: 10,
  },
  units: { boxes: 'percent' },
  canvas: { zoom: 'fit', showRulers: true, showSafeArea: true, showLabels: true, showLayers: true, showGameLayout: true, showTokens: true },
  devices: DEFAULT_DEVICES,
  breakpoints: DEFAULT_BREAKPOINTS,
  wireframes: DEFAULT_WIREFRAMES,
  // The game's zoom/layout decision (balance.ui.uiScale). The server replaces
  // these with the live values from src/content/balance.js when it can.
  gameLayout: { designW: 1200, designH: 730, min: 0.62, max: 1.7, narrowW: 430, narrowH: 780, narrowMax: 520, shortWideMinH: 340, gateBelowH: 465 },
  save: { compileAfterSave: true, keepBackups: 40 },
};

/** Deep-merge `patch` over `base`; arrays are replaced whole, never merged. */
export function mergeSettings(base, patch) {
  if (!isObject(patch)) return clone(base);
  const out = clone(base);
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObject(v) && isObject(out[k]) ? mergeSettings(out[k], v) : clone(v);
  }
  return out;
}

/** Refuse a settings object that would break the app; each message names the field. */
export function settingsProblems(s) {
  const out = [];
  if (!isObject(s)) return ['settings must be an object'];
  const g = s.grid || {};
  if (!(g.sizePx > 0)) out.push('grid.sizePx must be a positive number');
  if (!(Number.isInteger(g.subdivisions) && g.subdivisions >= 1)) out.push('grid.subdivisions must be an integer of at least 1');
  if (!(g.thresholdPx >= 0)) out.push('grid.thresholdPx must be 0 or more');
  if (!(g.bandStepPercent > 0 && g.bandStepPercent <= 50)) out.push('grid.bandStepPercent must be between 0 and 50');
  if (!Array.isArray(s.devices) || !s.devices.length) out.push('devices must be a non-empty array');
  else {
    const ids = new Set();
    for (const [i, d] of s.devices.entries()) {
      const at = `devices[${i}]`;
      if (!d || typeof d.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(d.id)) out.push(`${at}.id must be lower-case letters, digits and dashes`);
      else if (ids.has(d.id)) out.push(`${at}.id "${d.id}" is used twice`);
      else ids.add(d.id);
      if (!(d.width >= 200 && d.width <= 8192)) out.push(`${at}.width must be 200–8192`);
      if (!(d.height >= 200 && d.height <= 8192)) out.push(`${at}.height must be 200–8192`);
      if (typeof d.label !== 'string' || !d.label.trim()) out.push(`${at}.label is required`);
    }
  }
  if (!Array.isArray(s.breakpoints) || !s.breakpoints.length) out.push('breakpoints must be a non-empty array');
  else {
    const ids = new Set();
    for (const [i, b] of s.breakpoints.entries()) {
      if (!b || typeof b.id !== 'string' || !b.id) out.push(`breakpoints[${i}].id is required`);
      else if (ids.has(b.id)) out.push(`breakpoints[${i}].id "${b.id}" is used twice`);
      else ids.add(b.id);
      if (b && b.minWidth != null && b.maxWidth != null && b.minWidth > b.maxWidth) out.push(`breakpoints[${i}] has minWidth above maxWidth`);
    }
  }
  if (!Array.isArray(s.wireframes) || !s.wireframes.length) out.push('wireframes must be a non-empty array');
  else for (const [i, w] of s.wireframes.entries()) {
    if (!w || typeof w.id !== 'string' || !w.id) out.push(`wireframes[${i}].id is required`);
    if (!w || typeof w.file !== 'string' || !/^ui\/(tokens\.json|(scenes|components|screens|presentation)\/[\w-]+\.json)$/.test(w.file)) out.push(`wireframes[${i}].file must be a content/config ui/ path`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Devices, viewports, breakpoints, and the game's own layout decision
// ---------------------------------------------------------------------------

/** The CSS-px viewport a device shows in the given orientation. */
export function viewportFor(device, orientation = 'portrait') {
  const landscape = orientation === 'landscape';
  const w = landscape ? Math.max(device.width, device.height) : Math.min(device.width, device.height);
  const h = landscape ? Math.min(device.width, device.height) : Math.max(device.width, device.height);
  const safe = device.safe || { top: 0, bottom: 0 };
  // Turned, the notch and home indicator sit on the long sides.
  const safeArea = landscape
    ? { top: 0, bottom: safe.bottom ? Math.min(21, safe.bottom) : 0, left: safe.top || 0, right: safe.top || 0 }
    : { top: safe.top || 0, bottom: safe.bottom || 0, left: 0, right: 0 };
  return { width: w, height: h, safeArea, dpr: device.dpr || 1 };
}

/** Devices whose natural orientation is landscape (desktops) report so. */
export function naturalOrientation(device) {
  return device.width >= device.height ? 'landscape' : 'portrait';
}

/** The first breakpoint whose width/height bounds contain the viewport, or null. */
export function breakpointFor(breakpoints, viewport) {
  for (const b of breakpoints) {
    if (b.minWidth != null && viewport.width < b.minWidth) continue;
    if (b.maxWidth != null && viewport.width > b.maxWidth) continue;
    if (b.minHeight != null && viewport.height < b.minHeight) continue;
    if (b.maxHeight != null && viewport.height > b.maxHeight) continue;
    return b;
  }
  return null;
}

/**
 * The game's layout decision for a viewport: src/main.js layoutForCap, with
 * cap = Infinity (the player's "Auto" size). Ported line for line so the
 * studio's badge and the game's data-layout attribute cannot disagree.
 */
export function gameLayoutFor(viewport, z) {
  const w = viewport.width, h = viewport.height;
  const clampZ = (v) => Math.max(z.min, Math.min(z.max, v));
  const fitFor = (dw, dh) => Math.min(w / dw, h / dh);
  const shortWide = (zoom) => z.gateBelowH != null && h < z.gateBelowH && w / zoom >= z.designW && h >= (z.shortWideMinH || 0);
  const answer = (zoom, narrow) => {
    const compact = !narrow && shortWide(zoom);
    const short = z.gateBelowH != null && h < z.gateBelowH && !compact;
    return { zoom, narrow, compact, short, mode: narrow ? 'narrow' : compact ? 'short-wide' : short ? 'short' : 'wide', localWidth: round(w / zoom, 0), localHeight: round(h / zoom, 0) };
  };
  const wideZoom = clampZ(Math.round(fitFor(z.designW, z.designH) * 100) / 100);
  if (!(z.narrowW && z.narrowH && z.narrowMax)) return answer(wideZoom, false);
  const narrowFit = clampZ(Math.floor(fitFor(z.narrowW, z.narrowH) * 100) / 100);
  if (w <= z.narrowMax) return answer(narrowFit, true);
  return answer(wideZoom, false);
}

// ---------------------------------------------------------------------------
// Snapping
// ---------------------------------------------------------------------------

/** Snap `value` to the nearest multiple of `step` when within `threshold`; else unchanged. */
export function snapToStep(value, step, threshold = Infinity) {
  if (!(step > 0)) return value;
  const snapped = Math.round(value / step) * step;
  return Math.abs(snapped - value) <= threshold ? snapped : value;
}

/**
 * Snap one coordinate against a list of guide values; returns { value, guide }
 * where guide is the guide it snapped to (or null). The nearest guide wins.
 */
export function snapToGuides(value, guides, threshold) {
  let best = null;
  for (const g of guides) {
    const d = Math.abs(g - value);
    if (d <= threshold && (best === null || d < Math.abs(best - value))) best = g;
  }
  return best === null ? { value, guide: null } : { value: best, guide: best };
}

/**
 * Snap a rectangle (px, in viewport space). Edges snap to guides first (they
 * are the intent: "line this up with that"), then to the grid. `mode` is
 * 'move' (keep size) or a resize handle name (n, s, e, w, ne, nw, se, sw).
 * Returns { rect, guides: [{axis:'x'|'y', at}] } for the canvas to draw.
 */
export function snapRect(rect, { grid, guidesX = [], guidesY = [], mode = 'move' }) {
  const step = grid.snap ? grid.sizePx / Math.max(1, grid.subdivisions) : 0;
  const threshold = grid.thresholdPx;
  const hit = [];
  const snapEdge = (v, guides, axis) => {
    const g = snapToGuides(v, guides, threshold);
    if (g.guide !== null) { hit.push({ axis, at: g.guide }); return g.value; }
    return step ? snapToStep(v, step, threshold) : v;
  };
  let { x, y, w, h } = rect;
  if (mode === 'move') {
    // Three candidates per axis (leading edge, trailing edge, centre). A guide
    // hit outranks a grid hit — "line this up with that" is the intent — and
    // among equals the smaller move wins, the leading edge on a tie.
    const pick = (positions, guides, axis) => {
      const candidates = positions.map((v) => {
        const g = snapToGuides(v, guides, threshold);
        if (g.guide !== null) return { delta: g.value - v, guide: { axis, at: g.guide } };
        const s = step ? snapToStep(v, step, threshold) : v;
        return { delta: s - v, guide: null };
      }).filter((c) => c.delta !== 0 || c.guide);
      const pool = candidates.some((c) => c.guide) ? candidates.filter((c) => c.guide) : candidates;
      if (!pool.length) return { delta: 0, guide: null };
      return pool.reduce((a, b) => (Math.abs(b.delta) < Math.abs(a.delta) ? b : a));
    };
    const dx = pick([x, x + w, x + w / 2], guidesX, 'x'), dy = pick([y, y + h, y + h / 2], guidesY, 'y');
    x += dx.delta; y += dy.delta;
    if (dx.guide) hit.push(dx.guide); if (dy.guide) hit.push(dy.guide);
  } else {
    if (mode.includes('w')) { const nx = snapEdge(x, guidesX, 'x'); w += x - nx; x = nx; }
    if (mode.includes('e')) { w = snapEdge(x + w, guidesX, 'x') - x; }
    if (mode.includes('n')) { const ny = snapEdge(y, guidesY, 'y'); h += y - ny; y = ny; }
    if (mode.includes('s')) { h = snapEdge(y + h, guidesY, 'y') - y; }
  }
  const used = new Set();
  const guides = hit.filter((g) => { const k = `${g.axis}${g.at}`; if (used.has(k)) return false; used.add(k); return true; });
  return { rect: { x, y, w: Math.max(1, w), h: Math.max(1, h) }, guides };
}

/** Guide lines a viewport offers: its edges, centre and safe-area insets. */
export function viewportGuides(viewport, { safeArea = true } = {}) {
  const x = [0, viewport.width / 2, viewport.width];
  const y = [0, viewport.height / 2, viewport.height];
  const s = viewport.safeArea;
  if (safeArea && s) {
    if (s.left) x.push(s.left); if (s.right) x.push(viewport.width - s.right);
    if (s.top) y.push(s.top); if (s.bottom) y.push(viewport.height - s.bottom);
  }
  return { x, y };
}

/** Guide lines other boxes offer: edges and centres. */
export function boxGuides(rects) {
  const x = [], y = [];
  for (const r of rects) { x.push(r.x, r.x + r.w / 2, r.x + r.w); y.push(r.y, r.y + r.h / 2, r.y + r.h); }
  return { x, y };
}

// ---------------------------------------------------------------------------
// Bands — a W4 scene's vertical split. They always sum to 100.
// ---------------------------------------------------------------------------

export function bandEntries(bands) {
  return Object.entries(bands || {}).map(([id, percent]) => ({ id, percent }));
}

/**
 * Move the edge between band `index` and `index + 1` by `deltaPercent`,
 * snapped to `step`, so one band gains exactly what the other loses. A band
 * never drops below `minPercent`. Returns a new bands object.
 */
export function moveBandEdge(bands, index, deltaPercent, { step = 1, minPercent = 0 } = {}) {
  const entries = bandEntries(bands);
  if (index < 0 || index >= entries.length - 1) return clone(bands);
  const a = entries[index], b = entries[index + 1];
  const room = step > 0 ? Math.round(deltaPercent / step) * step : deltaPercent;
  const delta = clamp(room, -(a.percent - minPercent), b.percent - minPercent);
  const out = {};
  for (const e of entries) out[e.id] = e.percent;
  out[a.id] = round(a.percent + delta, 4);
  out[b.id] = round(b.percent - delta, 4);
  return out;
}

/** Set one band to `percent`; the slack goes to the next band (or the previous for the last). */
export function setBand(bands, id, percent, { minPercent = 0 } = {}) {
  const entries = bandEntries(bands);
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return clone(bands);
  const j = i < entries.length - 1 ? i + 1 : i - 1;
  if (j < 0) return clone(bands);
  const target = clamp(percent, minPercent, entries[i].percent + entries[j].percent - minPercent);
  return moveBandEdge(bands, Math.min(i, j), (i < j ? 1 : -1) * (target - entries[i].percent), { step: 0, minPercent });
}

// ---------------------------------------------------------------------------
// JSON paths, flattening, and the house-style formatter
// ---------------------------------------------------------------------------

export const splitPath = (path) => (Array.isArray(path) ? path : String(path).split('.').filter(Boolean));

export function getPath(obj, path) {
  let cur = obj;
  for (const k of splitPath(path)) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

/** Immutable set: returns a copy of `obj` with `path` set to `value`. */
export function setPath(obj, path, value) {
  const keys = splitPath(path);
  const out = clone(obj) ?? {};
  let cur = out;
  keys.slice(0, -1).forEach((k, i) => {
    if (!isObject(cur[k]) && !Array.isArray(cur[k])) cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
  return out;
}

export function deletePath(obj, path) {
  const keys = splitPath(path);
  const out = clone(obj);
  let cur = out;
  for (const k of keys.slice(0, -1)) { if (cur == null) return out; cur = cur[k]; }
  if (Array.isArray(cur)) cur.splice(Number(keys[keys.length - 1]), 1);
  else if (cur) delete cur[keys[keys.length - 1]];
  return out;
}

export const isFraction = (v) => isObject(v) && Object.keys(v).length === 2 && 'numerator' in v && 'denominator' in v;
export const isRef = (v) => typeof v === 'string' && /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(v);

/** The kind the inspector edits a leaf as. */
export function leafKind(v) {
  if (isRef(v)) return 'ref';
  if (isFraction(v)) return 'fraction';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') return 'string';
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object' || x === null) ? 'list' : 'array';
  return 'object';
}

/** Every editable leaf of a config file: { path, section, value, kind }. */
export function flattenConfig(data) {
  const out = [];
  const walk = (v, path, section) => {
    const kind = leafKind(v);
    if (kind === 'object' || kind === 'array') {
      const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);
      for (const [k, x] of entries) walk(x, [...path, k], section);
    } else out.push({ path: path.join('.'), section, value: v, kind });
  };
  for (const [section, v] of Object.entries(data || {})) walk(v, [section], section);
  return out;
}

/** Infer the unit a key name carries (Px, Rem, Vw, Vh, Ms, Percent, Fraction, Degrees). */
export function unitOf(path) {
  const key = splitPath(path).pop() || '';
  const m = /(Px|Rem|Vw|Vh|Ms|Percent|Fraction|Share|Degrees|Lines|Rows|Capacity)$/.exec(key);
  if (m) return m[1].toLowerCase();
  if (/^bands/.test(key) || /bands\./.test(String(path))) return 'percent';
  return '';
}

/**
 * JSON in content/config's house style: two-space indent; an object or array
 * whose members are all primitives sits on one line when it fits in `width`
 * columns; an array of flat objects puts each object on its own line.
 */
export function formatJson(value, { width = 100, original = null } = {}) {
  const spans = original ? jsonSpans(original) : null;
  const flat = (v) => (Array.isArray(v) ? v : Object.values(v)).every((x) => x === null || typeof x !== 'object');
  const render = (v, indent, path) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    const was = spans && spans.get(path);
    // An unchanged subtree keeps its bytes: a save that moves one band never
    // reflows the rest of the file. A changed one keeps its one-line or
    // many-line shape when it had one, so the diff is the edit and nothing else.
    if (was && was.json === JSON.stringify(v)) return was.text;
    const pad = '  '.repeat(indent + 1), close = '  '.repeat(indent);
    const preferInline = was ? !was.multiline : null;
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (flat(v) && preferInline !== false) { const one = `[${v.map((x) => JSON.stringify(x)).join(', ')}]`; if (preferInline || pad.length + one.length <= width) return one; }
      return `[\n${v.map((x, i) => pad + render(x, indent + 1, `${path}/${i}`)).join(',\n')}\n${close}]`;
    }
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    if (preferInline !== false) {
      const inner = keys.map((k) => `${JSON.stringify(k)}: ${render(v[k], indent + 1, `${path}/${k}`)}`);
      if (inner.every((s) => !s.includes('\n'))) { const one = `{ ${inner.join(', ')} }`; if (preferInline || pad.length + one.length <= width) return one; }
    }
    return `{\n${keys.map((k) => `${pad}${JSON.stringify(k)}: ${render(v[k], indent + 1, `${path}/${k}`)}`).join(',\n')}\n${close}}`;
  };
  return `${render(value, 0, '')}\n`;
}

/**
 * jsonSpans(text) → Map of JSON-pointer-ish path ('' root, '/a/0/b') to
 * { text, json, multiline } for every object and array in `text`. A tiny
 * recursive-descent pass; it trusts JSON.parse to have validated the text.
 */
export function jsonSpans(text) {
  const spans = new Map();
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i += 1; };
  const string = () => { const start = i; i += 1; while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1; i += 1; return JSON.parse(text.slice(start, i)); };
  const value = (path) => {
    ws();
    const start = i;
    const ch = text[i];
    let parsed;
    if (ch === '{') {
      i += 1; parsed = {}; ws();
      while (text[i] !== '}') { ws(); const key = string(); ws(); i += 1; parsed[key] = value(`${path}/${key}`); ws(); if (text[i] === ',') i += 1; ws(); }
      i += 1;
    } else if (ch === '[') {
      i += 1; parsed = []; ws();
      while (text[i] !== ']') { parsed.push(value(`${path}/${parsed.length}`)); ws(); if (text[i] === ',') i += 1; ws(); }
      i += 1;
    } else if (ch === '"') parsed = string();
    else { const m = /^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i)); i += m[0].length; parsed = JSON.parse(m[0]); }
    if (ch === '{' || ch === '[') { const slice = text.slice(start, i); spans.set(path, { text: slice, json: JSON.stringify(parsed), multiline: slice.includes('\n') }); }
    return parsed;
  };
  value('');
  return spans;
}

// ---------------------------------------------------------------------------
// Regions — a wireframe drawn from its config, in viewport px
// ---------------------------------------------------------------------------

const remPx = (tokens) => (tokens && tokens.refRemPx) || 16;

/**
 * regionsFor(wireframe, data, viewport, { parent, tokens, layoutMode }) →
 * [{ id, label, x, y, w, h, kind, edit? }]. `edit` says what dragging the
 * region's lower edge changes: { kind: 'bandEdge', index } or { kind: 'path',
 * path, unit }. Values here are nominal — the numbers as authored — with the
 * one floor the W4 parent states (footer minimum) shown, not silently applied.
 */
export function regionsFor(wireframe, data, viewport, { parent = null, tokens = {}, layoutMode = 'wide' } = {}) {
  const W = viewport.width, H = viewport.height, rem = remPx(tokens);
  const vw = (n) => (W * n) / 100, vh = (n) => (H * n) / 100;
  const sizing = (data && data.sizing) || {}, positioning = (data && data.positioning) || {};
  const out = [];
  const push = (r) => out.push({ kind: 'region', ...r });
  // A "$name" reads the file's own vars first, then ui/tokens.json — the
  // compiler's order (content/config/README.md), so a shadowed token draws
  // the number the game will use.
  const resolve = (v) => (isRef(v) ? ((data.vars || {})[v.slice(1)] ?? tokens[v.slice(1)]) : isFraction(v) ? v.numerator / v.denominator : v);
  const num = (v, fallback = 0) => { const r = resolve(v); return typeof r === 'number' ? r : fallback; };

  const drawBands = (bands, bandsPath) => {
    let y = 0;
    const entries = bandEntries(bands);
    entries.forEach((b, i) => {
      const h = vh(b.percent);
      push({ id: `band.${b.id}`, label: `${b.id} ${b.percent}%`, x: 0, y, w: W, h, band: b.id, percent: b.percent,
        edit: i < entries.length - 1 ? { kind: 'bandEdge', index: i, path: bandsPath } : null });
      y += h;
    });
  };

  switch (wireframe.draw) {
    case 'bands': {
      const compact = layoutMode !== 'wide' && sizing.bandsCompact;
      drawBands(compact ? sizing.bandsCompact : sizing.bands, compact ? 'sizing.bandsCompact' : 'sizing.bands');
      const scene = out.find((r) => r.band === 'scene');
      if (scene && typeof sizing.floorPercent === 'number') {
        push({ id: 'floor', label: `floor ${sizing.floorPercent}%`, x: 0, y: scene.y + scene.h * sizing.floorPercent / 100, w: W, h: 1, line: true, edit: { kind: 'path', path: 'sizing.floorPercent', unit: 'percentOf', of: 'band.scene' } });
      }
      const hand = sizing.hand;
      if (hand) {
        const ctx = out.find((r) => r.band === 'context');
        const wide = num(hand.wideWidthRem) * rem, narrow = num(hand.narrowWidthRem) * rem;
        const width = Math.min(W, layoutMode === 'narrow' ? narrow : wide);
        const height = Math.max(num(hand.minimumHeightPx), ctx ? ctx.h : 0);
        push({ id: 'hand', label: `hand ≥${num(hand.minimumHeightPx)}px, ${layoutMode === 'narrow' ? hand.narrowWidthRem : hand.wideWidthRem}rem wide`, x: (W - width) / 2, y: ctx ? ctx.y + ctx.h - height : H - height, w: width, h: height, dashed: true });
      }
      const footerMin = parent && num(getPath(parent, 'sizing.minimums.footerPx'));
      const footer = out.find((r) => r.band === 'footer');
      if (footer && footerMin && footer.h < footerMin) footer.note = `below the W4 minimum ${footerMin}px (${round(footer.h, 0)}px)`;
      break;
    }
    case 'dialogue': {
      // src/ui/models/DialogueModel.js: the bands fold to bandsCompact when the
      // screen is SHORT (height below sizing.hud.compactBelowHeightPx) or
      // NARROW (width below the W4 parent's compactBelowPx); the portrait slot
      // takes its compact width on the narrow test alone. Both in physical px.
      const compactBelowPx = parent ? num(getPath(parent, 'sizing.compactBelowPx'), Infinity) : Infinity;
      const narrowHost = W < compactBelowPx;
      const shortHost = H < num(getPath(sizing, 'hud.compactBelowHeightPx'), 0);
      const compactBands = (narrowHost || shortHost) && sizing.bandsCompact;
      drawBands(compactBands ? sizing.bandsCompact : sizing.bands, compactBands ? 'sizing.bandsCompact' : 'sizing.bands');
      const scene = out.find((r) => r.band === 'scene');
      if (scene && typeof sizing.floorPercent === 'number') {
        push({ id: 'floor', label: `floor ${sizing.floorPercent}%`, x: 0, y: scene.y + scene.h * sizing.floorPercent / 100, w: W, h: 1, line: true, edit: { kind: 'path', path: 'sizing.floorPercent', unit: 'percentOf', of: 'band.scene' } });
      }
      const slot = sizing.portraitSlot || {};
      const slotW = vw(num(narrowHost ? slot.compactWidthVw : slot.widthVw));
      const inset = vw(num((positioning.portraitSlot || {}).insetVw));
      const top = vh(num((positioning.portraitSlot || {}).topOffsetVh));
      if (scene && slotW) {
        push({ id: 'portrait.player', label: `player portrait${narrowHost ? ' (compact)' : ''}`, x: inset, y: scene.y + top, w: slotW, h: scene.h - top, dashed: true, edit: { kind: 'path', path: narrowHost ? 'sizing.portraitSlot.compactWidthVw' : 'sizing.portraitSlot.widthVw', unit: 'vw', axis: 'w' } });
        push({ id: 'portrait.npc', label: 'npc portrait', x: W - inset - slotW, y: scene.y + top, w: slotW, h: scene.h - top, dashed: true });
      }
      const ctx = out.find((r) => r.band === 'context');
      const ctxW = vw(num((sizing.context || {}).widthVw, 100));
      if (ctx) push({ id: 'context.text', label: `context ${num((sizing.context || {}).widthVw, 100)}vw`, x: (W - ctxW) / 2, y: ctx.y, w: ctxW, h: ctx.h, dashed: true, edit: { kind: 'path', path: 'sizing.context.widthVw', unit: 'vw', axis: 'w', centered: true } });
      break;
    }
    case 'map': {
      const header = sizing.header || {};
      const nominal = vh(num(header.heightFraction) * 100);
      const minimum = num(header.minimumTargetPx) + 2 * num((positioning.header || {}).insetPx);
      const h = Math.max(nominal, minimum);
      push({ id: 'header', label: `header ${round(num(header.heightFraction) * 100, 1)}% (floor ${minimum}px)`, x: 0, y: 0, w: W, h, edit: { kind: 'path', path: 'sizing.header.heightFraction', unit: 'fractionOfHeight' } });
      push({ id: 'scene', label: 'map scene', x: 0, y: h, w: W, h: H - h });
      break;
    }
    case 'choiceBody': {
      const fw = vw(num(sizing.frameWidthVw, 95)), fh = vh(num(sizing.frameHeightVh, 90));
      const fx = (W - fw) / 2, fy = (H - fh) / 2;
      push({ id: 'frame', label: `frame ${num(sizing.frameWidthVw)}vw × ${num(sizing.frameHeightVh)}vh`, x: fx, y: fy, w: fw, h: fh, edit: { kind: 'path', path: 'sizing.frameWidthVw', unit: 'vw', axis: 'w', pathH: 'sizing.frameHeightVh', unitH: 'vh', centered: true } });
      const hh = vh(num(sizing.headerMinVh)), fth = vh(num(sizing.footerMinVh));
      push({ id: 'header', label: `header ≥${num(sizing.headerMinVh)}vh`, x: fx, y: fy, w: fw, h: hh, edit: { kind: 'path', path: 'sizing.headerMinVh', unit: 'vh', axis: 'h' } });
      push({ id: 'footer', label: `footer ≥${num(sizing.footerMinVh)}vh`, x: fx, y: fy + fh - fth, w: fw, h: fth, edit: { kind: 'path', path: 'sizing.footerMinVh', unit: 'vh', axis: 'h', anchor: 'bottom' } });
      const si = vw(num(positioning.sideInsetVw)), ti = vh(num(positioning.topInsetVh));
      push({ id: 'body', label: 'body (inset)', x: fx + si, y: fy + hh + ti, w: fw - 2 * si, h: fh - hh - fth - 2 * ti, dashed: true });
      break;
    }
    case 'shop': {
      // src/ui/models/ShopWorkspaceModel.js shopWorkspaceLayout: wide when the
      // WHOLE width reaches wideMinRem; then the rail is a clamped side column
      // and offers/detail share the rest. Otherwise the rail sits on top at
      // full width (its height is its content's) and the panes stack, the
      // detail capped at detailMaxFraction of the height.
      const gap = num((positioning || {}).gapRem) * rem;
      const wide = W >= num(sizing.wideMinRem) * rem;
      if (wide) {
        const railW = Math.round(clamp(W * num(sizing.railFraction), num(sizing.railMinRem) * rem, num(sizing.railMaxRem) * rem));
        push({ id: 'rail', label: `rail ${round(num(sizing.railFraction) * 100, 1)}% (${num(sizing.railMinRem)}–${num(sizing.railMaxRem)}rem)`, x: 0, y: 0, w: railW, h: H, edit: { kind: 'path', path: 'sizing.railFraction', unit: 'fractionOfWidth', axis: 'w' } });
        const rest = W - railW - gap;
        const offersW = rest * num(sizing.offersFraction, 0.5);
        push({ id: 'offers', label: `offers ${round(num(sizing.offersFraction) * 100)}%`, x: railW + gap, y: 0, w: offersW, h: H, edit: { kind: 'path', path: 'sizing.offersFraction', unit: 'fractionOf', of: 'offers+detail', axis: 'w' } });
        push({ id: 'detail', label: `detail ${round((1 - num(sizing.offersFraction, 0.5)) * 100)}%`, x: railW + gap + offersW, y: 0, w: rest - offersW, h: H, dashed: true });
      } else {
        const railH = 3 * rem;
        push({ id: 'rail', label: `rail on top (below ${num(sizing.wideMinRem)}rem the panes stack)`, x: 0, y: 0, w: W, h: railH });
        const detailH = Math.floor((H - railH - gap) * num(sizing.detailMaxFraction, 0.5));
        push({ id: 'offers', label: 'offers (stacked)', x: 0, y: railH + gap, w: W, h: H - railH - gap - detailH });
        push({ id: 'detail', label: `detail ≤${round(num(sizing.detailMaxFraction) * 100)}% of the height`, x: 0, y: H - detailH, w: W, h: detailH, dashed: true, edit: { kind: 'path', path: 'sizing.detailMaxFraction', unit: 'fractionOfHeight', axis: 'h', anchor: 'bottom' } });
      }
      break;
    }
    case 'armoury': {
      const share = num(layoutMode === 'wide' ? sizing.collectionShare : sizing.compactCollectionShare, 0.5);
      const stacked = layoutMode !== 'wide';
      if (stacked) {
        push({ id: 'collection', label: `collection ${round(share * 100)}%`, x: 0, y: 0, w: W, h: H * share, edit: { kind: 'path', path: 'sizing.compactCollectionShare', unit: 'fractionOfHeight', axis: 'h' } });
        push({ id: 'detail', label: 'detail', x: 0, y: H * share, w: W, h: H * (1 - share) });
      } else {
        push({ id: 'collection', label: `collection ${round(share * 100)}%`, x: 0, y: 0, w: W * share, h: H, edit: { kind: 'path', path: 'sizing.collectionShare', unit: 'fractionOfWidth', axis: 'w' } });
        push({ id: 'detail', label: 'detail', x: W * share, y: 0, w: W * (1 - share), h: H });
      }
      break;
    }
    case 'smith': {
      const cw = clamp(W * num(sizing.candidatesWidth), num(sizing.candidatesMinRem) * rem, num(sizing.candidatesMaxRem) * rem);
      push({ id: 'candidates', label: `candidates ${round(num(sizing.candidatesWidth) * 100)}% (${num(sizing.candidatesMinRem)}–${num(sizing.candidatesMaxRem)}rem)`, x: 0, y: 0, w: cw, h: H, edit: { kind: 'path', path: 'sizing.candidatesWidth', unit: 'fractionOfWidth', axis: 'w' } });
      push({ id: 'detail', label: 'detail', x: cw, y: 0, w: W - cw, h: H });
      break;
    }
    case 'card': {
      const ratio = num(sizing.ratio, 5 / 8);
      const level = getPath(sizing, 'levels.inspect.widthPx') || getPath(sizing, 'levels.focus.widthPx') || 280;
      const cw = Math.min(W * 0.9, num(level)), ch = cw / ratio;
      const cx = (W - cw) / 2, cy = (H - Math.min(ch, H * 0.9)) / 2;
      push({ id: 'card', label: `card ${round(ratio, 3)} ratio, ${num(level)}px`, x: cx, y: cy, w: cw, h: Math.min(ch, H * 0.9) });
      const bands = Array.isArray(sizing.bands) ? sizing.bands : [];
      const total = bands.reduce((a, b) => a + num(b), 0) || 1;
      let y = cy;
      bands.forEach((b, i) => { const h = Math.min(ch, H * 0.9) * num(b) / total; push({ id: `card.band.${i}`, label: `band ${i} (${num(b)})`, x: cx, y, w: cw, h, dashed: true }); y += h; });
      break;
    }
    default:
      push({ id: 'viewport', label: `${wireframe.label || wireframe.id}: no drawing, edit the values on the right`, x: 0, y: 0, w: W, h: H, dashed: true });
  }
  return out;
}

/**
 * Apply a drag on a region's edit handle to the config data. `deltaPx` is the
 * movement of the edge being dragged, in viewport px. Returns new data.
 */
export function applyRegionDrag(data, region, deltaPx, viewport, { grid, regions = [] } = {}) {
  const edit = region.edit;
  if (!edit) return data;
  const H = viewport.height, W = viewport.width;
  const step = grid ? grid.bandStepPercent : 1;
  if (edit.kind === 'bandEdge') {
    const bands = getPath(data, edit.path);
    return setPath(data, edit.path, moveBandEdge(bands, edit.index, (deltaPx / H) * 100, { step, minPercent: 0 }));
  }
  const current = getPath(data, edit.path);
  const value = isRef(current) || isFraction(current) ? null : current;
  if (typeof value !== 'number') return data; // a $ref or fraction is edited by hand, never dragged over
  let next = value;
  // A centred region (the modal frame, the context column) grows on both
  // sides, so its edge moves half the value change: the value moves twice
  // the drag. A bottom-anchored edge moves the value the other way.
  const both = edit.centered ? 2 : 1;
  const sign = edit.anchor === 'bottom' ? -1 : 1;
  switch (edit.unit) {
    case 'percentOf': { const of = regions.find((r) => r.id === edit.of); next = value + (deltaPx / (of ? of.h : H)) * 100; break; }
    case 'fractionOf': {
      // The span is the named region, or the sum of the named regions ("a+b").
      const named = String(edit.of).split('+').map((id) => regions.find((r) => r.id === id)).filter(Boolean);
      const span = named.length ? named.reduce((a, r) => a + (edit.axis === 'w' ? r.w : r.h), 0) : (edit.axis === 'w' ? W : H);
      next = value + deltaPx / span; break;
    }
    case 'vw': next = value + (deltaPx / W) * 100 * both; break;
    case 'vh': next = value + (deltaPx / H) * 100 * both * sign; break;
    case 'fractionOfHeight': next = value + (deltaPx / H) * sign; break;
    case 'fractionOfWidth': next = value + deltaPx / W; break;
    default: return data;
  }
  const places = /fraction/i.test(edit.unit) ? 3 : 1;
  const snapped = /fraction/i.test(edit.unit) ? snapToStep(next, step / 100) : snapToStep(next, step);
  return setPath(data, edit.path, clamp(round(snapped, places), 0, /fraction/i.test(edit.unit) ? 1 : 100));
}

// ---------------------------------------------------------------------------
// Sketch documents — free wireframe boxes with per-breakpoint overrides
// ---------------------------------------------------------------------------

let counter = 0;
export const newId = (prefix = 'box') => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newSketch({ name = 'Untitled wireframe', breakpoints = DEFAULT_BREAKPOINTS } = {}) {
  return { schema: SKETCH_SCHEMA, name, unit: 'percent', breakpoints: breakpoints.map((b) => ({ ...b })), boxes: [], notes: '' };
}

export function newBox({ x = 10, y = 10, w = 30, h = 20, label = 'Box', layer = 0 } = {}) {
  return { id: newId(), label, x, y, w, h, layer, locked: false, hidden: false, overrides: {} };
}

/** Refuse a sketch that is not ours or is malformed; each message names the fault. */
export function sketchProblems(s) {
  const out = [];
  if (!isObject(s)) return ['sketch must be an object'];
  if (s.schema !== SKETCH_SCHEMA) out.push(`schema must be "${SKETCH_SCHEMA}"`);
  if (typeof s.name !== 'string') out.push('name must be a string');
  if (!['percent', 'px'].includes(s.unit)) out.push('unit must be "percent" or "px"');
  if (!Array.isArray(s.breakpoints)) out.push('breakpoints must be an array');
  if (!Array.isArray(s.boxes)) return [...out, 'boxes must be an array'];
  const ids = new Set(), bps = new Set((s.breakpoints || []).map((b) => b && b.id));
  for (const [i, b] of s.boxes.entries()) {
    const at = `boxes[${i}]`;
    if (!isObject(b)) { out.push(`${at} must be an object`); continue; }
    if (typeof b.id !== 'string' || !b.id) out.push(`${at}.id is required`);
    else if (b.id.includes(':')) out.push(`${at}.id "${b.id}" may not contain ":"`);
    else if (ids.has(b.id)) out.push(`${at}.id "${b.id}" is used twice`);
    else ids.add(b.id);
    for (const k of ['x', 'y', 'w', 'h']) if (typeof b[k] !== 'number' || !Number.isFinite(b[k])) out.push(`${at}.${k} must be a finite number`);
    if (b.w <= 0 || b.h <= 0) out.push(`${at} must have positive width and height`);
    if (b.overrides && !isObject(b.overrides)) out.push(`${at}.overrides must be an object`);
    for (const k of Object.keys(b.overrides || {})) if (!bps.has(k)) out.push(`${at}.overrides names breakpoint "${k}", which the sketch does not declare`);
  }
  return out;
}

/** The box's geometry at a breakpoint: its override merged over its base. */
export function resolveBox(box, breakpointId) {
  const o = (box.overrides || {})[breakpointId] || {};
  return { ...box, x: o.x ?? box.x, y: o.y ?? box.y, w: o.w ?? box.w, h: o.h ?? box.h, hidden: o.hidden ?? box.hidden ?? false, overridden: Boolean(o && Object.keys(o).length) };
}

/** Box units → viewport px. */
export function boxToPx(box, unit, viewport) {
  if (unit === 'px') return { x: box.x, y: box.y, w: box.w, h: box.h };
  return { x: (box.x / 100) * viewport.width, y: (box.y / 100) * viewport.height, w: (box.w / 100) * viewport.width, h: (box.h / 100) * viewport.height };
}

/** Viewport px → box units, rounded to a sensible precision. */
export function pxToBox(rect, unit, viewport) {
  if (unit === 'px') return { x: round(rect.x, 0), y: round(rect.y, 0), w: round(rect.w, 0), h: round(rect.h, 0) };
  return { x: round((rect.x / viewport.width) * 100, 2), y: round((rect.y / viewport.height) * 100, 2), w: round((rect.w / viewport.width) * 100, 2), h: round((rect.h / viewport.height) * 100, 2) };
}

/**
 * Write geometry to a box. With `breakpointId` set and `scope` = 'breakpoint'
 * the change lands in that breakpoint's override; otherwise in the base.
 */
export function updateBoxGeometry(sketch, boxId, geometry, { breakpointId = null, scope = 'base' } = {}) {
  const out = clone(sketch);
  const box = out.boxes.find((b) => b.id === boxId);
  if (!box) return out;
  if (scope === 'breakpoint' && breakpointId) {
    box.overrides = box.overrides || {};
    box.overrides[breakpointId] = { ...(box.overrides[breakpointId] || {}), ...geometry };
  } else Object.assign(box, geometry);
  return out;
}

export function clearOverride(sketch, boxId, breakpointId) {
  const out = clone(sketch);
  const box = out.boxes.find((b) => b.id === boxId);
  if (box && box.overrides) delete box.overrides[breakpointId];
  return out;
}

/** Align the given boxes (by id) to `edge` inside the viewport or to each other. */
export function alignBoxes(sketch, ids, edge, viewport, { breakpointId = null, scope = 'base' } = {}) {
  let out = sketch;
  const boxes = sketch.boxes.filter((b) => ids.includes(b.id)).map((b) => ({ b, r: boxToPx(resolveBox(b, breakpointId), sketch.unit, viewport) }));
  if (!boxes.length) return out;
  const many = boxes.length > 1;
  const bounds = many
    ? { x: Math.min(...boxes.map((o) => o.r.x)), y: Math.min(...boxes.map((o) => o.r.y)), r: Math.max(...boxes.map((o) => o.r.x + o.r.w)), b: Math.max(...boxes.map((o) => o.r.y + o.r.h)) }
    : { x: 0, y: 0, r: viewport.width, b: viewport.height };
  for (const { b, r } of boxes) {
    const next = { ...r };
    if (edge === 'left') next.x = bounds.x;
    if (edge === 'right') next.x = bounds.r - r.w;
    if (edge === 'hcenter') next.x = (bounds.x + bounds.r) / 2 - r.w / 2;
    if (edge === 'top') next.y = bounds.y;
    if (edge === 'bottom') next.y = bounds.b - r.h;
    if (edge === 'vcenter') next.y = (bounds.y + bounds.b) / 2 - r.h / 2;
    out = updateBoxGeometry(out, b.id, pxToBox(next, sketch.unit, viewport), { breakpointId, scope });
  }
  return out;
}

/** Move a box up or down the layer order (`delta` of ±1) or to the ends (±Infinity). */
export function reorderBox(sketch, boxId, delta) {
  const out = clone(sketch);
  const i = out.boxes.findIndex((b) => b.id === boxId);
  if (i < 0) return out;
  const [box] = out.boxes.splice(i, 1);
  const j = clamp(delta === Infinity ? out.boxes.length : delta === -Infinity ? 0 : i + delta, 0, out.boxes.length);
  out.boxes.splice(j, 0, box);
  return out;
}

// ---------------------------------------------------------------------------
// Undo history
// ---------------------------------------------------------------------------

export class History {
  constructor(initial, { limit = 200 } = {}) { this.past = []; this.future = []; this.present = clone(initial); this.limit = limit; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  /** Record a new state. Equal states (by JSON) are ignored so a no-op drag leaves no step. */
  push(next) {
    const text = JSON.stringify(next);
    if (text === JSON.stringify(this.present)) return this.present;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = JSON.parse(text);
    this.future = [];
    return this.present;
  }
  /** Replace the present without a step (a drag in progress). */
  replace(next) { this.present = clone(next); return this.present; }
  undo() { if (!this.canUndo) return this.present; this.future.push(this.present); this.present = this.past.pop(); return this.present; }
  redo() { if (!this.canRedo) return this.present; this.past.push(this.present); this.present = this.future.pop(); return this.present; }
}
