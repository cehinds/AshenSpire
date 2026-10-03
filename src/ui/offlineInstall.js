// src/ui/offlineInstall.js — "Make available offline" on Download & saves
// (docs/EXTERNAL-ASSETS-PLAN.md §5 option A, step 6b).
//
// On the hosted site a pack-shaped build can be kept in this browser: the page
// registers the site's service worker (`sw.js` at the site root, written by
// tools/pages-site.mjs from tools/pages-sw.mjs) and asks it to keep this page,
// its asset-base.json and its pinned indexes, then fetches every object the
// light and common indexes list (and high, when the player asks), which the
// worker checks against its name and caches. Offline, the same URL then boots
// from the cache: the HTML and indexes network-first with the kept copy as the
// fallback, the objects cache-first.
//
// WHAT IT NEVER DOES. It registers nothing until the player asks; it uses a
// RELATIVE url built on asset-base.json's base (new URL(base + 'sw.js',
// location.href)), never `/sw.js`, which on github.io would name the host's
// root; and a page that is not a hosted pack build (a single file, file://,
// the source tree, a local build with no sw.js beside its store) offers
// nothing here. The map tiles and the score are not objects the page reads
// yet (step 3c), so offline they fall back to the low-detail map and the synth.

import { ASSET_PACKS, builtInArtStatus, loadIndex, packsPinned } from './assetPacks.js';

/** The worker file, relative to the base (tools/pages-sw.mjs SW_FILE). */
export const SW_FILE = 'sw.js';
/** The header that asks the worker to keep a page (tools/pages-sw.mjs OFFLINE_HEADER). */
export const OFFLINE_HEADER = 'X-Ashen-Offline';
/** The caches the worker owns start with this (tools/pages-sw.mjs CACHE_PREFIX). */
export const CACHE_PREFIX = 'ashen-';

/**
 * Whether this page can be kept offline: { ok, base, high, reason }. `high`
 * says whether the build pins a high index the player may add.
 */
export function offlineSupport({ pin = ASSET_PACKS, status = builtInArtStatus(), loc = globalThis.location, nav = globalThis.navigator } = {}) {
  const high = !!pin?.packs?.high;
  if (!packsPinned(pin)) return { ok: false, base: null, high, reason: 'single' };
  if (!/^https?:$/.test(String(loc?.protocol || ''))) return { ok: false, base: null, high, reason: 'protocol' };
  if (!nav?.serviceWorker || typeof nav.serviceWorker.register !== 'function') return { ok: false, base: null, high, reason: 'unsupported' };
  if (status?.state === 'loading' || status?.state === 'idle') return { ok: false, base: null, high, reason: 'loading' };
  if (status?.state !== 'loaded' || typeof status.base !== 'string') return { ok: false, base: null, high, reason: 'art' };
  return { ok: true, base: status.base, high, reason: '' };
}

/** The worker's url and the scope it controls, for a base. */
export function workerUrl(base, href = globalThis.location?.href) {
  return new URL(`${base}${SW_FILE}`, href).href;
}

/** The packs to keep: light and common always (the fallback tier), high only when asked. */
export function offlinePacks(pin, includeHigh = false) {
  return ['light', 'common', ...(includeHigh ? ['high'] : [])].filter((p) => pin?.packs?.[p]);
}

/**
 * Resolves once the worker is active and controls the page, or rejects after
 * `ms` (a worker that fails to install never makes `ready` resolve).
 */
function controlled(nav, ms) {
  return new Promise((done, fail) => {
    let settled = false;
    const finish = (error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) fail(error); else done(); };
    const timer = setTimeout(() => finish(new Error('The offline service did not start. Reload the page and try again.')), ms);
    nav.serviceWorker.addEventListener('controllerchange', () => finish(), { once: true });
    Promise.resolve(nav.serviceWorker.ready).then(() => { if (nav.serviceWorker.controller) finish(); }, () => {});
  });
}

/**
 * makeAvailableOffline(opts) → { objects, failed, persisted, scope }. Throws
 * with a sentence a player can read when the worker cannot be registered or
 * the page or an index cannot be kept. `onProgress(done, total)` is called as
 * objects arrive; `signal` aborts.
 */
