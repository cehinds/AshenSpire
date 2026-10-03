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
// MUSIC AND MAP TILES (step 3c) are common ids too: src/ui/audio.js resolves
// `music/manifest.json` and each track, and src/ui/components/mapDetail.js
// each `map-detail/…` tile, through assetUrl(), so they come from the common
// pack's objects once this map is set. When it is not (no art index loaded),
// they pass through as paths, miss, and the synth score and the low-detail map
// stay, as they always have for a missing file.
//
// FILE:// (step 4). A double-clicked web edition cannot fetch: Chrome refuses
// fetch, and cross-origin font loads, from a file:// page. So under file:// the
// loader reads each index from its .js twin instead, through a <script> tag
// (`window.__ashenPack(name, text)`), and checks the STRING against the same
// pin before it parses it; images and CSS backdrops are plain loads of the
// object paths, which file:// allows. The faces come from the font sidecar
// (`__ashenFonts(name, text)`, checked against its own pin and each face
// against its common record) as FontFace objects, and the @font-face rules of
// ASSET_CSS are left out. asset-base.json is not read (it cannot be fetched):
// a file:// page is the build's own folder, so the base is `./`. The score stays
// synthesized under file:// (src/main.js, SPEC §7.4).
//
// THE LOADING UX (step 5). A cold boot draws the startup gate at once and
// loads behind it (src/main.js); the gate's status line and the critical set it
// counts are src/ui/bootArt.js; a failed load is offered a Retry on the title
// and in Settings → Art quality (src/ui/artTier.js retryBuiltInArt), which
// reloads the indexes through the same queue as a tier switch. Settings → Art
// quality Auto/Light/High (step 8c, src/ui/artTier.js) passes the tier to ask
// for; a switch in play refills the CSS from the new map too. A single file
// (ASSET_MAP filled) and the source tree (nothing stamped) never load anything
// here.
//
// NOT HERE: a per-file high → light fallback. The light index is not loaded
// beside a high one (a second ~700 KB index on every high boot), so one high
// object that fails falls to its element's own placeholder recipe
// (src/ui/assets.js), as any missing file does (§3, *Failure and fallback*).

import { ASSET_MAP, setBuiltInSource, builtInSource } from './assetmap.js';
import { sha256Hex } from './sha256.js';
import { t } from './strings.js';

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

/** A `{{id}}` slot in an ASSET_CSS rule. */
const SLOT = /\{\{([^{}]+)\}\}/g;

/** The file beside the page that says where packs/ and objects/ live. */
export const ASSET_BASE_FILE = 'asset-base.json';
export const ART_TIERS = Object.freeze(['high', 'light']);
/**
 * The load's deadline. The first screen is drawn only once the load has
 * SETTLED, and it settles by this time at the latest: a load still running then
 * is aborted and counts as failed (placeholders), and nothing it fetches later
 * is used. There is no late arrival, because a screen drawn on placeholders
 * cannot be re-pointed: the images' error handlers clear or replace the nodes
 * that named the asset id (enemySprite, pieceArt). A Retry (step 5,
 * src/ui/artTier.js retryBuiltInArt) loads again later and the title is redrawn.
 */
export const BOOT_WAIT_MS = 8000;
/** The share of the deadline a tier that has a fallback (high) may use before it is abandoned for light. */
export const HIGH_SHARE = 0.5;
/** The share asset-base.json may use; past it the loader assumes `./`. */
export const BASE_SHARE = 0.25;

let status = { state: 'idle', tier: null, requested: null, ids: 0, css: 0, failed: [] };
let pending = null;
// The last common index this page verified, with the pin it matched. A tier
// switch fetches common again; when that fetch fails or misses its deadline,
// these entries are kept rather than dropped, so the map tiles, the fonts and
// the score do not fall back to bare paths for the rest of the session
// (review of #1454). Used only while the pin names the same common index.
let lastCommon = null;

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

/** Where a pin's twin is: `packs/light-<d12>.json` → its name and its `.js` file. */
export function twinOf(file) {
  const m = /^((?:[A-Za-z0-9_-]+\/)*)([A-Za-z0-9_-]+)\.(?:json|js)$/.exec(String(file || ''));
  return m ? { name: m[2], file: `${m[1]}${m[2]}.js` } : null;
}

