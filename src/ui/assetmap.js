// src/ui/assetmap.js — the seam that lets the single-file build carry its art.
//
// Every rendered image is referenced by a path built at runtime
// (`assets/equipment/weapon_${id}.webp`), so no bundler can find them by
// reading the source. This map is the answer: tools/bundle.mjs REPLACES the
// empty object below with { path: 'data:image/webp;base64,...' } for every file
// under assets/, and assetUrl() prefers it.
//
// Served from a directory the map stays empty and the browser fetches files
// normally — which is what you want in development, since a 1 MB inlined blob
// would have to be re-read on every reload.
//
// This file is the ONLY place that knows the difference between the two, and
// the bundler's replacement is anchored on the exact line below.

/* ASSET_MAP_START */
export const ASSET_MAP = {};
/* ASSET_MAP_END */

// THE HIGH-RES TIER (LFS / art-tier plan, steps 3–4, 2026-09-26). An asset id
// is the runtime path above; art-manifest.json lists, per id, the file
// each tier ships. The built-in art is whatever this build carries — the light
// tier on dev/test, the full art on release/main — and a player may lay a
// high-res source over it (Settings → Display → Art quality). That source is a
// Map from id to a URL the browser can load: object URLs for a folder the
// player picked, or `hd/…` paths for a folder served next to the game. It holds
// only the files that exist, so an id it lacks falls back to the built-in art.
let highRes = null;

/**
 * setHighResSource(map) — lay a high-res source over the built-in art, or
 * remove it with null / an empty map. Returns how many ids it now covers.
 */
export function setHighResSource(map) {
  highRes = map && map.size ? map : null;
  return highRes ? highRes.size : 0;
}

/** Which tier an id resolves to right now: 'high' or 'built-in'. */
export function assetTier(path) {
  return highRes && highRes.has(path) ? 'high' : 'built-in';
}

/**
 * assetUrl('assets/sprites/reaver_gold.webp') → the high-res file when a
 * source covers it, else the inlined data URI when the build carries one, else
 * the path. Unknown paths pass straight through, so a missing asset still 404s
 * visibly rather than silently resolving.
 */
export function assetUrl(path) {
  return (highRes && highRes.get(path)) || ASSET_MAP[path] || path;
}

/** True when this build carries its own art (the single-file dist). */
export function assetsAreInlined() {
  return Object.keys(ASSET_MAP).length > 0;
}
