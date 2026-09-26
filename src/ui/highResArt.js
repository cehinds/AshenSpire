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
// partial folder is never a broken screen. The setting is per-device and never
// synced (LOCAL_ONLY_KEYS in src/model/settingsSync.js): a folder on this machine means
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
let generation = 0;       // bumped by every applyArtQuality call; a stale one does not publish
let servedPending = null; // the one in-flight look for `hd/`, shared by overlapping calls
let lastWanted = false;   // what the latest applyArtQuality call asked for
let pickRound = 0;        // bumped by every folder pick; a slower, older pick is dropped

/**
 * onArtSourceChange(fn) — called with the new covered count whenever the source
 * assetmap.js resolves through changes. main.js drops the pose preloads, which
 * are keyed by pose rather than URL and would otherwise keep the old art.
 * Images already on screen keep theirs until that screen is drawn again.
 */
export function onArtSourceChange(fn) { onChange = typeof fn === 'function' ? fn : null; }

/**
 * The same moment as a DOM event, for a screen that painted art somewhere this
 * module cannot reach — the prologue rasterises its character into a <canvas>.
 * It listens while mounted and repaints from assetUrl().
 */
export const ART_SOURCE_EVENT = 'ashen:art-source';
// Caches of frames warmed from one tier (the Reaver attack, combat effects)
// register here at module load, so a tier change starts them over.
const resetters = new Set();
export function whenArtSourceChanges(fn) { if (typeof fn === 'function') resetters.add(fn); }
function announce(n) {
  if (onChange) try { onChange(n); } catch { /* a listener must not break the setting */ }
  for (const fn of resetters) try { fn(n); } catch { /* as above */ }
  try { globalThis.document?.dispatchEvent?.(new CustomEvent(ART_SOURCE_EVENT, { detail: { covered: n } })); } catch { /* as above */ }
}

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
// The single file gives byte-identical assets one shared data URI (50 groups on
// 0.7.1, every one identical in the high tier too), so an inlined URL maps to
// all its ids and the one a source covers is taken: any of them is the same art.
const inlineIds = new Map();
let inlineIndexed = false;
function remember(map) {
  if (map) for (const [id, url] of map) urlToId.set(url, id);
}
function idOfUrl(url) {
  if (!url) return null;
  if (!inlineIndexed) {
    inlineIndexed = true;
    for (const [id, data] of Object.entries(ASSET_MAP)) {
      const list = inlineIds.get(data);
      if (list) list.push(id); else inlineIds.set(data, [id]);
    }
  }
  // A URL from an earlier source names one alias; its group is recovered from
  // that id's inlined URI, so a folder that covers only another alias still wins.
  const id = url.startsWith('assets/') ? url : urlToId.get(url) || null;
  const aliases = inlineIds.get(url) || (id && inlineIds.get(ASSET_MAP[id]));
  if (!aliases || aliases.length < 2) return id || (aliases ? aliases[0] : null);
  return aliases.find((a) => current && current.has(a)) || id || aliases[0];
}

// An <img> carries its URL in src; an SVG <image> (the environment, map and
// atlas art) in href, or xlink:href in older markup.
const XLINK = 'http://www.w3.org/1999/xlink';
function artAttr(el) {
  if (el.tagName === 'IMG') return 'src';
  if (el.hasAttribute('href')) return 'href';
  return el.hasAttributeNS?.(XLINK, 'href') ? 'xlink:href' : null;
}
function readArt(el, attr) { return attr === 'xlink:href' ? el.getAttributeNS(XLINK, 'href') : el.getAttribute(attr); }
function writeArt(el, attr, url) {
  if (attr === 'xlink:href') el.setAttributeNS(XLINK, 'xlink:href', url); else el.setAttribute(attr, url);
}

/**
 * currentArtUrl(url) — a URL this page handed out for an asset, re-resolved to
 * whatever tier assetUrl() names now; any other URL passes through. For code
 * that captured a list of frame URLs and shows them over time.
 */
export function currentArtUrl(url) {
  const id = idOfUrl(url);
  return id ? assetUrl(id) : url;
}

/** refreshMountedArt(root) → how many <img> / SVG <image> elements now point at a different tier. */
export function refreshMountedArt(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let moved = 0;
  for (const el of root.querySelectorAll('img[src], image')) {
    const attr = artAttr(el);
    if (!attr) continue;
    const was = readArt(el, attr);
    const id = idOfUrl(was);
    if (!id) continue;
    const now = assetUrl(id);
    if (now && now !== was) { writeArt(el, attr, now); moved += 1; }
  }
  return moved;
}

// ---- a served file that is missing ------------------------------------------
//
// A served `hd/` folder is listed by its manifest, not by what is on disk, so a
// partial copy maps ids to files that 404. The first image that fails to load
// from the source drops its id from it and falls back to the built-in art, and
// the event stops here, before an image's own error handler swaps in a
// placeholder: a missing high-res file is not a missing asset.
let watching = false;
const failed = new Set(); // high-res URLs that failed to load this session