// THE TWIN HOOKS. A twin is a classic script that calls one of these with its
// name and its text. A call is kept only while a loader is waiting for that
// name (between inserting the twin's <script> and reading it back), and only
// the first one; a call nobody is waiting for, or one that arrives after the
// reader gave up, is dropped. What is kept is still used only once it hashes
// to its pin. The hooks stay installed on the window once the first twin is
// asked for (a later load or a tier switch reads twins too).
const TWIN_FNS = Object.freeze({ pack: '__ashenPack', fonts: '__ashenFonts' });
const delivered = new Map(); // `${kind}:${name}` → text
const awaiting = new Map(); // `${kind}:${name}` → readers waiting for it

function installTwinHooks(root = globalThis) {
  for (const [kind, fn] of Object.entries(TWIN_FNS)) {
    if (typeof root[fn] === 'function' && root[fn].ashenTwinHook) continue;
    const hook = (name, text) => {
      if (typeof name !== 'string' || typeof text !== 'string') return;
      const key = `${kind}:${name}`;
      if (awaiting.get(key) > 0 && !delivered.has(key)) delivered.set(key, text);
    };
    hook.ashenTwinHook = true;
    try { root[fn] = hook; } catch { /* a frozen global: nothing loads */ }
  }
}

/**
 * The default script loader: one classic <script src> in <head>, removed once it
 * has run. Resolves on load, rejects on error or when `signal` aborts.
 */
export function scriptTag(src, { doc = globalThis.document, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!doc || typeof doc.createElement !== 'function') { reject(new Error('no document to load a script into')); return; }
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const el = doc.createElement('script');
    const finish = (fn, value) => {
      el.onload = el.onerror = null;
      signal?.removeEventListener?.('abort', onAbort);
      try { el.remove(); } catch { /* already gone */ }
      fn(value);
    };
    const onAbort = () => finish(reject, new Error('aborted'));
    el.onload = () => finish(resolve);
    el.onerror = () => finish(reject, new Error(`${src} could not be loaded`));
    signal?.addEventListener?.('abort', onAbort, { once: true });
    el.src = src;
    (doc.head || doc.documentElement).appendChild(el);
  });
}

/**
 * readTwin(kind, file, { base, scriptImpl, signal }) → the text a twin handed
 * over. Throws when the twin cannot be loaded or never called its hook.
 */
