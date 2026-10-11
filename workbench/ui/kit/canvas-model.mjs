// workbench/ui/kit/canvas-model.mjs — the pure editing model behind every
// Workbench canvas (Layout Studio modes, Motion stage). No DOM: canvas.mjs is
// the view over it, and workbench/tests/canvas-kit.test.mjs tests it.
//
// Document: { width, height, safeArea?: {top,right,bottom,left}, items: [Item] }
// Item:     { id, x, y, w, h, rot?, z, locked, hidden, group?, parent?, label, data }
//
// Rules the ops share:
//   - locked items are selectable and hit-testable, but move, resize, nudge and
//     geometry edits leave them where they are (they still anchor align/distribute).
//   - hidden items are never hit, marqueed or snapped to.
//   - rotation is kept on the item; geometry (hit, snap, marquee) uses the axis-
//     aligned box x/y/w/h.
//   - every mutating op returns { doc, change, ...extras }. `change` is
//     { label, undo(doc), redo(doc) }: undo and redo return a fresh copy of the
//     doc before or after the op, so one gesture is one History step and the
//     restore is exact regardless of the doc passed in.

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * The zoom at which a document fits a view: the view minus the stage padding on each
 * axis, clamped to the zoom range and rounded DOWN to 3 decimals so the page never
 * overflows the view by a pixel. The rulers sit outside the view, so they are not
 * subtracted here.
 */
export function fitZoom({ viewW, viewH, docW, docH, pad = 0, minZoom = 0.1, maxZoom = 4 }) {
  const z = Math.min((viewW - 2 * pad) / docW, (viewH - 2 * pad) / docH);
  const clamped = Math.min(maxZoom, Math.max(minZoom, Number.isFinite(z) ? z : minZoom));
  return Math.floor(clamped * 1000) / 1000;
}
export const EDGES = ['left', 'center', 'right', 'top', 'middle', 'bottom'];
export const NUDGE = { small: 1, large: 10 };
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const GEOMETRY = ['x', 'y', 'w', 'h', 'rot'];

export const clone = (value) => JSON.parse(JSON.stringify(value));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function normalizeItem(raw, index) {
  if (!isObj(raw) || raw.id === undefined || raw.id === null || raw.id === '') throw new Error(`canvas item ${index} needs an id`);
  const it = clone(raw);
  it.id = String(raw.id);
  it.x = num(raw.x);
  it.y = num(raw.y);
  it.w = Math.max(0, num(raw.w));
  it.h = Math.max(0, num(raw.h));
  if (raw.rot !== undefined) it.rot = num(raw.rot);
  it.z = num(raw.z, index);
  it.locked = raw.locked === true;
  it.hidden = raw.hidden === true;
  if (raw.group === null || raw.group === undefined || raw.group === '') delete it.group; else it.group = String(raw.group);
  if (raw.parent === null || raw.parent === undefined || raw.parent === '') delete it.parent; else it.parent = String(raw.parent);
  it.label = raw.label === null || raw.label === undefined ? it.id : String(raw.label);
  it.data = isObj(raw.data) ? raw.data : {};
  return it;
}

/** Normalise a raw document. Throws on a missing or duplicate item id. */
export function createDocument(raw = {}) {
  const doc = { width: num(raw.width, 800), height: num(raw.height, 600) };
  if (isObj(raw.safeArea)) doc.safeArea = { top: num(raw.safeArea.top), right: num(raw.safeArea.right), bottom: num(raw.safeArea.bottom), left: num(raw.safeArea.left) };
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [];
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.id)) throw new Error(`duplicate canvas item id "${it.id}"`);
    seen.add(it.id);
  }
  doc.items = items;
  return doc;
}

export const byId = (doc, id) => doc.items.find((it) => it.id === id) || null;

/** Items bottom to top. Equal z keeps document order. Returns live references. */
export function sortedByZ(doc) {
  return doc.items.map((it, i) => ({ it, i })).sort((a, b) => a.it.z - b.it.z || a.i - b.i).map((o) => o.it);
}

