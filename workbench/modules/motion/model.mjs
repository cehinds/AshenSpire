// workbench/modules/motion/model.mjs — the pure model behind Motion Studio: timeline
// maths, frame selection, the deep link, the library filter, the presentation-project
// file (pose files) with a byte-exact round trip, the edit operations and the mapping
// between anchors and the canvas kit's document. No DOM and no src/ imports: the
// render page (render.mjs, game origin) draws with the game's own model, and this
// file is tested by workbench/tests/motion-model.test.mjs.
//
// Pose file = a presentation project (schemaVersion 1): id, name, actor, duration (ms),
// poses (5–7 frame names), anchors (normalized [x,y] per anchor), clips (effects with
// cue, offset, duration, anchor, x/y/size/opacity/rotation/layer/travel/muted), bindings,
// dependencies and assets (embedded 'pose:<name>' images). The limits mirror
// content/config/ui/presentation/presentationSequence.json (behavior.limits).

export const FPS = 30;
export const FRAME_MS = 1000 / FPS;
export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
export const FACINGS = ['right', 'left'];
export const SIZES = { small: 0.5, medium: 0.75, large: 1 };
export const BACKGROUNDS = ['checker', 'plain', 'combat'];
export const ANCHOR_NAMES = ['hand', 'weapon', 'shield', 'torso', 'feet', 'target', 'ground'];
export const REF = { width: 1000, height: 600 };
export const LIMITS = {
  durationMs: [100, 30000], poses: [5, 7], clips: 100, bindings: 100,
  offsetMs: [-30000, 30000], clipDurationMs: [60, 30000], x: [-1000, 1000], y: [-600, 600],
  size: [20, 800], rotationDeg: [-360, 360],
};
const SCHEMA = 1;
const LAYERS = ['front', 'behind', 'aura'];

const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------------------
// Timeline maths. Times are milliseconds from 0 to the project's duration.

export function clampTime(t, duration) {
  return clamp(num(t, 0), 0, Math.max(0, num(duration, 0)));
}

/** The pose frame showing at time t: the index the game's sample() picks (floor, clamped). */
export function poseIndexAt(count, duration, t) {
  if (!count) return 0;
  return clamp(Math.floor((clampTime(t, duration) / duration) * count), 0, count - 1);
}

/** The time a pose frame starts. */
export function poseStart(count, duration, index) {
  return (clamp(index, 0, count - 1) * duration) / count;
}

/** One frame (1/30 s) earlier or later, clamped to the project. dir is -1 or 1. */
export function stepFrame(t, dir, duration) {
  return clampTime(num(t, 0) + (dir < 0 ? -FRAME_MS : FRAME_MS), duration);
}

/** The start of the previous or next pose frame; a step past either end stays put. */
export function stepPose(count, duration, t, dir) {
  const index = poseIndexAt(count, duration, t);
  const target = clamp(index + (dir < 0 ? -1 : 1), 0, count - 1);
  return poseStart(count, duration, target);
}

/**
 * Moves the playhead by dtMs at the given speed. With loop it wraps; without, it stops at
 * the end. Returns { time, ended } where ended is true when a non-looping run reached the end.
 */
export function advance(t, dtMs, { duration, speed = 1, loop = true } = {}) {
  const next = num(t, 0) + Math.max(0, num(dtMs, 0)) * num(speed, 1);
  if (loop && duration > 0) return { time: next % duration, ended: false };
  if (next >= duration) return { time: duration, ended: true };
  return { time: next, ended: false };
}

/** The neighbours of the current pose frame, for onion skin: null at either end. */
export function onionNeighbours(count, duration, t) {
  const index = poseIndexAt(count, duration, t);
  return {
    index,
    prev: index > 0 ? index - 1 : null,
    next: index < count - 1 ? index + 1 : null,
  };
}

/** Where each pose frame starts on the timeline, as fractions of the duration. */
export function poseTicks(count, duration) {
  if (!count || !duration) return [];
  return Array.from({ length: count }, (_, index) => ({ index, at: index / count }));
}

/** A clip's start in ms: the cue's fraction of the duration plus its offset (the game's startTime). */
export function clipStart(clip, duration, cues = {}) {
  return (num(cues[clip.cue], 0) * duration) + num(clip.offset, 0);
}

