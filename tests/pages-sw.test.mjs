// The Pages service worker and store (docs/EXTERNAL-ASSETS-PLAN.md §4, §5 A;
// step 6b): the worker's text run in a sandbox with a fake cache and network,
// the store's pure helpers, and the in-game download's new target.
// tools/pages-offline.mjs drives the same worker in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRange, objectSha, pageKey, isPagePath, serviceWorkerSource, SW_KILL, OBJECT_CACHE, PAGE_CACHE, OFFLINE_HEADER } from '../tools/pages-sw.mjs';
import { assetBaseFor, assetBaseText, packPinOf, pinnedPackFiles, publishPack, storeFindings, packPages, writeServiceWorker, serviceWorkerFindings } from '../tools/pages-store.mjs';
import { releasedDownload, receiveDownload } from '../src/model/offlineDownload.js';
import { createSha256 } from '../src/ui/sha256.js';
import { offlinePacks, workerUrl, offlineSupport, offlineState, removeOfflineCopy, makeAvailableOffline, pageCacheKey, PAGE_CACHE as PAGE_CACHE_UI, OFFLINE_HEADER as OFFLINE_HEADER_UI, SW_FILE as SW_FILE_UI } from '../src/ui/offlineInstall.js';
import { SW_FILE } from '../tools/pages-sw.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');

