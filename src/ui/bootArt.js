// src/ui/bootArt.js — the web edition's art loading, as the player sees it
// (docs/EXTERNAL-ASSETS-PLAN.md §3, *The loading screen*, step 5).
//
// THE CRITICAL SET. While the startup gate waits for its first press, the
// loader (src/ui/assetPacks.js) fetches the indexes; once they have loaded, the
// files the gate and the title need first are warmed: the "AS Lore" faces and
// the title backdrops. The set is listed in content/config
// (`presentation.startupGate.components.artLoading.critical`), never typed
// here. Warming never blocks anything: a press before it finishes goes to the
// title, where a late backdrop or face swaps in as it arrives (the CSS already
// names them; `font-display: swap` is set).
//
// THE LINE. One status line beside the gate (its own component,
// src/ui/components/bootArtStatus.js, never one of the gate's parts: SPEC §7.1)
// says where the load is: "Loading art…"
// while the indexes load, "Loading art · 12 of 19" while the set warms, nothing
// once it is done, and a sentence when the load failed (the title then offers
// Retry). The words are rows of content/source/uiStrings.csv. The line is a
// polite live region kept aria-busy while it counts, so a screen reader hears
// the outcome rather than every tick; with Reduced motion it does not pulse.
//
// A single file and the source tree pin no packs: the phase stays `off` and
// the gate draws no line at all, exactly as before step 5.

import { uiConfig } from '../config/generated/ui.js';
import { packsPinned } from './assetPacks.js';
import { t, tFull } from './strings.js';

const LOADING = uiConfig.presentation.startupGate;
/**
 * The files the gate and the title need first, in content/config's order:
 * { id, orientation } with orientation 'any', 'portrait' or 'landscape'. A
 * backdrop the stylesheets swap by orientation (the entrance hall and its
 * phone cut, kit.css `@media (orientation: portrait)`) is tagged, so a screen
 * warms only the one its CSS will ask for.
 */
export const CRITICAL_SET = Object.freeze((LOADING.components.artLoading?.critical || []).map((entry) => Object.freeze(
  typeof entry === 'string' ? { id: entry, orientation: 'any' } : { id: String(entry.id), orientation: entry.orientation || 'any' },
)));
/** How long the line may count before it is cleared; the files keep loading. */
export const CRITICAL_WAIT_MS = Number(LOADING.behavior?.artLoading?.criticalWaitMs) || 20000;
/**
 * A Retry's deadline (src/ui/artTier.js retryBuiltInArt). Nothing waits on a
 * Retry, so it is not the boot's BOOT_WAIT_MS: a link too slow to bring the art
 * index in 8 s must still be able to bring it on a Retry (review of #1471).
 */
export const RETRY_WAIT_MS = Number(LOADING.behavior?.artLoading?.retryWaitMs) || 60000;

/** This screen's orientation, as the stylesheets' media queries read it. */
export function screenOrientation(win = globalThis) {
  try { return win.matchMedia?.('(orientation: portrait)')?.matches ? 'portrait' : 'landscape'; } catch { return 'landscape'; }
}

/** The critical ids for one orientation: the untagged ones and those tagged for it. */
export function criticalIds(orientation = screenOrientation(), set = CRITICAL_SET) {
  return set.filter((e) => e.orientation === 'any' || e.orientation === orientation).map((e) => e.id);
}

/** The attribute every element that shows the line carries. */
export const BOOT_ART_ATTR = 'data-boot-art-status';

let phase = Object.freeze({ state: 'off', done: 0, total: 0 });
let runId = 0;

/** Where the boot's art load is: off (nothing pinned), index, warming, done or failed. */
export function bootArtPhase() { return phase; }

/**
 * bootArtLine(p) → null when the gate shows no line (nothing pinned), else
 * { state, text }: the words for that phase ('' once the set is done).
 */
export function bootArtLine(p = phase) {
  if (!p || p.state === 'off') return null;
  if (p.state === 'index') return { state: 'loading', text: t('art.loading') };
  if (p.state === 'warming') return { state: 'loading', text: t('art.progress', { done: p.done, total: p.total }) };
  if (p.state === 'failed') return { state: 'failed', text: tFull('art.failed.gate') };
  return { state: 'done', text: '' };
}

