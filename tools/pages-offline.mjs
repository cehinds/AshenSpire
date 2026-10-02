#!/usr/bin/env node
// tools/pages-offline.mjs — the Pages service worker in a real Chromium
// (docs/EXTERNAL-ASSETS-PLAN.md §4 "Service worker", §5 option A, §8; step 6b).
//
// It publishes a pack-shaped web edition (build/web, from `node tools/launch.mjs
// --build-only`) into a local copy of the Pages shape — /AshenSpire/dev/1/ with
// its asset-base.json, the shared /AshenSpire/objects/ and /packs/ store, and
// /AshenSpire/sw.js — through the same tools/pages-store.mjs functions
// tools/pages-site.mjs uses, serves it with tools/browser.mjs serveDir under
// /AshenSpire/, and drives the game:
//
//   1. boots the page and opens Download & saves → "Make available offline";
//   2. the worker is registered with scope /AshenSpire/ (never the host root)
//      and controls the page; the page, its asset-base.json and its indexes are
//      kept, and every light and common object is cached;
//   3. online, a newer HTML and a changed asset-base.json on the server are
//      what the page gets: the kept copies never shadow the network;
//   4. with the server STOPPED, the same URL boots from the cache, loads its
//      art index (the pin is checked as always) and fetches an object;
//   5. offline, a Range request for a music object answers 206 with exactly
//      those bytes (and a suffix range too), and an <audio> element loads it;
//   6. with the server back and sw.js replaced by the kill-switch
//      (tools/pages-sw.mjs serviceWorkerSource({ kill: true })), an update
//      unregisters the worker and deletes every ashen- cache.
//
// USAGE
//   node tools/pages-offline.mjs [--web build/web]
//   node tools/pages-offline.mjs --site _site --page dev/latest    a site pages-site assembled
//   node tools/pages-offline.mjs --shot keep.png                   also photograph the kept panel
//   node tools/pages-offline.mjs --selftest     each known-bad worker below must turn the run red by name
//
// VERDICT (tools/verdict.mjs form): "pages-offline: OK — N checks passed".
// BOUNDARY: Chromium only, headless, local http on 127.0.0.1 (a potentially
// trustworthy origin, as https Pages is). Controls are clicked by script, not
// by trusted input. It does not prove Safari's 206 needs, eviction, or an
// install prompt; the map tiles and the score folder are not objects the page
// reads yet (step 3c), so their offline fallbacks are not exercised here.

import { launchBrowser, serveDir } from './browser.mjs';
import { packPinOf, publishPack } from './pages-store.mjs';
import { OBJECT_CACHE, PAGE_CACHE, SW_FILE, serviceWorkerSource } from './pages-sw.mjs';
import { objectPath } from './asset-pack.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const flag = (name, dflt) => { const i = ARGV.indexOf(name); return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : dflt; };

// THE KNOWN-BADS: a worker that answers a Range with the whole body, a
// kill-switch that never unregisters, and a worker that serves a kept page
// before the network. Each is a text edit to the worker the site serves; a
// find-string that no longer matches is a drifted plant, a hard red.
const PLANTS = Object.freeze({
  'range-200': { expect: 'RANGE', worker: 'live', find: 'if (hit) return range ? slice(hit, range) : hit;', replace: 'if (hit) return hit;' },
  'kill-keeps': { expect: 'KILL', worker: 'kill', find: '  await self.registration.unregister();\n', replace: '' },
  'html-cache-first': { expect: 'STALE', worker: 'live', find: 'async function page(request) {\n', replace: 'async function page(request) {\n  { const kept = await (await caches.open(PAGE_CACHE)).match(pageKey(request.url)); if (kept) return kept; }\n' },
});

if (ARGV.includes('--selftest')) {
  let caught = 0;
  for (const [name, plant] of Object.entries(PLANTS)) {
    let out = ''; let code = 0;
    try { out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...ARGV.filter((a) => a !== '--selftest'), '--plant', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }); }
    catch (error) { code = error.status ?? 1; out = `${error.stdout || ''}${error.stderr || ''}`; }
    const named = new RegExp(`^FAIL ${plant.expect}\\b`, 'm').test(out);
    if (code === 1 && named) { caught++; console.log(`CAUGHT ${name}: red by ${plant.expect}`); }
    else { console.error(`MISS ${name}: exit ${code}, ${named ? 'named' : `no FAIL ${plant.expect} line`}\n${out.split('\n').slice(-12).join('\n')}`); process.exitCode = 1; }
  }
  if (!process.exitCode) console.log(`pages-offline selftest: OK — ${Object.keys(PLANTS).length} known-bads, ${caught} caught`);
  process.exit(process.exitCode || 0);
}

