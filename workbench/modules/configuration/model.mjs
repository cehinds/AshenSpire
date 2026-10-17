// workbench/modules/configuration/model.mjs — the Configuration studio's DOM-free model.
//
// Profile files: which games/ashenspire JSON files the picker offers.
// (Module listing, schema fields and draft editing are added below.)

export const GAME_DIR = 'games/ashenspire';

/**
 * The profile files among repo paths: game.json, every presets/*.json and every bundles/<name>/bundle.json
 * (game.lock.json and everything else is left out). `resolves` is true for the author profiles the game-profile
 * resolver validates (game.json and presets); a bundle gets JSON validation only.
 */
export function profileFiles(paths = []) {
  const out = [];
  for (const path of paths) {
    const p = String(path);
    let m;
    if (p === `${GAME_DIR}/game.json`) out.push({ path: p, group: 'Game', label: 'Product core', resolves: true, rank: 0, name: 'game' });
    else if ((m = /^games\/ashenspire\/presets\/([\w.-]+)\.json$/.exec(p))) out.push({ path: p, group: 'Presets', label: `Preset ${m[1]}`, resolves: true, rank: 1, name: m[1] });
    else if ((m = /^games\/ashenspire\/bundles\/([\w.-]+)\/bundle\.json$/.exec(p))) out.push({ path: p, group: 'Bundles', label: `Bundle ${m[1]}`, resolves: false, rank: 2, name: m[1] });
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(({ rank, name, ...rest }) => rest);
}

// ---------- modules ----------

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const MODULES_DIR = 'engine/modules';

/** The engine modules among repo paths (one per module.json), sorted by id, each with its file paths. */
export function moduleFiles(paths = []) {
  const ids = new Set();
  for (const p of paths) {
    const m = /^engine\/modules\/([\w.-]+)\/module\.json$/.exec(String(p));
    if (m) ids.add(m[1]);
  }
  return [...ids].sort().map((id) => ({
    id,
    manifest: `${MODULES_DIR}/${id}/module.json`,
    defaults: `${MODULES_DIR}/${id}/defaults.json`,
    schema: `${MODULES_DIR}/${id}/settings.schema.json`,
    guide: `${MODULES_DIR}/${id}/guide.md`,
  }));
}

/** A listing row from a parsed module.json (any shape: missing parts become empty strings). */
export function moduleEntry(id, manifest, guide = '') {
  const m = isObject(manifest) ? manifest : {};
  return { id, name: String(m.name || m.title || id), description: String(m.description || m.summary || guideSummary(guide)), version: String(m.version || '') };
}

/** The first prose line of a guide.md after its heading ('' when there is none). */
export function guideSummary(guide) {
  for (const line of String(guide || '').split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith('#') && !t.startsWith('```')) return t;
  }
  return '';
}

/**
 * What the author JSON says about a module: 'off' (false), 'on' (true or a settings object) or 'inherit' (no entry,
 * the bundle decides). `settings` is the author's override object, `{}` when there is none.
 */
export function authorState(author, id) {
  const entry = isObject(author) && isObject(author.modules) ? author.modules[id] : undefined;
  if (entry === false) return { state: 'off', settings: {} };
  if (entry === undefined || entry === null) return { state: 'inherit', settings: {} };
  return { state: 'on', settings: isObject(entry) ? entry : {} };
}

/**
 * Form fields for a settings.schema.json: one per property. kind is 'string' | 'number' | 'boolean' | 'enum', or
 * 'json' (shown read-only) for anything else. A schema that is not an object with properties gives no fields.
 */
export function schemaFields(schema, defaults) {
  const props = isObject(schema) && isObject(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema?.required) ? schema.required : []);
  const dflt = isObject(defaults) ? defaults : {};
  const prim = (v) => ['string', 'number', 'boolean'].includes(typeof v);
  return Object.entries(props).map(([key, spec]) => {
    const s = isObject(spec) ? spec : {};
    const field = { key, kind: 'json', description: typeof s.description === 'string' ? s.description : '', required: required.has(key), default: dflt[key] };
    if (Array.isArray(s.enum) && s.enum.length && s.enum.every(prim)) return { ...field, kind: 'enum', options: s.enum };
    if (s.type === 'boolean') return { ...field, kind: 'boolean' };
    if (s.type === 'string') return { ...field, kind: 'string' };
    if (s.type === 'number' || s.type === 'integer') return { ...field, kind: 'number', integer: s.type === 'integer', min: s.minimum, max: s.maximum };
    return field;
  });
}

/** An editable field's raw input -> { ok, value } or { ok: false, error }. '' clears the override (value undefined). */
export function parseFieldValue(field, raw) {
  if (raw === '' || raw === undefined || raw === null) return { ok: true, value: undefined };
  if (field.kind === 'boolean') return { ok: true, value: raw === true || raw === 'true' };
  if (field.kind === 'string') return { ok: true, value: String(raw) };
  if (field.kind === 'enum') {
    const hit = field.options.find((o) => String(o) === String(raw));
    return hit === undefined ? { ok: false, error: `${raw} is not one of the allowed values` } : { ok: true, value: hit };
  }
  if (field.kind === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `${raw} is not a number` };
    if (field.integer && !Number.isInteger(n)) return { ok: false, error: 'Needs a whole number' };
    if (typeof field.min === 'number' && n < field.min) return { ok: false, error: `Minimum is ${field.min}` };
    if (typeof field.max === 'number' && n > field.max) return { ok: false, error: `Maximum is ${field.max}` };
    return { ok: true, value: n };
  }
  return { ok: false, error: 'This setting is edited in the JSON above' };
}

const toText = (doc) => `${JSON.stringify(doc, null, 2)}\n`;
function parseAuthor(draft) {
  const doc = JSON.parse(draft);
  if (!isObject(doc)) throw Error('Profile JSON must be an object.');
  if (doc.modules !== undefined && !isObject(doc.modules)) throw Error('"modules" must be an object.');
  if (doc.modules === undefined) doc.modules = {};
  return doc;
}

/** The draft text with modules.<id> switched on or off. Off writes `false`; on turns a `false` into `true`. Throws on bad JSON. */
export function setModuleEnabled(draft, id, enabled) {
  const doc = parseAuthor(draft);
  const entry = doc.modules[id];
  if (!enabled) doc.modules[id] = false;
  else if (entry === false || entry === undefined || entry === null) doc.modules[id] = true;
  return toText(doc);
}

/**
 * The draft text with modules.<id>.<key> set (value undefined removes it). A module that is off must be switched on
 * first (throws). A `true` or missing entry becomes a settings object; an object left empty goes back to `true`
 * (or is dropped when it was missing). Throws on bad JSON.
 */
export function setModuleSetting(draft, id, key, value) {
  const doc = parseAuthor(draft);
  const before = doc.modules[id];
  if (before === false) throw Error(`${id} is off in this profile: switch it on first.`);
  const entry = isObject(before) ? before : {};
  if (value === undefined) delete entry[key]; else entry[key] = value;
  if (Object.keys(entry).length) doc.modules[id] = entry;
  else if (before === undefined || before === null) delete doc.modules[id];
  else doc.modules[id] = true;
  return toText(doc);
}
