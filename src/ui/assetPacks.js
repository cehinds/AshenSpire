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
// THE CSS ASSETS (step 3b): once the map is set, the ASSET_CSS rules (the
// "AS Lore" faces and the backdrops) are filled from that same map and
// injected, so they follow the tier fallback too.
//
// WHAT THIS DOES NOT DO YET. Over http(s) only: file:// (the .js twins and the
// font sidecar) is step 4. Music and map tiles are step 3c. The loading line
// on the startup gate, the Retry notice and per-file high → light fallback are
// step 5. Settings → Art quality Auto/Light/High (step 8c, src/ui/artTier.js)
// passes the tier to ask for; a switch in play refills the CSS from the new
// map too. A single file (ASSET_MAP filled) and the source tree (nothing
// stamped) never load anything here.

import { ASSET_MAP, setBuiltInSource } from './assetmap.js';
import { sha256Hex } from './sha256.js';

/* ASSET_PACKS_START */
export const ASSET_PACKS = null;
/* ASSET_PACKS_END */

// THE CSS ASSETS (§3.7, step 3b). The web edition's stylesheets name no asset
// file: tools/asset-css.mjs moved each @font-face into a rule here and turned
// each backdrop url() into `var(--as-css-<id>, none)`, defined by a rule here.
// Each rule's `{{id}}` slots are filled from the index the loader actually used
// (light when high failed), and the rules go into the page as one <style>. A
// failed load injects nothing: no backdrop, and the system faces the
// font-family stacks name. The two SVG masks never come here; they stay inline
// as data: URIs (a mask loads in CORS mode). Stamped by tools/bundle.mjs
// --external-art, in memory; null in a single file and the source tree.
/* ASSET_CSS_START */
export const ASSET_CSS = null;
/* ASSET_CSS_END */

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
/** The share of the deadline a tier that has a fallback (high) may use before it is abandoned for light. */
export const HIGH_SHARE = 0.5;
/** The share asset-base.json may use; past it the loader assumes `./`. */
export const BASE_SHARE = 0.25;

let status = { state: 'idle', tier: null, requested: null, ids: 0, css: 0, failed: [] };
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
 * (or left unset). Never throws. It settles by `deadlineMs` (BOOT_WAIT_MS) at
 * the latest, and no single stalled request can take the whole budget:
 *   · the common index is fetched IN PARALLEL with the art tiers, and only
 *     ever adds to a verified art map: a common index that fails, or has not
 *     arrived by the deadline, is left out (in 3a nothing reads common through
 *     assetUrl; fonts, music and tiles reach the page by their own routes);
 *   · each art tier but the last gets a sub-budget (HIGH_SHARE of the
 *     deadline), so a high index that hangs is aborted and light still has
 *     time to load;
 *   · past the deadline every fetch is aborted, an art map not yet verified
 *     counts as failed (placeholders), and anything that arrives later is
 *     dropped, never laid over a screen already drawn.
 */
