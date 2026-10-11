// workbench/modules/layout/sketch-model.mjs — the pure model of Layout Studio's
// Sketch mode: a free wireframe over a screen for planning, saved where UI Studio
// keeps its sketches today: ui-studio/workspace/sketches/<name>.json, schema
// "ashenspire.ui-sketch/1". No DOM and no fetch.
//
// A sketch is boxes (x, y, w, h in percent or px of the device, a label, a layer,
// lock and hide flags, and per-breakpoint overrides) plus the sketch's own notes.
// The geometry rules are UI Studio's (studio-model.mjs, a byte-identical copy of
// ui-studio/model.mjs): resolveBox, boxToPx, pxToBox, applyResolvedRect.

import * as M from './studio-model.mjs';

export const SKETCH_DIR = 'ui-studio/workspace/sketches';
/** The names UI Studio's server accepts for a sketch file. */
export const SKETCH_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const sketchRel = (name) => `${SKETCH_DIR}/${name}.json`;
export const validSketchName = (name) => typeof name === 'string' && SKETCH_NAME.test(name);

/** Parse a sketch file's text. The problems are UI Studio's own (a wrong schema is refused by name). */
export function parseSketch(text) {
  const data = JSON.parse(text);
  return { data, original: text, problems: M.sketchProblems(data) };
}

/**
 * The text a sketch saves as. Unchanged parts keep their bytes (formatJson keeps the
 * original's spans), so a one-label edit is a one-line diff. A new sketch is written
 * in the same house style as UI Studio (two-space JSON and a final newline).
 */
export function serializeSketch(data, original = null) {
  const text = M.formatJson(data, { original });
  return text.endsWith('\n') ? text : `${text}\n`;
}

/** An empty sketch with UI Studio's default breakpoints. */
export const newSketch = (name) => M.newSketch({ name });

/** The next free box id: box-1, box-2 … (no ':', which UI Studio refuses). */
export function freeBoxId(sketch) {
  const used = new Set(sketch.boxes.map((b) => b.id));
  let n = 1;
  while (used.has(`box-${n}`)) n++;
  return `box-${n}`;
}

/** Add a box. Its id is free; its geometry is in the sketch's unit. */
export function addBox(sketch, { x = 10, y = 10, w = 30, h = 20, label = 'Box', layer = null } = {}) {
  const out = M.clone(sketch);
  const top = out.boxes.reduce((m, b) => Math.max(m, Number(b.layer) || 0), -1) + 1;
  const box = { id: freeBoxId(out), label, x, y, w, h, layer: layer ?? top, locked: false, hidden: false, overrides: {} };
  out.boxes.push(box);
  return { sketch: out, id: box.id };
}

/**
 * Change a box. In breakpoint scope a geometry change lands in that breakpoint's
 * override; label, layer, locked and hidden are always base values.
 */
export function updateBox(sketch, id, patch, { breakpointId = null, scope = 'base' } = {}) {
  let out = M.clone(sketch);
  const geometry = {};
  for (const k of ['x', 'y', 'w', 'h']) if (patch[k] !== undefined) geometry[k] = patch[k];
  if (Object.keys(geometry).length) out = M.updateBoxGeometry(out, id, geometry, { breakpointId, scope });
  const box = out.boxes.find((b) => b.id === id);
  if (!box) return out;
  for (const k of ['label', 'layer', 'locked', 'hidden']) if (patch[k] !== undefined) box[k] = patch[k];
  return out;
}

/** Remove boxes by id. Locked boxes stay unless `force` is set. */
export function removeBoxes(sketch, ids, { force = false } = {}) {
  const out = M.clone(sketch);
  out.boxes = out.boxes.filter((b) => !ids.includes(b.id) || (b.locked && !force));
  return out;
}

export const setNotes = (sketch, notes) => ({ ...M.clone(sketch), notes: String(notes ?? '') });

/** The breakpoint a viewport falls in, for the sketch's own breakpoints. */
export const breakpointOf = (sketch, viewport) => M.breakpointFor(sketch.breakpoints || [], viewport);

/**
 * The boxes as canvas items at a viewport: px rects of the resolved geometry at the
 * breakpoint, in layer order. Hidden boxes stay in the document with hidden set, so
 * Layers still lists them and can show them again; the canvas kit does not draw them.
 * Locked ones are locked.
 */
export function canvasItems(sketch, viewport) {
  const bp = breakpointOf(sketch, viewport);
  const bpId = bp ? bp.id : null;
  return sketch.boxes
    .map((b) => ({ box: M.resolveBox(b, bpId), base: b }))
    .map(({ box, base }) => {
      const r = M.boxToPx(box, sketch.unit, viewport);
      return { id: base.id, x: r.x, y: r.y, w: r.w, h: r.h, z: Number(base.layer) || 0, locked: Boolean(base.locked), hidden: Boolean(box.hidden), label: base.label || base.id, overridden: box.overridden };
    });
}

/**
 * Apply canvas items (after a gesture or a Layers show/hide) to the sketch. Only the
 * items whose rect or hidden flag changed are written; a rect change in breakpoint
 * scope goes to that breakpoint, and the hidden flag is a base value.
 */
export function applyCanvasItems(sketch, items, viewport, { scope = 'base' } = {}) {
  const bp = breakpointOf(sketch, viewport);
  let out = sketch;
  const before = new Map(canvasItems(sketch, viewport).map((it) => [it.id, it]));
  for (const it of items) {
    const old = before.get(it.id);
    if (!old) continue;
    if (it.hidden !== undefined && Boolean(it.hidden) !== old.hidden) out = updateBox(out, it.id, { hidden: Boolean(it.hidden) });
    if (old.x === it.x && old.y === it.y && old.w === it.w && old.h === it.h) continue;
    out = M.applyResolvedRect(out, it.id, { x: it.x, y: it.y, w: it.w, h: it.h }, viewport, {
      breakpointId: bp ? bp.id : null, scope: scope === 'breakpoint' && bp ? 'breakpoint' : 'base',
    });
  }
  return out;
}

/**
 * What the PNG export draws at a viewport, as data the page paints: the size, the
 * title, each visible box in layer order with its px rect, and the notes line by line.
 */
export function drawingFor(sketch, viewport) {
  const width = Math.round(viewport.width), height = Math.round(viewport.height);
  const rects = canvasItems(sketch, viewport).filter((it) => !it.hidden).sort((a, b) => a.z - b.z)
    .map((it) => ({ x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h), label: it.label, locked: it.locked, overridden: it.overridden }));
  const notes = String(sketch.notes || '').split('\n').filter((l) => l.trim() !== '');
  return { width, height, title: sketch.name || 'Sketch', rects, notes };
}

/** The sketch as the JSON export carries it: the file's own text when it was read from one. */
export const exportJson = (sketch, original = null) => serializeSketch(sketch, original);