/** A clip's bar on the timeline as left/width fractions, clipped to the project. */
export function clipBar(clip, duration, cues = {}) {
  if (!duration) return { left: 0, width: 0 };
  const start = clipStart(clip, duration, cues);
  const left = clamp(start / duration, 0, 1);
  const right = clamp((start + num(clip.duration, 0)) / duration, 0, 1);
  return { left, width: Math.max(0, right - left) };
}

// ---------------------------------------------------------------------------
// Deep link: #mod=motion&class=…&outfit=…&anim=…&frame=…  (frame is a pose index, 0-based).

export function parseMotionLink(params = {}) {
  const get = (k) => (params instanceof URLSearchParams ? params.get(k) : params[k]);
  const text = (k) => {
    const v = get(k);
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null;
  };
  const frame = get('frame');
  const n = typeof frame === 'string' && /^\d{1,3}$/.test(frame) ? Number(frame) : null;
  return { class: text('class'), outfit: text('outfit'), anim: text('anim'), frame: n };
}

/** The params a link carries (empty values are left out), in a stable order. */
export function motionLinkOf(state = {}) {
  const out = new URLSearchParams();
  if (state.class) out.set('class', state.class);
  if (state.outfit) out.set('outfit', state.outfit);
  if (state.anim) out.set('anim', state.anim);
  if (Number.isInteger(state.frame) && state.frame >= 0) out.set('frame', String(state.frame));
  return out.toString();
}

// ---------------------------------------------------------------------------
// Library: every class, outfit, stance and animation set.

export const LIBRARY_KINDS = ['all', 'class', 'outfit', 'stance', 'animation'];

/**
 * Builds the library entries. classes: [{id, label}], outfits: [{id, label, classId}],
 * sets: [{path, name, actor, folder, poses, duration, stance}] (one per pose file).
 */
export function libraryEntries({ classes = [], outfits = [], sets = [] } = {}) {
  const out = [];
  for (const c of classes) out.push({ kind: 'class', id: c.id, label: c.label || c.id, classId: c.id, sub: 'Class' });
  for (const o of outfits) out.push({ kind: 'outfit', id: o.id, label: o.label || o.id, classId: o.classId || o.id, sub: `Outfit of ${o.classId || o.id}` });
  for (const s of sets) {
    out.push({
      kind: s.stance ? 'stance' : 'animation', id: s.path, label: s.name || s.path, classId: s.actor || null,
      sub: `${s.stance ? 'Stance' : 'Animation set'} · ${s.poses ?? '?'} poses`, path: s.path,
    });
  }
  return out;
}

/** Filters entries by kind, class and a search over label, id, class and sub-line. */
export function filterLibrary(entries = [], { q = '', kind = 'all', classId = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return entries.filter((e) => {
    if (kind && kind !== 'all' && e.kind !== kind) return false;
    if (classId && e.classId !== classId) return false;
    if (!needle) return true;
    return [e.label, e.id, e.classId, e.sub].some((v) => String(v || '').toLowerCase().includes(needle));
  });
}

// ---------------------------------------------------------------------------
// Pose files: parse, validate, and serialize byte-exactly.

/** Parses a pose file. Returns { project, original, problems }; project is null when the JSON is unreadable. */
export function parsePoseFile(text) {
  let project = null;
  try { project = JSON.parse(text); } catch (err) {
    return { project: null, original: text, problems: [`Not JSON: ${err.message}`] };
  }
  return { project, original: text, problems: checkProject(project) };
}

/** The problems that would stop the game reading a project (a subset of the game's validate()). */
export function checkProject(p) {
  const problems = [];
  if (!isObj(p)) return ['Not a project object'];
  if (p.schemaVersion !== SCHEMA) problems.push('Unsupported schemaVersion');
  if (typeof p.id !== 'string' || !p.id) problems.push('Project needs an id');
  if (typeof p.name !== 'string') problems.push('Project needs a name');
  if (typeof p.actor !== 'string' || !p.actor) problems.push('Project needs an actor');
  if (!(typeof p.duration === 'number' && p.duration >= LIMITS.durationMs[0] && p.duration <= LIMITS.durationMs[1])) problems.push('Duration out of range');
  if (!Array.isArray(p.poses) || p.poses.length < LIMITS.poses[0] || p.poses.length > LIMITS.poses[1] || p.poses.some((x) => typeof x !== 'string')) problems.push('Poses need 5 to 7 names');
  if (!isObj(p.anchors)) problems.push('Anchors missing');
  else for (const [name, pair] of Object.entries(p.anchors)) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((n) => typeof n !== 'number' || n < 0 || n > 1)) problems.push(`Anchor ${name} is not a normalized pair`);
  }
  if (!Array.isArray(p.clips)) problems.push('Clips missing');
  if (!Array.isArray(p.bindings)) problems.push('Bindings missing');
  if (!isObj(p.assets) && p.assets !== undefined) problems.push('Assets must be an object');
  return problems;
}