test('the kill-switch is a committed boolean, and what is published is recorded and checked', () => {
  assert.equal(typeof SW_KILL, 'boolean');
  const dir = mkdtempSync(join(tmpdir(), 'pages-sw-test-'));
  try {
    const rec = writeServiceWorker(dir, { kill: SW_KILL });
    assert.equal(rec.kill, SW_KILL);
    assert.equal(rec.sha256, sha(readFileSync(join(dir, 'sw.js'))));
    assert.deepEqual(serviceWorkerFindings(dir, rec).map(([, ok]) => ok), [true]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('parseRange reads one byte range the way serveDir does', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=990-5000', 1000), { start: 990, end: 999 });
  assert.equal(parseRange('bytes=5-3', 1000), null, 'invalid: the whole body');
  assert.equal(parseRange('', 1000), null);
  assert.equal(parseRange('bytes=-', 1000), null);
  assert.equal(parseRange('bytes=1000-', 1000), 'unsatisfiable');
  assert.equal(parseRange('bytes=-0', 1000), 'unsatisfiable');
});

test('objectSha accepts only a store path whose folder is its own prefix', () => {
  const h = 'ab'.padEnd(64, '0');
  assert.equal(objectSha(`objects/ab/${h}.mp3`), h);
  assert.equal(objectSha(`objects/cd/${h}.mp3`), null);
  assert.equal(objectSha(`dev/1/objects/ab/${h}.mp3`), null, 'only the store at the scope root');
  assert.equal(objectSha(`objects/ab/${h}`), null);
});

test('pageKey folds the query and a trailing index.html; isPagePath names the network-first files', () => {
  assert.equal(pageKey('https://x.io/AshenSpire/dev/1/?shot=title'), 'https://x.io/AshenSpire/dev/1/');
  assert.equal(pageKey('https://x.io/AshenSpire/dev/1/index.html'), 'https://x.io/AshenSpire/dev/1/');
  assert.ok(isPagePath('dev/1/asset-base.json') && isPagePath('asset-base.json') && isPagePath('packs/light-abc.json') && isPagePath('dev/latest/build.json'));
  assert.ok(!isPagePath('dev/1/music/manifest.json') && !isPagePath('packs/x/y.json'));
});

// ---- the worker, run in a sandbox -------------------------------------------

function sandbox({ kill = false, network = async () => new Response('net', { status: 200 }) } = {}) {
  const listeners = {};
  const stores = new Map();
  const log = { unregistered: false, deleted: [], claimed: false, navigated: [], order: [] };
  const cacheOf = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      async match(key) { const r = m.get(typeof key === 'string' ? key : key.url); return r ? r.clone() : undefined; },
      async put(key, res) { if (res.status === 206) throw new TypeError('206 cannot be cached'); m.set(typeof key === 'string' ? key : key.url, res.clone()); },
    };
  };
  const caches = {
    async open(name) { return cacheOf(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { log.deleted.push(name); return stores.delete(name); },
  };
  const self = {
    registration: { scope: 'https://x.io/AshenSpire/', async unregister() { log.unregistered = true; return true; } },
    location: { origin: 'https://x.io' },
    clients: { async claim() { log.claimed = true; log.order.push('claim'); }, async matchAll(opts = {}) {
      log.order.push('matchAll'); log.matchAll = opts;
      // A tab still under the old worker is listed only with includeUncontrolled.
      const old = { url: 'https://x.io/AshenSpire/dev/2/', async navigate(u) { log.navigated.push(u); } };
      return [{ url: 'https://x.io/AshenSpire/dev/1/', async navigate(u) { log.navigated.push(u); } }, ...(opts.includeUncontrolled ? [old] : [])];
    } },
    skipWaiting() {},
    addEventListener(type, fn) { listeners[type] = fn; },
  };
  const context = vm.createContext({ self, caches, fetch: network, Response, Request, Headers, URL, crypto: webcrypto, Uint8Array, Array, String, Number, Math, Error, TypeError, Promise, console });
  vm.runInContext(serviceWorkerSource({ kill }), context);
  const fetchEvent = async (url, { headers = {}, mode = 'cors' } = {}) => {
    const request = new Request(url, { headers });
    Object.defineProperty(request, 'mode', { value: mode });
    let answer = null; const waits = [];
    listeners.fetch?.({ request, respondWith(p) { answer = p; }, waitUntil(p) { waits.push(p); } });
    const res = answer ? await answer : null;
    await Promise.all(waits);
    return res;
  };
  const activate = async () => { let p; listeners.activate({ waitUntil(x) { p = x; } }); await p; };
  return { listeners, stores, log, caches, fetchEvent, activate };
}

test('the kill-switch registers no fetch handler, deletes every ashen- cache, unregisters and reloads its pages', async () => {
  const live = sandbox();
  assert.equal(typeof live.listeners.fetch, 'function', 'the live worker answers fetches');
  const dead = sandbox({ kill: true });
  assert.equal(dead.listeners.fetch, undefined, 'the kill-switch answers nothing');
  await (await dead.caches.open(OBJECT_CACHE)).put('https://x.io/a', new Response('a'));
  await (await dead.caches.open('someone-else')).put('https://x.io/b', new Response('b'));
  await dead.activate();
  assert.deepEqual(dead.log.deleted, [OBJECT_CACHE]);
  assert.equal(dead.log.unregistered, true);
  assert.deepEqual(dead.log.navigated, ['https://x.io/AshenSpire/dev/1/', 'https://x.io/AshenSpire/dev/2/'], 'every window in scope, the old worker\'s too, is reloaded (Codex, #1456)');
  assert.deepEqual(dead.log.order, ['claim', 'matchAll'], 'it claims before it lists');
  assert.equal(dead.log.matchAll.includeUncontrolled, true);
  await live.activate();
  assert.equal(live.log.unregistered, false);
  assert.equal(live.log.claimed, true);
});

test('an object is checked against its name before it is cached, and a cached one answers a Range with a 206 slice', async () => {
  const body = new TextEncoder().encode('0123456789'.repeat(20));
  const h = sha(body);
  const url = `https://x.io/AshenSpire/objects/${h.slice(0, 2)}/${h}.mp3`;
  let calls = 0;
  const sw = sandbox({ network: async () => { calls++; return new Response(body, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }); } });
  const first = await sw.fetchEvent(url);
  assert.equal(first.status, 200);
  assert.equal(calls, 1);
  const ranged = await sw.fetchEvent(url, { headers: { Range: 'bytes=10-19' } });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get('Content-Range'), `bytes 10-19/${body.length}`);
  assert.equal(ranged.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(new TextDecoder().decode(await ranged.arrayBuffer()), '0123456789');
  assert.equal(calls, 1, 'the range came from the cache');
  const past = await sw.fetchEvent(url, { headers: { Range: `bytes=${body.length}-` } });
  assert.equal(past.status, 416);
  // A file that does not hash to its name is never cached.
  const bad = sandbox({ network: async () => new Response('tampered', { status: 200 }) });
  const answer = await bad.fetchEvent(url);
  assert.equal(answer.status, 502);
  assert.equal(bad.stores.get(OBJECT_CACHE)?.size || 0, 0);
});

test('a Range for an object not yet cached is answered only after the whole object is fetched and checked (Copilot, #1456)', async () => {
  const body = new TextEncoder().encode('abcdefghij');
  const h = sha(body);
  const url = `https://x.io/AshenSpire/objects/${h.slice(0, 2)}/${h}.mp3`;
  const asked = [];
  const sw = sandbox({ network: async (req) => {
    asked.push(typeof req === 'string' ? 'whole' : (req.headers.get('range') || 'whole'));
    return new Response(body, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  } });
  const [res, again, whole] = await Promise.all([sw.fetchEvent(url, { headers: { Range: 'bytes=2-4' } }),
    sw.fetchEvent(url, { headers: { Range: 'bytes=0-1' } }), sw.fetchEvent(url)]);
  assert.equal(again.status, 206);
  assert.equal(new TextDecoder().decode(await again.arrayBuffer()), 'ab');
  assert.equal((await whole.arrayBuffer()).byteLength, body.length);
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('Content-Range'), `bytes 2-4/${body.length}`);
  assert.equal(new TextDecoder().decode(await res.arrayBuffer()), 'cde');
  assert.deepEqual(asked, ['whole'], 'three requests at once share one whole fetch; no ranged network request');
  assert.equal(sw.stores.get(OBJECT_CACHE).size, 1);
  // A corrupt object is never sliced out to the page, nor cached.
  const bad = sandbox({ network: async () => new Response('corrupt!!!', { status: 200 }) });
  const answer = await bad.fetchEvent(url, { headers: { Range: 'bytes=0-3' } });
  assert.equal(answer.status, 502);
  assert.equal(bad.stores.get(OBJECT_CACHE)?.size || 0, 0);
});

test('pages are network-first: online the network answers even when a copy is kept; only a kept page is written; offline the copy answers', async () => {
  let online = true; let version = 'v1';
  const sw = sandbox({ network: async () => { if (!online) throw new TypeError('offline'); return new Response(version, { status: 200 }); } });
  const page = 'https://x.io/AshenSpire/dev/1/';
  // Browsing writes nothing.
  assert.equal(await (await sw.fetchEvent(page, { mode: 'navigate' })).text(), 'v1');
  assert.equal(sw.stores.get(PAGE_CACHE)?.size || 0, 0, 'a plain visit keeps nothing');
  // "Make available offline" keeps it.
  const kept = await sw.fetchEvent(page, { headers: { [OFFLINE_HEADER]: '1' } });
  assert.equal(await kept.text(), 'v1');
  assert.equal(sw.stores.get(PAGE_CACHE).size, 1);
  // A newer build online: the network wins, never the kept copy.
  version = 'v2';
  assert.equal(await (await sw.fetchEvent(`${page}?shot=title`, { mode: 'navigate' })).text(), 'v2');
  // Offline: the kept copy, under any query.
  online = false;
  assert.equal(await (await sw.fetchEvent(`${page}index.html?shot=map`, { mode: 'navigate' })).text(), 'v1');
  // Offline and never kept: a network error, not something else's copy.
  const other = await sw.fetchEvent('https://x.io/AshenSpire/dev/2/', { mode: 'navigate' });
  assert.equal(other.type, 'error');
  // Out of scope and non-page files are not intercepted at all.
  assert.equal(await sw.fetchEvent('https://x.io/elsewhere/', { mode: 'navigate' }), null);
  assert.equal(await sw.fetchEvent('https://x.io/AshenSpire/dev/1/music/manifest.json'), null);
});

// ---- the store ----------------------------------------------------------------

test('asset-base.json names the site root from every page kind (section 4)', () => {
  assert.equal(assetBaseFor('dev/12'), '../../');
  assert.equal(assetBaseFor('dev/latest'), '../../');
  assert.equal(assetBaseFor('build'), '../');
  assert.equal(assetBaseFor('dist'), '../');
  assert.equal(assetBaseFor(''), './');
  assert.equal(assetBaseText('dev/12'), '{"base":"../../"}\n');
});

function fixtureBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'pages-sw-test-'));
  const obj = Buffer.from('object bytes');
  const h = sha(obj);
  const indexText = `{\n"assets/a.webp":["${h}",${obj.length},"image/webp"]\n}\n`;
  const ih = sha(indexText);
  const name = `packs/light-${ih.slice(0, 12)}.json`;
  mkdirSync(join(dir, 'build/packs'), { recursive: true });
  mkdirSync(join(dir, `build/objects/${h.slice(0, 2)}`), { recursive: true });
  writeFileSync(join(dir, 'build', name), indexText);
  writeFileSync(join(dir, 'build', name.replace(/\.json$/, '.js')), 'twin');
  writeFileSync(join(dir, `build/objects/${h.slice(0, 2)}/${h}.webp`), obj);
  const pin = { schema: 1, tier: 'light', packs: { light: { index: name, sha256: ih } } };
  const html = Buffer.from(`<!doctype html><script>const ASSET_PACKS = ${JSON.stringify(pin)};\n</script>`);
  return { dir, html, pin, objectRel: `objects/${h.slice(0, 2)}/${h}.webp`, index: name };
}