export async function makeAvailableOffline({
  includeHigh = false, onProgress = () => {}, signal,
  pin = ASSET_PACKS, status = builtInArtStatus(), loc = globalThis.location, nav = globalThis.navigator,
  fetchImpl = globalThis.fetch, concurrency = 6, controlMs = 15000,
} = {}) {
  const support = offlineSupport({ pin, status, loc, nav });
  if (!support.ok) throw new Error('This copy of the game cannot be kept offline.');
  let registration;
  try {
    registration = await nav.serviceWorker.register(workerUrl(support.base, loc.href), { updateViaCache: 'none' });
  } catch {
    throw new Error('The offline service is not available on this site.');
  }
  await controlled(nav, controlMs);
  let persisted = false;
  try { persisted = !!(await nav.storage?.persist?.()); } catch { persisted = false; }
  const keep = (url, init = {}) => fetchImpl(url, { ...init, cache: 'no-store', signal, headers: { [OFFLINE_HEADER]: '1' } });
  const keepOne = async (url) => {
    const res = await keep(url);
    if (!res.ok) throw new Error('This page could not be kept offline. Check your connection and try again.');
    await res.arrayBuffer();
  };
  // The base first; THE PAGE ITSELF LAST, only once every index and object is
  // in: the kept page is what offlineState reads as "kept", so a keep that
  // fails partway never claims this build (review of #1456).
  await keepOne(new URL('asset-base.json', loc.href).href);
  // Each index, kept by the worker as it passes, and checked against its pin here.
  const objects = new Set();
  for (const pack of offlinePacks(pin, includeHigh)) {
    let map;
    try { map = await loadIndex(pack, pin, { base: support.base, fetchImpl: (url, init) => keep(url, init), signal }); }
    catch { throw new Error('The art index could not be kept offline. Check your connection and try again.'); }
    for (const url of map.values()) objects.add(url);
  }
  // Every object: the worker checks each against its name before caching it.
  const queue = [...objects];
  const total = queue.length;
  let done = 0;
  let failed = 0;
  onProgress(0, total);
  const worker = async () => {
    while (queue.length) {
      signal?.throwIfAborted?.();
      const url = queue.shift();
      try {
        const res = await fetchImpl(url, { signal });
        if (!res.ok) failed++;
        try { await res.body?.cancel?.(); } catch { /* already read */ }
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        failed++;
      }
      done++;
      onProgress(done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker));
  if (!failed) await keepOne(new URL(loc.pathname, loc.href).href);
  return { objects: total, failed, kept: !failed, persisted, scope: registration?.scope || null };
}

/** The worker's page cache (tools/pages-sw.mjs PAGE_CACHE). */
export const PAGE_CACHE = 'ashen-pages-v1';

/** The key the worker keeps a page under: origin + path, a trailing index.html folded (pages-sw.mjs pageKey). */
export function pageCacheKey(href) {
  const url = new URL(href);
  const path = url.pathname.endsWith('/index.html') ? url.pathname.slice(0, -'index.html'.length) : url.pathname;
  return url.origin + path;
}

/**
 * Whether THIS build is kept offline: { registered, kept }. The worker's
 * registration is shared by every build under the site root, so it only says
 * the service is on (`registered`). `kept` is per page: this page's HTML and
 * the light and common indexes its own pin names are in the worker's page
 * cache, which only "Make available offline" for this page writes.
 */
export async function offlineState({ pin = ASSET_PACKS, status = builtInArtStatus(), loc = globalThis.location, nav = globalThis.navigator, cacheStorage = globalThis.caches } = {}) {
  try {
    if (!nav?.serviceWorker?.getRegistration || typeof status?.base !== 'string') return { registered: false, kept: false };
    const registration = await nav.serviceWorker.getRegistration(new URL(status.base, loc.href).href);
    const registered = !!registration && registration.active?.scriptURL === workerUrl(status.base, loc.href);
    if (!registered || !cacheStorage?.open) return { registered, kept: false };
    const cache = await cacheStorage.open(PAGE_CACHE);
    const wanted = [pageCacheKey(loc.href), ...offlinePacks(pin).map((p) => pageCacheKey(new URL(`${status.base}${pin.packs[p].index}`, loc.href).href))];
    for (const key of wanted) if (!(await cache.match(key))) return { registered, kept: false };
    return { registered, kept: true };
  } catch { return { registered: false, kept: false }; }
}

const PIN_IN_HTML = /const ASSET_PACKS = (\{.*?\});\n/;
const isPageEntry = (url) => !/\.json$/.test(new URL(url).pathname);

/**
 * Remove THIS build's offline copy (Copilot, #1456): its page, its
 * asset-base.json and the indexes no other kept build pins. The objects are
 * shared by every kept build and stay. When no other build is kept, the
 * worker is unregistered and every ashen- cache deleted, objects included.
 * Returns { scope: 'build' | 'all', others } — `others` kept builds remain.
 */
export async function removeOfflineCopy({ pin = ASSET_PACKS, status = builtInArtStatus(), loc = globalThis.location, nav = globalThis.navigator, cacheStorage = globalThis.caches } = {}) {
  const base = typeof status?.base === 'string' ? status.base : './';
  const cache = await cacheStorage.open(PAGE_CACHE);
  const mine = pageCacheKey(loc.href);
  await cache.delete(mine);
  await cache.delete(pageCacheKey(new URL('asset-base.json', loc.href).href));
  const keys = (await cache.keys()).map((k) => (typeof k === 'string' ? k : k.url));
  const others = keys.filter((k) => isPageEntry(k) && k !== mine);
  if (!others.length) {
    const script = workerUrl(base, loc.href);
    for (const registration of (await nav?.serviceWorker?.getRegistrations?.()) || []) {
      const url = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL;
      if (url === script) await registration.unregister();
    }
    for (const name of (await cacheStorage.keys()) || []) if (name.startsWith(CACHE_PREFIX)) await cacheStorage.delete(name);
    return { scope: 'all', others: 0 };
  }
  // The indexes another kept build still pins stay.
  const root = new URL(base, loc.href);
  const pinned = new Set();
  for (const key of others) {
    try {
      const res = await cache.match(key);
      const m = PIN_IN_HTML.exec(res ? await res.text() : '');
      for (const p of Object.values(m ? JSON.parse(m[1]).packs || {} : {})) pinned.add(new URL(p.index, root).href);
    } catch { /* an unreadable entry pins nothing */ }
  }
  for (const p of Object.values(pin?.packs || {})) {
    const url = new URL(p.index, root).href;
    if (!pinned.has(url)) await cache.delete(url);
  }
  return { scope: 'build', others: others.length };
}
