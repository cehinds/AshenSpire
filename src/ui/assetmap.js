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

/**
 * assetUrl('assets/sprites/reaver_gold.webp') → that path, or the inlined
 * data URI when the build carries one. Unknown paths pass straight through,
 * so a missing asset still 404s visibly rather than silently resolving.
 */
export function assetUrl(path) {
  return ASSET_MAP[path] || path;
}

/** True when this build carries its own art (the single-file dist). */
export function assetsAreInlined() {
  return Object.keys(ASSET_MAP).length > 0;
}
