// src/ui/assetPacks.js — the web edition's built-in art, loaded at runtime from
// the pack index the HTML pins (docs/EXTERNAL-ASSETS-PLAN.md §3, step 3a).
//
// THE SHAPE. tools/bundle.mjs --external-art writes the game file beside a
// content-addressed store (tools/asset-pack.mjs):
//
//   AshenSpire.html
//   asset-base.json                    {"base":"./"} — where packs/ and objects/ are
//   packs/<pack>-<digest12>.json       id → [sha256, bytes, mime]
//   objects/<xx>/<sha256>.<ext>        every file, named by its bytes
//
// and stamps ASSET_PACKS below, in memory, with each index's sha256, its id,
// object and byte counts, and the build's default tier. At boot this module
// reads `asset-base.json`, fetches the default tier's index and the common
// index, checks each text against its pin (SubtleCrypto, or src/ui/sha256.js
// where the page has none), and hands src/ui/assetmap.js a Map from id to the
// object's relative path. assetUrl() then resolves through it.
//
// THE TIER FALLBACK (§3.5): high → light → placeholders. A build whose
// default is high (release/main) also carries the light pack; when the high
// index cannot be loaded or fails its hash, the light one is used. When no
// art index loads, nothing is set, every id passes through as its path, and
// the screens show their placeholders (SPEC §2.4) — the game never stops
// because an index is missing.
//
// WHAT THIS DOES NOT DO YET. Over http(s) only: file:// (the .js twins and the
// font sidecar) is step 4. CSS assets, music and map tiles are steps 3b and
// 3c. The loading line on the startup gate, the Retry notice and per-file
// high → light fallback are step 5; Settings → Art quality Auto/Light/High is
// step 8c. A single file (ASSET_MAP filled) and the source tree (nothing
// stamped) never load anything here.

import { ASSET_MAP, setBuiltInSource } from './assetmap.js';
import { sha256Hex } from './sha256.js';

/* ASSET_PACKS_START */
export const ASSET_PACKS = null;
/* ASSET_PACKS_END */

/** The file beside the page that says where packs/ and objects/ live. */
export const ASSET_BASE_FILE = 'asset-base.json';
export const ART_TIERS = Object.freeze(['high', 'light']);
/**
 * The load's deadline. The first screen is drawn only once the load has
 * SETTLED, and it settles by this time at the latest: a load still running then
 * is aborted and counts as failed (placeholders), and nothing it fetches later
 * is used. There is no late arrival, because a screen drawn on placeholders
 * cannot be re-pointed: the images' error handlers clear or replace the nodes
 * that named the asset id (enemySprite, pieceArt). A Retry is step 5.
 */
export const BOOT_WAIT_MS = 8000;

let status = { state: 'idle', tier: null, requested: null, ids: 0, failed: [] };
let pending = null;

/** What the loader did: idle, none (nothing pinned), inline, loading, loaded or failed. */
export function builtInArtStatus() {
  return { ...status, failed: [...status.failed] };
}

/** True when this build pins a pack to load: the web edition, not a single file. */
export function packsPinned(pin = ASSET_PACKS, inlineMap = ASSET_MAP) {
  return !!(pin && pin.packs && typeof pin.packs === 'object') && Object.keys(inlineMap || {}).length === 0;
}

/** The tiers to try, best first: high falls back to light; light has no fallback but placeholders. */
export function tierOrder(requested) {
  return requested === 'high' ? ['high', 'light'] : ['light'];
}

/** objects/<xx>/<sha256>.<ext> under `base` — the same name tools/asset-pack.mjs writes. */
export function objectUrl(base, id, sha) {
  const dot = id.lastIndexOf('.');
  const ext = dot > id.lastIndexOf('/') ? id.slice(dot).toLowerCase() : '';
  return `${base}objects/${sha.slice(0, 2)}/${sha}${ext}`;
}

/**
 * A base from asset-base.json, or null when it is not a plain relative folder
 * (`./`, `../../`, `site/`). It comes from the build's own folder, like the
 * HTML, but a value that names another origin or the host's root is refused.
 */
export function cleanBase(value) {
  if (typeof value !== 'string') return null;
  if (value === '' || value === './') return './';
  return /^(?:\.\.?\/)*(?:[A-Za-z0-9_-]+\/)*$/.test(value) ? value : null;
}

function isHttp(protocol) {
  return /^https?:$/.test(String(protocol || ''));
}

/** Where packs/ and objects/ are: asset-base.json's base, else `./`. Never throws. */
export async function readAssetBase({ fetchImpl = globalThis.fetch, signal } = {}) {
  try {
    const res = await fetchImpl(ASSET_BASE_FILE, { cache: 'no-cache', signal });
    if (!res || !res.ok) return './';
    return cleanBase((await res.json())?.base) || './';
  } catch {
    return './';
  }
}

/**
 * loadIndex(pack, pin, { base, fetchImpl }) → Map id → object URL. Throws with
 * a reason when the index is unpinned, unreachable, fails its hash or is not
 * an index.
 */