async function readTwin(kind, file, { base = './', scriptImpl, signal } = {}) {
  const twin = twinOf(file);
  if (!twin) throw new Error(`${file} names no twin`);
  installTwinHooks();
  const key = `${kind}:${twin.name}`;
  delivered.delete(key);
  awaiting.set(key, (awaiting.get(key) || 0) + 1);
  let text;
  try {
    await scriptImpl(`${base}${twin.file}`, { signal });
    text = delivered.get(key);
  } finally {
    const left = (awaiting.get(key) || 1) - 1;
    if (left > 0) awaiting.set(key, left);
    else { awaiting.delete(key); delivered.delete(key); }
  }
  if (typeof text !== 'string') throw new Error(`${twin.file} did not call ${TWIN_FNS[kind]}("${twin.name}", …)`);
  return { text, file: twin.file };
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

/** The map id → object URL of a verified index's bytes; throws when they fail the pin. */
async function indexFromBytes(pack, want, file, bytes, { base, subtle }) {
  const sha = await sha256Hex(bytes, subtle);
  if (sha !== want.sha256) throw new Error(`${pack}: ${file} hashes to ${sha.slice(0, 12)}, the pin says ${want.sha256.slice(0, 12)}`);
  const entries = JSON.parse(new TextDecoder().decode(bytes));
  const map = new Map();
  for (const [id, row] of Object.entries(entries || {})) {
    if (Array.isArray(row) && /^[0-9a-f]{64}$/.test(String(row[0]))) map.set(id, objectUrl(base, id, row[0]));
  }
  return map;
}

function pinnedIndex(pack, pin) {
  const want = pin?.packs?.[pack];
  if (!want || typeof want.index !== 'string' || !/^[0-9a-f]{64}$/.test(String(want.sha256))) throw new Error(`${pack}: not pinned`);
  return want;
}

/**
 * loadIndex(pack, pin, { base, fetchImpl }) → Map id → object URL. Throws with
 * a reason when the index is unpinned, unreachable, fails its hash or is not
 * an index.
 */
export async function loadIndex(pack, pin, { base = './', fetchImpl = globalThis.fetch, subtle, signal, cache } = {}) {
  const want = pinnedIndex(pack, pin);
  // `cache` (a Retry, 'reload'): past the HTTP cache, so a cached error or a
  // cached copy that fails its pin is not served again (Codex on #1471).
  const res = await fetchImpl(`${base}${want.index}`, cache ? { signal, cache } : { signal });
  if (!res || !res.ok) throw new Error(`${pack}: ${want.index} ${res ? res.status : 'unreachable'}`);
  return indexFromBytes(pack, want, want.index, new Uint8Array(await res.arrayBuffer()), { base, subtle });
}

/**
 * loadTwinIndex(pack, pin, { base, scriptImpl }) → the same Map, read from the
 * index's .js twin (file://, step 4). The twin's STRING is hashed against the
 * index's pin before it is parsed: it is the .json file's text byte for byte,
 * so one pin covers both, and a twin that does not match is dropped unparsed.
 */
export async function loadTwinIndex(pack, pin, { base = './', scriptImpl = scriptTag, subtle, signal } = {}) {
  const want = pinnedIndex(pack, pin);
  let got;
  try {
    got = await readTwin('pack', want.index, { base, scriptImpl, signal });
  } catch (e) {
    throw new Error(`${pack}: ${e.message}`);
  }
  return indexFromBytes(pack, want, got.file, new TextEncoder().encode(got.text), { base, subtle });
}

/** The sha256 an object URL names (objectUrl's last segment), or null. */
function objectSha(url) {
  return (/([0-9a-f]{64})(?:\.[a-z0-9]+)?$/.exec(String(url || '')) || [])[1] || null;
}

/** Every @font-face descriptor a FontFace takes, CSS name → FontFace option. */
export const FACE_DESCRIPTORS = Object.freeze({
  'font-style': 'style', 'font-weight': 'weight', 'font-stretch': 'stretch',
  'font-display': 'display', 'unicode-range': 'unicodeRange', 'font-feature-settings': 'featureSettings',
  'font-variation-settings': 'variationSettings', 'size-adjust': 'sizeAdjust',
  'ascent-override': 'ascentOverride', 'descent-override': 'descentOverride', 'line-gap-override': 'lineGapOverride',
});

/** The declarations of one @font-face rule, comments stripped: [property, value] pairs. */
function faceDeclarations(text) {
  const body = text.slice(text.indexOf('{') + 1, text.lastIndexOf('}')).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = [];
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    out.push([part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim()]);
  }
  return out;
}

/**
 * unmappedFaceDescriptors(css) → the descriptors an ASSET_CSS @font-face rule
 * carries that a FontFace built by fontFaceRules would lose (anything but
 * font-family, src and FACE_DESCRIPTORS), as `<property> (<rule start>)`. The
 * file:// door would declare a different face than the http(s) one, so
 * tools/verify-external.mjs D refuses any.
 */
export function unmappedFaceDescriptors(css) {
  const out = [];
  for (const rule of (css && Array.isArray(css.rules) ? css.rules : [])) {
    const text = String(rule);
    if (!/^\s*@font-face\b/.test(text)) continue;
    for (const [prop] of faceDeclarations(text)) {
      if (prop !== 'font-family' && prop !== 'src' && !FACE_DESCRIPTORS[prop]) out.push(`${prop} (${text.slice(0, 48)})`);
    }
  }
  return out;
}

/**
 * fontFaceRules(css) → Map id → { family, descriptors } for every ASSET_CSS
 * @font-face rule whose one slot names a face: what a FontFace needs, read from
 * the same rule the http(s) page injects, so the two doors declare one face.
 */