/**
 * builtInFor(url) — `url` failed to load. When it is a high-res file this page
 * handed out, drop its id from the source and return the built-in URL to load
 * instead; otherwise null (a missing asset is still a missing asset). Loaders
 * that never join the document (`new Image()` painted to a canvas) call this
 * themselves, because their error events never pass the listener below.
 */
export function builtInFor(url) {
  const id = urlToId.get(url);
  if (!id) return null;
  if (current && current.get(id) === url) {
    current.delete(id);
    setHighResSource(current);
    failed.add(url);
    if (status) { describeSource(); showStatus(); }
  } else if (!failed.has(url)) return null;
  return assetUrl(id);
}
export function watchMissingFiles(doc = globalThis.document) {
  if (watching || !doc || typeof doc.addEventListener !== 'function') return;
  watching = true;
  doc.addEventListener('error', (event) => {
    const el = event.target;
    if (!el || typeof el.getAttribute !== 'function') return;
    const attr = artAttr(el);
    if (!attr) return;
    const fallback = builtInFor(readArt(el, attr));
    if (!fallback) return;
    // Every copy of that file on screen (two of the same enemy) fails too; each
    // falls back the same way, not only the first.
    event.stopPropagation();
    writeArt(el, attr, fallback);
  }, true);
}

/** False on browsers whose file picker cannot hand over a folder (phones). */
export function canPickFolder(doc = globalThis.document) {
  if (!doc || typeof doc.createElement !== 'function') return false;
  return 'webkitdirectory' in doc.createElement('input');
}

function publish() {
  const source = picked || served || null;
  remember(source);
  const n = setHighResSource(source);
  if (source !== current) {
    current = source;
    refreshMountedArt();
    announce(n);
  }
  showStatus();
  return n;
}

/**
 * applyArtQuality(settings) — called at boot and whenever settings change.
 * Built-in clears any source; Local high-res uses the picked folder, else a
 * served `hd/` folder, else nothing (and says so).
 */
export async function applyArtQuality(settings, opts = {}) {
  watchMissingFiles();
  lastWanted = wantsHighRes(settings);
  if (!wantsHighRes(settings)) {
    generation += 1;
    status = '';
    // Kept, not revoked: switching back to Local high-res this session reuses
    // the folder already chosen. A new pick revokes the old object URLs.
    const hadSource = current !== null;
    current = null;
    setHighResSource(null);
    if (hadSource) {
      refreshMountedArt();
      announce(0);
    }
    return 0;
  }
  const gen = ++generation;
  if (!picked && served === null) {
    servedPending ??= findServedHighRes(opts).then((map) => { served = map || false; servedPending = null; });
    await servedPending;
    // The player changed the setting (or picked a folder) while the manifest
    // loaded: that later call has already published, so this one must not.
    if (gen !== generation) return 0;
  }
  const n = describeSource();
  return publish() && n;
}

// The status line for the source in use, from what it covers now (a failed
// file shrinks it). Returns that count.
function describeSource() {
  // The source in use is the picked folder whenever there is one, even once
  // its last file has failed; the served folder does not stand in for it.
  const source = picked || served || null;
  const n = source ? source.size : 0;
  const files = `${n} high-res file${n === 1 ? '' : 's'}`;
  const from = !n ? '' : source === picked ? `${files} from the folder you chose` : `${files} served beside the game`;
  status = from ? `${from}; anything it lacks stays built-in.`
    : 'No high-res folder found. Choose one; anything it lacks stays built-in.';
  return n;
}
function showStatus() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  for (const el of document.querySelectorAll('[data-art-status]')) el.textContent = status;
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
      // Stamped BEFORE the manifest read (a few MB): a folder picked after
      // this one, or a switch to Built-in meanwhile, must win over it.
      const round = ++pickRound;
      const files = [...(input.files || [])];
      let manifest = null;
      const listed = files.find((f) => /(^|[\\/])art-manifest\.json$/.test(f.webkitRelativePath || f.name));
      if (listed) { try { manifest = JSON.parse(await listed.text()); } catch { manifest = null; } }
      if (round !== pickRound) { done(0); return; }
      if (picked) for (const url of picked.values()) try { URL.revokeObjectURL(url); } catch { /* already gone */ }
      picked = highResFromFiles(files, { manifest });
      if (!picked.size) picked = null;
      // The folder is kept either way; it is published only if Local
      // high-res is still what the setting asks for now, not what the
      // (possibly stale) settings object said when the picker opened.
      done(wantsHighRes(settings) && lastWanted ? await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }) : 0);
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
  generation = 0;
  servedPending = null;
  lastWanted = false;
  pickRound = 0;
  watching = false;
  failed.clear();
  urlToId.clear();
  inlineIds.clear();
  inlineIndexed = false;
  setHighResSource(null);
}
