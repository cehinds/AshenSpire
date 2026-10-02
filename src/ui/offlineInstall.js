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
  // The page and its base first: these are what an offline visit asks for.
  for (const url of [new URL(loc.pathname, loc.href).href, new URL('asset-base.json', loc.href).href]) {
    const res = await keep(url);
    if (!res.ok) throw new Error('This page could not be kept offline. Check your connection and try again.');
    await res.arrayBuffer();
  }
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
  return { objects: total, failed, persisted, scope: registration?.scope || null };
}

/** Whether this page is kept offline now: its worker is registered and controls the page. */
export async function offlineState({ status = builtInArtStatus(), loc = globalThis.location, nav = globalThis.navigator } = {}) {
  try {
    if (!nav?.serviceWorker?.getRegistration || typeof status?.base !== 'string') return { registered: false };
    const registration = await nav.serviceWorker.getRegistration(new URL(status.base, loc.href).href);
    return { registered: !!registration && registration.active?.scriptURL === workerUrl(status.base, loc.href) };
  } catch { return { registered: false }; }
}

/** Remove the offline copy: unregister the site's worker and delete its caches. Returns how many were removed. */
export async function removeOfflineCopy({ status = builtInArtStatus(), loc = globalThis.location, nav = globalThis.navigator, cacheStorage = globalThis.caches } = {}) {
  let removed = 0;
  const script = typeof status?.base === 'string' ? workerUrl(status.base, loc.href) : null;
  for (const registration of (await nav?.serviceWorker?.getRegistrations?.()) || []) {
    const url = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL;
    if (script && url === script && await registration.unregister()) removed++;
  }
  for (const name of (await cacheStorage?.keys?.()) || []) if (name.startsWith(CACHE_PREFIX) && await cacheStorage.delete(name)) removed++;
  return removed;
}