/** Write the line into every element that shows it. */
export function paintBootArt(doc = globalThis.document) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const line = bootArtLine();
  for (const el of doc.querySelectorAll(`[${BOOT_ART_ATTR}]`)) {
    el.textContent = line ? line.text : '';
    el.dataset.state = line ? line.state : 'off';
    el.setAttribute('aria-busy', line && line.state === 'loading' ? 'true' : 'false');
  }
}

function setPhase(next, doc) {
  phase = Object.freeze({ done: 0, total: 0, ...next });
  paintBootArt(doc);
}

function isFont(id) { return /\.woff2?$/i.test(String(id)); }

/** The default image warm-up: load and decode, settle either way. */
function loadImageDefault(url) {
  return new Promise((done) => {
    if (typeof Image !== 'function') { done(false); return; }
    const img = new Image();
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/** The default face warm-up over http(s): the same url the @font-face rule names, into the HTTP cache. */
async function loadFontDefault(url) {
  try {
    const res = await globalThis.fetch(url);
    if (!res || !res.ok) return false;
    await res.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/**
 * warmCriticalSet({ ids, map, protocol, loadImage, loadFont, onProgress, waitMs })
 * → { done, total, failed }. Every id `map` (the built-in source) lists is
 * loaded once; an id it does not list (the common index failed, so no faces)
 * is not counted. Under file:// the faces are already FontFace objects from the
 * font sidecar (the loader added them before it published the source), so
 * they count as done without a request: a file:// page cannot load a face by
 * url(). Resolves when every file has settled, or after `waitMs`.
 */
export function warmCriticalSet({
  ids = criticalIds(), map, protocol = globalThis.location?.protocol,
  loadImage = loadImageDefault, loadFont = loadFontDefault, onProgress = () => {}, waitMs = CRITICAL_WAIT_MS,
} = {}) {
  const items = ids.filter((id) => map && typeof map.get === 'function' && typeof map.get(id) === 'string');
  const total = items.length;
  let done = 0;
  let failed = 0;
  const viaFile = String(protocol || '') === 'file:';
  return new Promise((finish) => {
    let over = false;
    const end = () => { if (!over) { over = true; clearTimeout(timer); finish({ done, total, failed }); } };
    const timer = setTimeout(end, waitMs);
    if (!total) { end(); return; }
    onProgress(done, total);
    for (const id of items) {
      const url = map.get(id);
      const load = isFont(id) ? (viaFile ? Promise.resolve(true) : loadFont(url)) : loadImage(url);
      Promise.resolve(load).then((ok) => ok, () => false).then((ok) => {
        if (over) return;
        done += 1;
        if (!ok) failed += 1;
        onProgress(done, total);
        if (done === total) end();
      });
    }
  });
}

/**
 * startBootArt({ settled, source, pinned, doc, warm }) — the gate's line for
 * one cold boot. `settled` is the boot load (startBuiltInArt's promise);
 * `source()` the map it published. Phase: index → (warming → done) | failed.
 * Returns a promise that settles when the line has nothing more to say.
 */
export function startBootArt({ settled, source, pinned = packsPinned(), doc = globalThis.document, warm = warmCriticalSet } = {}) {
  const mine = ++runId;
  if (!pinned || !settled) { setPhase({ state: 'off' }, doc); return Promise.resolve(phase); }
  setPhase({ state: 'index' }, doc);
  return Promise.resolve(settled).then(async (status) => {
    if (mine !== runId) return phase;
    if (!status || status.state !== 'loaded') { setPhase({ state: 'failed' }, doc); return phase; }
    const map = typeof source === 'function' ? source() : null;
    await warm({ map, onProgress: (done, total) => { if (mine === runId) setPhase({ state: 'warming', done, total }, doc); } });
    if (mine === runId) setPhase({ state: 'done' }, doc);
    return phase;
  }, () => { if (mine === runId) setPhase({ state: 'failed' }, doc); return phase; });
}

/**
 * bootArtRetried(status) — a Retry (src/ui/artTier.js retryBuiltInArt) settled:
 * a load that now succeeded clears a failed line; one that failed again keeps it.
 */
export function bootArtRetried(status, doc = globalThis.document) {
  if (phase.state === 'off') return;
  runId += 1;
  setPhase({ state: status && status.state === 'loaded' ? 'done' : 'failed' }, doc);
}

/** For tests: forget the line. */
export function resetBootArt() {
  runId += 1;
  phase = Object.freeze({ state: 'off', done: 0, total: 0 });
}
