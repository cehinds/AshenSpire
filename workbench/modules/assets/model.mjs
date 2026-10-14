// workbench/modules/assets/model.mjs — DOM-free helpers for the Asset Gallery (index.mjs). Plain
// data in, plain data out: the rows the listing returns, their kind, the filters and sorts, the facets,
// the deep link, the usage search's needles and matches, the frame sets, the export and the grid's
// virtual-window arithmetic. The server imports the usage helpers too, so one home answers both.

/** The kinds the gallery filters by, in chip order. `other` takes what no rule names (fonts, stance exports). */
export const KINDS = Object.freeze([
  { id: 'sprites', label: 'Sprites' },
  { id: 'painted-outfits', label: 'Painted outfits' },
  { id: 'poses', label: 'Poses' },
  { id: 'animations', label: 'Animations' },
  { id: 'equipment', label: 'Equipment icons' },
  { id: 'environments', label: 'Environments' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'music', label: 'Music' },
  { id: 'ui', label: 'UI art' },
  { id: 'other', label: 'Other' },
]);

const AUDIO = /\.(ogg|mp3|wav|m4a)$/i;
// The game path's tier root (assets/ is the high pack, assets-mobile/ the light one) is not part of its kind.
const TIER_ROOT = /^(?:assets|assets-mobile)\//;
const KIND_RULES = Object.freeze([
  ['painted-outfits', /^painted-outfits\//],
  ['animations', /^animations\//],
  ['poses', /^(?:readiness-|enemy-|defeated-)?poses\/|^pose-effects\//],
  ['equipment', /^equipment\//],
  ['environments', /^(?:environments|map|map-detail)\//],
  ['backgrounds', /^bg\//],
  ['ui', /^(?:ui|framework|card-components|cards|icons)\/|^player-polish\/(?:ui|materials)\//],
  ['sprites', /^(?:sprites|enemies-[\w-]+|enemy-states|combat-effects|portraits|events|prologue)\//],
]);

const text = (v) => (v === undefined || v === null ? '' : String(v));
const list = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

/** The gallery kind of a game path (see KINDS). Audio is music wherever it sits. */
export function kindOfPath(p) {
  const s = text(p);
  if (AUDIO.test(s) || s.startsWith('music/')) return 'music';
  const rel = s.replace(TIER_ROOT, '');
  for (const [kind, re] of KIND_RULES) if (re.test(rel)) return kind;
  return 'other';
}

/** The lower-case extension without its dot ('webp'), or '' for none. */
export function formatOf(p) {
  const m = text(p).match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/** The folder a game path sits in ('assets/poses'), or '' at the root. */
export function folderOf(p) {
  const s = text(p);
  const at = s.lastIndexOf('/');
  return at < 0 ? '' : s.slice(0, at);
}

/** The file name without its folder or extension ('idle_03'). */
export function nameOf(p) {
  const s = text(p);
  const base = s.slice(s.lastIndexOf('/') + 1);
  return base.replace(/\.[^.]+$/, '');
}

export const isAudio = (p) => AUDIO.test(text(p));

/**
 * The rows the gallery works on, from the listing's files: { path, name, folder, kind, format, bytes,
 * w, h, from, audio }. A row without a path is dropped; an unknown size or dimension is null.
 */
export function rowsOf(files = []) {
  return list(files).filter((f) => f && typeof f.path === 'string' && f.path).map((f) => {
    const path = f.path;
    return {
      path, name: nameOf(path), folder: folderOf(path), kind: kindOfPath(path), format: formatOf(path),
      bytes: num(f.bytes), w: num(f.w), h: num(f.h), from: text(f.from) || 'tree', audio: isAudio(path),
    };
  });
}

/**
 * A tile label for each row, in the rows' order: the parent folder and the name ('herald / BOW-01'), growing
 * to the shortest suffix of the path that tells the rows apart. A name with no folder shows the name alone.
 * Two rows that would read the same keep their extensions ('x / a.png', 'x / a.webp').
 */
export function tileLabelsOf(rows = []) {
  const parts = list(rows).map((r) => text(r.path).split('/'));
  const keyOf = (p, k) => p.slice(Math.max(0, p.length - k)).join('/');
  const labelOf = (p, k, withExt) => {
    const tail = p.slice(Math.max(0, p.length - k));
    if (!withExt) tail[tail.length - 1] = tail[tail.length - 1].replace(/\.[^./]+$/, '');
    return tail.join(' / ');
  };
  const out = new Array(parts.length);
  let pending = parts.map((_, i) => i);
  for (let k = 2; pending.length; k += 1) {
    const count = new Map();
    for (const p of parts) { const key = keyOf(p, k); count.set(key, (count.get(key) || 0) + 1); }
    const still = [];
    for (const i of pending) {
      // Unique at this depth, or the path has no more segments to add.
      if (count.get(keyOf(parts[i], k)) === 1 || parts[i].length <= k) out[i] = { k, withExt: false };
      else still.push(i);
    }
    pending = still;
  }
  const labels = out.map((o, i) => labelOf(parts[i], o.k, o.withExt));
  const taken = new Map();
  labels.forEach((l) => taken.set(l, (taken.get(l) || 0) + 1));
  return labels.map((l, i) => (taken.get(l) > 1 ? labelOf(parts[i], out[i].k, true) : l));
}

/** Each kind with how many rows carry it, in KINDS order (zero counts kept, so the chips stay put). */
export function kindCounts(rows = []) {
  const n = Object.fromEntries(KINDS.map((k) => [k.id, 0]));
  for (const r of list(rows)) n[r.kind] = (n[r.kind] || 0) + 1;
  return KINDS.map((k) => ({ id: k.id, label: k.label, count: n[k.id] || 0 }));
}

/**
 * Facets for the filter column: the kinds, formats and folders that occur, each with its count. Folders are
 * the rows' own folders; a filter on a folder also takes its subfolders.
 */
export function facetsOf(rows = []) {
  const count = (pick) => {
    const m = new Map();
    for (const r of list(rows)) { const v = pick(r); if (v) m.set(v, (m.get(v) || 0) + 1); }
    return [...m].map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value));
  };
  return { formats: count((r) => r.format), folders: count((r) => r.folder) };
}

const lower = (v) => text(v).toLowerCase();

/**
 * The rows that match every filter. `q` is a search: each word must appear in the path (folder and name
 * included), so 'poses idle' finds assets/poses/idle_03.webp. kind and format match exactly; a folder matches
 * the folder and its subfolders. '' or missing means any.
 */
export function filterRows(rows = [], f = {}) {
  const words = lower(f.q).split(/\s+/).filter(Boolean);
  return list(rows).filter((r) => {
    if (words.length) {
      const hay = lower(r.path);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (f.kind && r.kind !== f.kind) return false;
    if (f.format && r.format !== lower(f.format)) return false;
    if (f.folder && r.folder !== f.folder && !r.folder.startsWith(`${f.folder}/`)) return false;
    return true;
  });
}

export const SORTS = Object.freeze([
  { id: 'path', label: 'Path A–Z' },
  { id: 'size', label: 'Largest file' },
  { id: 'pixels', label: 'Largest image' },
  { id: 'name', label: 'Name A–Z' },
]);
export const DEFAULT_SORT = 'path';

/** A copy of the rows in one of the four orders (unknown = path). Unknown sizes sort last. */
export function sortRows(rows = [], sort = DEFAULT_SORT) {
  const copy = [...list(rows)];
  const byPath = (a, b) => a.path.localeCompare(b.path);
  const desc = (pick) => (a, b) => {
    const x = pick(a), y = pick(b);
    if (x === null && y === null) return byPath(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || byPath(a, b);
  };
  switch (sort) {
    case 'size': return copy.sort(desc((r) => r.bytes));
    case 'pixels': return copy.sort(desc((r) => (r.w && r.h ? r.w * r.h : null)));
    case 'name': return copy.sort((a, b) => a.name.localeCompare(b.name) || byPath(a, b));
    default: return copy.sort(byPath);
  }
}

/** The deep-link fields and their defaults. kind '' is every kind; path is the selected asset. */
const DEFAULTS = Object.freeze({ kind: '', q: '', path: '', folder: '', format: '', sort: DEFAULT_SORT });

/** `#mod=assets&kind=…&q=…&path=…`: the state the gallery reads from its params (unknown values fall back). */
export function parseDeepLink(params = {}) {
  const get = (k) => (params instanceof URLSearchParams ? params.get(k) : params[k]);
  const kind = KINDS.some((k) => k.id === get('kind')) ? get('kind') : DEFAULTS.kind;
  const sort = SORTS.some((s) => s.id === get('sort')) ? get('sort') : DEFAULTS.sort;
  return {
    kind,
    q: text(get('q')),
    path: text(get('path')),
    folder: text(get('folder')).replace(/^\/+|\/+$/g, ''),
    format: text(get('format')).toLowerCase(),
    sort,
  };
}

/** The inverse of parseDeepLink: only the values that differ from the defaults are written. */
export function deepLinkOf(state = {}) {
  const s = { ...DEFAULTS, ...state };
  const out = new URLSearchParams({ mod: 'assets' });
  for (const k of ['kind', 'q', 'path', 'folder', 'format']) if (s[k]) out.set(k, s[k]);
  if (s.sort !== DEFAULTS.sort) out.set('sort', s.sort);
  return `#${out}`;
}

/** The URL of one art file on this Workbench's origin (the route is /asset-file/<game path>). */
export function assetUrl(p) {
  const path = text(p);
  // A page can redirect art URLs (the published Workbench reads the light art from game/assets/).
  if (typeof globalThis.ASHEN_ASSET_URL === 'function') return globalThis.ASHEN_ASSET_URL(path);
  return `/asset-file/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * The strings a search for a game path's uses looks for in content/ and src/: the path itself, the same path
 * without its tier root (how a source file usually names it), and the name as a whole word. A name shorter
 * than five characters is not searched alone: 'idle' would match everywhere.
 */
export function usageNeedles(p) {
  const path = text(p);
  const bare = path.replace(TIER_ROOT, '');
  const paths = [...new Set([path, bare].filter((s) => s.length >= 6))];
  const name = nameOf(path);
  const keys = name.length >= 5 ? [name] : [];
  return { paths, keys };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when a line of source names one of the needles: a path anywhere, a name as a whole word. */
export function lineUses(line, needles = { paths: [], keys: [] }) {
  const s = text(line);
  if (needles.paths.some((p) => s.includes(p))) return true;
  return needles.keys.some((k) => new RegExp(`(^|[^A-Za-z0-9_])${escapeRe(k)}([^A-Za-z0-9_]|$)`).test(s));
}

/**
 * The usage search's result, normalised: [{ file, hits: [{ line, text }] }], files sorted, each file's hits in
 * line order and de-duplicated. Anything malformed in the reply is dropped, so the drawer never shows a bad row.
 */
export function groupUsage(hits = []) {
  const byFile = new Map();
  for (const h of list(hits)) {
    if (!h || typeof h.file !== 'string' || !h.file) continue;
    const line = num(h.line);
    if (line === null) continue;
    const group = byFile.get(h.file) || new Map();
    if (!group.has(line)) group.set(line, { line, text: text(h.text).slice(0, 240) });
    byFile.set(h.file, group);
  }
  return [...byFile].sort(([a], [b]) => a.localeCompare(b)).map(([file, group]) => ({
    file, hits: [...group.values()].sort((a, b) => a.line - b.line),
  }));
}

/**
 * The entity the Entity Browser shows for a piece of equipment art, or null. icon_<armament>.webp is the
 * armament `<armament>`; body_<class>_<outfit>.webp is the armour `<class>:<outfit>` (the browser's own id).
 */
export function entityLinkOf(p) {
  const s = text(p);
  if (!s.replace(TIER_ROOT, '').startsWith('equipment/')) return null;
  const name = nameOf(s);
  const icon = name.match(/^icon_([A-Za-z][\w]*)$/);
  if (icon) return { kind: 'armaments', id: icon[1] };
  const body = name.match(/^body_([a-z]+)_([A-Za-z][\w]*)$/);
  if (body) return { kind: 'armor', id: `${body[1]}:${body[2]}` };
  return null;
}

/**
 * The frames a path belongs to: the files in its folder whose names are one stem and a number ('attack_000',
 * 'attack_001', …), in number order. [] when the file is not one frame of a run of two or more.
 */
export function frameSetOf(p, rows = []) {
  const m = nameOf(p).match(/^(.*?)[_-]?(\d+)$/);
  if (!m) return [];
  const folder = folderOf(p);
  const stem = m[1];
  const frames = list(rows).filter((r) => r.folder === folder && r.format === formatOf(p)).flatMap((r) => {
    const f = r.name.match(/^(.*?)[_-]?(\d+)$/);
    return f && f[1] === stem ? [{ row: r, n: Number(f[2]) }] : [];
  });
  if (frames.length < 2) return [];
  return frames.sort((a, b) => a.n - b.n).map((f) => f.row);
}

/** The export the Unity and Unreal side reads: the selected rows as path, kind and dimensions. */
export function exportOf(rows = [], { exported = null } = {}) {
  const items = list(rows).map((r) => ({ path: r.path, kind: r.kind, format: r.format, width: r.w ?? null, height: r.h ?? null, bytes: r.bytes ?? null }));
  return { schema: 1, format: 'ashen-asset-selection', exported: exported || null, count: items.length, items };
}

/** An opacity for the onion-skin overlay, kept in 0..1 (a non-number reads as 0.5). */
export function clampOpacity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** A zoom factor kept in 0.25..8 (a non-number reads as 1). */
export function clampZoom(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(0.25, n));
}

/** "1.2 KB", "340 B", "3.4 MB" (or an em dash for an unknown size). */
export function sizeLabel(bytes) {
  const n = num(bytes);
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** "640 × 480", or an em dash when the header named no size. */
export function dimsLabel(w, h) {
  return num(w) !== null && num(h) !== null ? `${w} × ${h}` : '—';
}

/**
 * The pack status line's command: the packs not fetched, and the fetch command for them. null when every pack
 * is in place. `packs` is the listing's [{ id, fetched }].
 */
export function missingPacks(packs = []) {
  const missing = list(packs).filter((p) => p && !p.fetched).map((p) => p.id);
  if (!missing.length) return null;
  return { packs: missing, command: `node tools/fetch-art.mjs --pack ${missing.join(',')}` };
}

/**
 * The grid's virtual geometry: how many columns fit the width, and the height of every row, so only the rows
 * on screen (plus an overscan) are drawn. `tile` is the thumbnail's size and `gap` the space between tiles.
 */
export function gridMetrics({ count = 0, width = 0, tile = 128, gap = 8 } = {}) {
  const cell = Math.max(32, Number(tile) || 128);
  const space = Math.max(0, Number(gap) || 0);
  const cols = Math.max(1, Math.floor((Math.max(0, Number(width) || 0) + space) / (cell + space)));
  const rows = Math.ceil(Math.max(0, Number(count) || 0) / cols);
  return { cols, rows, rowHeight: cell + space, height: rows * (cell + space), cell, gap: space };
}

/** The rows and items the viewport shows, with `overscan` extra rows either side: { from, to } item indexes (to exclusive). */
export function visibleItems({ count = 0, metrics, scrollTop = 0, viewport = 0, overscan = 2 } = {}) {
  const { cols, rows, rowHeight } = metrics;
  if (!count || !rows) return { from: 0, to: 0 };
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
  if (first > rows - 1) return { from: count, to: count };
  const last = Math.min(rows - 1, Math.floor((Math.max(0, scrollTop) + Math.max(0, viewport)) / rowHeight) + overscan);
  return { from: Math.min(count, first * cols), to: Math.min(count, (last + 1) * cols) };
}

// Runs `fn` at most once at a time: a call made while a run is in flight gets that run's promise, so two
// callers (the mount and the first show) make one request. A call after the run settles starts a new one.
export function singleFlight(fn) {
  let inflight = null;
  return () => {
    if (!inflight) inflight = new Promise((resolve) => resolve(fn())).finally(() => { inflight = null; });
    return inflight;
  };
}
