// workbench/modules/layout/config-model.mjs — the pure half of Layout Studio's
// "UI config" mode. No DOM and no fetch: index.mjs supplies the file API, and
// this file turns content/config/ui JSON into wireframe regions, maps a canvas
// edit back to the config values it came from, and serializes the changed files.
//
// The arithmetic is UI Studio's: regionsFor for the regions, applyRegionDrag
// for an edge drag, formatJson for byte-preserving output, gameLayoutFor and
// viewportFor for the device. The workbench server serves only workbench/, so
// studio-model.mjs is a byte-identical copy of ui-studio/model.mjs; the layout
// tests fail if the two drift. What is new here is the mapping from a canvas
// item's geometry change to the edge that moved.
import * as M from './studio-model.mjs';

export const CONFIG_DIR = 'content/config';
export const UI_DIR = `${CONFIG_DIR}/ui`;
export const TOKENS = 'ui/tokens.json';

export const configPath = (rel) => `${CONFIG_DIR}/${rel}`;
const lf = (text) => String(text).replace(/\r\n/g, '\n');

/** The studio's defaults: devices, breakpoints, wireframe catalog, grid and the game's layout numbers. */
export function defaultSettings() {
  return M.clone(M.DEFAULT_SETTINGS);
}

export const wireframeById = (settings, id) => settings.wireframes.find((w) => w.id === id) || settings.wireframes[0];

/** The orientation a device is shown in when the page has not turned it. */
export const naturalOrientation = (device) => M.naturalOrientation(device);

/**
 * The CSS-px viewport a device shows. `orientation` is 'auto' (the device's
 * natural one), 'portrait' or 'landscape'; a resizable device uses freeSize.
 */
export function viewportOf(device, { orientation = 'auto', freeSize = { width: 1024, height: 768 } } = {}) {
  if (device.resizable) {
    const o = orientation === 'auto' ? (freeSize.width >= freeSize.height ? 'landscape' : 'portrait') : orientation;
    return M.viewportFor({ ...device, width: freeSize.width, height: freeSize.height }, o);
  }
  return M.viewportFor(device, orientation === 'auto' ? M.naturalOrientation(device) : orientation);
}

// ---------------------------------------------------------------------------
// Loading: the file tree and the files' text, through an injected api(path)
// ---------------------------------------------------------------------------

/** One loaded file: its draft data, the text it was read as, and the hash the save must match. */
export function fileState(rel, text, hash) {
  const original = lf(text);
  let data = null, error = null;
  try { data = JSON.parse(original); } catch (e) { error = `Invalid JSON: ${e.message}`; }
  return { rel, path: configPath(rel), original, hash, data, error };
}

/**
 * Load every JSON file under content/config/ui. `api(path)` is the Workbench
 * GET helper; the paths are the file API's (files/list, files/read).
 * Returns { files: Map<rel, fileState>, truncated }, rel being config-relative.
 */
export async function loadWorkspace(api) {
  const listing = await api(`files/list?dir=${encodeURIComponent(UI_DIR)}&ext=json`);
  const rels = listing.files.map((p) => p.slice(CONFIG_DIR.length + 1)).sort();
  const pairs = await Promise.all(rels.map(async (rel) => {
    const r = await api(`files/read?path=${encodeURIComponent(configPath(rel))}`);
    return [rel, fileState(rel, r.text, r.hash)];
  }));
  return { files: new Map(pairs), truncated: Boolean(listing.truncated) };
}

