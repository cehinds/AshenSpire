// workbench/modules/layout/card-layers-model.mjs — Layout Studio's "Card layers" mode, pure
// (no DOM, no network). It loads src/content/card-layout.json, edits its layer list and
// geometry, checks the result, and writes the file back with the indent, newline and key
// order it was read with, so an edit changes only the values it touches.
//
// The game reads the file through tools/card-components.mjs, which regenerates
// src/content/cardComponents.generated.js after every save (core/watch.mjs buildsFor).

export const LAYOUT_FILE = 'src/content/card-layout.json';
/** The render page's protocol: a page from another checkout with another number is not drawn. */
export const RENDER_PROTOCOL = 1;
export const RENDER_SOURCE = 'ashen-card-render';
export const MODULE_SOURCE = 'ashen-card-module';
export const LAYER_TYPES = Object.freeze(['image', 'text']);
/** The numeric fields a layer owns in the inspector. */
export const GEOMETRY = Object.freeze(['x', 'y', 'w', 'h', 'rotation', 'opacity']);
const ARTWORK_HREF = /^assets\/[\w/.-]+\.(png|webp|svg)$/;

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** The layout's text format: indent, byte-order mark and newline, so a save writes the same shape back. */
export function formatOf(text) {
  const body = String(text ?? '');
  const match = /^\{\r?\n([ \t]+)"/.exec(body.replace(/^﻿/, ''));
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  return {
    indent: match ? match[1] : '  ',
    bom: body.startsWith('﻿'),
    newline,
    eol: body.endsWith('\n') ? newline : '',
  };
}

/** Parse the file text. Invalid JSON throws (the message names the parser's complaint). */
export function parseLayout(text) {
  if (typeof text !== 'string') throw Error('The layout file is not text');
  let data;
  try { data = JSON.parse(text.replace(/^﻿/, '')); } catch (err) { throw Error(`Invalid JSON: ${err.message}`); }
  return { data, format: formatOf(text), problems: layoutProblems(data) };
}

/**
 * Serialize with the format the file was read in. Key order is the object's own order (the
 * edit functions keep it), so JSON.stringify writes the same keys in the same order.
 */
export function serialize(data, format = { indent: '  ', bom: false, newline: '\n', eol: '\n' }) {
  const body = JSON.stringify(data, null, format.indent).replace(/\n/g, format.newline || '\n');
  return (format.bom ? '﻿' : '') + body + (format.eol || '');
}

/** A layer number as the inspector shows it: at most 2 decimals, no trailing zeros. Display only; the stored value is unchanged. */
export function displayNumber(v) {
  return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '';
}

/**
 * The disk text as a layout the view may take. Throws the first reason the game could not read it
 * (with a count of the rest), so a bad file never reaches the draft.
 */
export function layoutFromDisk(text) {
  const parsed = parseLayout(text);
  const problems = [...parsed.problems];
  if (!Array.isArray(parsed.data?.layers) && !problems.length) problems.push('layers must be a non-empty list');
  if (problems.length) throw Error(problems.length > 1 ? `${problems[0]} (and ${problems.length - 1} more)` : problems[0]);
  return parsed;
}

/** Problems with a layout document, as messages a person can act on. An empty list means the game can read it. */
export function layoutProblems(data) {
  if (!isObj(data)) return ['The layout must be a JSON object'];
  const out = [];
  if (data.schemaVersion !== 1) out.push('schemaVersion must be 1');
  for (const key of ['width', 'height']) {
    if (!Number.isFinite(data[key]) || data[key] < 10 || data[key] > 4000) out.push(`${key} must be a number from 10 to 4000`);
  }
  if (!Array.isArray(data.layers) || !data.layers.length) {
    out.push('layers must be a non-empty list');
    return out;
  }
  const ids = new Set();
  data.layers.forEach((layer, i) => {
    if (!isObj(layer)) { out.push(`layer ${i + 1} is not an object`); return; }
    const name = typeof layer.id === 'string' && layer.id ? layer.id : `layer ${i + 1}`;
    if (typeof layer.id !== 'string' || !layer.id) out.push(`layer ${i + 1} needs an id`);
    else if (ids.has(layer.id)) out.push(`duplicate layer id ${layer.id}`);
    else ids.add(layer.id);
    if (!LAYER_TYPES.includes(layer.type)) out.push(`${name}: type must be image or text`);
    for (const key of GEOMETRY) if (!Number.isFinite(layer[key])) out.push(`${name}: ${key} must be a number`);
    if (Number.isFinite(layer.w) && layer.w <= 0) out.push(`${name}: w must be above 0`);
    if (Number.isFinite(layer.h) && layer.h <= 0) out.push(`${name}: h must be above 0`);
    if (Number.isFinite(layer.opacity) && (layer.opacity < 0 || layer.opacity > 1)) out.push(`${name}: opacity must be from 0 to 1`);
    for (const flag of ['visible', 'locked']) if (layer[flag] !== undefined && typeof layer[flag] !== 'boolean') out.push(`${name}: ${flag} must be true or false`);
    if (layer.href !== undefined && (typeof layer.href !== 'string' || !ARTWORK_HREF.test(layer.href) || layer.href.includes('..'))) out.push(`${name}: href must be a png, webp or svg under assets/`);
  });
  return out;
}

/**
 * The file change for a draft: [{ path, text }] when the serialized draft differs from the
 * text it was read from, [] when nothing changed. The text keeps the original's format.
 */
export function changesFor({ original, data, path = LAYOUT_FILE }) {
  if (typeof original !== 'string' || data == null) return [];
  const text = serialize(data, formatOf(original));
  return text === original ? [] : [{ path, text }];
}

/**
 * The render page's address on the game server. ?po= is the Workbench origin the page may talk to;
 * ?r= changes on a reload, so the same page is navigated to again.
 */
export function renderUrl(gameBase, { parentOrigin = '', nonce = 0 } = {}) {
  const base = String(gameBase || '').replace(/\/?$/, '/');
  const q = new URLSearchParams();
  if (parentOrigin) q.set('po', parentOrigin);
  if (nonce) q.set('r', String(nonce));
  const query = q.toString();
  return `${base}workbench/modules/layout/card-layers-render.html${query ? `?${query}` : ''}`;
}

// ---- edits: each returns a new document; the one it was given is never mutated ----

const round = (v) => Math.round(v * 1000) / 1000;
const MIN_SIZE = 1;

/** The index of a layer by id, or -1. */
export function indexOfLayer(data, id) {
  return Array.isArray(data?.layers) ? data.layers.findIndex((l) => l && l.id === id) : -1;
}

/** The layer list as the inspector shows it: front (top of the paint order) first. */
export function layerRows(data) {
  const layers = Array.isArray(data?.layers) ? data.layers : [];
  return layers.map((layer, index) => ({
    id: layer.id,
    type: layer.type,
    index,
    visible: layer.visible !== false,
    locked: layer.locked === true,
  })).reverse();
}

function withLayer(data, id, edit) {
  const i = indexOfLayer(data, id);
  if (i < 0) throw Error(`No layer ${id}`);
  const layers = data.layers.slice();
  layers[i] = edit(data.layers[i]);
  return { ...data, layers };
}

/**
 * One field of a layer. Geometry must be a number, w and h stay at least MIN_SIZE, opacity stays
 * from 0 to 1, and the flags are true or false. A refused value throws and the document is kept.
 */
export function setLayerField(data, id, field, value) {
  let next = value;
  if (field === 'visible' || field === 'locked') {
    if (typeof value !== 'boolean') throw Error(`${field} must be true or false`);
  } else if (!GEOMETRY.includes(field)) {
    throw Error(`${field} is not a layer field the Workbench edits`);
  } else {
    if (!Number.isFinite(value)) throw Error(`${field} must be a number`);
    if ((field === 'w' || field === 'h') && value < MIN_SIZE) throw Error(`${field} must be at least ${MIN_SIZE}`);
    if (field === 'opacity' && (value < 0 || value > 1)) throw Error('opacity must be from 0 to 1');
    next = round(value);
  }
  const i = indexOfLayer(data, id);
  if (i >= 0 && data.layers[i][field] === next) return data;
  return withLayer(data, id, (layer) => ({ ...layer, [field]: next }));
}

/** Move a layer by a design-unit offset. A zero move returns the same document. */
export function moveLayer(data, id, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw Error('The move must be a number');
  if (!dx && !dy) return data;
  return withLayer(data, id, (layer) => ({ ...layer, x: round(layer.x + dx), y: round(layer.y + dy) }));
}

/** Set a layer's box (x, y, w, h). Width and height stay at least MIN_SIZE. */
export function resizeLayer(data, id, box) {
  for (const key of ['x', 'y', 'w', 'h']) if (!Number.isFinite(box?.[key])) throw Error(`${key} must be a number`);
  if (box.w < MIN_SIZE || box.h < MIN_SIZE) throw Error(`w and h must be at least ${MIN_SIZE}`);
  return withLayer(data, id, (layer) => ({ ...layer, x: round(box.x), y: round(box.y), w: round(box.w), h: round(box.h) }));
}

/**
 * Move a layer to a new place in the paint order. `to` is the index in the file's list (0 is the
 * back, drawn first). The other layers keep their order.
 */
export function reorderLayer(data, id, to) {
  const from = indexOfLayer(data, id);
  if (from < 0) throw Error(`No layer ${id}`);
  if (!Number.isInteger(to) || to < 0 || to >= data.layers.length) throw Error('The layer cannot move there');
  if (to === from) return data;
  const layers = data.layers.slice();
  const [moving] = layers.splice(from, 1);
  layers.splice(to, 0, moving);
  return { ...data, layers };
}

/** The ids of the layers whose content differs between two documents. */
export function changedLayers(before, after) {
  const a = new Map((before?.layers || []).map((l) => [l.id, JSON.stringify(l)]));
  const b = new Map((after?.layers || []).map((l) => [l.id, JSON.stringify(l)]));
  const ids = new Set([...a.keys(), ...b.keys()]);
  return [...ids].filter((id) => a.get(id) !== b.get(id));
}