export async function loadIndex(pack, pin, { base = './', fetchImpl = globalThis.fetch, subtle, signal } = {}) {
  const want = pin?.packs?.[pack];
  if (!want || typeof want.index !== 'string' || !/^[0-9a-f]{64}$/.test(String(want.sha256))) throw new Error(`${pack}: not pinned`);
  const res = await fetchImpl(`${base}${want.index}`, { signal });
  if (!res || !res.ok) throw new Error(`${pack}: ${want.index} ${res ? res.status : 'unreachable'}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const sha = await sha256Hex(bytes, subtle);
  if (sha !== want.sha256) throw new Error(`${pack}: ${want.index} hashes to ${sha.slice(0, 12)}, the pin says ${want.sha256.slice(0, 12)}`);
  const entries = JSON.parse(new TextDecoder().decode(bytes));
  const map = new Map();
  for (const [id, row] of Object.entries(entries || {})) {
    if (Array.isArray(row) && /^[0-9a-f]{64}$/.test(String(row[0]))) map.set(id, objectUrl(base, id, row[0]));
  }
  return map;
}

/**
 * loadBuiltInPacks(opts) → the status above, once the built-in source is set
 * (or left unset). Loads the requested tier, falling back down tierOrder, plus
 * the common pack, and settles by `deadlineMs` at the latest (BOOT_WAIT_MS):
 * past it the fetches are aborted, the state is `failed`, and a response that
 * still arrives is dropped. Never throws.
 */
export async function loadBuiltInPacks({
  pin = ASSET_PACKS, inlineMap = ASSET_MAP, fetchImpl = globalThis.fetch,
  protocol = globalThis.location?.protocol, subtle, onSource = null, deadlineMs = BOOT_WAIT_MS,
} = {}) {
  if (!packsPinned(pin, inlineMap)) {
    status = { state: Object.keys(inlineMap || {}).length ? 'inline' : 'none', tier: null, requested: null, ids: 0, failed: [] };
    return builtInArtStatus();
  }
  const requested = ART_TIERS.includes(pin.tier) ? pin.tier : 'light';
  if (typeof fetchImpl !== 'function' || !isHttp(protocol)) {
    // file:// reads the .js twins, which is step 4; until then a double-clicked
    // web edition shows its placeholders.
    status = { state: 'failed', tier: null, requested, ids: 0, failed: ['the page is not served over http(s)'] };
    return builtInArtStatus();
  }
  status = { state: 'loading', tier: null, requested, ids: 0, failed: [] };
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const deadline = new Promise((settle) => {
    timer = setTimeout(() => settle({ timedOut: true }), deadlineMs);
  });
  const outcome = await Promise.race([
    readPacks(pin, requested, { fetchImpl, subtle, signal: controller?.signal }),
    deadline,
  ]);
  clearTimeout(timer);
  if (outcome.timedOut) {
    // Settled as failed, for good: whatever the aborted load would still
    // return never reaches assetmap.js (readPacks sets nothing).
    try { controller?.abort(); } catch { /* already settled */ }
    status = { state: 'failed', tier: null, requested, ids: 0, failed: [`the pack index did not load within ${deadlineMs} ms`] };
    setBuiltInSource(null);
    return builtInArtStatus();
  }
  const { art, tier, common, failed } = outcome;
  if (!art) {
    // Placeholders: no art index, so no source. The common pack alone does not
    // make a source either; its files (fonts, music, tiles) reach the page by
    // their own routes until steps 3b and 3c.
    status = { state: 'failed', tier: null, requested, ids: 0, failed };
    setBuiltInSource(null);
    return builtInArtStatus();
  }
  const map = new Map(common || []);
  for (const [id, url] of art) map.set(id, url);
  const ids = setBuiltInSource(map);
  status = { state: 'loaded', tier, requested, ids, failed };
  if (typeof onSource === 'function') try { onSource(map); } catch { /* a listener must not fail the load */ }
  return builtInArtStatus();
}

/** The fetches and checks of one load; sets nothing. */
async function readPacks(pin, requested, { fetchImpl, subtle, signal }) {
  const failed = [];
  const base = await readAssetBase({ fetchImpl, signal });
  let tier = null;
  let art = null;
  for (const candidate of tierOrder(requested)) {
    try {
      art = await loadIndex(candidate, pin, { base, fetchImpl, subtle, signal });
      tier = candidate;
      break;
    } catch (e) {
      failed.push(e.message);
    }
  }
  let common = null;
  if (pin.packs.common) {
    try { common = await loadIndex('common', pin, { base, fetchImpl, subtle, signal }); } catch (e) { failed.push(e.message); }
  }
  return { art, tier, common, failed };
}

/**
 * startBuiltInArt(opts) — start the load once; every later call shares it.
 * A build that pins packs stamps the outcome on <html data-built-in-art="…">
 * (the tier it loaded, or `failed`) for the browser gates.
 */
export function startBuiltInArt(opts = {}) {
  pending ??= loadBuiltInPacks(opts).then((result) => {
    try {
      const root = globalThis.document?.documentElement;
      // Only a build that pins packs says anything: a single file and the
      // source tree stay exactly as they were.
      if (root?.dataset && result.state !== 'none' && result.state !== 'inline') root.dataset.builtInArt = result.state === 'loaded' ? result.tier : result.state;
    } catch { /* no document: tests */ }
    if (result.failed.length) console.warn(`built-in art: ${result.failed.join('; ')}`);
    return result;
  });
  return pending;
}

/**
 * whenBuiltInArtReady(fn, opts) — call `fn` once the built-in art has settled:
 * at once when nothing is pinned (a single file, the source tree), else when
 * the load has loaded or failed, which is by BOOT_WAIT_MS at the latest. The
 * first screen therefore never draws before the source it will use is final.
 */
export function whenBuiltInArtReady(fn, opts = {}) {
  if (!packsPinned(opts.pin ?? ASSET_PACKS, opts.inlineMap ?? ASSET_MAP)) {
    startBuiltInArt(opts);
    fn();
    return;
  }
  let done = false;
  const go = () => { if (!done) { done = true; fn(); } };
  startBuiltInArt(opts).then(go, go);
}

/** For tests: forget the load. */
export function resetBuiltInArt() {
  pending = null;
  status = { state: 'idle', tier: null, requested: null, ids: 0, failed: [] };
  setBuiltInSource(null);
}
