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

// ---------------------------------------------------------------------------
// Geometry: the game's formation, as src/ui/models/CombatFormationModel.js
// computes it for a battlefield (no preview, no fixed slots). Its numbers are
// the same as content/config/ui/presentation/combatFormationModel.json's grid
// block and src/model/formationLayout.js; the layout tests fail on drift.
// ---------------------------------------------------------------------------

export const FORMATION_ROWS = 'ABCDEF';
export const GRID = Object.freeze({
  slantFraction: 0.19, cellFraction: 0.78, fieldDepthFraction: 0.49, bottomClearanceFraction: 0.12,
  tileWidthFraction: 0.62, tileRowFraction: 0.5,
});
/** The numeric fields the Battlefield mode edits, with the game's limits (formationLayout.js FORMATION_FIELDS). */
export const FIELDS = Object.freeze([
  { key: 'formationColumns', label: 'Columns per side', min: 1, max: 3, def: 2, step: 1, integer: true },
  { key: 'formationRows', label: 'Rows per side', min: 1, max: 6, def: 2, step: 1, integer: true },
  { key: 'formationWidth', label: 'Width', min: 40, max: 100, def: 80, step: 1, integer: true, suffix: '%' },
  { key: 'formationDepth', label: 'Depth', min: 30, max: 100, def: 60, step: 1, integer: true, suffix: '%' },
  { key: 'formationGap', label: 'Team gap', min: 4, max: 30, def: 12, step: 1, integer: true, suffix: '%' },
  { key: 'groundTilt', label: 'Tilt', min: 0, max: 65, def: 35, step: 1, integer: true, suffix: '°' },
  { key: 'groundSkew', label: 'Skew', min: -35, max: 35, def: 15, step: 1, integer: true, suffix: '°' },
]);
export const PRESETS = Object.freeze(['straight', 'forward-slant', 'back-slant', 'classic-v']);
export const SNAP_STEP_PX = 50;

/** formationLayoutConfig: the values clamped to the game's limits. */
export function formationConfig(values = {}) {
  const config = { ...values };
  config.formationPreset = PRESETS.includes(values.formationPreset) ? values.formationPreset : 'straight';
  for (const f of FIELDS) {
    const number = Number(values[f.key] ?? f.def);
    config[f.key] = Number.isFinite(number) ? Math.round(Math.min(f.max, Math.max(f.min, number))) : f.def;
  }
  return config;
}

const member = (cell) => `${cell.side}:${cell.row}:${cell.column}`;

/** formationGroups(): the saved groups, sanitized the way the game reads them. */
export function sanitizeGroups(raw) {
  let list = raw;
  if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 32).filter((g) => g && typeof g.id === 'string').map((g) => ({
    id: g.id.slice(0, 60), name: String(g.name || g.id).slice(0, 60),
    members: Array.isArray(g.members) ? [...new Set(g.members.filter((m) => /^(player|enemy):[0-5]:[0-2]$/.test(m)))].slice(0, 36) : [],
    x: Number.isFinite(g.x) ? Math.max(-100, Math.min(100, g.x)) : 0,
    y: Number.isFinite(g.y) ? Math.max(-100, Math.min(100, g.y)) : 0,
    ...(Number.isFinite(g.scale) ? { scale: Math.max(0.25, Math.min(3, g.scale)) } : {}),
  }));
}

export function groupContains(group, cell) {
  return group.id === 'all' || group.id === cell.side
    || group.id === `row-${cell.row}` || group.id === `${cell.side}-row-${cell.row}`
    || group.id === `cell-${member(cell)}`
    || group.id === `${cell.side}-column-${cell.column}` || group.members.includes(member(cell));
}

/** applyFormationGroups(): translations (percent of the battlefield) applied parent-first, clamped per group. */
export function applyGroups(cells, groups, width, height) {
  const order = (g) => (g.id === 'all' ? 3 : ['player', 'enemy'].includes(g.id) ? 2 : g.id.includes('-column-') ? 1 : 0);
  for (const group of sanitizeGroups(groups).sort((a, b) => order(a) - order(b))) {
    const members = cells.filter((c) => groupContains(group, c));
    if (!members.length) continue;
    const dx = Math.max(-Math.min(...members.map((c) => c.x)), Math.min(width - Math.max(...members.map((c) => c.x)), width * group.x / 100));
    const dy = Math.max(-Math.min(...members.map((c) => c.ground)), Math.min(height - Math.max(...members.map((c) => c.ground)), height * group.y / 100));
    for (const cell of members) {
      cell.x += dx; cell.ground += dy;
      cell.characterScale = (cell.characterScale || 1) * (group.scale || 1);
    }
  }
  return cells;
}

