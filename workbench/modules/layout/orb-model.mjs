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

// The browser cannot import the game's source (the Workbench serves its own modules), so the
// game's pure rules are restated here, each next to its name in src/. tests/ and
// workbench/tests/layout-orb-model.test.mjs import the originals and compare every answer.

export const FOOTER_FILE = 'content/config/ui/presentation/footerLayout.json';
/** src/content/footerLayout.js footerFonts, and src/content/staminaOrb.js assets (the SP art). */
export const FOOTER_FONTS = Object.freeze({ serif: 'Georgia, serif', sans: 'Arial, sans-serif', mono: 'monospace' });
export const ORB_ASSETS = Object.freeze(Object.fromEntries(['frame', 'orb', 'sigil', 'diamond', 'spent'].map((id) => [id, `assets/ui/stamina-orb/${id}.webp`])));

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

// src/ui/models/FooterLayoutModel.js: an art's asset, or a text's binding, names its group.
const ASSET_ROLE = { frame: 'sp', orb: 'sp', sigil: 'sp', diamond: 'sp', spent: 'sp', draw: 'draw', plate: 'end', 'spent-cards': 'discard', potions: 'potions' };
const BINDING_ROLE = { sp: 'sp', spLabel: 'sp', draw: 'draw', drawLabel: 'draw', endTurn: 'end', endTurnKey: 'end', discard: 'discard', exhaust: 'discard', potions: 'potions' };
const FOOTER_ROLES = ['sp', 'draw', 'end', 'discard', 'potions'];

/** The SP group's item ids, classified as the game classifies them (footerLayoutModel with every item shown). */
export function spIds(data) {
  const items = layoutOf(data).items;
  const anchors = items.filter((n) => ASSET_ROLE[n.asset]);
  const role = (n) => {
    if (ASSET_ROLE[n.asset]) return ASSET_ROLE[n.asset];
    if (BINDING_ROLE[n.binding]) return BINDING_ROLE[n.binding];
    if (n.asset === 'connector') return 'rail';
    if (FOOTER_ROLES.includes(n.group)) return n.group;
    const nearest = anchors.slice().sort((a, b) => Math.hypot(n.x - a.x, n.y - a.y) - Math.hypot(n.x - b.x, n.y - b.y))[0];
    return ASSET_ROLE[nearest?.asset] || 'end';
  };
  return items.filter((n) => role(n) === 'sp').map((n) => n.id);
}

/** src/ui/models/FooterLayoutModel.js footerBounds: the box around some items. */
export function footerBounds(items) {
  if (!items.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(...items.map((n) => n.x)), y = Math.min(...items.map((n) => n.y));
  return { x, y, w: Math.max(1, ...items.map((n) => n.x + n.w - x)), h: Math.max(1, ...items.map((n) => n.y + n.h - y)) };
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

/**
 * The mana ring the game draws at a capacity, from its resampling of the sockets
 * (src/ui/models/FooterLayoutModel.js footerStaminaLayers): gems only, in socket order.
 */
export function ringAt(data, capacity, available = 0) {
  const sockets = layoutOf(data).items.filter((n) => ['diamond', 'spent'].includes(n.asset))
    .sort((a, b) => socketRank(a) - socketRank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const gems = Array.from({ length: capacity }, (_, i) => ({ id: i < available ? 'diamond' : 'spent' }));
  return gems.flatMap((gem, i) => {
    if (!sockets.length) return [];
    const at = i * sockets.length / gems.length;
    const a = sockets[Math.floor(at)], b = sockets[(Math.floor(at) + 1) % sockets.length], blend = at % 1;
    if (a.visible === false) return [];
    const lerp = (key) => a[key] + (b[key] - a[key]) * blend;
    const scale = Math.min(1, sockets.length / gems.length) * (gem.id === 'spent' ? 0.6 : 1);
    const w = lerp('w') * scale, h = lerp('h') * scale;
    return [{ id: a.id, asset: gem.id, x: lerp('x') + (lerp('w') - w) / 2, y: lerp('y') + (lerp('h') - h) / 2, w, h }];
  });
}
const socketRank = (n) => (/^mana-\d+$/.test(n.id) ? Number(n.id.slice(5)) : Infinity);

/** The file text a save would write for this object, or null when it matches the original text. */
export function changedText(original, data) {
  const text = serializeFooter(data);
  return text === original ? null : text;
}
