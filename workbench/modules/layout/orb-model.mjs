// workbench/modules/layout/orb-model.mjs — the pure model of Layout Studio's SP orb
// mode. No DOM and no fetch.
//
// The data the game reads is content/config/ui/presentation/footerLayout.json: the
// combat footer's items, and the SP group inside it (the orb, its frame and sigil,
// the SP number and label, and the twelve mana sockets). src/content/footerLayout.js
// loads it, and src/ui/components/footerArt.js paints it. The game's own role
// classifier (footerLayoutModel) decides which items are the SP group, so this
// model never restates that rule.
//
// A save writes the file as JSON.stringify(data, null, 2) plus a final newline,
// which reproduces the file byte for byte when nothing was edited (tested against
// the real file). Only the SP items' geometry and visibility are written from the
// canvas; the rest of the footer is carried through untouched. Values the game does
// not read (the canvas's stacking order and lock state) are never written.

import { footerLayoutModel, footerStaminaLayers } from '../../../src/ui/models/FooterLayoutModel.js';

export const FOOTER_FILE = 'content/config/ui/presentation/footerLayout.json';

/** The fields of a footer item this mode edits; text items also carry fontSize. */
export const FIELDS = Object.freeze(['x', 'y', 'w', 'h', 'opacity', 'visible']);
export const TEXT_FIELDS = Object.freeze(['fontSize']);

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

/** The footer's layout object, or a thrown error that names what is wrong. */
export function layoutOf(data) {
  const layout = data && data.components && data.components.layout;
  if (!layout || !Array.isArray(layout.items)) throw Error(`${FOOTER_FILE}: components.layout.items must be an array`);
  return layout;
}

/** Parse the JSON text. Throws when the text is not a footer layout. */
export function parseFooter(text) {
  const data = JSON.parse(text);
  layoutOf(data);
  return data;
}

/** The file text for a footer object. An unedited parse gives the original text. */
export const serializeFooter = (data) => JSON.stringify(data, null, 2) + '\n';

/**
 * The SP group, by the game's own classifier. Hidden items are classified as if
 * shown, so the hidden sigil stays in the group (footerLayoutModel drops hidden
 * items, which would hide them from the editor as well).
 */
export function spIds(data) {
  const layout = layoutOf(data);
  const shown = { ...layout, items: layout.items.map((n) => ({ ...n, visible: true })) };
  return footerLayoutModel(shown).groups.sp.items.map((n) => n.id);
}

/** The mana sockets in their numeric order (mana-0 … mana-11), which the game resamples. */
export function socketIds(data) {
  return layoutOf(data).items.filter((n) => /^mana-\d+$/.test(n.id)).map((n) => n.id)
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
}

/** The editable value kinds of one item: its geometry, opacity and visibility, and the font size for text. */
export function fieldsOf(item) {
  return item.asset === 'text' ? [...FIELDS, ...TEXT_FIELDS] : [...FIELDS];
}

/**
 * Check one value the way the editor accepts it. Returns null, or the reason it is refused.
 * Geometry may sit anywhere (the footer's art may overhang its canvas); sizes must be positive.
 */
export function fieldProblem(item, field, value) {
  if (field === 'visible') return typeof value === 'boolean' ? null : `${item.id} visible must be true or false`;
  if (!finite(value)) return `${item.id} ${field} must be a finite number`;
  if ((field === 'w' || field === 'h' || field === 'fontSize') && value <= 0) return `${item.id} ${field} must be greater than 0`;
  if (field === 'opacity' && (value < 0 || value > 1)) return `${item.id} opacity must be between 0 and 1`;
  return null;
}

/** Problems in a whole footer object (the same checks the editor applies), empty when it is sound. */
export function footerProblems(data) {
  const out = [];
  let layout;
  try { layout = layoutOf(data); } catch (err) { return [err.message]; }
  const seen = new Set();
  for (const item of layout.items) {
    if (!item || typeof item.id !== 'string' || !item.id) { out.push('every footer item needs an id'); continue; }
    if (seen.has(item.id)) out.push(`duplicate footer item "${item.id}"`);
    seen.add(item.id);
    for (const field of ['x', 'y', 'w', 'h', 'opacity', 'visible']) {
      if (item[field] === undefined && field === 'opacity') continue;
      const problem = fieldProblem(item, field, item[field]);
      if (problem && !(field === 'visible' && item.visible === undefined)) out.push(problem);
    }
  }
  return out;
}

/** A new footer object with one item field set. The input is never mutated; a refused value throws. */
export function setItemField(data, id, field, value) {
  const layout = layoutOf(data);
  const item = layout.items.find((n) => n.id === id);
  if (!item) throw Error(`no footer item "${id}"`);
  if (!fieldsOf(item).includes(field)) throw Error(`${id} has no ${field}`);
  const problem = fieldProblem(item, field, value);
  if (problem) throw Error(problem);
  return {
    ...data,
    components: {
      ...data.components,
      layout: { ...layout, items: layout.items.map((n) => (n.id === id ? { ...n, [field]: value } : n)) },
    },
  };
}

/**
 * The canvas document for the footer: the layout's size, and every item in file order (the
 * stacking order), so the non-SP art reads as context. Only the SP group is editable.
 * Item.hidden mirrors visible: false. Stacking (z) is the file's order and is not saved.
 */
export function toCanvasDoc(data) {
  const layout = layoutOf(data);
  const sp = new Set(spIds(data));
  const items = layout.items.map((n, index) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    w: n.w,
    h: n.h,
    z: index,
    locked: !sp.has(n.id),
    hidden: n.visible === false,
    label: n.name || n.id,
    data: { kind: sp.has(n.id) ? 'sp' : 'context', asset: n.asset, binding: n.binding || 'static' },
  }));
  return { width: layout.width, height: layout.height, items };
}

/**
 * Take the canvas's geometry and visibility back into the footer object. Only SP items
 * change, and only where a value moved by more than a hundredth of a pixel, so an
 * untouched canvas returns the same data. Returns the new object (or the same one).
 */
export function fromCanvasDoc(data, doc) {
  const layout = layoutOf(data);
  const sp = new Set(spIds(data));
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  let changed = false;
  const items = layout.items.map((n) => {
    if (!sp.has(n.id)) return n;
    const it = byId.get(n.id);
    if (!it) return n;
    const next = { ...n };
    for (const key of ['x', 'y', 'w', 'h']) {
      // A size the canvas drove to zero or below is refused, not written: the old size stays.
      if ((key === 'w' || key === 'h') && !(it[key] > 0)) continue;
      if (Math.abs(it[key] - n[key]) >= 0.005) next[key] = round2(it[key]);
    }
    const visible = !it.hidden;
    if (visible !== (n.visible !== false)) next.visible = visible;
    if (next.x !== n.x || next.y !== n.y || next.w !== n.w || next.h !== n.h || next.visible !== n.visible) changed = true;
    return next;
  });
  if (!changed) return data;
  return { ...data, components: { ...data.components, layout: { ...layout, items } } };
}

/** The sockets' geometry the game draws at a capacity, from its own resampling (footerStaminaLayers). */
export function ringAt(data, capacity, available = 0) {
  const gems = Array.from({ length: capacity }, (_, i) => ({ id: i < available ? 'diamond' : 'spent' }));
  return footerStaminaLayers(layoutOf(data), { gems }).filter((n) => n.asset === 'diamond' || n.asset === 'spent');
}

/** The file text a save would write for this object, or null when it matches the original text. */
export function changedText(original, data) {
  const text = serializeFooter(data);
  return text === original ? null : text;
}