/**
 * The battlefield geometry for a presentation (the layout's values) at width × height:
 * one entry per slot, { cell, side, row, column, x, ground, characterScale }.
 */
export function battlefieldGeometry(presentation, { width, height, footerClearance = 0 }) {
  const config = formationConfig(presentation);
  const { formationColumns: columns, formationRows: rows } = config;
  const footprint = width * config.formationWidth / 100;
  const gap = footprint * config.formationGap / 100;
  const span = (footprint - gap) / 2;
  const inset = (width - footprint) / 2;
  const slant = config.formationPreset === 'straight' || rows === 1 ? 0 : span * GRID.slantFraction;
  const pitch = (span - slant) / columns;
  const cellWidth = pitch * GRID.cellFraction;
  const depth = height * GRID.fieldDepthFraction * config.formationDepth / 100;
  const lastFoot = height - Math.max(footerClearance, height * GRID.bottomClearanceFraction);
  const firstFoot = lastFoot - depth;
  const rowSpacing = depth / Math.max(1, rows - 1);
  const tileHeight = Math.min(pitch * GRID.tileWidthFraction, (rows === 1 ? depth : rowSpacing) * GRID.tileRowFraction);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    const progress = rows === 1 ? 0.5 : row / (rows - 1);
    for (const enemy of [false, true]) for (let column = 0; column < columns; column++) {
      const front = column === columns - 1;
      const band = front ? 'front' : 'back';
      let shift = 0;
      if (config.formationPreset === 'classic-v') shift = progress * slant;
      if (config.formationPreset === 'forward-slant') shift = (enemy ? progress : 1 - progress) * slant;
      if (config.formationPreset === 'back-slant') shift = (enemy ? 1 - progress : progress) * slant;
      const distance = Math.max(cellWidth / 2, Math.min(width / 2 - cellWidth / 2,
        inset + pitch * (column + 0.5) + shift + (config[`${band}OffsetX`] || 0)));
      const ground = Math.max(tileHeight / 2, Math.min(height - tileHeight / 2,
        (rows === 1 ? lastFoot - depth / 2 : firstFoot + progress * depth) + (config[`${band}OffsetY`] || 0)));
      cells.push({
        cell: `${FORMATION_ROWS[row]}${enemy ? columns * 2 - column : column + 1}`,
        side: enemy ? 'enemy' : 'player', row, column,
        x: enemy ? width - distance : distance, ground, characterScale: 1,
      });
    }
  }
  return applyGroups(cells, config.formationGroups, width, height);
}

// ---------------------------------------------------------------------------
// Edits. Every edit returns a new presets object; the input is not changed, and
// only the entries it names are replaced, so the other values keep their bytes.
// A slot moves through its own group ("cell-side:row:column"), which the game
// applies after the section and row offsets, so a px move is exact.
// ---------------------------------------------------------------------------

const round = (v) => Math.round(v * 1e6) / 1e6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The group id that moves one slot. */
export const slotGroupId = (cell) => `cell-${cell.side}:${cell.row}:${cell.column}`;

/** A readable name for a slot group, as the game's group menu words it. */
export function slotGroupName(cell) {
  const col = cell.side === 'player' ? cell.column + 1 : (cell.columns ?? 2) * 2 - cell.column;
  return `${cell.side} · position ${FORMATION_ROWS[cell.row]}${col}`;
}

/**
 * Set a group's offset (percent of the battlefield) and/or scale. The group is
 * replaced in place when it exists, or appended when it does not.
 */
export function withGroup(data, key, groupId, patch, { name = groupId } = {}) {
  const layout = data[key];
  if (!layout || !layout.presentation) throw Error(`${key} has no presentation`);
  const list = Array.isArray(layout.presentation.formationGroups) ? layout.presentation.formationGroups : [];
  const at = list.findIndex((g) => g && g.id === groupId);
  const current = at >= 0 ? list[at] : { id: groupId, name, members: [], x: 0, y: 0, scale: 1 };
  const next = { ...current };
  if (patch.x !== undefined) next.x = round(clamp(patch.x, -100, 100));
  if (patch.y !== undefined) next.y = round(clamp(patch.y, -100, 100));
  if (patch.scale !== undefined) next.scale = round(clamp(patch.scale, 0.25, 3));
  const groups = at >= 0 ? list.map((g, i) => (i === at ? next : g)) : [...list, next];
  return { ...data, [key]: { ...layout, presentation: { ...layout.presentation, formationGroups: groups } } };
}