export function fontFaceRules(css) {
  const out = new Map();
  for (const rule of (css && Array.isArray(css.rules) ? css.rules : [])) {
    const text = String(rule);
    if (!/^\s*@font-face\b/.test(text)) continue;
    const ids = [...text.matchAll(SLOT)].map((m) => m[1]);
    if (ids.length !== 1) continue;
    let family = '';
    const descriptors = {};
    for (const [prop, value] of faceDeclarations(text)) {
      if (prop === 'font-family') family = value.replace(/^(['"])(.*)\1$/, '$2');
      else if (FACE_DESCRIPTORS[prop] && value) descriptors[FACE_DESCRIPTORS[prop]] = value;
    }
    if (family) out.set(ids[0], { family, descriptors });
  }
  return out;
}

function base64Bytes(b64) {
  const bin = atob(String(b64));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// The faces this page has added from a sidecar, by the sidecar's pin: a tier
// switch reloads the indexes but never adds the same faces twice.
let facesAdded = null; // { sha, count }

/**
 * loadFontSidecar(pin, common, opts) → { faces, failed }. file:// only (step 4):
 * the sidecar's text is checked against `pin.fonts.sha256`; each face it carries
 * must be a face ASSET_CSS declares, listed by the verified common map, and
 * decode to bytes that hash to that common record. Each one that passes becomes
 * a FontFace in `doc.fonts`; one that fails is left to the system faces the
 * font-family stacks name.
 */
export async function loadFontSidecar(pin, common, {
  base = './', scriptImpl = scriptTag, subtle, signal, css = ASSET_CSS, doc = globalThis.document,
  FontFaceImpl = globalThis.FontFace, stillWanted = null,
} = {}) {
  const failed = [];
  const want = pin?.fonts;
  if (!want || typeof want.file !== 'string' || !/^[0-9a-f]{64}$/.test(String(want.sha256))) return { faces: 0, failed: ['fonts: no sidecar pinned'] };
  if (facesAdded && facesAdded.sha === want.sha256) return { faces: facesAdded.count, failed };
  if (!common || typeof common.get !== 'function') return { faces: 0, failed: ['fonts: no verified common index to check the faces against'] };
  if (typeof FontFaceImpl !== 'function' || !doc?.fonts || typeof doc.fonts.add !== 'function') return { faces: 0, failed: ['fonts: this browser has no FontFace'] };
  let got;
  try {
    got = await readTwin('fonts', want.file, { base, scriptImpl, signal });
  } catch (e) {
    return { faces: 0, failed: [`fonts: ${e.message}`] };
  }
  // Past the deadline (the load aborted `signal`), or once the player has
  // replaced the tier switch this load belongs to (stillWanted), nothing more is
  // added: the load has settled or is not wanted, and a face arriving later is
  // never laid over it.
  const stop = () => !!signal?.aborted || (typeof stillWanted === 'function' && !stillWanted());
  const ABORTED = { faces: 0, failed: ['fonts: aborted at the deadline or superseded; no face added'] };
  if (stop()) return ABORTED;
  const sha = await sha256Hex(new TextEncoder().encode(got.text), subtle);
  if (stop()) return ABORTED;
  if (sha !== want.sha256) return { faces: 0, failed: [`fonts: ${got.file} hashes to ${sha.slice(0, 12)}, the pin says ${want.sha256.slice(0, 12)}`] };
  let faces;
  try { faces = JSON.parse(got.text); } catch { return { faces: 0, failed: [`fonts: ${got.file} is not a sidecar`] }; }
  const declared = fontFaceRules(css);
  const made = [];
  for (const [id, b64] of Object.entries(faces || {})) {
    const rule = declared.get(id);
    const record = objectSha(common.get(id));
    if (!rule || !record) { failed.push(`fonts: ${id} is not a face the page declares and the common index lists`); continue; }
    let bytes;
    try { bytes = base64Bytes(b64); } catch { failed.push(`fonts: ${id} is not base64`); continue; }
    const got256 = await sha256Hex(bytes, subtle);
    if (stop()) return ABORTED;
    if (got256 !== record) { failed.push(`fonts: ${id} hashes to ${got256.slice(0, 12)}, its common record says ${record.slice(0, 12)}`); continue; }
    made.push([id, rule, bytes]);
  }
  // Every face is loaded first and added only together, and only while the
  // load is still wanted: an abort while a face is loading adds none of them
  // and leaves the cache alone.
  const ready = [];
  for (const [id, rule, bytes] of made) {
    try {
      const face = new FontFaceImpl(rule.family, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), rule.descriptors);
      if (typeof face.load === 'function') await face.load();
      if (stop()) return ABORTED;
      ready.push(face);
    } catch (e) {
      if (stop()) return ABORTED;
      failed.push(`fonts: ${id} did not load (${e?.message || e})`);
    }
  }
  if (stop()) return ABORTED;
  for (const face of ready) doc.fonts.add(face);
  const count = ready.length;
  if (count) facesAdded = { sha: want.sha256, count };
  return { faces: count, failed };
}

/**
 * loadBuiltInPacks(opts) → the status above, once the built-in source is set
 * (or left unset). Never throws. It settles by `deadlineMs` (BOOT_WAIT_MS) at
 * the latest, and no single stalled request can take the whole budget:
 *   · the common index is fetched IN PARALLEL with the art tiers, and only
 *     ever adds to a verified art map: a common index that fails, or has not
 *     arrived by the deadline, is left out (the fonts' ASSET_CSS rules are
 *     then dropped, the score stays synthesized and the map stays low
 *     detail);
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
  scriptImpl = null, FontFaceImpl = globalThis.FontFace,
  // An AbortSignal from the caller (a Retry or a tier switch the player has
  // replaced, src/ui/artTier.js): every request in flight is aborted at once
  // and the load settles as superseded, publishing nothing, rather than
  // holding the queue for its whole deadline (Codex on #1471).
  signal = null,
  // The fetch cache mode for the indexes: unset on the boot load (the HTTP
  // cache's default), 'reload' on a Retry (src/ui/artTier.js).
  cache = undefined,
} = {}) {
  if (!packsPinned(pin, inlineMap)) {
    status = { state: Object.keys(inlineMap || {}).length ? 'inline' : 'none', tier: null, requested: null, ids: 0, css: 0, failed: [] };
    return builtInArtStatus();
  }
  // `tier`: Art quality's choice (step 8c, src/ui/artTier.js), else the default.
  const requested = ART_TIERS.includes(askedTier) ? askedTier : ART_TIERS.includes(pin.tier) ? pin.tier : 'light';
  const before = status;
  // file:// (step 4): the indexes come from their .js twins, through <script>
  // tags, and the faces from the font sidecar. Any other scheme, or http(s)
  // without fetch, loads nothing and shows placeholders.
  const viaFile = String(protocol || '') === 'file:';
  const loadScript = scriptImpl || ((src, o) => scriptTag(src, { ...o, doc }));
  if (viaFile ? !scriptImpl && (!doc || typeof doc.createElement !== 'function') : (typeof fetchImpl !== 'function' || !isHttp(protocol))) {
    status = { state: 'failed', tier: null, requested, ids: 0, css: 0, failed: [viaFile ? 'file://: no document to load the .js twins into' : 'the page is not served over http(s) or file://'] };
    return builtInArtStatus();
  }
  const readIndex = viaFile
    ? (pack, o) => loadTwinIndex(pack, pin, { ...o, scriptImpl: loadScript })
    : (pack, o) => loadIndex(pack, pin, { ...o, fetchImpl, cache });
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
  const CUT = { cut: true };
  let onCut = null;
  const cut = new Promise((settle) => {
    if (!signal) return;
    onCut = () => { for (const c of controllers) try { c.abort(); } catch { /* settled */ } settle(CUT); };
    if (signal.aborted) onCut(); else signal.addEventListener?.('abort', onCut, { once: true });
  });
  const superseded = () => { status = before; return { ...builtInArtStatus(), superseded: true }; };
  const isCut = () => !!signal?.aborted;
  try {
    if (isCut()) return superseded();
    const baseCtl = abortable();
    // A file:// page cannot fetch asset-base.json, and is the build's own
    // folder: packs/ and objects/ are beside it.
    const base = viaFile ? './' : await Promise.race([readAssetBase({ fetchImpl, signal: baseCtl?.signal }), budget(Math.min(left(), Math.round(deadlineMs * BASE_SHARE)), baseCtl, './'), cut]);
    if (base === CUT || isCut()) return superseded();
    // The common index, alongside the tiers; its failure is recorded, never fatal.
    let common = null;
    let commonDone = !pin.packs.common;
    const commonCtl = abortable();
    const commonLoad = pin.packs.common
      ? readIndex('common', { base, subtle, signal: commonCtl?.signal })
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
        readIndex(candidate, { base, subtle, signal: ctl?.signal }).then((map) => ({ map }), (e) => ({ error: e })),
        budget(ms, ctl, TIMED_OUT),
        cut,
      ]);
      if (got === CUT || isCut()) return superseded();
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
      const waited = await Promise.race([commonLoad.then(() => true), budget(left(), commonCtl, false), cut]);
      if (waited === CUT || isCut()) return superseded();
      if (!waited) failed.push(`common: the index did not load within ${deadlineMs} ms; the art loads without it`);
    }
    const commonSha = pin.packs.common?.sha256;
    if (common) lastCommon = { sha: commonSha, base, map: common };
    else if (lastCommon && lastCommon.sha === commonSha && lastCommon.base === base) {
      common = lastCommon.map;
      failed.push('common: kept the entries verified by the earlier load');
    }
    const map = new Map(common || []);
    for (const [id, url] of art) map.set(id, url);
    // A tier switch the player has since replaced (stillWanted) publishes nothing.
    if (isCut() || (typeof stillWanted === 'function' && !stillWanted())) return superseded();
    // file://: the faces, from the font sidecar, before the source is
    // published (within what is left of the deadline). Chrome refuses a
    // file:// page's @font-face url() loads, so those rules are left out of
    // the CSS below and the faces are FontFace objects instead.
    let faces = 0;
    if (viaFile && pin.fonts && common) {
      const fontCtl = abortable();
      const got = await Promise.race([
        loadFontSidecar(pin, common, { base, scriptImpl: loadScript, subtle, signal: fontCtl?.signal, css, doc, FontFaceImpl, stillWanted }),
        budget(left(), fontCtl, { faces: 0, failed: [`fonts: the sidecar did not load within ${deadlineMs} ms`] }),
        cut,
      ]);
      if (got === CUT || isCut()) return superseded();
      faces = got.faces;
      failed.push(...got.failed);
      // The sidecar was awaited: a switch the player replaced meanwhile still
      // publishes nothing (review of #1461).
      if (typeof stillWanted === 'function' && !stillWanted()) { status = before; return { ...builtInArtStatus(), superseded: true }; }
    }
    const ids = setBuiltInSource(map);
    // The CSS assets come from the same map: the tier that loaded, plus common.
    const filled = applyAssetCss(map, { css, doc, faces: !viaFile });
    if (filled.dropped.length) failed.push(`css: ${filled.dropped.length} rule(s) left on their fallbacks, the loaded indexes list no ${filled.dropped.slice(0, 3).join(', ')}`);
    // `base` is where packs/ and objects/ live (asset-base.json's base): the
    // offline install (src/ui/offlineInstall.js) registers the service worker
    // and reads the indexes there.
    status = { state: 'loaded', tier, requested, ids, css: filled.rules, failed: [...failed], base, ...(viaFile ? { via: 'file', faces } : {}) };
    if (typeof onSource === 'function') try { onSource(map); } catch { /* a listener must not fail the load */ }
    return builtInArtStatus();
  } finally {
    if (onCut) signal?.removeEventListener?.('abort', onCut);
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
 * builtInArtSettled() → the boot load's promise (its status once it has
 * settled), or null before startBuiltInArt has been called.
 */
