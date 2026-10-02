// tools/pages-sw.mjs — the Pages service worker, as text (docs/EXTERNAL-ASSETS-PLAN.md
// §4 "Service worker", §5 option A, §8 "Service-worker staleness"; step 6b).
//
// tools/pages-site.mjs writes serviceWorkerSource() at the site root as
// `/AshenSpire/sw.js`, and `--check` proves the published copy is exactly this
// text (a stale or hand-edited sw.js is red). The page registers it only when the
// player asks for it (Download & saves → "Make available offline",
// src/ui/offlineInstall.js), with a RELATIVE url built on asset-base.json's base,
// so its scope is the project site, `/AshenSpire/`, never the host's root.
//
// WHAT THE WORKER DOES
//   · objects/<xx>/<sha256>.<ext> — cache-first. A miss is fetched whole, its
//     SHA-256 is checked against its own name, and only then is it cached; a
//     file that fails its name is never cached and answers 502. The name is the
//     content, so a cached object can never be stale.
//   · a Range request for a cached object (an <audio> element asks for ranges,
//     and Safari needs a 206 to play) is answered with a 206 slice of the cached
//     bytes; on a miss the whole object is fetched, checked and cached first,
//     then sliced, so no unchecked byte is ever answered.
//   · pages — navigations, asset-base.json, build.json and packs/ — are
//     NETWORK-FIRST. Online, the network always answers, so a cached copy can
//     never shadow a newer build. The cache answers only when the network
//     fails, and it holds only what "Make available offline" stored (a request
//     carrying the X-Ashen-Offline header): browsing never writes a page into
//     it, so an offline copy is the HTML, indexes and objects of one moment.
//   · everything else in scope passes straight to the network, untouched.
//
// THE KILL-SWITCH. SW_KILL below is committed `false`. Flipping it to `true`
// (and publishing) replaces the worker with one that registers no fetch
// handler, deletes every `ashen-` cache, unregisters itself and reloads the
// pages it controlled. The page registers with updateViaCache: 'none', so the
// browser re-checks sw.js on every navigation and the switch arrives on the
// next visit. It is a committed constant, not a dispatch input, because every
// push to dev republishes the site: a switch thrown by one run would be
// undone by the next.

import { createHash } from 'node:crypto';

/** The published file, at the site root (the worker's scope is its folder). */
export const SW_FILE = 'sw.js';
/** Bump when the worker's behaviour changes; recorded in builds.json. */
export const SW_VERSION = 1;
/** The kill-switch (see the header). Committed false. */
export const SW_KILL = false;
/** The request header that asks the worker to keep a page for offline play. */
export const OFFLINE_HEADER = 'X-Ashen-Offline';
/** Every cache the worker owns starts with this. */
export const CACHE_PREFIX = 'ashen-';
export const OBJECT_CACHE = 'ashen-objects-v1';
export const PAGE_CACHE = 'ashen-pages-v1';

/**
 * One `bytes=` range against a body of `size` bytes, as tools/browser.mjs
 * serveDir reads it: `{start, end}` (inclusive), `null` when the header is
 * absent or invalid (answer the whole body, RFC 9110 14.2), or 'unsatisfiable'
 * (416). Self-contained: its source is copied into the worker.
 */
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m || (!m[1] && !m[2])) return null;
  if (m[1] && m[2] && Number(m[2]) < Number(m[1])) return null;
  if (!m[1] && Number(m[2]) === 0) return 'unsatisfiable';
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

/** The sha256 an `objects/<xx>/<sha256>.<ext>` path (relative to the scope) names, or null. Self-contained. */
export function objectSha(rel) {
  const m = /^objects\/([0-9a-f]{2})\/([0-9a-f]{64})\.[a-z0-9]+$/.exec(String(rel || ''));
  return m && m[2].slice(0, 2) === m[1] ? m[2] : null;
}

/**
 * The cache key of a page request: origin + path, without the query (a
 * `?shot=` boot is the same page) and with a trailing `index.html` folded into
 * its folder. Self-contained.
 */
export function pageKey(href) {
  const url = new URL(href);
  const path = url.pathname.endsWith('/index.html') ? url.pathname.slice(0, -'index.html'.length) : url.pathname;
  return url.origin + path;
}

/** Whether a path inside the scope is a page the worker keeps network-first. Self-contained. */
export function isPagePath(rel) {
  return /(^|\/)(asset-base|build)\.json$/.test(rel) || /^packs\/[^/]+$/.test(rel);
}