/**
 * The file text for a project. Unchanged projects return the original bytes exactly. A changed
 * project is written as JSON with non-ASCII escaped as \uXXXX (the style of the shipped pose files),
 * keeping the original's trailing whitespace.
 */
export function serializePoseFile(project, original) {
  if (typeof original === 'string' && original.length) {
    const parsed = JSON.parse(original);
    if (JSON.stringify(parsed) === JSON.stringify(project)) return original;
  }
  const body = JSON.stringify(project).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const tail = typeof original === 'string' ? original.slice(original.trimEnd().length) : '';
  return body + tail;
}

/** True when the project differs from the file it was read from. */
export function isDirty(original, project) {
  if (typeof original !== 'string' || !original.length) return false;
  return serializePoseFile(project, original) !== original;
}

// ---------------------------------------------------------------------------
// Edit operations. Each returns a new project and leaves the input untouched.

const copy = (p) => JSON.parse(JSON.stringify(p));
export const snap = (v, step) => (step > 0 ? Math.round(v / step) * step : v);

export function setAnchor(project, name, [x, y]) {
  const next = copy(project);
  if (!isObj(next.anchors) || !Array.isArray(next.anchors[name])) throw new Error(`No anchor ${name}`);
  next.anchors[name] = [round(clamp(x, 0, 1)), round(clamp(y, 0, 1))];
  return next;
}

const CLIP_FIELDS = {
  x: LIMITS.x, y: LIMITS.y, size: LIMITS.size, opacity: [0, 1], rotation: LIMITS.rotationDeg,
  offset: LIMITS.offsetMs, duration: LIMITS.clipDurationMs,
};

/** Sets numeric clip fields (x, y, size, opacity, rotation, offset, duration), clamped to the limits. */
export function setClipFields(project, id, patch = {}) {
  const next = copy(project);
  const clip = next.clips.find((c) => c.id === id);
  if (!clip) throw new Error(`No effect ${id}`);
  for (const [key, value] of Object.entries(patch)) {
    if (CLIP_FIELDS[key]) {
      const [lo, hi] = CLIP_FIELDS[key];
      clip[key] = key === 'opacity' ? round(clamp(num(value, clip[key]), lo, hi), 2) : Math.round(clamp(num(value, clip[key]), lo, hi));
    } else if (key === 'layer' && LAYERS.includes(value)) clip.layer = value;
    else if ((key === 'travel' || key === 'muted') && typeof value === 'boolean') clip[key] = value;
  }
  return next;
}

/** Moves a clip's placement by reference-pixel offsets from its anchor. */
export function moveClip(project, id, x, y) {
  return setClipFields(project, id, { x, y });
}

const CUE_NAMES = ['anticipation', 'release', 'contact', 'recovery'];
const ANCHOR_FOR_NEW = 'torso';

/**
 * Adds an effect clip at the playhead's cue, on the torso anchor, with the game's default
 * timing (a 200 ms burst at the contact cue). Returns { project, id }.
 */