export function builtInArtSettled() { return pending; }

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

/** True when the built-in source lists `<folder>/manifest.json`: the shipped score resolves to an object. */
export function shippedScoreResolves(folder) {
  const source = builtInSource();
  return !!(source && folder && source.has(`${String(folder).replace(/\/+$/, '')}/manifest.json`));
}

/**
 * musicHold({ pinned, configureMusic }) — when the music folder is applied at
 * boot. A build that pins packs draws its first screen only after the load has
 * settled, so a manifest that lands meanwhile would start and abort a track
 * per screen a ?shot= boot walks through: the folder is held and applied once
 * the first screen is drawn. A single file and the source tree pin nothing and
 * apply it at once, before the first screen, exactly as before step 3a.
 *   apply(folder, o)  — the settings path: apply now, or hold; `o` (e.g.
 *                       { indexed }) is passed to configureMusic with it
 *   sourceArrived()   — a built-in source landed later (a tier switch after a
 *                       failed boot load): an indexed configure that ran
 *                       without one runs again
 *   firstScreen(show) — draw the first screen, then release the hold (always,
 *                       even if `show` throws)
 */
export function musicHold({ pinned = packsPinned(), configureMusic, hasSource = shippedScoreResolves }) {
  let waiting = !!pinned;
  let held = false;
  let folder;
  let opts = {};
  // True when the last configure asked for the shipped score through the index
  // while the built-in source did not list its manifest (the boot load failed,
  // or the art loaded and the common index did not): its paths missed and the
  // synth plays. sourceArrived() configures again once a source lists it.
  let missed = false;
  const run = () => {
    missed = !!opts.indexed && !hasSource(folder);
    configureMusic({ ...opts, folder });
  };
  return {
    apply(next, extra = {}) {
      folder = next;
      opts = extra;
      if (waiting) held = true;
      else run();
    },
    firstScreen(show) {
      try {
        show();
      } finally {
        waiting = false;
        if (held) { held = false; run(); }
      }
    },
    // A source arrived later (a tier switch after a failed boot load): the
    // shipped score is read again through it. A player's own folder, or a
    // configure that already had a source, is left alone.
    sourceArrived() {
      if (!waiting && missed && opts.indexed && hasSource(folder)) run();
    },
  };
}