test('publishPack shares one store between builds, and storeFindings proves it and names what is wrong', () => {
  const f = fixtureBuild();
  const site = join(f.dir, 'site');
  try {
    assert.deepEqual(packPinOf(f.html), f.pin);
    assert.equal(packPinOf('<script>const ASSET_PACKS = null;\n</script>'), null);
    assert.deepEqual(pinnedPackFiles(f.pin), [f.index, f.index.replace(/\.json$/, '.js')]);
    const one = publishPack(site, 'dev/1', f.html, join(f.dir, 'build'));
    const two = publishPack(site, 'dev/2', f.html, join(f.dir, 'build'));
    assert.equal(one.added, 1);
    assert.equal(two.added, 0, 'the second build adds nothing: the object is stored once');
    assert.equal(readFileSync(join(site, 'dev/2/asset-base.json'), 'utf8'), '{"base":"../../"}\n');
    const pages = packPages(site, ['dev']);
    assert.deepEqual(pages.map((p) => p.rel).sort(), ['dev/1/index.html', 'dev/2/index.html']);
    const reds = () => storeFindings(site, packPages(site, ['dev'])).filter(([, ok]) => !ok).map(([t]) => t);
    assert.deepEqual(reds(), []);
    rmSync(join(site, f.objectRel));
    assert.match(reds().join('\n'), /^MISSING OBJECT/m);
    publishPack(site, 'dev/3', f.html, join(f.dir, 'build'));
    rmSync(join(site, 'dev/1/asset-base.json'));
    assert.match(reds().join('\n'), /^MISSING dev\/1\/asset-base\.json/m);
    writeFileSync(join(site, 'dev/1/asset-base.json'), '{"base":"../"}');
    assert.match(reds().join('\n'), /^WRONG BASE dev\/1\/index\.html/m);
    writeFileSync(join(site, 'dev/1/asset-base.json'), '{"base":"../../"}');
    mkdirSync(join(site, 'objects/00'), { recursive: true });
    writeFileSync(join(site, 'objects/00/stray.webp'), 'x');
    assert.match(reds().join('\n'), /^UNREFERENCED/m);
    rmSync(join(site, 'objects/00'), { recursive: true });
    rmSync(join(site, f.index));
    assert.match(reds().join('\n'), /^MISSING INDEX for dev\/1\/index\.html/m);
    // A store that already holds a different file under the same name refuses
    // THAT build, by name, before writing anything of it (review of #1456).
    writeFileSync(join(site, f.index), 'other');
    assert.throws(() => publishPack(site, 'dev/4', f.html, join(f.dir, 'build')), (e) => e.refused === true && /disagree/.test(e.message));
    assert.ok(!existsSync(join(site, 'dev/4')), 'a refused build writes nothing');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('the published sw.js must be the current text for its recorded state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-sw-test-'));
  try {
    const rec = writeServiceWorker(dir, { kill: false });
    assert.ok(existsSync(join(dir, 'sw.js')));
    assert.deepEqual(serviceWorkerFindings(dir, rec).map(([, ok]) => ok), [true]);
    writeFileSync(join(dir, 'sw.js'), serviceWorkerSource({ kill: true }));
    assert.match(serviceWorkerFindings(dir, rec)[0][0], /^STALE sw\.js/);
    assert.deepEqual(serviceWorkerFindings(dir, { ...rec, kill: true }).map(([, ok]) => ok), [true]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---- the page side --------------------------------------------------------------

test('a pack-shaped build downloads its light single file from download/, and an old copy cannot be misled', () => {
  const url = 'https://example.org/dev/latest/build.json';
  const info = { branch: 'dev', ordinal: 742, version: '0.7.1', bytes: null, pageBytes: 9_000_000, download: { path: 'download/AshenSpire.html', bytes: 29_000_000, sha256: 'a'.repeat(64) } };
  const got = releasedDownload(info, url, 'dev');
  assert.equal(got.url, 'https://example.org/dev/742/download/AshenSpire.html');
  assert.equal(got.bytes, 29_000_000);
  assert.equal(got.filename, 'AshenSpire-dev-0.7.1.742.html');
  // The null top-level size is what a pre-6b copy reads; it refuses it.
  assert.throws(() => releasedDownload({ ...info, download: undefined }, url, 'dev'), /not ready/);
  for (const path of ['../x.html', '/abs.html', 'download/../../x.html', 'https://evil/x.html', 'download/x.js']) {
    assert.throws(() => releasedDownload({ ...info, download: { ...info.download, path } }, url, 'dev'), /not ready/, path);
  }
  assert.throws(() => releasedDownload({ ...info, download: { ...info.download, bytes: 0 } }, url, 'dev'));
});

test('the offline install keeps light and common (and high only when asked), and registers relative to the base', () => {
  const pin = { packs: { high: {}, light: {}, common: {} } };
  assert.deepEqual(offlinePacks(pin), ['light', 'common']);
  assert.deepEqual(offlinePacks(pin, true), ['light', 'common', 'high']);
  assert.deepEqual(offlinePacks({ packs: { light: {} } }, true), ['light']);
  assert.equal(workerUrl('../../', 'https://cehinds.github.io/AshenSpire/dev/742/'), 'https://cehinds.github.io/AshenSpire/sw.js');
  assert.equal(workerUrl('../', 'https://cehinds.github.io/AshenSpire/build/AshenSpire.html'), 'https://cehinds.github.io/AshenSpire/sw.js');
  const nav = { serviceWorker: { register() {} } };
  const loaded = { state: 'loaded', base: '../../' };
  const http = { protocol: 'https:' };
  assert.equal(offlineSupport({ pin: null, status: loaded, loc: http, nav }).reason, 'single');
  assert.equal(offlineSupport({ pin: { packs: { light: {} } }, status: loaded, loc: { protocol: 'file:' }, nav }).reason, 'protocol');
  assert.equal(offlineSupport({ pin: { packs: { light: {} } }, status: loaded, loc: http, nav: {} }).reason, 'unsupported');
  assert.equal(offlineSupport({ pin: { packs: { light: {} } }, status: { state: 'failed' }, loc: http, nav }).reason, 'art');
  assert.deepEqual(offlineSupport({ pin: { packs: { light: {} } }, status: loaded, loc: http, nav }), { ok: true, base: '../../', high: false, reason: '' });
});

test('the page and the worker agree on the cache, the header, the file and the page key', () => {
  assert.equal(PAGE_CACHE_UI, PAGE_CACHE);
  assert.equal(OFFLINE_HEADER_UI, OFFLINE_HEADER);
  assert.equal(SW_FILE_UI, SW_FILE);
  for (const href of ['https://x.io/AshenSpire/dev/1/?shot=map', 'https://x.io/AshenSpire/dev/1/index.html', 'https://x.io/AshenSpire/AshenSpire.html']) {
    assert.equal(pageCacheKey(href), pageKey(href));
  }
});

test('"kept" is this build\'s own copy, not the site-wide worker another build registered (Codex, #1456)', async () => {
  const pin = { packs: { light: { index: 'packs/light-aaa.json' }, common: { index: 'packs/common-bbb.json' } } };
  const status = { state: 'loaded', base: '../../' };
  const nav = { serviceWorker: { async getRegistration() { return { active: { scriptURL: 'https://x.io/AshenSpire/sw.js' } }; } } };
  const cacheWith = (keys) => ({ async open(name) { assert.equal(name, PAGE_CACHE); return { async match(k) { return keys.includes(k) ? {} : undefined; } }; } });
  const dev1 = ['https://x.io/AshenSpire/dev/1/', 'https://x.io/AshenSpire/packs/light-aaa.json', 'https://x.io/AshenSpire/packs/common-bbb.json'];
  // dev/1 was kept; dev/1 itself reads as kept, under any query.
  assert.deepEqual(await offlineState({ pin, status, nav, loc: { href: 'https://x.io/AshenSpire/dev/1/?shot=title' }, cacheStorage: cacheWith(dev1) }), { registered: true, kept: true });
  // Another ordinal shares the worker but is not kept.
  assert.deepEqual(await offlineState({ pin, status, nav, loc: { href: 'https://x.io/AshenSpire/dev/2/' }, cacheStorage: cacheWith(dev1) }), { registered: true, kept: false });
  // Same page, but a newer build pins a different index: not kept.
  const pin2 = { packs: { ...pin.packs, light: { index: 'packs/light-ccc.json' } } };
  assert.equal((await offlineState({ pin: pin2, status, nav, loc: { href: 'https://x.io/AshenSpire/dev/1/' }, cacheStorage: cacheWith(dev1) })).kept, false);
  // No worker at all: neither.
  const none = { serviceWorker: { async getRegistration() { return undefined; } } };
  assert.deepEqual(await offlineState({ pin, status, nav: none, loc: { href: 'https://x.io/AshenSpire/dev/1/' }, cacheStorage: cacheWith(dev1) }), { registered: false, kept: false });
});

test('"Remove" takes only this build, keeps what another kept build pins, and retires the worker with the last one (Copilot, #1456)', async () => {
  const pinOf = (light) => ({ packs: { light: { index: `packs/light-${light}.json` }, common: { index: 'packs/common-c.json' } } });
  const html = (light) => `<script>const ASSET_PACKS = ${JSON.stringify(pinOf(light))};\n</script>`;
  const R = 'https://x.io/AshenSpire/';
  const entries = new Map([
    [`${R}dev/1/`, html('a')], [`${R}dev/1/asset-base.json`, '{}'],
    [`${R}dev/2/`, html('b')], [`${R}dev/2/asset-base.json`, '{}'],
    [`${R}packs/light-a.json`, '{}'], [`${R}packs/light-b.json`, '{}'], [`${R}packs/common-c.json`, '{}'],
  ]);
  const caches = new Map([[PAGE_CACHE, entries], [OBJECT_CACHE, new Map([['o', 'x']])]]);
  let unregistered = 0;
  const nav = { serviceWorker: { async getRegistrations() { return [{ active: { scriptURL: `${R}sw.js` }, async unregister() { unregistered++; return true; } }]; } } };
  const cacheStorage = {
    async open(n) { const m = caches.get(n); return { async delete(k) { return m.delete(k); }, async keys() { return [...m.keys()]; }, async match(k) { return m.has(k) ? new Response(m.get(k)) : undefined; } }; },
    async keys() { return [...caches.keys()]; },
    async delete(n) { return caches.delete(n); },
  };
  const status = { state: 'loaded', base: '../../' };
  const one = await removeOfflineCopy({ pin: pinOf('a'), status, nav, cacheStorage, loc: { href: `${R}dev/1/?shot=x` } });
  assert.deepEqual(one, { scope: 'build', others: 1 });
  assert.deepEqual([...entries.keys()].sort(), [`${R}dev/2/`, `${R}dev/2/asset-base.json`, `${R}packs/common-c.json`, `${R}packs/light-b.json`]);
  assert.equal(unregistered, 0);
  assert.ok(caches.has(OBJECT_CACHE), 'the shared objects stay');
  const two = await removeOfflineCopy({ pin: pinOf('b'), status, nav, cacheStorage, loc: { href: `${R}dev/2/` } });
  assert.deepEqual(two, { scope: 'all', others: 0 });
  assert.equal(unregistered, 1);
  assert.equal(caches.size, 0);
});

test('a keep that fails partway never keeps the page, so the build is not called kept (review of #1456)', async () => {
  const h = 'ab'.repeat(32);
  const index = `{\n"assets/a.webp":["${h}",1,"image/webp"],\n"assets/b.webp":["${'cd'.repeat(32)}",1,"image/webp"]\n}\n`;
  const pin = { tier: 'light', packs: { light: { index: 'packs/light-x.json', sha256: sha(index) } } };
  const status = { state: 'loaded', base: '../../' };
  const loc = { protocol: 'https:', href: 'https://x.io/AshenSpire/dev/1/', pathname: '/AshenSpire/dev/1/' };
  const nav = { serviceWorker: { controller: {}, ready: Promise.resolve(), async register() { return { scope: 'https://x.io/AshenSpire/' }; }, addEventListener() {} } };
  const run = async (failObject) => {
    const kept = [];
    const fetchImpl = async (url, init = {}) => {
      const abs = new URL(url, loc.href).href;
      if (init.headers?.['X-Ashen-Offline'] === '1') kept.push(abs);
      if (abs.endsWith('light-x.json')) return new Response(index);
      if (failObject && abs.includes(`/${'cd'.repeat(32)}`)) return new Response('', { status: 502 });
      return new Response('x');
    };
    const result = await makeAvailableOffline({ pin, status, loc, nav, fetchImpl });
    return { result, kept };
  };
  const bad = await run(true);
  assert.equal(bad.result.failed, 1);
  assert.equal(bad.result.kept, false);
  assert.ok(!bad.kept.includes(loc.href), 'the page is never kept after a failure');
  const good = await run(false);
  assert.equal(good.result.kept, true);
  assert.equal(good.kept.at(-1), loc.href, 'the page is kept last');
  assert.equal(offlineSupport({ pin, status: { state: 'loading' }, loc, nav }).reason, 'loading', 'still loading is not "did not load"');
});

test('the downloaded light single file is checked against its published sha256 as it streams (review of #1456)', async () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 4097]) {
    const bytes = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255);
    const h = createSha256();
    for (let i = 0; i < n; i += 13) h.update(bytes.subarray(i, i + 13));
    assert.equal(h.digest(), sha(bytes), `chunked digest of ${n} bytes`);
  }
  const body = new TextEncoder().encode('the whole light single file');
  const stream = () => new Response(new ReadableStream({ start(c) { c.enqueue(body.subarray(0, 5)); c.enqueue(body.subarray(5)); c.close(); } }));
  const ok = await receiveDownload(stream(), { bytes: body.length, sha256: sha(body) });
  assert.equal(ok.bytes, body.length);
  await assert.rejects(receiveDownload(stream(), { bytes: body.length, sha256: 'f'.repeat(64) }), /did not match/);
  const info = { branch: 'dev', ordinal: 1, version: '0.7.1', bytes: null, download: { path: 'download/AshenSpire.html', bytes: 3, sha256: 'a'.repeat(64) } };
  assert.equal(releasedDownload(info, 'https://e.org/dev/latest/build.json', 'dev').sha256, 'a'.repeat(64));
  assert.throws(() => releasedDownload({ ...info, download: { ...info.download, sha256: 'nothex' } }, 'https://e.org/dev/latest/build.json', 'dev'));
});

