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
