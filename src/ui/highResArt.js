// src/ui/highResArt.js — Settings → Display → Art quality: lay a local high-res
// art source over the built-in art (LFS / art-tier plan, step 4, 2026-09-26).
//
// The built-in art is whatever this build carries: the light tier on dev/test,
// the full art on release/main. "Local high-res" swaps in full-resolution files
// the player has, from one of two places:
//
//   · a folder served next to the game — `hd/art-manifest.json` beside
//     AshenSpire.html, listing the files under `hd/` (the unpacked high-res
//     release). Found automatically over http(s); file:// cannot fetch it.
//   · a folder the player picks — any build, file:// included. The browser
//     hands over its files for this page's lifetime only, so a reload asks
//     again; the choice of tier itself is remembered.
//
// Either way the result is a Map from asset id (the runtime `assets/…` path) to
// a loadable URL, holding only the files that exist. src/ui/assetmap.js consults
// it first and falls back to the built-in art for every id it lacks, so a
// partial folder is never a broken screen. The setting is per-device
// (DEVICE_KEYS in src/model/settingsSync.js): a folder on this machine means
// nothing on another.

import { setHighResSource, assetUrl, ASSET_MAP } from './assetmap.js';

export const ART_QUALITY_KEY = 'artQuality';
export const ART_BUILT_IN = 'Built-in';
export const ART_LOCAL_HIGH = 'Local high-res';
export const ART_QUALITY_CHOICES = Object.freeze([ART_BUILT_IN, ART_LOCAL_HIGH]);
/** Where a high-res folder served next to the game lives, relative to the page. */
export const SERVED_HD_BASE = 'hd/';

let picked = null;   // Map from the folder the player picked this session
let served = null;   // Map from `hd/` beside the game, when found
let status = '';
let current = null;  // the Map assetmap.js holds now, to tell a change from a no-op
let onChange = null;

/**
 * onArtSourceChange(fn) — called with the new covered count whenever the source
 * assetmap.js resolves through changes. main.js drops the pose preloads, which
 * are keyed by pose rather than URL and would otherwise keep the old art.
 * Images already on screen keep theirs until that screen is drawn again.
 */
export function onArtSourceChange(fn) { onChange = typeof fn === 'function' ? fn : null; }

/** True when the setting asks for high-res art. */
export function wantsHighRes(settings) {
  return (settings || {})[ART_QUALITY_KEY] === ART_LOCAL_HIGH;
}

/**
 * The asset id a picked file stands for, or null. A release unpacks as
 * `<folder>/assets/…`; the player may pick the folder itself or its parent, so
 * the id starts at the first `assets/` segment of the file's relative path.
 */
export function idForRelativePath(relPath) {
  const parts = String(relPath || '').split(/[\\/]/).filter(Boolean);
  const at = parts.indexOf('assets');
  return at < 0 || at === parts.length - 1 ? null : parts.slice(at).join('/');
}

/**
 * highResFromFiles(files, { manifest, toUrl }) → Map id → URL for every picked
 * file that is an asset id. With a manifest (the release's art-manifest.json)
 * only ids it lists are taken, so stray files in the folder are ignored.
 */
export function highResFromFiles(files, { manifest = null, toUrl = (f) => URL.createObjectURL(f) } = {}) {
  const known = manifest && manifest.assets ? manifest.assets : null;
  const map = new Map();
  for (const file of files || []) {
    const id = idForRelativePath(file.webkitRelativePath || file.name);
    if (!id || (known && !Object.prototype.hasOwnProperty.call(known, id))) continue;
    map.set(id, toUrl(file));
  }
  return map;
}

/**
 * highResFromManifest(manifest, base) → Map id → `<base><high.path>` for every
 * id the served manifest lists with a high-res file.
 */
export function highResFromManifest(manifest, base = SERVED_HD_BASE) {
  const map = new Map();
  for (const [id, entry] of Object.entries((manifest && manifest.assets) || {})) {
    if (entry && entry.high && entry.high.path) map.set(id, `${base}${entry.high.path}`);
  }
  return map;
}