/** Union box of items: { x, y, w, h }. */
export function boundsOf(items) {
  if (!items.length) return null;
  const x0 = Math.min(...items.map((it) => it.x)), y0 = Math.min(...items.map((it) => it.y));
  const x1 = Math.max(...items.map((it) => it.x + it.w)), y1 = Math.max(...items.map((it) => it.y + it.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const pick = (doc, ids) => { const want = new Set(ids || []); return doc.items.filter((it) => want.has(it.id)); };
const inScope = (it, scope) => scope === null || scope === undefined || it.group === scope;

/** Ids of items a marquee or Ctrl+A may select: not hidden, inside the scope. */
export function selectableIds(doc, { scope = null } = {}) {
  return doc.items.filter((it) => !it.hidden && inScope(it, scope)).map((it) => it.id);
}

/** Selection with every group member of the given ids added (a group is one unit). */
export function expandSelection(doc, ids) {
  const want = new Set(ids || []);
  const groups = new Set();
  for (const it of doc.items) if (want.has(it.id) && it.group) groups.add(it.group);
  return doc.items.filter((it) => want.has(it.id) || (it.group && groups.has(it.group))).map((it) => it.id);
}

/** Unique id from a set of taken ids: base, then base-2, base-3 … */
function uniqueId(taken, base) {
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

/** A change record: undo and redo restore the exact doc before or after the op. */
export function makeChange(label, before, after) {
  const b = clone(before), a = clone(after);
  return { label, undo: () => clone(b), redo: () => clone(a) };
}

const sameDoc = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const done = (label, before, next, extra = {}) => ({ doc: next, change: makeChange(label, before, next), ...extra });

// ---------------------------------------------------------------------------
// Snapping (ported from ui-studio snapRect)
// ---------------------------------------------------------------------------

const nearestGuide = (v, guides, threshold) => {
  let best = null, dist = Infinity;
  for (const g of guides) {
    const d = Math.abs(g - v);
    if (d <= threshold && d < dist) { best = g; dist = d; }
  }
  return best;
};

const snapStep = (v, step, threshold) => {
  if (!(step > 0)) return v;
  const s = Math.round(v / step) * step;
  return Math.abs(s - v) <= threshold ? s : v;
};

/**
 * snapRect(rect, { mode, grid, threshold, guidesX, guidesY }) → { rect, guides }
 *   mode: 'move' (keep size) or a handle name (n, s, e, w, ne, nw, se, sw).
 *   grid: { enabled, size, subdivisions } — grid step is size / subdivisions.
 *   Guide lines outrank the grid; the nearest candidate within threshold wins.
 *   guides: [{ axis: 'x'|'y', at }] for the view to draw (deduplicated).
 */
export function snapRect(rect, opts = {}) {
  const { mode = 'move', grid = null, threshold = 6, guidesX = [], guidesY = [] } = opts;
  const step = grid && grid.enabled && grid.size > 0 ? grid.size / Math.max(1, grid.subdivisions || 1) : 0;
  const hits = [];
  let { x, y, w, h } = rect;
  if (mode === 'move') {
    // Leading edge, trailing edge, centre per axis. A guide hit outranks a grid
    // hit; among equals the smaller move wins, the leading edge on a tie.
    const pick1 = (positions, guides, axis) => {
      const cands = positions.map((v) => {
        const g = nearestGuide(v, guides, threshold);
        if (g !== null) return { delta: g - v, guide: { axis, at: g } };
        return { delta: snapStep(v, step, threshold) - v, guide: null };
      }).filter((c) => c.delta !== 0 || c.guide);
      const pool = cands.some((c) => c.guide) ? cands.filter((c) => c.guide) : cands;
      if (!pool.length) return { delta: 0, guide: null };
      return pool.reduce((a, b) => (Math.abs(b.delta) < Math.abs(a.delta) ? b : a));
    };
    const dx = pick1([x, x + w, x + w / 2], guidesX, 'x');
    const dy = pick1([y, y + h, y + h / 2], guidesY, 'y');
    x += dx.delta; y += dy.delta;
    if (dx.guide) hits.push(dx.guide);
    if (dy.guide) hits.push(dy.guide);
  } else {
    // Only the edges the handle moves are snapped; the opposite edge stays put.
    const snapEdge = (v, guides, axis) => {
      const g = nearestGuide(v, guides, threshold);
      if (g !== null) { hits.push({ axis, at: g }); return g; }
      return snapStep(v, step, threshold);
    };
    if (mode.includes('w')) { const nx = snapEdge(x, guidesX, 'x'); w += x - nx; x = nx; }
    if (mode.includes('e')) { w = snapEdge(x + w, guidesX, 'x') - x; }
    if (mode.includes('n')) { const ny = snapEdge(y, guidesY, 'y'); h += y - ny; y = ny; }
    if (mode.includes('s')) { h = snapEdge(y + h, guidesY, 'y') - y; }
  }
  const seen = new Set();
  const guides = hits.filter((g) => { const k = `${g.axis}${g.at}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { rect: { x, y, w: Math.max(1, w), h: Math.max(1, h) }, guides };
}

/** Guide lines the document offers: viewport edges and centre, safe area, item edges and centres. */
export function snapGuides(doc, { exclude = [], viewport = true, items = true, safeArea = true } = {}) {
  const guidesX = [], guidesY = [];
  if (viewport) {
    guidesX.push(0, doc.width / 2, doc.width);
    guidesY.push(0, doc.height / 2, doc.height);
    const s = doc.safeArea;
    if (safeArea && s) {
      if (s.left) guidesX.push(s.left);
      if (s.right) guidesX.push(doc.width - s.right);
      if (s.top) guidesY.push(s.top);
      if (s.bottom) guidesY.push(doc.height - s.bottom);
    }
  }
  if (items) {
    const skip = new Set(exclude);
    for (const it of doc.items) {
      if (it.hidden || skip.has(it.id)) continue;
      guidesX.push(it.x, it.x + it.w / 2, it.x + it.w);
      guidesY.push(it.y, it.y + it.h / 2, it.y + it.h);
    }
  }
  return { guidesX, guidesY };
}

/** Snap options for snapRect from a view-level config, excluding the moving ids. */
export function snapOptions(doc, snap, exclude = []) {
  const s = snap || {};
  const g = s.grid || {};
  return {
    grid: { enabled: !!g.enabled, size: num(g.size, 0), subdivisions: Math.max(1, num(g.subdivisions, 1)) },
    threshold: num(s.threshold, 6),
    ...snapGuides(doc, { exclude, viewport: s.viewport !== false, items: s.items !== false, safeArea: s.safeArea !== false }),
  };
}

// ---------------------------------------------------------------------------
// Hit testing and marquee
// ---------------------------------------------------------------------------

/**
 * Topmost visible item under a point (doc coordinates), or null. Locked items
 * are hit unless includeLocked is false. `scope` is a group id to drill into:
 * only that group's members can be hit.
 */
export function hitTest(doc, point, { scope = null, includeLocked = true } = {}) {
  const list = sortedByZ(doc);
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    if (it.hidden || !inScope(it, scope)) continue;
    if (it.locked && !includeLocked) continue;
    if (point.x >= it.x && point.x <= it.x + it.w && point.y >= it.y && point.y <= it.y + it.h) return it.id;
  }
  return null;
}

/**
 * Ids inside a marquee rect { x, y, w, h } (negative w/h allowed).
 * mode 'intersect' (default) selects any overlap; 'contain' only full containment.
 * Hidden items are skipped; locked items are selected.
 */
/** True when a selection change from `before` to `after` is a real change (both arrays of ids, in order). */
export function selectionChanged(before, after) {
  return JSON.stringify(before ?? []) !== JSON.stringify(after ?? []);
}

export function marqueeHit(doc, rect, { mode = 'intersect', scope = null } = {}) {
  const x0 = Math.min(rect.x, rect.x + rect.w), x1 = Math.max(rect.x, rect.x + rect.w);
  const y0 = Math.min(rect.y, rect.y + rect.h), y1 = Math.max(rect.y, rect.y + rect.h);
  return doc.items.filter((it) => {
    if (it.hidden || !inScope(it, scope)) return false;
    if (mode === 'contain') return it.x >= x0 && it.x + it.w <= x1 && it.y >= y0 && it.y + it.h <= y1;
    return it.x < x1 && it.x + it.w > x0 && it.y < y1 && it.y + it.h > y0;
  }).map((it) => it.id);
}

// ---------------------------------------------------------------------------
// Move, nudge, resize
// ---------------------------------------------------------------------------

/**
 * Move the unlocked ids by (dx, dy). With `snap` (a view snap config) the
 * moved bounds snap to guides and grid first; the result carries the snapped
 * delta (dx, dy) and the guides to draw. Pass snap: null for free movement.
 */
export function moveSelection(doc, ids, dx, dy, { snap = null } = {}) {
  const next = clone(doc);
  const movers = pick(next, ids).filter((it) => !it.locked);
  let ddx = num(dx), ddy = num(dy), guides = [];
  if (movers.length && snap) {
    const b = boundsOf(movers);
    const moved = { x: b.x + ddx, y: b.y + ddy, w: b.w, h: b.h };
    const sn = snapRect(moved, { mode: 'move', ...snapOptions(doc, snap, movers.map((m) => m.id)) });
    ddx += sn.rect.x - moved.x;
    ddy += sn.rect.y - moved.y;
    guides = sn.guides;
  }
  for (const it of movers) { it.x += ddx; it.y += ddy; }
  return done(movers.length > 1 ? `Move ${movers.length} items` : 'Move', doc, next, { dx: ddx, dy: ddy, guides });
}

/** Nudge the unlocked ids one step (NUDGE.small, or NUDGE.large when `large`). */
export function nudge(doc, ids, dir, { large = false } = {}) {
  const d = DIRS[dir];
  if (!d) throw new Error(`unknown nudge direction "${dir}"`);
  const step = large ? NUDGE.large : NUDGE.small;
  const r = moveSelection(doc, ids, d[0] * step, d[1] * step);
  return { ...r, change: makeChange(`Nudge ${dir}`, doc, r.doc) };
}

/**
 * Resize one unlocked item by a handle, moved by (dx, dy) in doc px.
 *   shift: keep the aspect ratio (corners follow the larger relative change).
 *   alt:   resize from the centre (the opposite side mirrors).
 *   snap:  a view snap config; the moving edges snap to guides and grid.
 * Returns { doc, change, guides }.
 */
export function resizeItem(doc, id, handle, dx, dy, { shift = false, alt = false, snap = null, minSize = 1 } = {}) {
  const next = clone(doc);
  const it = byId(next, id);
  if (!it || it.locked || !HANDLES.includes(handle)) return done('Resize', doc, next, { guides: [] });
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const r0 = { x: it.x, y: it.y, w: it.w, h: it.h };
  const cx = r0.x + r0.w / 2, cy = r0.y + r0.h / 2;
  const k = alt ? 2 : 1;
  const place = (w, h) => ({
    x: alt || sx === 0 ? cx - w / 2 : sx > 0 ? r0.x : r0.x + r0.w - w,
    y: alt || sy === 0 ? cy - h / 2 : sy > 0 ? r0.y : r0.y + r0.h - h,
    w,
    h,
  });
  let w = Math.max(minSize, r0.w + sx * k * dx);
  let h = Math.max(minSize, r0.h + sy * k * dy);
  let guides = [];
  if (snap) {
    const sn = snapRect(place(w, h), { mode: handle, ...snapOptions(doc, snap, [id]) });
    guides = sn.guides;
    if (alt) {
      if (sx) w = 2 * (sx > 0 ? sn.rect.x + sn.rect.w - cx : cx - sn.rect.x);
      if (sy) h = 2 * (sy > 0 ? sn.rect.y + sn.rect.h - cy : cy - sn.rect.y);
    } else {
      if (sx) w = sn.rect.w;
      if (sy) h = sn.rect.h;
    }
    w = Math.max(minSize, w);
    h = Math.max(minSize, h);
  }
  if (shift && r0.w > 0 && r0.h > 0) {
    const a = r0.w / r0.h;
    if (sx && sy) {
      if (Math.abs(w - r0.w) / r0.w >= Math.abs(h - r0.h) / r0.h) h = w / a; else w = h * a;
    } else if (sx) h = w / a;
    else if (sy) w = h * a;
    w = Math.max(minSize, w);
    h = Math.max(minSize, h);
  }
  Object.assign(it, place(w, h));
  return done(`Resize ${it.label}`, doc, next, { guides });
}

// ---------------------------------------------------------------------------
// Align and distribute
// ---------------------------------------------------------------------------

/**
 * Align the ids to an edge: left, center, right, top, middle, bottom.
 * The reference is `anchor` (an item id) when given, else the selection's
 * bounds, else the viewport for a single item. Locked items never move, so a
 * locked anchor stays where it is and the rest line up on it.
 */
export function align(doc, ids, edge, { anchor = null } = {}) {
  if (!EDGES.includes(edge)) throw new Error(`unknown align edge "${edge}"`);
  const next = clone(doc);
  const sel = pick(next, ids);
  if (sel.length) {
    const ref = anchor !== null && anchor !== undefined ? byId(next, anchor) : null;
    const src = ref ? { x: ref.x, y: ref.y, w: ref.w, h: ref.h }
      : sel.length === 1 ? { x: 0, y: 0, w: next.width, h: next.height }
        : boundsOf(sel);
    for (const it of sel) {
      if (it.locked) continue;
      if (edge === 'left') it.x = src.x;
      else if (edge === 'center') it.x = src.x + src.w / 2 - it.w / 2;
      else if (edge === 'right') it.x = src.x + src.w - it.w;
      else if (edge === 'top') it.y = src.y;
      else if (edge === 'middle') it.y = src.y + src.h / 2 - it.h / 2;
      else it.y = src.y + src.h - it.h;
    }
  }
  return done(`Align ${edge}`, doc, next);
}

/**
 * Distribute with equal gaps on an axis ('horizontal' or 'vertical'). The
 * outermost items and locked items are fixed; each run of movable items
 * between fixed neighbours is spaced evenly. Fewer than three items: no change.
 */
export function distribute(doc, ids, axis) {
  if (axis !== 'horizontal' && axis !== 'vertical') throw new Error(`unknown distribute axis "${axis}"`);
  const next = clone(doc);
  const key = axis === 'horizontal' ? 'x' : 'y';
  const size = axis === 'horizontal' ? 'w' : 'h';
  const sel = pick(next, ids).sort((a, b) => a[key] - b[key]);
  const n = sel.length;
  if (n >= 3) {
    const fixed = (i) => i === 0 || i === n - 1 || sel[i].locked;
    let i = 1;
    while (i < n - 1) {
      if (fixed(i)) { i += 1; continue; }
      let j = i;
      while (!fixed(j)) j += 1;
      const L = sel[i - 1], R = sel[j];
      const run = sel.slice(i, j);
      const used = run.reduce((s, it) => s + it[size], 0);
      const gap = (R[key] - (L[key] + L[size]) - used) / (run.length + 1);
      let cur = L[key] + L[size] + gap;
      for (const it of run) { it[key] = cur; cur += it[size] + gap; }
      i = j + 1;
    }
  }
  return done(`Distribute ${axis}`, doc, next);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** Put the ids into one new group (needs two or more). Returns { groupId } too. */
export function group(doc, ids, { id = null } = {}) {
  const next = clone(doc);
  const sel = pick(next, ids);
  let groupId = null;
  if (sel.length >= 2) {
    const taken = new Set([...next.items.map((it) => it.id), ...next.items.map((it) => it.group).filter(Boolean)]);
    groupId = id ? String(id) : uniqueId(taken, 'group');
    for (const it of sel) it.group = groupId;
  }
  return done(`Group ${sel.length}`, doc, next, { groupId });
}

/** Ungroup every group the ids belong to. Members keep no `group` key afterwards. */
export function ungroup(doc, ids) {
  const next = clone(doc);
  const groups = new Set(pick(next, ids).map((it) => it.group).filter(Boolean));
  for (const it of next.items) if (it.group && groups.has(it.group)) delete it.group;
  return done('Ungroup', doc, next);
}

// ---------------------------------------------------------------------------
// Z-order
// ---------------------------------------------------------------------------

/**
 * Reorder ids: 'front', 'back', 'forward' (one step up), 'backward' (one step
 * down). The set of z values is kept; the items trade places in it.
 */
export function reorder(doc, ids, dir) {
  if (!['front', 'back', 'forward', 'backward'].includes(dir)) throw new Error(`unknown z-order "${dir}"`);
  const next = clone(doc);
  const want = new Set(ids || []);
  const isSel = (it) => want.has(it.id);
  const order = sortedByZ(next);
  const zs = order.map((it) => it.z);
  let arr = order.slice();
  if (dir === 'front') arr = [...arr.filter((i) => !isSel(i)), ...arr.filter(isSel)];
  else if (dir === 'back') arr = [...arr.filter(isSel), ...arr.filter((i) => !isSel(i))];
  else if (dir === 'forward') {
    for (let i = arr.length - 2; i >= 0; i--) if (isSel(arr[i]) && !isSel(arr[i + 1])) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
  } else {
    for (let i = 1; i < arr.length; i++) if (isSel(arr[i]) && !isSel(arr[i - 1])) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
  }
  arr.forEach((it, i) => { it.z = zs[i]; });
  return done(`Arrange ${dir}`, doc, next);
}

/**
 * Place one item above or below another in the stack (layers-panel drag).
 * 'above' means a higher z than the target.
 */
export function stackMove(doc, id, targetId, placement = 'above') {
  const next = clone(doc);
  const order = sortedByZ(next);
  const zs = order.map((it) => it.z);
  const from = order.findIndex((it) => it.id === id);
  if (from < 0 || id === targetId) return done('Move layer', doc, next);
  const [moving] = order.splice(from, 1);
  let to = order.findIndex((it) => it.id === targetId);
  if (to < 0) return done('Move layer', doc, next);
  if (placement === 'above') to += 1;
  order.splice(to, 0, moving);
  order.forEach((it, i) => { it.z = zs[i]; });
  return done('Move layer', doc, next);
}

// ---------------------------------------------------------------------------
// Duplicate, delete, update
// ---------------------------------------------------------------------------

/**
 * Copy the ids offset by (dx, dy), on top, in their z order. A group whose
 * members were all copied is copied as a new group; partial groups are not.
 * Returns { ids } of the copies.
 */
export function duplicate(doc, ids, { dx = 10, dy = 10 } = {}) {
  const next = clone(doc);
  const want = new Set(ids || []);
  const src = sortedByZ(next).filter((it) => want.has(it.id));
  const taken = new Set([...next.items.map((it) => it.id), ...next.items.map((it) => it.group).filter(Boolean)]);
  const members = new Map();
  for (const it of next.items) if (it.group) members.set(it.group, [...(members.get(it.group) || []), it.id]);
  const groupMap = new Map();
  for (const [g, ms] of members) if (ms.every((m) => want.has(m))) groupMap.set(g, uniqueId(taken, 'group'));
  const top = next.items.length ? Math.max(...next.items.map((it) => it.z)) : 0;
  const copies = src.map((it, k) => {
    const c = clone(it);
    c.id = uniqueId(taken, `${it.id}-copy`);
    c.x += num(dx);
    c.y += num(dy);
    c.z = top + 1 + k;
    if (it.group && groupMap.has(it.group)) c.group = groupMap.get(it.group);
    else delete c.group;
    return c;
  });
  next.items.push(...copies);
  return done(`Duplicate ${copies.length}`, doc, next, { ids: copies.map((c) => c.id) });
}

/** Delete the ids. */
export function removeItems(doc, ids) {
  const next = clone(doc);
  const drop = new Set(ids || []);
  const before = next.items.length;
  next.items = next.items.filter((it) => !drop.has(it.id));
  return done(`Delete ${before - next.items.length}`, doc, next);
}

/**
 * Patch the ids. Top-level keys: x y w h rot (skipped on locked items), label,
 * z, locked, hidden. `data` merges shallowly into item.data.
 */
export function updateItems(doc, ids, patch = {}, { label = 'Edit' } = {}) {
  const next = clone(doc);
  for (const it of pick(next, ids)) {
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'data') { if (isObj(v)) it.data = { ...it.data, ...v }; continue; }
      if (GEOMETRY.includes(k)) {
        if (it.locked) continue;
        it[k] = k === 'w' || k === 'h' ? Math.max(1, num(v, it[k])) : num(v, it[k]);
        continue;
      }
      if (k === 'locked' || k === 'hidden') it[k] = v === true;
      else if (k === 'label') it.label = String(v);
      else if (k === 'z') it.z = num(v, it.z);
      else throw new Error(`unknown canvas field "${k}"`);
    }
  }
  return done(label, doc, next);
}