/** Move slots by px: each slot's own group takes the move, as a percent of the battlefield. */
export function moveSlots(data, key, moves, { width, height }) {
  let next = data;
  for (const m of moves) {
    if (!m.dx && !m.dy) continue;
    const group = (next[key].presentation.formationGroups || []).find((g) => g && g.id === m.groupId);
    const x = (group?.x || 0) + (m.dx / width) * 100;
    const y = (group?.y || 0) + (m.dy / height) * 100;
    next = withGroup(next, key, m.groupId, { x, y }, { name: m.name });
  }
  return next;
}

/** Set one of the layout's numeric fields (clamped to the game's limits) or its preset. */
export function withField(data, key, field, value) {
  const layout = data[key];
  if (!layout || !layout.presentation) throw Error(`${key} has no presentation`);
  const spec = FIELDS.find((f) => f.key === field);
  let v = value;
  if (field === 'formationPreset') { if (!PRESETS.includes(value)) throw Error(`unknown preset ${value}`); }
  else {
    if (!spec) throw Error(`${field} is not a Battlefield field`);
    v = Number(value);
    if (!Number.isFinite(v)) throw Error(`${field} needs a number`);
    v = clamp(Math.round(v), spec.min, spec.max);
  }
  return { ...data, [key]: { ...layout, presentation: { ...layout.presentation, [field]: v } } };
}

/**
 * The layout's supplied anchors follow its presentation. The repo's test requires each
 * anchor to be what the game computes from the presentation, so an edit to a layout
 * refreshes that layout's anchors. A value that did not move keeps its bytes; a layout
 * whose presentation did not change is returned as it is. `prev` is the data before the edit.
 */
export function refreshAnchors(data, key, prev = null) {
  const layout = data[key];
  if (!layout || !Array.isArray(layout.anchors) || !layout.battlefield) return data;
  if (prev && prev[key] && JSON.stringify(prev[key].presentation) === JSON.stringify(layout.presentation)) return data;
  const { width, height } = layout.battlefield;
  const cells = battlefieldGeometry(layout.presentation, { width, height });
  const keep = (old, value) => (Number.isFinite(old) && Math.abs(old - value) < 1e-9 ? old : value);
  const anchors = layout.anchors.map((a) => {
    const c = cells.find((x) => x.cell === a.cell);
    if (!c) return a;
    return { ...a,
      left: keep(a.left, c.x), right: keep(a.right, width - c.x),
      top: keep(a.top, c.ground), bottom: keep(a.bottom, height - c.ground),
      characterScale: keep(a.characterScale, c.characterScale) };
  });
  return { ...data, [key]: { ...layout, anchors } };
}

/**
 * Align the cells on one edge: left, center, right (x) or top, middle, bottom (ground).
 * Returns [{ id, dx, dy }] in px; a cell already on the edge gets 0.
 */
export function alignDeltas(cells, edge) {
  const xs = cells.map((c) => c.x), gs = cells.map((c) => c.ground);
  const target = {
    left: Math.min(...xs), center: (Math.min(...xs) + Math.max(...xs)) / 2, right: Math.max(...xs),
    top: Math.min(...gs), middle: (Math.min(...gs) + Math.max(...gs)) / 2, bottom: Math.max(...gs),
  }[edge];
  if (target === undefined || !Number.isFinite(target)) throw Error(`unknown edge ${edge}`);
  const horizontal = ['left', 'center', 'right'].includes(edge);
  return cells.map((c) => (horizontal ? { id: c.id, dx: target - c.x, dy: 0 } : { id: c.id, dx: 0, dy: target - c.ground }));
}

/**
 * Distribute the cells evenly along an axis, the first and last kept in place.
 * Returns [{ id, dx, dy }] in px.
 */
export function distributeDeltas(cells, axis) {
  const key = axis === 'horizontal' ? 'x' : 'ground';
  const sorted = [...cells].sort((a, b) => a[key] - b[key]);
  const n = sorted.length;
  if (n < 3) return cells.map((c) => ({ id: c.id, dx: 0, dy: 0 }));
  const first = sorted[0][key], last = sorted[n - 1][key];
  const step = (last - first) / (n - 1);
  const moves = new Map(sorted.map((c, i) => [c.id, first + step * i - c[key]]));
  return cells.map((c) => {
    const d = moves.get(c.id);
    return axis === 'horizontal' ? { id: c.id, dx: d, dy: 0 } : { id: c.id, dx: 0, dy: d };
  });
}