/** Look for a high-res folder served next to the game. Never throws. */
export async function findServedHighRes({ fetchImpl = globalThis.fetch, base = SERVED_HD_BASE, protocol = globalThis.location?.protocol } = {}) {
  if (typeof fetchImpl !== 'function' || !/^https?:$/.test(String(protocol || ''))) return null;
  try {
    const res = await fetchImpl(`${base}art-manifest.json`, { cache: 'no-cache' });
    if (!res || !res.ok) return null;
    const map = highResFromManifest(await res.json(), base);
    return map.size ? map : null;
  } catch {
    return null;
  }
}

// ---- images already on the page -------------------------------------------
//
// A screen drawn before the source arrived (the served manifest is fetched
// after the first frame) or before the player changed the setting holds the
// old URLs. Rather than redraw a live screen, each <img> is traced back to its
// asset id and pointed at whatever assetUrl() says now. An id is recognised
// from any URL this page has handed out for it: the served path itself, the
// inlined data URI (the single file), or a high-res URL from an earlier source.
const urlToId = new Map();
let inlineIndexed = false;
function remember(map) {
  if (map) for (const [id, url] of map) urlToId.set(url, id);
}
function idOfUrl(url) {
  if (!url) return null;
  if (url.startsWith('assets/')) return url;
  if (!inlineIndexed) {
    inlineIndexed = true;
    for (const [id, data] of Object.entries(ASSET_MAP)) if (!urlToId.has(data)) urlToId.set(data, id);
  }
  return urlToId.get(url) || null;
}

/** refreshMountedArt(root) → how many <img> elements now point at a different tier. */
export function refreshMountedArt(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let moved = 0;
  for (const img of root.querySelectorAll('img[src]')) {
    const was = img.getAttribute('src');
    const id = idOfUrl(was);
    if (!id) continue;
    const now = assetUrl(id);
    if (now && now !== was) { img.setAttribute('src', now); moved += 1; }
  }
  return moved;
}

function publish() {
  const source = picked || served || null;
  remember(source);
  const n = setHighResSource(source);
  if (source !== current) {
    current = source;
    refreshMountedArt();
    if (onChange) try { onChange(n); } catch { /* a listener must not break the setting */ }
  }
  if (typeof document !== 'undefined') {
    for (const el of document.querySelectorAll('[data-art-status]')) el.textContent = status;
  }
  return n;
}

/**
 * applyArtQuality(settings) — called at boot and whenever settings change.
 * Built-in clears any source; Local high-res uses the picked folder, else a
 * served `hd/` folder, else nothing (and says so).
 */
export async function applyArtQuality(settings, opts = {}) {
  if (!wantsHighRes(settings)) {
    status = '';
    // Kept, not revoked: switching back to Local high-res this session reuses
    // the folder already chosen. A new pick revokes the old object URLs.
    const hadSource = current !== null;
    current = null;
    setHighResSource(null);
    if (hadSource) {
      refreshMountedArt();
      if (onChange) try { onChange(0); } catch { /* as above */ }
    }
    return 0;
  }
  if (!picked && served === null) served = await findServedHighRes(opts) || false;
  const n = (picked && picked.size) || (served && served.size) || 0;
  const from = picked ? `${n} high-res files from the folder you chose`
    : served ? `${n} high-res files served beside the game` : '';
  status = from ? `${from}; anything it lacks stays built-in.`
    : 'No high-res folder found. Choose one; anything it lacks stays built-in.';
  return publish() && n;
}

/** The status line the settings row shows. */
export function artQualityStatus() { return status; }

/**
 * pickHighResFolder(settings) — open the browser's folder picker (must run in a
 * click handler) and use what it returns. Resolves to the number of files taken.
 */
export function pickHighResFolder(settings, doc = globalThis.document) {
  return new Promise((done) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.addEventListener('change', async () => {
      const files = [...(input.files || [])];
      let manifest = null;
      const listed = files.find((f) => /(^|[\\/])art-manifest\.json$/.test(f.webkitRelativePath || f.name));
      if (listed) { try { manifest = JSON.parse(await listed.text()); } catch { manifest = null; } }
      if (picked) for (const url of picked.values()) try { URL.revokeObjectURL(url); } catch { /* already gone */ }
      picked = highResFromFiles(files, { manifest });
      if (!picked.size) picked = null;
      done(await applyArtQuality(settings));
    }, { once: true });
    input.click();
  });
}

/** For tests: forget every source this module found. */
export function resetHighResArt() {
  picked = null;
  served = null;
  status = '';
  current = null;
  onChange = null;
  urlToId.clear();
  inlineIndexed = false;
  setHighResSource(null);
}