/** Plain { rel: data } for the regions model (it reads a parent and sibling files by rel). */
export function configsOf(files) {
  const out = {};
  for (const [rel, f] of files) if (f.data !== null) out[rel] = f.data;
  return out;
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

/**
 * The regions of a wireframe at a viewport, as UI Studio's regionsFor draws
 * them, with the game's layout decision and the breakpoint the viewport falls in.
 */
export function regionsFor({ wireframe, files, viewport, settings }) {
  const configs = files instanceof Map ? configsOf(files) : files;
  const layout = M.gameLayoutFor(viewport, settings.gameLayout);
  const breakpoint = M.breakpointFor(settings.breakpoints, viewport);
  const data = configs[wireframe.file];
  if (!data) return { regions: [], layout, breakpoint };
  const parent = wireframe.parent && configs[wireframe.parent] ? configs[wireframe.parent] : null;
  const tokens = (configs[TOKENS] && configs[TOKENS].vars) || {};
  const regions = M.regionsFor(wireframe, data, viewport, {
    parent, tokens, layoutMode: layout.mode, screens: settings.screens, zoom: layout.zoom, rootFontPx: settings.gameLayout.rootFontPx, configs,
  });
  return { regions, layout, breakpoint };
}

/** The canvas document for a viewport and its regions. Regions without an edit are locked. */
export function canvasDocFor(viewport, regions) {
  const doc = { width: viewport.width, height: viewport.height, items: [] };
  if (viewport.safeArea) doc.safeArea = viewport.safeArea;
  doc.items = regions.map((r, i) => ({
    id: r.id, x: r.x, y: r.y, w: Math.max(0, r.w), h: Math.max(0, r.h), z: i,
    locked: !r.edit, label: r.label, data: { band: r.band ?? null, path: pathsOf(r, null)[0] ?? null },
  }));
  return doc;
}

/**
 * The config paths a region owns, for the inspector: its edit path (and the
 * second axis of a centred frame), or for a band the band's own percent path.
 */
export function pathsOf(region, data) {
  const e = region.edit;
  const out = [];
  if (e && e.kind === 'bandEdge') out.push(`${e.path}.${region.band}`);
  else if (e && e.path) out.push(e.path);
  if (e && e.pathH) out.push(e.pathH);
  if (!out.length && region.band) {
    const roots = ['sizing.bands', 'sizing.bandsCompact'];
    const root = data ? roots.find((r) => M.getPath(data, `${r}.${region.band}`) !== undefined) : roots[0];
    if (root) out.push(`${root}.${region.band}`);
  }
  return out;
}

/** A $name or fraction value's meaning for a chip: { ref, value, from } or null for a literal. */
export function refInfo(value, data, tokens = {}) {
  if (M.isRef(value)) {
    const name = value.slice(1);
    const fileVars = (data && data.vars) || {};
    const from = Object.prototype.hasOwnProperty.call(fileVars, name) ? 'file' : Object.prototype.hasOwnProperty.call(tokens, name) ? 'tokens' : 'missing';
    return { ref: value, value: M.resolveValue(value, (n) => (Object.prototype.hasOwnProperty.call(fileVars, n) ? fileVars[n] : tokens[n])), from };
  }
  if (M.isFraction(value)) return { ref: null, value: M.resolveValue(value, () => undefined), from: 'fraction' };
  return null;
}

// ---------------------------------------------------------------------------
// Canvas edit → config values
// ---------------------------------------------------------------------------

/**
 * How far the edge a region's edit moves has travelled, in viewport px.
 *   bandEdge:  the band's bottom edge.
 *   width:     the right edge; a centred region grows on both sides, so half.
 *   height:    the bottom edge; an edit anchored at the bottom moves its top
 *              edge; a centred region half.
 *   no axis:   a line (the floor) moves on y.
 */
export function movementFor(edit, before, after) {
  if (!edit) return 0;
  if (edit.kind === 'bandEdge') return (after.y + after.h) - (before.y + before.h);
  if (edit.axis === 'w') return edit.centered ? (after.w - before.w) / 2 : (after.x + after.w) - (before.x + before.w);
  if (edit.axis === 'h') {
    if (edit.centered) return (after.h - before.h) / 2;
    return edit.anchor === 'bottom' ? after.y - before.y : (after.y + after.h) - (before.y + before.h);
  }
  return after.y - before.y;
}

/**
 * Apply the canvas geometry of `items` (the canvas doc after a gesture) to the
 * config `data` of the active file. `regions` are the regions the canvas was
 * built from; a region whose geometry did not change, or whose edit has no
 * edge moving (a sideways move of a centred frame), changes nothing. Returns
 * the new data; the input is not touched when nothing moved.
 */
export function applyCanvasEdits({ data, regions, items, viewport, grid }) {
  let next = data;
  const after = new Map(items.map((it) => [it.id, it]));
  for (const r of regions) {
    if (!r.edit) continue;
    const it = after.get(r.id);
    if (!it) continue;
    const before = { x: r.x, y: r.y, w: r.w, h: r.h };
    const now = { x: it.x, y: it.y, w: it.w, h: it.h };
    if (before.x === now.x && before.y === now.y && before.w === now.w && before.h === now.h) continue;
    const drags = [{ edit: r.edit, delta: movementFor(r.edit, before, now) }];
    if (r.edit.pathH) drags.push({ edit: { kind: 'path', path: r.edit.pathH, unit: r.edit.unitH, axis: 'h', centered: r.edit.centered }, delta: movementFor({ axis: 'h', centered: r.edit.centered }, before, now) });
    for (const { edit, delta } of drags) {
      if (!delta) continue;
      next = M.applyRegionDrag(next, { ...r, edit }, delta, viewport, { grid, regions });
    }
  }
  return next;
}

/** Set one config value by path. Immutable: returns a new tree. */
export function setConfigValue(data, path, value) {
  return M.setPath(data, path, value);
}

// ---------------------------------------------------------------------------
// Serialization and dirty state
// ---------------------------------------------------------------------------

/** The text a draft would save as, in content/config's house style, keeping the original's spans. */
export function proposedText(file) {
  return M.formatJson(file.data, { original: file.original });
}

/** A file is dirty when its proposed text differs from what was read. */
export function isDirty(file) {
  return file.data !== null && proposedText(file) !== file.original;
}

/** The save payload for every dirty file: [{ path, text, baseHash }]. */
export function changesFor(files) {
  return [...files.values()].filter(isDirty).map((f) => ({ path: f.path, text: proposedText(f), baseHash: f.hash }));
}

/**
 * What a failed files/save means for the dialog, from the error ctx.api threw:
 *   problems: 422, the compiler's { path, message } list;
 *   conflicts: 409, the files changed on disk ({ path, hash });
 *   error: anything else, a network error included, with its message.
 */
export function saveFailureOf(err) {
  if (err && err.status === 422) return { kind: 'problems', problems: Array.isArray(err.body?.problems) ? err.body.problems : [] };
  if (err && err.status === 409) return { kind: 'conflicts', conflicts: Array.isArray(err.body?.conflicts) ? err.body.conflicts : [] };
  return { kind: 'error', message: (err && err.message) || 'network error' };
}
