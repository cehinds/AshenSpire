#!/usr/bin/env node
// tools/external-play.mjs — load the DE-INLINED build in a real browser and
// prove the art arrives over the wire.
//
// WHY A SECOND GATE. tools/verify-external.mjs reads the output directory off
// disk and proves every shippable asset is present and byte-identical. That is
// necessary and it is not sufficient: a file can be on disk and still never
// reach the page — a url rebased against the wrong base, a path that resolves
// only when the output happens to sit two directories under the repo root, a
// sibling tree the build forgot to carry. Every one of those passes a disk
// check and 404s in a browser.
//
// Both of those defects were real in this build, found here and not by reading:
// the CSS urls first came out as `../../assets/…` (climbing out of the output
// directory), and the map-detail tiles were not copied at all. Static checks
// were green for both.
//
//   node tools/external-play.mjs [--dir build] [--expect-tier light] [--plant desktop-light]
//
// Art quality is Auto in a fresh profile, so the phone screens must load light
// (step 8c) and the desktop screens the build's tier; --expect-tier names the
// tier the desktop screens must END ON when it is not the one the build pins: a high-default build whose high index was removed must load light
// (the tier fallback, §3.5), and then no object only the high index lists may
// be asked for, its CSS backdrops included.
//
// THE CSS ASSETS (step 3b): on every screen, each CSS background must come from
// the object store, from the tier the page loaded (or common), and each mask
// must be an inline SVG data: URI; the "AS Lore" faces must be declared and
// load, and every font the page fetched must be a common object.
//
// MUSIC AND TILES (step 3c): the shipped score's manifest and at least one
// track must be requested as common objects (the ids `music/manifest.json` and
// `music/…mp3`), and each track asked for must decode as audio; the map screen
// must draw its detail tiles, each one a common object whose id is a
// `map-detail/…` tile, and each must decode as an image. No request may name a
// bare `music/` or `map-detail/` path. The browser runs with autoplay allowed
// (and muted, as every browser tool is), so the title's track is fetched
// without a gesture.
//
// FILE:// (step 4, --file): the same seven screens, opened by double-click —
// the HTML as a file:// URL, no server, no flag that loosens Chrome's file://
// rules. The indexes must arrive through their .js twins (no .json index is
// asked for), the "AS Lore" faces through the font sidecar as FontFace objects
// (no font object is fetched, which Chrome would refuse), the masks inline, the
// backdrops, sprites and map tiles as plain loads of the objects beside the
// HTML, and the score must stay synthesized: no manifest, no track, no music/
// path is asked for (SPEC §7.4; Web Audio cannot play a file: track).
//   node tools/external-play.mjs --file [--dir build] [--expect-tier light]
//
// THE INDEX BLOCKED (step 5, --block-index, http only): every packs/ request
// is held (the cold boot) or refused (the ?shot= screens). The cold boot must
// draw the startup gate at once with its "Loading art…" line, before the load
// has settled; a press during the load must not draw the title until the load
// has failed (BOOT_WAIT_MS); then the title must carry the notice with Retry,
// and no debug failure banner. The block is lifted and Retry is pressed: the
// pinned tier must load, the title be drawn again on it (ASSET_CSS in the page,
// no notice). The combat and map screens must mount on placeholders with the
// index refused, asking for no object; and a Retry from the in-run Settings
// must redraw the combat's placeholder enemies as images, in the same combat,
// once Settings closes. The cold boot runs with the debug
// profile auto-load on (Settings → Advanced → Defaults & sync) and its GitHub
// request held too: the gate must still be drawn at once, not after the
// profile's 3 s wait (Codex on #1471).
//   node tools/external-play.mjs --block-index [--dir build]
//
// VERDICT: "external-play: OK — N checks passed".
//
// WHAT IT DOES NOT CHECK: gameplay. It mounts seven screens and watches the
// network; it does not play a run, and a screen that mounts with the wrong art
// passes. Two known non-findings are filtered and named where they are filtered.
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { resolve, dirname, relative } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { objectPath } from './asset-pack.mjs';
import { SFX_RECIPES, SFX_MANIFEST } from '../src/content/sfx.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { retryArtStateExpression } from './external-play-art-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const dirFlag = ARGV.indexOf('--dir');
const DIR = resolve(ROOT, dirFlag >= 0 ? ARGV[dirFlag + 1] : 'build');
// --file: open the build by its file:// URL, as a double-click does (step 4).
const FILE_MODE = ARGV.includes('--file');
const DIR_URL = pathToFileURL(DIR + '/').href;
/** A request's url relative to the build: the http origin, or the build's file:// folder, stripped. */
const rel = (url) => {
  const u = String(url || '');
  if (u.startsWith(DIR_URL)) return u.slice(DIR_URL.length);
  return u.replace(/^https?:\/\/[^/]+\//, '');
};

if (!existsSync(resolve(DIR, 'AshenSpire.html'))) {
  console.error(`external-play: no build at ${relative(ROOT, DIR)} — node tools/bundle.mjs [--light] --out ${relative(ROOT, DIR)}`);
  process.exit(2);
}

// THE PACK SHAPE (docs/EXTERNAL-ASSETS-PLAN.md step 3a): the build pins its
// default tier in ASSET_PACKS, and the page stamps <html data-built-in-art> with
// the tier it loaded. Each screen must have loaded that tier, and every image
// that asked for art must have come from the object store, not a bare
// `assets/…` path (which would mean an id the index does not list).
const HTML_TEXT = readFileSync(resolve(DIR, 'AshenSpire.html'), 'utf8');
const PINNED_TIER = (HTML_TEXT.match(/const ASSET_PACKS = \{"schema":1,"tier":"(high|light)"/) || [])[1] || null;
const tierFlag = ARGV.indexOf('--expect-tier');
const EXPECT_TIER = tierFlag >= 0 ? ARGV[tierFlag + 1] : PINNED_TIER;
// --plant desktop-light: the self-check for the per-screen object rule. The
// desktop screens are given a phone-sized SCREEN (their window stays 1280×800),
// so Auto loads light where the gate expects the build's tier; on a high build
// the run must go RED, the object rule included ("not their screen's tier").
const PLANT = ARGV.includes('--plant') ? ARGV[ARGV.indexOf('--plant') + 1] : null;
const BLOCK_INDEX = ARGV.includes('--block-index');
if (BLOCK_INDEX && (FILE_MODE || tierFlag >= 0 || PLANT)) {
  console.error('external-play: --block-index runs alone, over http');
  process.exit(2);
}
if (PLANT !== null && PLANT !== 'desktop-light') {
  console.error('external-play: --plant takes desktop-light');
  process.exit(2);
}
if (tierFlag >= 0 && !['high', 'light'].includes(EXPECT_TIER)) {
  console.error('external-play: --expect-tier takes high or light');
  process.exit(2);
}
// Which pinned pack lists each object, read from the indexes on disk (the ones
// still there: a removed high index lists nothing). object path → Set of packs.
const PACK_OF = new Map();
// object path → Set of the ids that name it, for the music and tile checks.
const IDS_OF = new Map();
if (PINNED_TIER) {
  let pin = null;
  try { pin = JSON.parse((HTML_TEXT.match(/const ASSET_PACKS = (\{.*?\});\n/) || [])[1]); } catch { pin = null; }
  for (const [pack, p] of Object.entries(pin?.packs || {})) {
    const file = resolve(DIR, String(p.index));
    if (!existsSync(file)) continue;
    for (const [id, [sha]] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
      const path = objectPath(sha, id);
      if (!PACK_OF.has(path)) PACK_OF.set(path, new Set());
      PACK_OF.get(path).add(pack);
      if (pack === 'common') {
        if (!IDS_OF.has(path)) IDS_OF.set(path, new Set());
        IDS_OF.get(path).add(id);
      }
    }
  }
}
// The "AS Lore" faces the page must load: as many as the build's ASSET_CSS
// stamp declares, read from the HTML rather than typed here.
let LORE_FACES = 0;
try { LORE_FACES = (JSON.parse((HTML_TEXT.match(/const ASSET_CSS = (\{.*?\}|null);\n/) || [])[1] || 'null')?.rules || []).filter((r) => /^@font-face\b/.test(r) && /AS Lore/.test(r)).length; } catch { LORE_FACES = 0; }
const objectPathOf = (url) => (String(url).match(/objects\/[0-9a-f]{2}\/[0-9a-f]{64}\.[a-z0-9]+/) || [])[0] || null;
/** The common ids an object url stands for (empty when it is not a common object). */
const commonIds = (url) => [...(IDS_OF.get(objectPathOf(url)) || [])];
/** Why an object url is not one the expected tier (or common) may show, or ''. */
function wrongTier(url, tier = EXPECT_TIER) {
  const path = objectPathOf(url);
  if (!path) return 'not an object';
  const packs = PACK_OF.get(path);
  if (!packs) return 'listed by no index beside the build';
  if (packs.has(tier) || packs.has('common')) return '';
  return `only the ${[...packs].join('/')} index lists it`;
}

/** True for the SFX convention probe of a synth-only cue: `assets/sfx/<recipe id>.ogg` with no SFX_MANIFEST entry. */
function sfxProbe404(url) {
  // Over http(s) a 404; under --file the fetch is refused outright (Chrome's
  // fetch does not do file:), which the single file has always met the same way.
  const m = /^assets\/sfx\/([^/?#]+)\.ogg$/.exec(rel(url));
  if (!m) return false;
  let id;
  try { id = decodeURIComponent(m[1]); } catch { return false; }
  return Object.hasOwn(SFX_RECIPES, id) && !Object.hasOwn(SFX_MANIFEST, id);
}

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

// Four screens on a phone, then the gate, combat and the map on a desktop window. Art quality
// is Auto in a fresh profile (a ?shot= boot keeps no settings), and Auto loads
// light on a narrow layout (src/ui/artTier.js, step 8c), so the phone screens
// must show light art and the desktop one the tier the build pins: a high
// build is checked at both tiers.
// The screen size is set too: Auto also reads the screen's short side, and a
// headless browser's own screen is 800×600, which is not a desktop's.
const PHONE = { width: 390, height: 844, screenWidth: 390, screenHeight: 844, deviceScaleFactor: 2, mobile: true };
const DESKTOP = { width: 1280, height: 800, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 1, mobile: false };
const SCREENS = [
  // The cold boot's startup gate: the river citadel backdrops and the
  // entrance hall's door mask (CSS assets, step 3b).
  ['gate', '', `!!document.querySelector('.startup-gate')`, PHONE],
  ['title', '?shot=title', `!!document.querySelector('#app button')`, PHONE],
  ['combat', '?shot=combat', `!!document.querySelector('.combat .hand .card')`, PHONE],
  ['map', '?shot=map', `!!document.querySelector('.map-node')`, PHONE],
  ['dgate', '', `!!document.querySelector('.startup-gate')`, DESKTOP],
  ['desktop', '?shot=combat', `!!document.querySelector('.combat .hand .card')`, DESKTOP],
  ['dmap', '?shot=map', `!!document.querySelector('.map-node')`, DESKTOP],
];

const server = FILE_MODE ? null : await serve({ root: DIR, port: 8317, open: false });
// Autoplay allowed, so the title's track is requested and played without a
// gesture (DEFAULT_ARGS already mutes the output).
const { wsUrl, close } = await launchBrowser({ prefix: 'extplay-', browser: process.env.CHROME || process.env.CHROME_PATH, timeoutMs: 30000, args: ['--autoplay-policy=no-user-gesture-required'] });
const cdp = connect(wsUrl); await cdp.ready;
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S); await cdp.send('Network.enable', {}, S);
// Every screen must show its own requests: with the cache on, a screen that
// reuses an earlier screen's objects could load them without a request.
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, S);

const failures = []; const thrown = []; const urls = new Map();
// The requests of the screen being mounted, reset before each navigation: one
// entry per request, so a url an earlier screen also asked for still counts.
let screenLog = [];
// The removed index is its .json over http(s) and its .js twin under --file.
const removedIndex = (url) => EXPECT_TIER !== PINNED_TIER && new RegExp(`(^|/)packs/${PINNED_TIER}-[0-9a-f]{12}\\.(?:json|js)$`).test(String(url));
cdp.on((m) => {
  // /api/lan/* is the LAUNCHER's endpoint (src/net/lan.js), not an asset: a
  // plain static server does not implement it and the source tree 404s on it
  // identically. Filtering it here, named, beats a green that quietly ignores
  // every 404.
  // favicon.ico is requested by the BROWSER, not by the game — no markup asks
  // for it, so its absence says nothing about whether the art shipped. Filtered
  // on both event paths, because it arrives on either depending on timing; the
  // first cut filtered only loadingFailed and went red on the responseReceived.
  // Under --expect-tier, the pinned tier's index is ABSENT by design (that is
  // the fallback being tested), so its 404 is the plant, not a finding.
  // assets/sfx/<id>.ogg is the SFX filename convention (src/ui/audio.js sfx(),
  // content/sfx.js): with the context running (autoplay is allowed here, for
  // the score) every cue plays its synth and probes for a sample file, and no
  // build ships one. The source tree and the single file 404 on it
  // identically. Only a BARE path is filtered, and only for a cue that is a
  // synth recipe with no SFX_MANIFEST entry (sfxProbe404): an override the
  // manifest names, whose file a build forgot, still fails here, and an id an
  // index listed would have resolved to objects/ and is checked like any other.
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400
      && !/\/api\/lan\//.test(m.params.response.url) && !/favicon\.ico/i.test(m.params.response.url)
      && !(m.params.response.status === 404 && sfxProbe404(m.params.response.url))
      && !(m.params.response.status === 404 && removedIndex(m.params.response.url))) {
    failures.push(`${m.params.response.status} ${rel(m.params.response.url)}`);
  }
  if (m.method === 'Network.requestWillBeSent') {
    const u = rel(m.params.request.url);
    urls.set(m.params.requestId, u);
    screenLog.push([m.params.loaderId, u]);
  }
  if (m.method === 'Network.loadingFailed' && !/favicon/i.test(m.params.errorText || '') && !removedIndex(urls.get(m.params.requestId) || '')
      && !(FILE_MODE && sfxProbe404(urls.get(m.params.requestId) || ''))
      // The launcher's /api/lan/ under --file is file:///api/lan/… (or
      // file:///D:/api/lan/… on Windows), refused as a fetch rather than
      // answered 404: the same non-finding as above. No remote file host or
      // other file path is exempted.
      && !(FILE_MODE && /^file:\/\/\/(?:[A-Za-z]:\/)?api\/lan\//.test(urls.get(m.params.requestId) || ''))) failures.push(`${m.params.errorText} ${urls.get(m.params.requestId) || ''}`.trim());
  if (m.method === 'Runtime.exceptionThrown') thrown.push(m.params.exceptionDetails.text || 'exception');
});
const ev = async (e) => {
  const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
  return r.result.value;
};

if (BLOCK_INDEX) await blockedIndexPass();

/** The --block-index pass (step 5). Exits the process with its verdict. */
async function blockedIndexPass() {
  const found = [];
  let n = 0;
  const check = (ok, why) => { n++; if (!ok) found.push(why); };
  if (!PINNED_TIER) { console.error('external-play --block-index: the build pins no packs'); process.exit(2); }
  // 'hold' leaves each packs/ request paused (it never answers, as a stalled
  // network); 'fail' refuses it at once; 'pass' lets it through.
  let mode = 'hold';
  const held = [];
  let profileAskedAt = 0;
  cdp.on((m) => {
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId } = m.params;
    // The settings profile's GitHub request: held for good, so the profile
    // waits out its whole timeout.
    if (/^https:\/\/api\.github\.com\//.test(m.params.request.url)) { profileAskedAt ||= Date.now(); return; }
    if (mode === 'pass') cdp.send('Fetch.continueRequest', { requestId }, S).catch(() => {});
    else if (mode === 'fail') cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }, S).catch(() => {});
    else held.push(requestId);
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/packs/*', requestStage: 'Request' }, { urlPattern: 'https://api.github.com/*', requestStage: 'Request' }] }, S);
  const poll = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr).catch(() => false)) return Date.now() - t0; await wait(100); } return -1; };
  // The banner (src/ui/debuglog.js failureBanner) names what died; '' when there is none.
  const bannerText = `(() => { const n = [...document.body.querySelectorAll('*')].find((e) => e.children.length === 0 && !/^(?:SCRIPT|STYLE|TEMPLATE)$/.test(e.tagName) && /STOPPED WORKING/.test(e.textContent || '')); return n ? (n.parentElement?.textContent || n.textContent).slice(0, 200) : ''; })()`;
  const banner = async () => { const text = await ev(bannerText); return text ? ` — ${text}` : ''; };
  const click = async (selector) => {
    const box = await ev(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`);
    if (!box) return false;
    for (const type of ['mousePressed', 'mouseReleased']) await cdp.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 }, S);
    return true;
  };
  thrown.length = 0;

  // 1. The cold boot, the indexes held and the profile auto-load on: the gate
  // at once, its line loading. localhost is a dev page, so the debug-only
  // auto-load runs; the flag is set on the page's own origin first.
  await cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP, S);
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/asset-base.json` }, S);
  await wait(500);
  await ev(`localStorage.setItem('ashenspire.sync.auto', '1')`);
  const t0 = Date.now();
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/AshenSpire.html` }, S);
  const gateAt = await poll(`!!document.querySelector('.startup-gate')`, 6000);
  check(gateAt >= 0, 'the cold boot did not draw the startup gate within 6 s while the indexes were held');
  const gateSeen = Date.now();
  check(profileAskedAt > 0, 'the profile auto-load never asked GitHub (the pass did not exercise it)');
  const afterProfile = profileAskedAt ? gateSeen - profileAskedAt : -1;
  check(profileAskedAt > 0 && afterProfile < 2500, `the gate was drawn ${afterProfile} ms after the profile request, i.e. after the profile's 3 s wait, not at once`);
  const early = await ev(`({ line: document.querySelector('[data-component="boot-art-status"]')?.textContent || '', state: document.documentElement.dataset.builtInArt || '',
    busy: document.querySelector('[data-component="boot-art-status"]')?.getAttribute('aria-busy') || '', live: document.querySelector('[data-component="boot-art-status"]')?.getAttribute('aria-live') || '' })`);
  check(early.state === '', `the gate was drawn after the load settled (data-built-in-art "${early.state}"), not behind it`);
  check(/^Loading art/.test(early.line), `the gate's status line says "${early.line}", not "Loading art…"`);
  check(early.busy === 'true' && early.live === 'polite', `the status line is not a polite, busy live region (aria-busy ${early.busy}, aria-live ${early.live})`);
  // A press during the load: the reveal runs, but the title waits for the load.
  await click('.startup-gate');
  await wait(4500);
  const waiting = await ev(`({ title: !!document.querySelector('.title-screen'), line: document.querySelector('[data-component="boot-art-status"]')?.textContent || '', state: document.documentElement.dataset.builtInArt || '' })`);
  check(!waiting.title && waiting.state === '', `the title was drawn before the load settled (title ${waiting.title}, data-built-in-art "${waiting.state}")`);
  check(/^Loading art/.test(waiting.line), `after the press the line says "${waiting.line}", not "Loading art…"`);
  const failedAt = await poll(`document.documentElement.dataset.builtInArt === 'failed'`, 12000);
  check(failedAt >= 0, 'the held load did not fail by the boot deadline');
  // The message is written into the live node just after it appears (so it is announced).
  const titleAt = await poll(`!!document.querySelector('.title-screen [data-component="art-load-notice"] [data-component="art-load-notice-retry"]') && !!document.querySelector('.art-load-notice-text')?.textContent`, 6000);
  check(titleAt >= 0, 'after the load failed the title did not show the notice with Retry');
  const notice = await ev(`({ text: document.querySelector('.art-load-notice-text')?.textContent || '', live: document.querySelector('.art-load-notice-text')?.getAttribute('aria-live') || '',
    css: !!document.querySelector('style[data-asset-css]'), objects: [...document.images].filter((i) => (i.getAttribute('src') || '').includes('objects/')).length })`);
  check(/could not be loaded/.test(notice.text) && notice.live === 'polite', `the notice says "${notice.text}" (aria-live ${notice.live})`);
  check(!notice.css && notice.objects === 0, `the failed load still put pack art in the page (ASSET_CSS ${notice.css}, ${notice.objects} object image(s))`);
  let raised = await banner();
  check(!raised, `the debug failure banner was raised for a failed art load${raised}`);
  const bootMs = Date.now() - t0;

  // 2. The block lifted, Retry pressed: the pinned tier loads and the title is redrawn.
  mode = 'pass';
  for (const requestId of held.splice(0)) await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Aborted' }, S).catch(() => {});
  check(await click('[data-component="art-load-notice-retry"]'), 'the Retry button could not be pressed');
  const loadedAt = await poll(`document.documentElement.dataset.builtInArt === ${JSON.stringify(PINNED_TIER)}`, 12000);
  check(loadedAt >= 0, `Retry did not load the pinned tier (${PINNED_TIER}); data-built-in-art is "${await ev('document.documentElement.dataset.builtInArt || ""')}"`);
  const after = await poll(`!!document.querySelector('.title-screen') && !document.querySelector('[data-component="art-load-notice"]') && !!document.querySelector('style[data-asset-css]')`, 6000);
  check(after >= 0, 'after Retry the title was not drawn again on the new art (notice gone, ASSET_CSS in the page)');
  raised = await banner();
  check(!raised, `the debug failure banner was raised after Retry${raised}`);

  // 3. The index refused on a phone: combat and the map mount on placeholders.
  await ev(`localStorage.removeItem('ashenspire.sync.auto')`);
  mode = 'fail';
  const shots = [];
  for (const [name, query, ready] of [['combat', '?shot=combat', `!!document.querySelector('.combat .hand .card')`], ['map', '?shot=map', `!!document.querySelector('.map-node')`]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', PHONE, S);
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/AshenSpire.html${query}` }, S);
    const up = await poll(ready, 20000);
    check(up >= 0, `${name} did not mount with the index refused`);
    const art = await ev(`({ state: document.documentElement.dataset.builtInArt || '', objects: [...document.images].filter((i) => (i.getAttribute('src') || '').includes('objects/')).length })`);
    check(art.state === 'failed', `${name}: data-built-in-art is "${art.state}", not failed`);
    check(art.objects === 0, `${name}: ${art.objects} image(s) from objects/ with no index loaded`);
    raised = await banner();
    check(!raised, `${name}: the debug failure banner was raised${raised}`);
    shots.push(`${name} in ${up} ms`);
  }
  // 4. Retry from the in-run Settings (Codex on #1471), on combat and on a
  // dialogue: the screen drawn on placeholders (the index refused; each one
  // marked data-art-placeholder, src/ui/artFallback.js), the block lifted,
  // Quick menu → Settings → Art quality → Retry, Settings closed: the same
  // screen (no remount; combat keeps its hand) must draw that art as images
  // from objects/.
  for (const [name, query, ready, artSel, rootSel] of [
    ['combat', '?shot=combat', `!!document.querySelector('.combat .hand .card')`, '.enemy-row [data-enemy-id]', '.combat'],
    ['dialogue', '?shot=event', `!!document.querySelector('.dialogue-portrait-art [data-enemy-id]')`, '.dialogue-portrait-art [data-enemy-id]', '#app > *'],
  ]) {
    mode = 'fail';
    await cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP, S);
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/AshenSpire.html${query}` }, S);
    check(await poll(`${ready} && document.documentElement.dataset.builtInArt === 'failed'`, 20000) >= 0, `in-run Retry (${name}): the screen did not mount on a failed load`);
    const artState = retryArtStateExpression(artSel);
    await ev(`window.__retryRoot = document.querySelector(${JSON.stringify(rootSel)})`);
    // The images' own error handlers swap the placeholders in as each request fails.
    await poll(`(${artState}).placeholders === (${artState}).n && (${artState}).n > 0`, 6000);
    const placeheld = await ev(artState);
    check(placeheld.n > 0 && placeheld.placeholders === placeheld.n, `in-run Retry (${name}): the failed load did not leave marked placeholders (${placeheld.placeholders} of ${placeheld.n})`);
    mode = 'pass';
    await click('[aria-label="Quick menu"]');
    await poll(`!!document.querySelector('.qn-row')`, 4000);
    await ev(`[...document.querySelectorAll('.qn-row')].find((r) => /settings/i.test(r.textContent))?.click()`);
    check(await poll(`!!document.querySelector('[data-art-retry]:not([hidden])')`, 6000) >= 0, `in-run Retry (${name}): Settings offered no Retry`);
    // The row may sit below the fold of the Settings panel: scrolled into view, then pressed.
    await ev(`document.querySelector('[data-art-retry]:not([hidden])')?.scrollIntoView({ block: 'center' })`);
    await wait(300);
    await click('[data-art-retry]:not([hidden])');
    const inRunAt = await poll(`document.documentElement.dataset.builtInArt === ${JSON.stringify(PINNED_TIER)}`, 15000);
    check(inRunAt >= 0, `in-run Retry (${name}): Settings' Retry did not load ${PINNED_TIER} (data-built-in-art "${await ev('document.documentElement.dataset.builtInArt || ""')}")`);
    await ev(`document.querySelector('[aria-modal="true"] .modal-close')?.click()`);
    const redrawnAt = await poll(`(${artState}).drawn === (${artState}).n && (${artState}).n > 0`, 10000);
    const redrawn = await ev(artState);
    check(redrawnAt >= 0, `in-run Retry (${name}): after Settings closed the art is still placeholders (${redrawn.drawn} of ${redrawn.n} drawn from objects/)`);
    check(await ev(`document.querySelector(${JSON.stringify(rootSel)}) === window.__retryRoot`) && redrawn.hand === placeheld.hand, `in-run Retry (${name}): the screen was remounted (or the hand changed), not redrawn in place`);
    shots.push(`in-run Retry redrew ${redrawn.drawn} ${name} sprite(s)`);
    if (name !== 'combat') continue;
    // The relic rail's icon (relicIcon's own placeholder) came back too.
    const relics = await ev(`[...document.querySelectorAll('.relic-art')].map((r) => { const i = r.querySelector('img'); return !!(i && (i.getAttribute('src') || '').includes('objects/')); })`);
    check(relics.length > 0 && relics.every(Boolean), `in-run Retry (combat): a relic icon is still its glyph (${relics.filter(Boolean).length} of ${relics.length} drawn from objects/)`);
    // COMBAT'S OWN REDRAW (ART_REDRAW_EVENT): it rebuilds the enemy frames from
    // the combat's state, so the frames are new nodes, and the focus a keyboard
    // or controller player had on an enemy (its frame, as keyboard targeting
    // focuses it) is on the same enemy afterwards. Removing combat's listener
    // leaves the old frames: red.
    await wait(800); // Settings' close hands focus back to its opener first
    const before = await ev(`(() => { const frame = [...document.querySelectorAll('.combat .combatant.enemy[data-eid]')].find((f) => f.getClientRects().length);
      if (!frame) return null; window.__oldFrame = frame; frame.focus(); return { eid: frame.dataset.eid, focused: document.activeElement === frame }; })()`);
    check(!!before?.focused, `in-run Retry (combat): no enemy frame took the focus for the redraw check (${JSON.stringify(before)})`);
    await ev(`document.dispatchEvent(new CustomEvent('ashen:art-redraw'))`);
    const eidSel = JSON.stringify(`.combat .combatant.enemy[data-eid="${before?.eid || ''}"]`);
    const rebuiltAt = await poll(`(() => { const f = document.querySelector(${eidSel}); return !!f && f !== window.__oldFrame; })()`, 4000);
    check(rebuiltAt >= 0, 'in-run Retry (combat): ART_REDRAW_EVENT did not rebuild the enemy frames');
    check(await ev(`document.activeElement === document.querySelector(${eidSel})`), 'in-run Retry (combat): the redraw dropped the focus from the enemy');
    check(await ev(`document.querySelector('.combat') === window.__retryRoot`), 'in-run Retry (combat): the redraw remounted the combat');
  }
  check(!thrown.length, `${thrown.length} uncaught exception(s): ${thrown.slice(0, 2).join(' | ')}`);
  await close(); server?.server.close();
  console.log(`  gate drawn ${gateAt} ms after navigation (${afterProfile} ms after the held profile request) with the indexes held; the load failed at ${failedAt} ms past the press wait; boot to notice ${bootMs} ms`);
  console.log(`  Retry loaded ${PINNED_TIER} in ${loadedAt} ms and redrew the title; ${shots.join(', ')} on placeholders with the index refused`);
  for (const f of found) console.log('  RED ' + f);
  if (found.length) { console.log(`external-play: RED — ${found.length} finding(s) over ${n} checks`); process.exit(1); }
  console.log(`external-play: OK — ${n} checks passed`);
  console.log('BOUNDARY: http only (file:// cannot intercept a twin script), one desktop window for');
  console.log('          the gate and the Retry, and the placeholders are proven by the absence of');
  console.log('          object images, not by looking at each one.');
  process.exit(0);
}

let checks = 0; const findings = []; let seenObjects = 0; let cssBackdrops = 0; let cssMasks = 0; let fontsAsked = 0;
let tilesDrawn = 0; let tracksDecoded = 0;
// Every object url each screen asked for, with the tier that screen must show.
const askedBy = [];
for (const [name, query, ready, viewport] of SCREENS) {
  await cdp.send('Emulation.setDeviceMetricsOverride', PLANT === 'desktop-light' && !viewport.mobile ? { ...viewport, screenWidth: 390, screenHeight: 844 } : viewport, S);
  // Auto's tier for this window: light on the phone; on a desktop the tier the
  // build pins, or the one --expect-tier names when that index was removed.
  const wantTier = viewport.mobile ? 'light' : EXPECT_TIER;
  screenLog = [];
  // The document this navigation makes: requests are kept by its loaderId, so
  // a late request from the screen before cannot be counted as this one's.
  const pageUrl = FILE_MODE ? `${DIR_URL}AshenSpire.html${query}` : `http://localhost:${server.port}/AshenSpire.html${query}`;
  const { loaderId } = await cdp.send('Page.navigate', { url: pageUrl }, S);
  const t0 = Date.now(); let up = false;
  while (Date.now() - t0 < 20000) { if (await ev(ready).catch(() => false)) { up = true; break; } await wait(200); }
  await wait(1200);
  checks++;
  if (!up) { findings.push(`${name} did not mount`); continue; }
  // The loader settles before the first screen is drawn, or after its boot
  // wait; give a late one the same time the screen gets.
  await ev(`new Promise((done) => { const t0 = Date.now(); (function poll() { if (document.documentElement.dataset.builtInArt || Date.now() - t0 > 10000) done(); else setTimeout(poll, 100); })(); })`).catch(() => {});
  // An <img> with NO src reports complete=true/naturalWidth=0 and is not a
  // missing asset — PoseAnimator builds its frames before assigning one, and
  // the source tree shows the same element. Only images that asked for
  // something and got nothing count.
  const art = await ev(`(() => { const imgs=[...document.images];
    const broken=imgs.filter(i=>i.complete&&i.naturalWidth===0&&(i.currentSrc||i.getAttribute('src')));
    const asked=imgs.map(i=>i.getAttribute('src')||'').filter(s=>s&&!s.startsWith('data:')&&!s.startsWith('blob:'));
    return { imgs: imgs.length, broken: broken.map(i=>(i.currentSrc||i.src).slice(-70)),
      objects: asked.filter(s=>/(^|\\/)objects\\/[0-9a-f]{2}\\/[0-9a-f]{64}\\./.test(s)).length,
      bare: asked.filter(s=>/^assets\\//.test(s)).slice(0, 3), tier: document.documentElement.dataset.builtInArt || '' }; })()`);
  checks++;
  if (art.broken.length) findings.push(`${name}: ${art.broken.length} broken image(s) — ${art.broken.slice(0, 3).join(', ')}`);
  if (PINNED_TIER) {
    checks++;
    if (art.tier !== wantTier) findings.push(`${name}: the page loaded built-in art "${art.tier || 'nothing'}"; Auto on this window should load ${wantTier} (the build pins ${PINNED_TIER}${EXPECT_TIER !== PINNED_TIER ? `, --expect-tier ${EXPECT_TIER}` : ''})`);
    checks++;
    if (art.bare.length) findings.push(`${name}: image(s) asked for a bare path, not an object — ${art.bare.join(', ')}`);
  }
  seenObjects += art.objects;
  let cssNote = '';
  if (PINNED_TIER) {
    // THE CSS ASSETS (step 3b). Every url() any element or pseudo-element
    // computes for a background or a mask, and whether each backdrop object
    // actually decodes as an image.
    const css = await ev(`(async () => {
      const found = [];
      // url(#id) names an SVG element in the page (the map's terrain reveal masks), not a file.
      const pick = (v, kind) => { for (const m of String(v || '').matchAll(/url\\("?([^")]+)"?\\)/g)) if (!/^#|^[^#]*\\/AshenSpire\\.html[^#]*#/.test(m[1])) found.push([kind, m[1]]); };
      for (const el of document.querySelectorAll('*')) for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        pick(cs.backgroundImage, 'bg'); pick(cs.maskImage, 'mask'); pick(cs.webkitMaskImage, 'mask');
      }
      const uniq = [...new Map(found.map(([k, u]) => [k + u, [k, u]])).values()];
      const decoded = await Promise.all(uniq.filter(([, u]) => !u.startsWith('data:')).map(([, u]) => new Promise((done) => {
        const img = new Image(); img.onload = () => done([u, img.naturalWidth > 0]); img.onerror = () => done([u, false]); img.src = u; })));
      const sheet = document.querySelector('style[data-asset-css]');
      const lore = [...document.fonts].filter((f) => /AS Lore/.test(f.family));
      await Promise.all(lore.map((f) => f.load().catch(() => null)));
      return { urls: uniq, decoded, injected: sheet ? sheet.textContent.length : -1, unfilled: sheet ? /\\{\\{/.test(sheet.textContent) : false,
        faces: lore.length, loaded: lore.filter((f) => f.status === 'loaded').length };
    })()`);
    const bgs = css.urls.filter(([kind, u]) => kind === 'bg' && !u.startsWith('data:'));
    const masks = css.urls.filter(([kind]) => kind === 'mask');
    checks++;
    for (const [, u] of bgs) { const why = wrongTier(u, wantTier); if (why) findings.push(`${name}: a CSS background is not a ${wantTier}/common object (${why}) — ${u.slice(-80)}`); }
    checks++;
    for (const [u, ok] of css.decoded) if (!ok) findings.push(`${name}: a CSS image did not decode — ${u.slice(-80)}`);
    checks++;
    for (const [, u] of masks) if (!/^data:image\/svg\+xml/.test(u)) findings.push(`${name}: a CSS mask is not an inline SVG data: URI — ${u.slice(0, 80)}`);
    checks++;
    if (css.injected <= 0 || css.unfilled) findings.push(`${name}: the ASSET_CSS rules are ${css.injected <= 0 ? 'not in the page' : 'in the page with unfilled slots'}`);
    checks++;
    if (!LORE_FACES || css.faces !== LORE_FACES || css.loaded !== css.faces) findings.push(`${name}: ${css.loaded} of ${css.faces} "AS Lore" faces loaded (ASSET_CSS declares ${LORE_FACES})`);
    cssBackdrops += bgs.length; cssMasks += masks.length;
    cssNote = `; css ${bgs.length} backdrop(s) from objects, ${masks.length} inline mask(s), ${css.loaded}/${css.faces} lore faces`;
  }
  let tileNote = '';
  if (PINNED_TIER && /map$/.test(name)) {
    // THE MAP TILES (step 3c), on the phone's map and the desktop's: the
    // detail layer must reach `ready`, every tile it drew must be a common
    // object that is a map-detail tile (the tiles are common ids, so the same
    // objects serve either art tier), and each must decode.
    const tiles = await ev(`(async () => {
      const t0 = Date.now();
      const port = () => document.querySelector('[data-detail-state]');
      while (Date.now() - t0 < 15000 && port()?.dataset.detailState !== 'ready') await new Promise((r) => setTimeout(r, 200));
      const hrefs = [...document.querySelectorAll('.map-detail-tiles image')].map((i) => i.getAttribute('href') || '');
      const decoded = await Promise.all(hrefs.map((h) => new Promise((done) => {
        const img = new Image(); img.src = h; img.decode().then(() => done(img.naturalWidth > 0), () => done(false)); })));
      return { state: port()?.dataset.detailState || '', hrefs, decoded };
    })()`);
    checks++;
    if (tiles.state !== 'ready' || !tiles.hrefs.length) findings.push(`${name}: the detail tiles did not draw (state ${tiles.state || 'none'}, ${tiles.hrefs.length} tile(s))`);
    checks++;
    for (const h of tiles.hrefs) if (!commonIds(h).some((id) => id.startsWith('map-detail/'))) findings.push(`${name}: a detail tile is not a common map-detail object — ${h.slice(-80)}`);
    checks++;
    tiles.decoded.forEach((ok, i) => { if (!ok) findings.push(`${name}: a detail tile did not decode — ${tiles.hrefs[i].slice(-80)}`); });
    tilesDrawn += tiles.decoded.filter(Boolean).length;
    tileNote = `; ${tiles.decoded.filter(Boolean).length}/${tiles.hrefs.length} detail tile(s) from common objects decoded`;
  }
  for (const u of new Set(screenLog.filter(([id]) => id === loaderId).map(([, u]) => u))) if (objectPathOf(u)) askedBy.push([u, wantTier, name]);
  console.log(`  ${name.padEnd(7)} mounted, ${art.imgs} image(s), ${art.objects} from objects/, ${art.broken.length} broken${PINNED_TIER ? `, built-in art ${art.tier || 'none'}` : ''}${cssNote}${tileNote}`);
}
if (PINNED_TIER) {
  // Across the screens: some backdrop and some mask came through, and every
  // object the page asked for (fonts, backdrops, sprites) is one the expected
  // tier or common lists — after a fallback, nothing from the tier that failed.
  checks++;
  if (!cssBackdrops) findings.push('no screen showed a CSS backdrop from objects/ — ASSET_CSS never reached the page');
  checks++;
  if (!cssMasks) findings.push('no screen showed an inline SVG mask');
  checks++;
  const asked = [...new Set(urls.values())].filter((u) => objectPathOf(u));
  // Each screen's requests against that screen's tier: light on the phone,
  // EXPECT_TIER on the desktop.
  const off = askedBy.filter(([u, tier]) => wrongTier(u, tier));
  if (off.length) findings.push(`${off.length} requested object(s) are not their screen's tier or common: ${off.slice(0, 3).map(([u, tier, name]) => `${name} ${u.slice(-40)} (${wrongTier(u, tier)})`).join(', ')}`);
  checks++;
  const fonts = asked.filter((u) => /\.woff2$/.test(u));
  if (FILE_MODE) {
    // file://: the faces are FontFace objects from the sidecar (each screen's
    // lore check above proves they loaded); a font object fetched would be a
    // load Chrome refuses from a file:// page.
    if (fonts.length) findings.push(`--file: the page asked for ${fonts.length} font object(s) by url(), which Chrome refuses under file:// — ${fonts[0].slice(-60)}`);
    checks++;
    const sidecar = [...new Set(urls.values())].filter((u) => /^packs\/fonts-[0-9a-f]{12}\.js$/.test(u));
    if (!sidecar.length) findings.push('--file: the font sidecar (packs/fonts-….js) was never loaded');
    fontsAsked = sidecar.length;
  } else {
    if (!fonts.length) findings.push('the page fetched no font from objects/');
    for (const u of fonts) if (!PACK_OF.get(objectPathOf(u))?.has('common')) findings.push(`a font came from outside the common pack: ${u.slice(-80)}`);
    fontsAsked = fonts.length;
  }
  if (FILE_MODE) {
    // The indexes through their .js twins, never a .json fetch.
    checks++;
    const all = [...new Set(urls.values())];
    const json = all.filter((u) => /^packs\/.+\.json$/.test(u));
    if (json.length) findings.push(`--file: ${json.length} .json index request(s), which a file:// page cannot fetch — ${json[0]}`);
    checks++;
    const twins = all.filter((u) => /^packs\/(?:light|high|common)-[0-9a-f]{12}\.js$/.test(u));
    if (!twins.some((u) => u.startsWith('packs/common-')) || !twins.some((u) => !u.startsWith('packs/common-'))) findings.push(`--file: the art and common indexes were not read from their .js twins (twins asked for: ${twins.join(', ') || 'none'})`);
  }
}
if (PINNED_TIER && FILE_MODE) {
  // THE SCORE UNDER file:// (step 4, §3.9): it stays synthesized. Nothing may
  // ask for the manifest, a track (object or bare path) or the music/ folder;
  // a map-detail/ path is never bare either.
  const asked = [...new Set(urls.values())];
  checks++;
  const bare = asked.filter((u) => /^(?:music|map-detail)\//.test(u));
  if (bare.length) findings.push(`${bare.length} request(s) named a bare music/ or map-detail/ path, not an object: ${bare.slice(0, 3).join(', ')}`);
  checks++;
  const music = asked.filter((u) => commonIds(u).some((id) => id.startsWith('music/')));
  if (music.length) findings.push(`--file: ${music.length} music object(s) asked for; under file:// the score stays synthesized — ${music[0].slice(-60)}`);
} else if (PINNED_TIER) {
  // THE SCORE (step 3c): the manifest and some track came from the common
  // pack's objects, nothing asked for the old music/ or map-detail/ folders,
  // and every track asked for decodes as audio (decoded in the page, on the
  // last screen, from the same object url).
  const asked = [...new Set(urls.values())];
  checks++;
  const bare = asked.filter((u) => /^(?:music|map-detail)\//.test(u));
  if (bare.length) findings.push(`${bare.length} request(s) named a bare music/ or map-detail/ path, not an object: ${bare.slice(0, 3).join(', ')}`);
  checks++;
  if (!asked.some((u) => commonIds(u).includes('music/manifest.json'))) findings.push('the page did not request music/manifest.json from the common pack');
  const trackUrls = asked.filter((u) => commonIds(u).some((id) => /^music\/.+\.mp3$/.test(id)));
  checks++;
  if (!trackUrls.length) findings.push('the page requested no music track from the common pack');
  const decodedTracks = await ev(`Promise.all(${JSON.stringify(trackUrls.map((u) => '/' + u))}.map(async (u) => {
    try { const buf = await (await fetch(u)).arrayBuffer(); const a = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf); return [u, a.duration > 0]; }
    catch { return [u, false]; } }))`);
  for (const [u, ok] of decodedTracks) {
    checks++;
    if (ok) tracksDecoded++;
    else findings.push(`a music track did not decode — ${u.slice(-80)}`);
  }
}
if (PINNED_TIER) {
  // At least one screen drew pack art: a build whose screens all happened to
  // show no images would otherwise pass the per-image checks vacuously.
  checks++;
  if (!seenObjects) findings.push('no screen drew an image from objects/ — the pack art never reached the page');
}
checks++;
if (failures.length) findings.push(`${failures.length} failed request(s): ${[...new Set(failures)].slice(0, 5).join(' | ')}`);
checks++;
if (thrown.length) findings.push(`${thrown.length} uncaught exception(s): ${thrown.slice(0, 2).join(' | ')}`);

await close(); server?.server.close();
for (const f of findings) console.log('  RED ' + f);
if (findings.length) { console.log(`external-play: RED — ${findings.length} finding(s) over ${checks} checks`); process.exit(1); }
// Same grammar rule as verify-external: the verdict line ends at the count, or
// tools/verdict.mjs reads the whole thing as prose and calls the run silent.
console.log(`  ${SCREENS.length} screens mounted from ${relative(ROOT, DIR)}${FILE_MODE ? ' by file:// URL' : ''}; 0 broken images; 0 failed requests${PINNED_TIER ? `; ${seenObjects} images from objects/ (light on the phone, ${EXPECT_TIER} on the desktop); ${cssBackdrops} CSS backdrop(s) and ${FILE_MODE ? `the faces from ${fontsAsked} font sidecar` : `${fontsAsked} font(s) from objects`}, ${cssMasks} inline mask(s); ${tilesDrawn} map tile(s)${FILE_MODE ? ' from common objects, decoded; the score synthesized' : ` and ${tracksDecoded} track(s) from common objects, decoded`}` : ''}.`);
console.log(`external-play: OK — ${checks} checks passed`);
console.log('BOUNDARY: seven screens and the network. No run was played, and a screen that');
console.log('          mounts with the WRONG art passes this; a track that decodes is not');
console.log('          proven to be heard, and only the tiles the map screens show are drawn.');
