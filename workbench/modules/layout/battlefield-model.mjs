// workbench/modules/layout/battlefield-model.mjs — the pure model of Layout
// Studio's Battlefield mode. No DOM and no fetch.
//
// The data the game reads is src/content/formationPositioningPresets.js. Its
// FORMATION_POSITIONING_PRESETS object is JSON text between a fixed header and
// the closing `};`, so a parse keeps the header and tail as text and a save
// writes them back unchanged. The body is written with JSON.stringify(…, null, 2),
// which reproduces the file byte for byte when nothing was edited (tested
// against the real file), so an edit changes only the values it touches.

export const PRESETS_FILE = 'src/content/formationPositioningPresets.js';
const OPEN = 'export const FORMATION_POSITIONING_PRESETS = ';
const CLOSE = '\n};\n';

/** Split the module text into the header, the JSON object body and the tail. */
export function splitPresets(text) {
  const at = text.indexOf(OPEN);
  if (at < 0) throw Error(`${PRESETS_FILE}: FORMATION_POSITIONING_PRESETS was not found`);
  const start = at + OPEN.length;
  const end = text.indexOf(CLOSE, start);
  if (end < 0) throw Error(`${PRESETS_FILE}: the closing "};" of FORMATION_POSITIONING_PRESETS was not found`);
  return { head: text.slice(0, start), body: text.slice(start, end + 2), tail: text.slice(end + 2) };
}

/** Parse the module text: { head, body, tail, data }. Throws when the object body is not JSON. */
export function parsePresets(text) {
  const parts = splitPresets(text);
  const data = JSON.parse(parts.body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(`${PRESETS_FILE}: the presets must be an object`);
  return { ...parts, data };
}

const formatBody = (data) => JSON.stringify(data, null, 2);

/** The module text for a parse with its data replaced. Unchanged data gives the original text. */
export function serializePresets(parts, data) {
  return parts.head + formatBody(data) + parts.tail;
}

/** The layout keys the file supplies, in file order ("2x2", "1x1" …). */
export const layoutKeys = (data) => Object.keys(data);