const PLANT = flag('--plant', null);
if (PLANT && !PLANTS[PLANT]) { console.error(`pages-offline: no plant ${PLANT}`); process.exit(2); }
// --site <dir> --page <branch>/<dir>: drive a site tools/pages-site.mjs
// assembled instead of building one (its sw.js is restored afterwards).
const GIVEN_SITE = flag('--site', null) ? resolve(flag('--site')) : null;
const REL = flag('--page', 'dev/1').replace(/^\/+|\/+$/g, '');
const WEB = resolve(ROOT, flag('--web', 'build/web'));
const HTML_FILE = GIVEN_SITE ? join(GIVEN_SITE, REL, 'index.html') : join(WEB, 'AshenSpire.html');
if (!existsSync(HTML_FILE)) { console.error(`pages-offline: ${HTML_FILE} is missing — run node tools/launch.mjs --build-only first`); process.exit(2); }
const HTML = readFileSync(HTML_FILE);
const PIN = packPinOf(HTML);
if (!PIN) { console.error(`pages-offline: ${HTML_FILE} is not pack-shaped (no ASSET_PACKS pin)`); process.exit(2); }

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const workerText = (kind) => {
  const text = serviceWorkerSource({ kill: kind === 'kill' });
  const plant = PLANT && PLANTS[PLANT];
  if (!plant || plant.worker !== kind) return text;
  if (!text.includes(plant.find)) { console.error(`pages-offline: PLANT SITE DRIFTED — ${PLANT} finds nothing in the ${kind} worker`); process.exit(2); }
  return text.replace(plant.find, plant.replace);
};

// The site, in the Pages shape.
const SITE = GIVEN_SITE || mkdtempSync(join(tmpdir(), 'pages-offline-'));
const SITE_SW = GIVEN_SITE && existsSync(join(SITE, SW_FILE)) ? readFileSync(join(SITE, SW_FILE)) : null;
if (!GIVEN_SITE) {
  publishPack(SITE, REL, HTML, WEB);
  // A second build under the same worker, never kept: it must not say it is.
  publishPack(SITE, 'dev/2', HTML, WEB);
}
writeFileSync(join(SITE, SW_FILE), workerText('live'));
// What "Make available offline" must keep: light and common (high only when asked).
const kept = ['light', 'common'].filter((p) => PIN.packs[p]);
const expectedObjects = new Set();
let music = null;
for (const pack of kept) {
  for (const [id, row] of Object.entries(JSON.parse(readFileSync(join(SITE, PIN.packs[pack].index), 'utf8')))) {
    expectedObjects.add(objectPath(row[0], id));
    if (!music && /\.mp3$/.test(id)) music = { id, path: objectPath(row[0], id) };
  }
}

let checks = 0;
const failures = [];
// A planted run stops at its plant's own red: what follows proves nothing more.
const PLANTED_STOP = Symbol('planted red seen');
const check = (code, ok, label) => {
  if (ok) { checks++; console.log(`PASS ${label}`); return; }
  failures.push(code); console.log(`FAIL ${code} ${label}`);
  if (PLANT && PLANTS[PLANT].expect === code) throw PLANTED_STOP;
};

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 1; const pending = new Map(); const subs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) subs.forEach((f) => f(m));
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    on: (f) => subs.push(f),
    send: (method, params = {}, sessionId) => new Promise((res, rej) => { const i = id++; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); }),
  };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let server = await serveDir(SITE, { prefix: 'AshenSpire' });
const PORT = server.port;
const ORIGIN = server.origin;
const PAGE = `${ORIGIN}/AshenSpire/${REL}/`;
const stopServer = async () => { server.server.closeAllConnections?.(); await server.close(); server = null; };