export function addClip(project, effect, { cue = 'contact', anchor = ANCHOR_FOR_NEW } = {}) {
  if (typeof effect !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(effect)) throw new Error('Effect IDs are letters, digits and . _ : -');
  if (!CUE_NAMES.includes(cue)) throw new Error(`Unknown cue ${cue}`);
  if (!isObj(project.anchors) || !Array.isArray(project.anchors[anchor])) throw new Error(`No anchor ${anchor}`);
  if (project.clips.length >= LIMITS.clips) throw new Error(`A project holds at most ${LIMITS.clips} effects`);
  const next = copy(project);
  const taken = new Set(next.clips.map((c) => c.id));
  let n = next.clips.length + 1, id = `effect-${effect}-${n}`;
  while (taken.has(id)) { n += 1; id = `effect-${effect}-${n}`; }
  next.clips.push({ id, effect, cue, offset: 0, duration: 200, anchor, x: 0, y: 0, size: 160, opacity: 1, rotation: 0, layer: 'front', travel: false, muted: false });
  return { project: next, id };
}

/** Removes an effect clip. Unknown IDs throw, so a stale selection cannot silently do nothing. */
export function removeClip(project, id) {
  if (!project.clips.some((c) => c.id === id)) throw new Error(`No effect ${id}`);
  const next = copy(project);
  next.clips = next.clips.filter((c) => c.id !== id);
  return next;
}

/** The bindings as read-only rows: which card or object triggers which effects. */
export function bindingRows(project) {
  return (project.bindings || []).map((b) => ({
    id: b.id, name: b.name || b.id, provider: b.provider, kind: b.kind, objectId: b.objectId || '', event: b.event,
    tags: [...(b.all || []).map((t) => t), ...(b.any || []).map((t) => `any ${t}`), ...(b.none || []).map((t) => `not ${t}`)],
    enabled: b.enabled !== false, priority: b.priority ?? 0,
  }));
}

/** Changes the pose names' frame count is not supported (the poses are the animation's keys); this only renames a pose frame. */
export function renamePose(project, index, name) {
  const next = copy(project);
  if (!Array.isArray(next.poses) || !next.poses[index]) throw new Error('No such pose');
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(name)) throw new Error('Pose names are letters, digits and . _ : -');
  next.poses[index] = name;
  return next;
}

// ---------------------------------------------------------------------------
// The canvas kit view of a project: anchors and clip positions as items on a
// REF-sized page. Anchor items are handles centred on the anchor; clip items are
// handles centred on the clip's position (anchor + x/y in reference pixels).

export const HANDLE = 24;

export function canvasDocOf(project) {
  const items = [];
  for (const name of Object.keys(project.anchors || {})) {
    const [ax, ay] = project.anchors[name];
    const cx = ax * REF.width, cy = ay * REF.height;
    items.push({ id: `anchor:${name}`, x: cx - HANDLE / 2, y: cy - HANDLE / 2, w: HANDLE, h: HANDLE, z: 2, label: name, data: { kind: 'anchor', name } });
  }
  for (const clip of project.clips || []) {
    const [ax, ay] = project.anchors?.[clip.anchor] || [0.5, 0.5];
    const cx = ax * REF.width + clip.x, cy = ay * REF.height + clip.y;
    items.push({ id: `clip:${clip.id}`, x: cx - HANDLE / 2, y: cy - HANDLE / 2, w: HANDLE, h: HANDLE, z: 1, label: clip.effect || clip.id, data: { kind: 'clip', id: clip.id } });
  }
  return { width: REF.width, height: REF.height, items };
}

/** Applies the canvas document's item positions back to the project (anchors and clip offsets). */
export function applyCanvasDoc(project, doc) {
  let next = copy(project);
  for (const item of doc.items || []) {
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    if (item.id.startsWith('anchor:')) {
      const name = item.id.slice(7);
      if (Array.isArray(next.anchors?.[name])) next = setAnchor(next, name, [cx / REF.width, cy / REF.height]);
    } else if (item.id.startsWith('clip:')) {
      const clip = next.clips.find((c) => `clip:${c.id}` === item.id);
      if (!clip) continue;
      const [ax, ay] = next.anchors?.[clip.anchor] || [0.5, 0.5];
      next = moveClip(next, clip.id, Math.round(cx - ax * REF.width), Math.round(cy - ay * REF.height));
    }
  }
  return next;
}

/** A library-free summary of what a save would change: the changed top-level fields. */
export function changedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((k) => k !== 'assets' && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
}

export { isObj };
