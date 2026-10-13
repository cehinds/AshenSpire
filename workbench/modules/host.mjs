// workbench/modules/host.mjs — DOM-free helpers the Workbench host uses for
// native modules: per-module prefs, the #mod=<id>&… deep link, and preview
// overrides. See workbench/modules/README.md for the contract.

export const PREFS_PREFIX = 'wb.mod.';

/** Per-module preferences in localStorage 'wb.mod.<id>'. Never throws. */
export function createModulePrefs(id, storage = null) {
  const key = `${PREFS_PREFIX}${id}`;
  const read = () => {
    try {
      const v = JSON.parse(storage?.getItem(key) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  };
  return {
    get(name, fallback) { const v = read(); return Object.prototype.hasOwnProperty.call(v, name) ? v[name] : fallback; },
    set(name, value) {
      const v = read(); v[name] = value;
      try { storage?.setItem(key, JSON.stringify(v)); } catch { /* private window: the pref lasts this visit */ }
      return value;
    },
    all() { return read(); },
  };
}

/** '#mod=data&table=cards' -> { mod: 'data', params: { table: 'cards' } }, or null without mod. */
export function parseHash(hash) {
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const mod = q.get('mod');
  if (!mod) return null;
  q.delete('mod');
  return { mod, params: Object.fromEntries(q) };
}

/** The inverse of parseHash: hashFor('data', { table: 'cards' }) -> '#mod=data&table=cards'. */
export function hashFor(id, params = {}) {
  const q = new URLSearchParams({ mod: id });
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null) q.set(k, String(v));
  return `#${q}`;
}

/** Adds ?wb.<key>=<value> for each preview override (a null value is dropped). */
export function withPreviewOverrides(url, overrides = {}) {
  const entries = Object.entries(overrides || {}).filter(([, v]) => v !== undefined && v !== null);
  if (!url || !entries.length) return url;
  const u = new URL(url, 'http://127.0.0.1/');
  for (const [k, v] of entries) u.searchParams.set(`wb.${k}`, String(v));
  return /^https?:\/\//.test(url) ? u.toString() : `${u.pathname}${u.search}${u.hash}`;
}

/**
 * Matches a save to the server's build of it. A save queues a build; the hub then sends
 * 'reload' (or 'reload-failed') naming the files it built and startedAt, when the build's batch
 * was fixed. add(paths, sentAt) records a save sent at sentAt (before its response) and
 * returns { type, data } when a matching build event already arrived (the event can beat the
 * save's response); event(type, data) returns { type, data } when it settles a waiting save, else null.
 * A build answers a save only when it started at or after the save was sent, so an older
 * build's reload never settles a newer save. Events that match nothing are kept for windowMs,
 * for that race; waiting saves expire after expireMs.
 */
export function createReloadWaiter({ now = () => Date.now(), windowMs = 1500, expireMs = 120000 } = {}) {
  const waiting = [];
  const recent = [];
  const touches = (paths, files) => Array.isArray(files) && files.some((f) => paths.has(f));
  const answers = (startedAt, sentAt) => Number.isFinite(startedAt) && startedAt >= sentAt;
  const prune = (t) => {
    for (let i = waiting.length - 1; i >= 0; i--) if (t - waiting[i].at > expireMs) waiting.splice(i, 1);
    for (let i = recent.length - 1; i >= 0; i--) if (t - recent[i].at > windowMs) recent.splice(i, 1);
  };
  return {
    add(paths, sentAt = now()) {
      const set = new Set((Array.isArray(paths) ? paths : []).map(String));
      if (!set.size) return null;
      const t = now();
      prune(t);
      const i = recent.findIndex((e) => touches(set, e.files) && answers(e.startedAt, sentAt));
      if (i >= 0) { const [hit] = recent.splice(i, 1); return { type: hit.type, data: hit.data }; }
      waiting.push({ paths: set, sentAt, at: t });
      return null;
    },
    event(type, data) {
      const t = now();
      prune(t);
      const files = Array.isArray(data?.files) ? data.files : [];
      const startedAt = data?.startedAt;
      const settled = waiting.filter((w) => touches(w.paths, files) && answers(startedAt, w.sentAt));
      if (settled.length) {
        for (const w of settled) waiting.splice(waiting.indexOf(w), 1);
        return { type, data };
      }
      recent.push({ type, files, startedAt, at: t, data });
      return null;
    },
    get pending() { return waiting.length; },
  };
}

/**
 * What the preview does for one build event. saved is true when the event settled a save.
 * A reload happens at most once per event: for a saved file's build, or for any build with auto-reload on.
 */
export function buildAction(type, saved, { auto = false } = {}) {
  return {
    reload: type === 'reload' && Boolean(saved || auto),
    failed: type === 'reload-failed' && Boolean(saved),
  };
}