/**
 * bootLine(app, { pinned }) — a `?shot=` boot (any first screen but the
 * startup gate) still waits for the load to settle (up to BOOT_WAIT_MS), with
 * the page otherwise blank. A static line says what it is doing; it is removed
 * before the first screen is drawn. Nothing is shown when nothing is pinned.
 * The cold boot draws the gate at once instead, with its own line
 * (src/ui/bootArt.js, step 5). The words are uiStrings' `art.loading`.
 * Returns the remover.
 */
export function bootLine(app, { pinned = packsPinned(), doc = globalThis.document } = {}) {
  if (!pinned || !app || !doc || typeof doc.createElement !== 'function') return () => {};
  const line = doc.createElement('p');
  line.setAttribute('role', 'status');
  line.dataset.bootLine = '';
  line.textContent = t('art.loading');
  line.style.cssText = 'margin:0;padding:24px;text-align:center;opacity:.7;font:16px/1.4 serif;color:inherit';
  app.append(line);
  return () => line.remove();
}


/**
 * fillAssetCss(css, map, { resolveUrl }) → { text, rules, dropped }: the
 * ASSET_CSS rules with every `{{id}}` slot replaced by that id's object from
 * `map`. A rule naming an id the map lacks is left out whole (its face or
 * backdrop stays on the fallback); `dropped` lists those ids.
 */
export function fillAssetCss(css, map, { resolveUrl = (url) => url, faces = true } = {}) {
  const kept = [];
  const dropped = [];
  if (!css || !Array.isArray(css.rules) || !map || typeof map.get !== 'function') return { text: '', rules: 0, dropped };
  for (const rule of css.rules) {
    // `faces: false` (file://): the @font-face rules are left out; the faces
    // come from the font sidecar as FontFace objects instead.
    if (!faces && /^\s*@font-face\b/.test(String(rule))) continue;
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
export function applyAssetCss(map, { css = ASSET_CSS, doc = globalThis.document, faces = true } = {}) {
  const filled = fillAssetCss(css, map, {
    faces,
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
  lastCommon = null;
  facesAdded = null;
  delivered.clear();
  awaiting.clear();
  status = { state: 'idle', tier: null, requested: null, ids: 0, css: 0, failed: [] };
  setBuiltInSource(null);
}