export async function loadBuiltInPacks({
  pin = ASSET_PACKS, inlineMap = ASSET_MAP, fetchImpl = globalThis.fetch,
  protocol = globalThis.location?.protocol, subtle, onSource = null, deadlineMs = BOOT_WAIT_MS,
  css = ASSET_CSS, doc = globalThis.document,
  tier: askedTier = null, keepOnFail = false, stillWanted = null,
} = {}) {
  if (!packsPinned(pin, inlineMap)) {
    status = { state: Object.keys(inlineMap || {}).length ? 'inline' : 'none', tier: null, requested: null, ids: 0, css: 0, failed: [] };
    return builtInArtStatus();
  }
  // `tier`: Art quality's choice (step 8c, src/ui/artTier.js), else the default.
  const requested = ART_TIERS.includes(askedTier) ? askedTier : ART_TIERS.includes(pin.tier) ? pin.tier : 'light';
  const before = status;
  if (typeof fetchImpl !== 'function' || !isHttp(protocol)) {
    // file:// reads the .js twins, which is step 4; until then a double-clicked
    // web edition shows its placeholders.
    status = { state: 'failed', tier: null, requested, ids: 0, css: 0, failed: ['the page is not served over http(s)'] };
    return builtInArtStatus();
  }
  status = { state: 'loading', tier: null, requested, ids: 0, css: 0, failed: [] };
  const failed = [];
  const controllers = [];
  const abortable = () => {
    const c = typeof AbortController === 'function' ? new AbortController() : null;
    if (c) controllers.push(c);
    return c;
  };
  const started = Date.now();
  const left = () => Math.max(0, deadlineMs - (Date.now() - started));
  const timers = [];
  // Resolves to `fallback` after ms, and aborts that attempt's fetches.
  const budget = (ms, controller, fallback) => new Promise((settle) => {
    timers.push(setTimeout(() => { try { controller?.abort(); } catch { /* settled */ } settle(fallback); }, ms));
  });
  const TIMED_OUT = { timedOut: true };
  try {
    const baseCtl = abortable();
    const base = await Promise.race([readAssetBase({ fetchImpl, signal: baseCtl?.signal }), budget(Math.min(left(), Math.round(deadlineMs * BASE_SHARE)), baseCtl, './')]);
    // The common index, alongside the tiers; its failure is recorded, never fatal.
    let common = null;
    let commonDone = !pin.packs.common;
    const commonCtl = abortable();
    const commonLoad = pin.packs.common
      ? loadIndex('common', pin, { base, fetchImpl, subtle, signal: commonCtl?.signal })
        .then((map) => { common = map; }, (e) => { failed.push(e.message); })
        .finally(() => { commonDone = true; })
      : Promise.resolve();
    let tier = null;
    let art = null;
    const order = tierOrder(requested);
    for (const [i, candidate] of order.entries()) {
      const last = i === order.length - 1;
      const ms = last ? left() : Math.min(left(), Math.round(deadlineMs * HIGH_SHARE));
      if (ms <= 0) { failed.push(`${candidate}: no time left before the ${deadlineMs} ms deadline`); continue; }
      const ctl = abortable();
      const got = await Promise.race([
        loadIndex(candidate, pin, { base, fetchImpl, subtle, signal: ctl?.signal }).then((map) => ({ map }), (e) => ({ error: e })),
        budget(ms, ctl, TIMED_OUT),
      ]);
      if (got.map) { art = got.map; tier = candidate; break; }
      failed.push(got === TIMED_OUT ? `${candidate}: the index did not load within ${ms} ms` : got.error.message);
    }
    if (!art) {
      // A tier switch in play (keepOnFail) keeps the art already on screen, and
      // records the tier it asked for, so the row can say that one failed.
      if (keepOnFail && before.state === 'loaded') { status = { ...before, requested, failed }; return builtInArtStatus(); }
      // Placeholders: no art index, so no source. The common pack alone does
      // not make a source either.
      status = { state: 'failed', tier: null, requested, ids: 0, css: 0, failed };
      setBuiltInSource(null);
      return builtInArtStatus();
    }
    // A verified art map is kept whatever common does: common gets the time
    // left, and is left out if it is not there by then.
    if (!commonDone) {
      const waited = await Promise.race([commonLoad.then(() => true), budget(left(), commonCtl, false)]);
      if (!waited) failed.push(`common: the index did not load within ${deadlineMs} ms; the art loads without it`);
    }
    const map = new Map(common || []);
    for (const [id, url] of art) map.set(id, url);
    // A tier switch the player has since replaced (stillWanted) publishes nothing.
    if (typeof stillWanted === 'function' && !stillWanted()) { status = before; return { ...builtInArtStatus(), superseded: true }; }
    const ids = setBuiltInSource(map);
    // The CSS assets come from the same map: the tier that loaded, plus common.
    const filled = applyAssetCss(map, { css, doc });
    if (filled.dropped.length) failed.push(`css: ${filled.dropped.length} rule(s) left on their fallbacks, the loaded indexes list no ${filled.dropped.slice(0, 3).join(', ')}`);
    // `base` is where packs/ and objects/ live (asset-base.json's base): the
    // offline install (src/ui/offlineInstall.js) registers the service worker
    // and reads the indexes there.
    status = { state: 'loaded', tier, requested, ids, css: filled.rules, failed: [...failed], base };
    if (typeof onSource === 'function') try { onSource(map); } catch { /* a listener must not fail the load */ }
    return builtInArtStatus();
  } finally {
    for (const t of timers) clearTimeout(t);
    // Whatever is still in flight is not wanted: a late answer is never used.
    for (const c of controllers) try { c.abort(); } catch { /* settled */ }
  }
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

/**
 * musicHold({ pinned, configureMusic }) — when the music folder is applied at
 * boot. A build that pins packs draws its first screen only after the load has
 * settled, so a manifest that lands meanwhile would start and abort a track
 * per screen a ?shot= boot walks through: the folder is held and applied once
 * the first screen is drawn. A single file and the source tree pin nothing and
 * apply it at once, before the first screen, exactly as before step 3a.
 *   apply(folder)     — the settings path: apply now, or hold
 *   firstScreen(show) — draw the first screen, then release the hold (always,
 *                       even if `show` throws)
 */
export function musicHold({ pinned = packsPinned(), configureMusic }) {
  let waiting = !!pinned;
  let held = false;
  let folder;
  return {
    apply(next) {
      folder = next;
      if (waiting) held = true;
      else configureMusic({ folder });
    },
    firstScreen(show) {
      try {
        show();
      } finally {
        waiting = false;
        if (held) { held = false; configureMusic({ folder }); }
      }
    },
  };
}

/**
 * bootLine(app, { pinned }) — while a pack build waits for its load to settle
 * (up to BOOT_WAIT_MS), the page is otherwise blank. A static line says what it
 * is doing; it is removed before the first screen is drawn. Nothing is shown
 * when nothing is pinned. The real progress line on the startup gate, its
 * wording in content/config and Reduced motion are step 5. Returns the remover.
 */
export function bootLine(app, { pinned = packsPinned(), doc = globalThis.document } = {}) {
  if (!pinned || !app || !doc || typeof doc.createElement !== 'function') return () => {};
  const line = doc.createElement('p');
  line.setAttribute('role', 'status');
  line.dataset.bootLine = '';
  line.textContent = 'Loading art…';
  line.style.cssText = 'margin:0;padding:24px;text-align:center;opacity:.7;font:16px/1.4 serif;color:inherit';
  app.append(line);
  return () => line.remove();
}

const SLOT = /\{\{([^{}]+)\}\}/g;

/**
 * fillAssetCss(css, map, { resolveUrl }) → { text, rules, dropped }: the
 * ASSET_CSS rules with every `{{id}}` slot replaced by that id's object from
 * `map`. A rule naming an id the map lacks is left out whole (its face or
 * backdrop stays on the fallback); `dropped` lists those ids.
 */
export function fillAssetCss(css, map, { resolveUrl = (url) => url } = {}) {
  const kept = [];
  const dropped = [];
  if (!css || !Array.isArray(css.rules) || !map || typeof map.get !== 'function') return { text: '', rules: 0, dropped };
  for (const rule of css.rules) {
    let missing = null;
    const text = String(rule).replace(SLOT, (_, id) => {
      const url = map.get(id);
      if (typeof url !== 'string' || !url) { missing ??= id; return ''; }
      // An object path has no quote or backslash; escaped anyway, so a url can
      // never close the string it sits in.
      return String(resolveUrl(url)).replace(/["\\\n]/g, (c) => encodeURIComponent(c));
    });
    if (missing) dropped.push(missing);
    else kept.push(text);
  }
  return { text: kept.join('\n'), rules: kept.length, dropped };
}

/**
 * applyAssetCss(map, { css, doc }) → what fillAssetCss returned, after putting
 * the filled rules in the page as <style data-asset-css> (replacing an earlier
 * one). Each object path is made absolute against the document, so a url read
 * through a custom property cannot resolve against anything else. Nothing is
 * injected when there is no template, no map or no document.
 */
export function applyAssetCss(map, { css = ASSET_CSS, doc = globalThis.document } = {}) {
  const filled = fillAssetCss(css, map, {
    resolveUrl: (url) => { try { return new URL(url, doc?.baseURI).href; } catch { return url; } },
  });
  if (!filled.rules || !doc || typeof doc.createElement !== 'function') return filled;
  try {
    const style = doc.createElement('style');
    style.setAttribute('data-asset-css', '');
    style.textContent = filled.text;
    const old = doc.querySelector?.('style[data-asset-css]');
    if (old) old.replaceWith(style);
    else (doc.head || doc.documentElement).appendChild(style);
  } catch { /* no usable document: tests */ }
  return filled;
}

/** For tests: forget the load. */
export function resetBuiltInArt() {
  pending = null;
  status = { state: 'idle', tier: null, requested: null, ids: 0, css: 0, failed: [] };
  setBuiltInSource(null);
}