const browser = await launchBrowser({ prefix: 'pgoff-', browser: process.env.CHROME || process.env.CHROME_PATH, timeoutMs: 30000 });
let exitCode = 0;
try {
  const cdp = connect(browser.wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 1000, deviceScaleFactor: 1, mobile: false }, S);
  const ev = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'page threw');
    return r.result.value;
  };
  const until = async (expression, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await ev(expression)) return true; } catch { /* navigating */ } await wait(200); }
    return false;
  };
  const go = async (url) => { await cdp.send('Page.navigate', { url }, S); };
  const tierOnline = PIN.tier || 'light';

  // 1. Boot, open Download & saves, keep the build offline.
  await go(PAGE);
  const booted = await until(`!!document.documentElement.dataset.builtInArt && !!document.querySelector('.startup-gate')`, 30000);
  const loadedTier = await ev('document.documentElement.dataset.builtInArt').catch(() => null);
  check('BOOT', booted && [tierOnline, 'light'].includes(loadedTier), `the page boots under /AshenSpire/${REL}/ and loads its pinned art (${loadedTier})`);
  await ev(`document.querySelector('.startup-gate').click()`);
  await until(`!!document.querySelector('#download-game')`);
  await ev(`document.querySelector('#download-game').click()`);
  const offered = await until(`!!document.querySelector('#offline-keep')`, 10000);
  check('OFFER', offered, 'Download & saves offers "Make available offline" on the hosted web edition');
  if (offered) {
    await ev(`document.querySelector('#offline-keep').click()`);
    const done = await until(`/^Ready offline|^Kept /.test(document.querySelector('#offline-keep-status')?.textContent || '')`, 180000);
    const said = await ev(`document.querySelector('#offline-keep-status')?.textContent || ''`);
    check('KEEP', done && /^Ready offline/.test(said), `the keep completes: "${said.slice(0, 90)}"`);
    // --shot <file.png>: the Download & saves panel once the keep is done, for a review.
    if (flag('--shot', null)) {
      await ev(`document.querySelector('#offline-keep-status').scrollIntoView({ block: 'center' })`);
      await wait(300);
      writeFileSync(resolve(flag('--shot')), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' }, S)).data, 'base64'));
    }
  }

  // 2. Scope, control and what was kept.
  const reg = await ev(`navigator.serviceWorker.getRegistration().then((r) => r ? { scope: r.scope, script: r.active && r.active.scriptURL } : null)`);
  check('SCOPE', reg && reg.scope === `${ORIGIN}/AshenSpire/` && reg.script === `${ORIGIN}/AshenSpire/${SW_FILE}`, `the worker is /AshenSpire/${SW_FILE} with scope /AshenSpire/ (${reg ? reg.scope : 'none'})`);
  check('CONTROL', await ev(`navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : ''`) === `${ORIGIN}/AshenSpire/${SW_FILE}`, 'the worker controls the page');
  const pageKeys = await ev(`caches.open(${JSON.stringify(PAGE_CACHE)}).then((c) => c.keys()).then((ks) => ks.map((k) => k.url))`);
  const wantPages = [PAGE, `${PAGE}asset-base.json`, ...kept.map((p) => `${ORIGIN}/AshenSpire/${PIN.packs[p].index}`)];
  const missingPages = wantPages.filter((u) => !pageKeys.includes(u));
  check('KEPT', missingPages.length === 0, `the page, its asset-base.json and the ${kept.join(' and ')} indexes are kept${missingPages.length ? ` (missing: ${missingPages.join(', ')})` : ''}`);
  const objectKeys = await ev(`caches.open(${JSON.stringify(OBJECT_CACHE)}).then((c) => c.keys()).then((ks) => ks.map((k) => new URL(k.url).pathname.replace('/AshenSpire/', '')))`);
  const absent = [...expectedObjects].filter((p) => !objectKeys.includes(p));
  check('OBJECTS', absent.length === 0 && objectKeys.length >= expectedObjects.size, `every ${kept.join(' and ')} object is cached (${objectKeys.length} of ${expectedObjects.size})`);

  // 2b. Another build shares the worker but was not kept: it offers the keep,
  // and does not claim to be kept (Codex, #1456).
  if (!GIVEN_SITE) {
    await go(`${ORIGIN}/AshenSpire/dev/2/`);
    await until(`!!document.querySelector('.startup-gate')`, 30000);
    await ev(`document.querySelector('.startup-gate').click()`);
    await until(`!!document.querySelector('#download-game')`);
    await ev(`document.querySelector('#download-game').click()`);
    await until(`!!document.querySelector('#offline-keep')`, 10000);
    await wait(1500);
    const other = await ev(`({ label: document.querySelector('#offline-keep').textContent, status: document.querySelector('#offline-keep-status').textContent, remove: !document.querySelector('#offline-keep-remove').hidden })`);
    check('PERPAGE', other.label === 'Make available offline' && !/kept for offline/.test(other.status) && !other.remove,
      `another build under the same worker is not called kept ("${other.label}", "${other.status || 'no status'}")`);
    // Keep it too, then remove it: only its own copy goes; dev/1 stays kept.
    await ev(`document.querySelector('#offline-keep').click()`);
    await until(`/^Ready offline/.test(document.querySelector('#offline-keep-status')?.textContent || '')`, 180000);
    await ev(`document.querySelector('#offline-keep-remove').click()`);
    await until(`/removed/.test(document.querySelector('#offline-keep-status')?.textContent || '')`, 15000);
    const after = await ev(`caches.open(${JSON.stringify(PAGE_CACHE)}).then((c) => c.keys()).then((ks) => ks.map((k) => k.url))`);
    const regs = await ev(`navigator.serviceWorker.getRegistrations().then((rs) => rs.length)`);
    check('REMOVE', !after.includes(`${ORIGIN}/AshenSpire/dev/2/`) && after.includes(PAGE) && regs === 1,
      `removing dev/2's copy leaves dev/1 kept and the worker registered (${after.length} page entries, ${regs} registration)`);
  }

  // 3. Online, the network wins over the kept copies.
  const htmlPath = join(SITE, REL, 'index.html');
  const basePath = join(SITE, REL, 'asset-base.json');
  const baseText = readFileSync(basePath, 'utf8');
  writeFileSync(htmlPath, Buffer.from(HTML.toString('latin1').replace('</head>', '<meta name="ashen-newer-build" content="1"></head>'), 'latin1'));
  writeFileSync(basePath, `${baseText.trimEnd()} \n`);
  await go(PAGE);
  const newer = await until(`!!document.querySelector('meta[name="ashen-newer-build"]')`, 15000);
  const baseNow = await ev(`fetch('asset-base.json', { cache: 'no-cache' }).then((r) => r.text())`).catch(() => null);
  check('STALE', newer && baseNow === `${baseText.trimEnd()} \n`, 'online, a newer HTML and a changed asset-base.json reach the page, not the kept copies');
  writeFileSync(htmlPath, HTML);
  writeFileSync(basePath, baseText);
  await until(`!!document.documentElement.dataset.builtInArt`, 15000);

  // 4. Offline: the server is gone; the same URL boots from the cache.
  await stopServer();
  await go(`${PAGE}?shot=title`);
  const offlineBoot = await until(`!!document.documentElement.dataset.builtInArt && document.documentElement.dataset.builtInArt !== 'loading'`, 30000);
  const offlineTier = await ev('document.documentElement.dataset.builtInArt').catch(() => null);
  check('OFFLINE', offlineBoot && offlineTier === 'light', `offline, the kept page boots and loads its light art index from the cache (${offlineTier})`);
  const sample = [...expectedObjects].find((p) => p.endsWith('.webp'));
  const objectOk = await ev(`fetch('../../${sample}').then((r) => r.status)`).catch((e) => String(e.message));
  check('OFFLINE', objectOk === 200, `offline, an object answers from the cache (${objectOk})`);

  // 5. Offline Range answers for audio.
  if (!music) check('RANGE', false, 'the common index lists an MP3 to range over');
  else {
    const bytes = readFileSync(join(SITE, music.path));
    const ranged = async (range) => ev(`fetch('../../${music.path}', { headers: { Range: ${JSON.stringify(range)} } }).then(async (r) => {
      const b = new Uint8Array(await r.arrayBuffer());
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), (x) => x.toString(16).padStart(2, '0')).join('');
      return { status: r.status, range: r.headers.get('Content-Range'), type: r.headers.get('Content-Type'), length: b.length, sha: h };
    })`);
    const mid = await ranged('bytes=100-1099');
    check('RANGE', mid.status === 206 && mid.range === `bytes 100-1099/${bytes.length}` && mid.length === 1000 && mid.sha === sha256(bytes.subarray(100, 1100)) && mid.type === 'audio/mpeg',
      `offline, Range bytes=100-1099 of ${music.id} answers 206 with exactly those bytes (${mid.status}, ${mid.range}, ${mid.type})`);
    const tail = await ranged('bytes=-500');
    check('RANGE', tail.status === 206 && tail.range === `bytes ${bytes.length - 500}-${bytes.length - 1}/${bytes.length}` && tail.sha === sha256(bytes.subarray(bytes.length - 500)),
      `offline, a suffix Range answers 206 with the last 500 bytes (${tail.status}, ${tail.range})`);
    const audio = await ev(`new Promise((done) => { const a = new Audio('../../${music.path}'); a.preload = 'metadata';
      a.addEventListener('loadedmetadata', () => done({ ok: true, duration: a.duration }), { once: true });
      a.addEventListener('error', () => done({ ok: false, error: a.error && a.error.code }), { once: true });
      setTimeout(() => done({ ok: false, error: 'timeout' }), 15000); })`);
    check('AUDIO', audio.ok && audio.duration > 1, `offline, an <audio> element loads ${music.id} through the worker (${audio.ok ? `${audio.duration.toFixed(1)} s` : `error ${audio.error}`})`);
  }

  // 6. The kill-switch: the server returns serving it; an update retires the worker.
  // A SECOND TAB, opened under the live worker before the switch arrives: the
  // kill-switch must reload it too (Codex, #1456).
  server = await serveDir(SITE, { prefix: 'AshenSpire', port: PORT });
  const { targetId: t2 } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S2 } = await cdp.send('Target.attachToTarget', { targetId: t2, flatten: true });
  await cdp.send('Runtime.enable', {}, S2);
  const ev2 = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S2);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'page threw');
    return r.result.value;
  };
  await cdp.send('Page.navigate', { url: PAGE }, S2);
  let tab2 = false;
  for (let t0 = Date.now(); Date.now() - t0 < 30000 && !tab2; await wait(200)) {
    tab2 = await ev2(`!!navigator.serviceWorker.controller && !!document.documentElement.dataset.builtInArt`).catch(() => false);
  }
  if (tab2) await ev2('window.__ashenBeforeKill = 1');
  writeFileSync(join(SITE, SW_FILE), workerText('kill'));
  await ev(`navigator.serviceWorker.getRegistration().then((r) => r && r.update()).then(() => true, () => true)`).catch(() => null);
  const gone = await until(`navigator.serviceWorker.getRegistrations().then((rs) => rs.length === 0)`, 20000);
  const left = await until(`caches.keys().then((ks) => ks.filter((k) => k.startsWith('ashen-')).length === 0)`, 10000);
  check('KILL', gone && left, `the kill-switch sw.js unregisters the worker and deletes every ashen- cache (${gone ? 'unregistered' : 'still registered'}, ${left ? 'no caches' : 'caches left'})`);
  let reloaded = false;
  for (let t0 = Date.now(); tab2 && Date.now() - t0 < 15000 && !reloaded; await wait(200)) {
    reloaded = await ev2(`typeof window.__ashenBeforeKill === 'undefined' && !navigator.serviceWorker.controller && document.readyState !== 'loading'`).catch(() => false);
  }
  check('KILL', tab2 && reloaded, `a second tab under the old worker is reloaded off it by the kill-switch (${tab2 ? (reloaded ? 'reloaded, uncontrolled' : 'not reloaded') : 'never controlled'})`);
} catch (error) {
  if (error !== PLANTED_STOP) {
    console.error(`pages-offline: harness error — ${error.stack || error.message}`);
    exitCode = 2;
  }
} finally {
  try { if (server) await stopServer(); } catch { /* closed */ }
  await browser.close();
  if (GIVEN_SITE) { if (SITE_SW) writeFileSync(join(SITE, SW_FILE), SITE_SW); }
  else rmSync(SITE, { recursive: true, force: true });
}
if (exitCode) process.exit(exitCode);
console.log('BOUNDARY: headless Chromium over local http on 127.0.0.1; controls clicked by script; Safari, eviction and install prompts are not exercised; tiles and the score folder are not objects yet (step 3c).');
if (failures.length) { console.error(`pages-offline: FAILED — ${failures.length} check(s): ${[...new Set(failures)].join(', ')}`); process.exit(1); }
console.log(`pages-offline: OK — ${checks} checks passed`);
