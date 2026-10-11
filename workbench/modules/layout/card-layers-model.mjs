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
