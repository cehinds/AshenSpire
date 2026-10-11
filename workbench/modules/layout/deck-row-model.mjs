// workbench/modules/layout/deck-row-model.mjs — the card row reference from the Deck row tool
// (docs/design/deck-row-editor), as the Deck row mode's preview. No DOM and no fetch.
//
// The game does not read this layout: its deck editor rows are laid out by CSS, and the
// only value of the row the game reads is the cost groups (deck-model.mjs). So this row is
// PREVIEW ONLY. It is never written to the repo. It can be copied or imported as version 1
// JSON, which is a reference for the implementation and nothing the game loads. An import
// that fails leaves the current row intact.

export const ROW_NOTE = 'Preview only. The game does not read this row, so it is not saved to the repo.';
export const COMPONENTS = Object.freeze(['harness', 'grip', 'art', 'title', 'type', 'description', 'manaIcon', 'manaValue', 'staminaIcon', 'staminaValue', 'actionSigil', 'inspect', 'count']);
export const LABELS = Object.freeze({ grip: 'Reorder grip', art: 'Card artwork', title: 'Title', type: 'Card type', description: 'Description', manaIcon: 'MP diamond', manaValue: 'MP number', staminaIcon: 'SP orb', staminaValue: 'SP number', harness: 'Cost harness', actionSigil: 'Action sigil', inspect: 'Inspect', count: 'Number in deck' });
/** The row's limits, as the reference tool enforced them. */
export const LIMITS = Object.freeze({ width: [200, 1600], height: [48, 400], fontSize: [6, 72], minBox: 8, grid: [1, 64] });
const box = (x, y, width, height, fontSize = 12) => ({ x, y, width, height, fontSize, visible: true });

/** The supplied 520 × 86 layout, as the reference tool opened it. */
export function defaultRow() {
  return { version: 1, row: { width: 520, height: 86 }, grid: 4, snap: true, elements: {
    harness: { ...box(368, 9, 136, 46), visible: false }, actionSigil: { ...box(494, 20, 20, 25), visible: false },
    grip: box(8, 25, 14, 34, 20), art: box(31, 14, 58, 58),
    title: box(102, 10, 168, 23, 16), type: box(276, 13, 72, 17, 10),
    description: box(102, 37, 280, 33, 11), manaIcon: box(406, 11, 38, 38), manaValue: box(406, 11, 38, 38, 19),
    staminaIcon: box(458, 11, 38, 38), staminaValue: box(458, 11, 38, 38, 19), inspect: box(406, 55, 64, 20, 10), count: box(478, 55, 30, 20, 11),
  } };
}

/** A box kept inside the row, with no negative size. */
export function clampBox(value, row) {
  const width = Math.min(row.width, Math.max(LIMITS.minBox, value.width));
  const height = Math.min(row.height, Math.max(LIMITS.minBox, value.height));
  return { ...value, width, height, x: Math.max(0, Math.min(row.width - width, value.x)), y: Math.max(0, Math.min(row.height - height, value.y)) };
}

/** Parse and check a version 1 row. Throws with the first problem, so a refused import says why. */
export function validateRow(input) {
  if (!input || input.version !== 1 || !input.row || !input.elements) throw new Error('Expected a version 1 card row layout.');
  const finite = (v, [lo, hi], label) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`${label} must be between ${lo} and ${hi}.`); return v; };
  const row = { width: finite(input.row.width, LIMITS.width, 'Row width'), height: finite(input.row.height, LIMITS.height, 'Row height') };
  if (Object.keys(input.elements).length !== COMPONENTS.length || Object.keys(input.elements).some((id) => !COMPONENTS.includes(id))) throw new Error(`The layout must contain all ${COMPONENTS.length} known components.`);
  if (input.snap !== undefined && typeof input.snap !== 'boolean') throw new Error('Snap must be true or false.');
  const elements = {};
  for (const id of COMPONENTS) {
    const item = input.elements[id];
    if (!item || typeof item.visible !== 'boolean') throw new Error(`${LABELS[id]} needs a visibility setting.`);
    elements[id] = clampBox({
      x: finite(item.x, [0, row.width], `${id} X`), y: finite(item.y, [0, row.height], `${id} Y`),
      width: finite(item.width, [LIMITS.minBox, row.width], `${id} width`), height: finite(item.height, [LIMITS.minBox, row.height], `${id} height`),
      fontSize: finite(item.fontSize, LIMITS.fontSize, `${id} font size`), visible: item.visible,
    }, row);
  }
  return { version: 1, row, grid: finite(input.grid ?? 4, LIMITS.grid, 'Grid size'), snap: input.snap !== false, elements };
}

/** The JSON a Copy or Download carries: the same version 1 form the import reads. */
export const rowJson = (row) => JSON.stringify(row, null, 2) + '\n';

/** The canvas document: the row, and one item per component in the reference's order. Hidden components are drawn hidden. */
export function toCanvasDoc(row) {
  const items = COMPONENTS.map((id, z) => {
    const b = row.elements[id];
    return { id, x: b.x, y: b.y, w: b.width, h: b.height, z, label: LABELS[id], hidden: !b.visible, data: { kind: 'component', fontSize: b.fontSize } };
  });
  return { width: row.row.width, height: row.row.height, items };
}

/** Take the canvas's boxes and visibility back into the row. Returns the same object when nothing moved. */
export function fromCanvasDoc(row, doc) {
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  let changed = false;
  const elements = { ...row.elements };
  for (const id of COMPONENTS) {
    const it = byId.get(id);
    if (!it) continue;
    const next = clampBox({ ...row.elements[id], x: it.x, y: it.y, width: it.w, height: it.h, visible: !it.hidden }, row.row);
    const old = row.elements[id];
    if (next.x !== old.x || next.y !== old.y || next.width !== old.width || next.height !== old.height || next.visible !== old.visible) {
      elements[id] = next; changed = true;
    }
  }
  return changed ? { ...row, elements } : row;
}

/** One value of one component, checked the way the reference tool checked it. Returns the next row or throws. */
export function setField(row, id, field, value) {
  if (!COMPONENTS.includes(id)) throw new Error(`no component "${id}"`);
  if (field === 'visible') { if (typeof value !== 'boolean') throw new Error('Visible must be true or false.'); }
  else if (!['x', 'y', 'width', 'height', 'fontSize'].includes(field)) throw new Error(`${id} has no ${field}`);
  else if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Enter a finite number.');
  const next = { ...row.elements[id], [field]: field === 'fontSize' ? Math.max(LIMITS.fontSize[0], Math.min(LIMITS.fontSize[1], value)) : value };
  return { ...row, elements: { ...row.elements, [id]: clampBox(next, row.row) } };
}

/** The row's own size, clamped to its limits, with every component kept inside it. */
export function setSize(row, { width, height }) {
  const size = { width: Math.max(LIMITS.width[0], Math.min(LIMITS.width[1], width)), height: Math.max(LIMITS.height[0], Math.min(LIMITS.height[1], height)) };
  const elements = Object.fromEntries(COMPONENTS.map((id) => [id, clampBox(row.elements[id], size)]));
  return { ...row, row: size, elements };
}