/** Lower-case hex of an ArrayBuffer. Self-contained. */
export function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The worker's text. `kill` writes the kill-switch. */
export function serviceWorkerSource({ kill = SW_KILL } = {}) {
  return `// AshenSpire — the Pages service worker (docs/EXTERNAL-ASSETS-PLAN.md §4, §5 A; step 6b).
// GENERATED by tools/pages-sw.mjs and written by tools/pages-site.mjs; pages-site
// --check proves the published copy is that text. Do not edit it here.
'use strict';
const VERSION = ${JSON.stringify(SW_VERSION)};
const KILL = ${kill ? 'true' : 'false'};
const OBJECT_CACHE = ${JSON.stringify(OBJECT_CACHE)};
const PAGE_CACHE = ${JSON.stringify(PAGE_CACHE)};
const CACHE_PREFIX = ${JSON.stringify(CACHE_PREFIX)};
const OFFLINE_HEADER = ${JSON.stringify(OFFLINE_HEADER.toLowerCase())};
const SCOPE_PATH = new URL(self.registration.scope).pathname;

${parseRange.toString()}

${objectSha.toString()}

${pageKey.toString()}

${isPagePath.toString()}

${hex.toString()}

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => { event.waitUntil(KILL ? retire() : claim()); });

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ashen-sw-version' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION, kill: KILL });
  }
});

async function claim() {
  for (const name of await caches.keys()) {
    if (name.startsWith(CACHE_PREFIX) && name !== OBJECT_CACHE && name !== PAGE_CACHE) await caches.delete(name);
  }
  await self.clients.claim();
}

// THE KILL-SWITCH: every cache this worker owns goes, the registration goes,
// and each page it controlled reloads from the network.
async function retire() {
  for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
  // Take every page in scope first (Codex, #1456): a tab still controlled by
  // the old worker is not this worker's client until claimed, and would not
  // be reloaded off it.
  try { await self.clients.claim(); } catch (error) { /* reload what we can */ }
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await self.registration.unregister();
  for (const client of windows) { try { await client.navigate(client.url); } catch (error) { /* not ours to reload */ } }
}

if (!KILL) self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  const rel = url.pathname.slice(SCOPE_PATH.length);
  const sha = objectSha(rel);
  if (sha) { event.respondWith(object(event, url, sha)); return; }
  if (request.headers.has('range')) return;
  if (request.mode === 'navigate' || request.headers.get(OFFLINE_HEADER) === '1' || isPagePath(rel)) event.respondWith(page(request));
});

// Network-first. A copy is written only when the page asked for it to be kept,
// and read only when the network fails.
async function page(request) {
  const keep = request.headers.get(OFFLINE_HEADER) === '1';
  const key = pageKey(request.url);
  try {
    const response = keep ? await fetch(request, { cache: 'no-store' }) : await fetch(request);
    if (keep && response.ok && (response.type === 'basic' || response.type === 'default') && !response.redirected) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(key, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(PAGE_CACHE);
    const hit = await cache.match(key);
    if (hit) return hit;
    return Response.error();
  }
}

const filling = new Map();

async function object(event, url, sha) {
  const request = event.request;
  const key = url.origin + url.pathname;
  const cache = await caches.open(OBJECT_CACHE);
  const range = request.headers.get('range');
  const hit = await cache.match(key);
  if (hit) return range ? slice(hit, range) : hit;
  // A miss is fetched WHOLE and checked against its name before any byte of it
  // is answered, a Range included (Copilot, #1456): a range straight from the
  // network could hand out a corrupt object's bytes as a 206.
  // One fill per object at a time: requests for an object already being
  // fetched (an <audio> asks for several ranges at once) wait for that fill.
  let pending = filling.get(key);
  if (!pending) {
    pending = fill(cache, key, sha).finally(() => filling.delete(key));
    filling.set(key, pending);
  }
  let got;
  try { got = await pending; }
  catch (error) { return new Response('', { status: 502, statusText: 'object unavailable or failed its hash' }); }
  const whole = new Response(got.bytes, { status: 200, headers: got.headers });
  return range ? slice(whole, range) : whole;
}

// Fetch the whole object, check it against its name, cache it; { bytes, headers }.
async function fill(cache, key, sha) {
  const response = await fetch(key);
  if (!response.ok) throw new Error(String(response.status));
  const bytes = await response.arrayBuffer();
  if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha) throw new Error('hash');
  const headers = { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
    'Content-Length': String(bytes.byteLength), 'Accept-Ranges': 'bytes' };
  await cache.put(key, new Response(bytes, { status: 200, headers }));
  return { bytes, headers };
}

async function slice(response, header) {
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const type = response.headers.get('Content-Type') || 'application/octet-stream';
  const r = parseRange(header, size);
  if (r === null) return new Response(bytes, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
  if (r === 'unsatisfiable') return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(bytes.slice(r.start, r.end + 1), { status: 206, headers: { 'Content-Type': type,
    'Content-Range': 'bytes ' + r.start + '-' + r.end + '/' + size, 'Content-Length': String(r.end - r.start + 1), 'Accept-Ranges': 'bytes' } });
}
`;
}

/** sha256 of the worker text, as builds.json records it. */
export function serviceWorkerSha256(opts) {
  return createHash('sha256').update(serviceWorkerSource(opts)).digest('hex');
}