test('a pin or index that names a file outside packs/ and objects/ is refused, and nothing is written (review of #1456)', () => {
  const f = fixtureBuild();
  const site = join(f.dir, 'site');
  try {
    const withPin = (pin) => Buffer.from(`<script>const ASSET_PACKS = ${JSON.stringify(pin)};\n</script>`);
    for (const index of ['../escape.json', 'packs/../../x.json', 'packs/light-zz.json', 'packs/Light-0123456789ab.json']) {
      assert.throws(() => publishPack(site, 'dev/9', withPin({ packs: { light: { index, sha256: 'a'.repeat(64) } } }), join(f.dir, 'build')),
        (e) => e.refused === true && /not a packs\//.test(e.message), index);
    }
    // An index row whose name is not a sha256.
    const badIndex = '{\n"assets/a.webp":["../../etc/passwd",1,"image/webp"]\n}\n';
    const name = `packs/light-${sha(badIndex).slice(0, 12)}.json`;
    writeFileSync(join(f.dir, 'build', name), badIndex);
    writeFileSync(join(f.dir, 'build', name.replace(/\.json$/, '.js')), 'twin');
    assert.throws(() => publishPack(site, 'dev/9', withPin({ packs: { light: { index: name, sha256: sha(badIndex) } } }), join(f.dir, 'build')),
      (e) => e.refused === true && /no sha256 name/.test(e.message));
    assert.ok(!existsSync(site), 'nothing was written');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
