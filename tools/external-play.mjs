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
//   node tools/external-play.mjs [--dir build/web] [--expect-tier light]
//
// --expect-tier names the tier the page must END ON when it is not the one the
// build pins: a high-default build whose high index was removed must load light
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
// VERDICT: "external-play: OK — N checks passed".
//
// WHAT IT DOES NOT CHECK: gameplay. It mounts four screens and watches the
// network; it does not play a run, and a screen that mounts with the wrong art
// passes. Two known non-findings are filtered and named where they are filtered.
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { resolve, dirname, relative } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { objectPath } from './asset-pack.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const dirFlag = ARGV.indexOf('--dir');
const DIR = resolve(ROOT, dirFlag >= 0 ? ARGV[dirFlag + 1] : 'build/web');

if (!existsSync(resolve(DIR, 'AshenSpire.html'))) {
  console.error(`external-play: no build at ${relative(ROOT, DIR)} — node tools/bundle.mjs --external-art --out ${relative(ROOT, DIR)}`);
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
function wrongTier(url) {
  const path = objectPathOf(url);
  if (!path) return 'not an object';
  const packs = PACK_OF.get(path);
  if (!packs) return 'listed by no index beside the build';
  if (packs.has(EXPECT_TIER) || packs.has('common')) return '';
  return `only the ${[...packs].join('/')} index lists it`;
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

const SCREENS = [
  // The cold boot's startup gate: the river citadel backdrops and the
  // entrance hall's door mask (CSS assets, step 3b).
  ['gate', '', `!!document.querySelector('.startup-gate')`],
  ['title', '?shot=title', `!!document.querySelector('#app button')`],
  ['combat', '?shot=combat', `!!document.querySelector('.combat .hand .card')`],
  ['map', '?shot=map', `!!document.querySelector('.map-node')`],
];

const server = await serve({ root: DIR, port: 8317, open: false });
// Autoplay allowed, so the title's track is requested and played without a
// gesture (DEFAULT_ARGS already mutes the output).
const { wsUrl, close } = await launchBrowser({ prefix: 'extplay-', browser: process.env.CHROME || process.env.CHROME_PATH, timeoutMs: 30000, args: ['--autoplay-policy=no-user-gesture-required'] });
const cdp = connect(wsUrl); await cdp.ready;
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S); await cdp.send('Network.enable', {}, S);

const failures = []; const thrown = []; const urls = new Map();
const removedIndex = (url) => EXPECT_TIER !== PINNED_TIER && new RegExp(`(^|/)packs/${PINNED_TIER}-[0-9a-f]{12}\\.json$`).test(String(url));
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
  // build ships one (SFX_MANIFEST is empty). The source tree and the single
  // file 404 on it identically. Only a BARE path is filtered: an id an index
  // listed would have resolved to objects/ and is checked like any other.
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400
      && !/\/api\/lan\//.test(m.params.response.url) && !/favicon\.ico/i.test(m.params.response.url)
      && !(m.params.response.status === 404 && /^https?:\/\/[^/]+\/assets\/sfx\/[^/?#]+\.ogg$/.test(m.params.response.url))
      && !(m.params.response.status === 404 && removedIndex(m.params.response.url))) {
    failures.push(`${m.params.response.status} ${m.params.response.url.replace(/^https?:\/\/[^/]+\//, '')}`);
  }
  if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url.replace(/^https?:\/\/[^/]+\//, ''));
  if (m.method === 'Network.loadingFailed' && !/favicon/i.test(m.params.errorText || '') && !removedIndex(urls.get(m.params.requestId) || '')) failures.push(`${m.params.errorText} ${urls.get(m.params.requestId) || ''}`.trim());
  if (m.method === 'Runtime.exceptionThrown') thrown.push(m.params.exceptionDetails.text || 'exception');
});
const ev = async (e) => {
  const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
  return r.result.value;
};

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, S);
let checks = 0; const findings = []; let seenObjects = 0; let cssBackdrops = 0; let cssMasks = 0; let fontsAsked = 0;
let tilesDrawn = 0; let tracksDecoded = 0;
for (const [name, query, ready] of SCREENS) {
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/AshenSpire.html${query}` }, S);
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
    if (art.tier !== EXPECT_TIER) findings.push(`${name}: the page loaded built-in art "${art.tier || 'nothing'}", ${EXPECT_TIER === PINNED_TIER ? `the build pins ${PINNED_TIER}` : `expected ${EXPECT_TIER} (the build pins ${PINNED_TIER})`}`);
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
    for (const [, u] of bgs) { const why = wrongTier(u); if (why) findings.push(`${name}: a CSS background is not a ${EXPECT_TIER}/common object (${why}) — ${u.slice(-80)}`); }
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
  if (PINNED_TIER && name === 'map') {
    // THE MAP TILES (step 3c): the detail layer must reach `ready`, every tile
    // it drew must be a common object that is a map-detail tile, and each must
    // decode.
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
    if (tiles.state !== 'ready' || !tiles.hrefs.length) findings.push(`map: the detail tiles did not draw (state ${tiles.state || 'none'}, ${tiles.hrefs.length} tile(s))`);
    checks++;
    for (const h of tiles.hrefs) if (!commonIds(h).some((id) => id.startsWith('map-detail/'))) findings.push(`map: a detail tile is not a common map-detail object — ${h.slice(-80)}`);
    checks++;
    tiles.decoded.forEach((ok, i) => { if (!ok) findings.push(`map: a detail tile did not decode — ${tiles.hrefs[i].slice(-80)}`); });
    tilesDrawn += tiles.decoded.filter(Boolean).length;
    tileNote = `; ${tiles.decoded.filter(Boolean).length}/${tiles.hrefs.length} detail tile(s) from common objects decoded`;
  }
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
  const off = asked.filter((u) => wrongTier(u));
  if (off.length) findings.push(`${off.length} requested object(s) are not ${EXPECT_TIER}/common: ${off.slice(0, 3).map((u) => `${u.slice(-40)} (${wrongTier(u)})`).join(', ')}`);
  checks++;
  const fonts = asked.filter((u) => /\.woff2$/.test(u));
  if (!fonts.length) findings.push('the page fetched no font from objects/');
  for (const u of fonts) if (!PACK_OF.get(objectPathOf(u))?.has('common')) findings.push(`a font came from outside the common pack: ${u.slice(-80)}`);
  fontsAsked = fonts.length;
}
if (PINNED_TIER) {
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

await close(); server.server.close();
for (const f of findings) console.log('  RED ' + f);
if (findings.length) { console.log(`external-play: RED — ${findings.length} finding(s) over ${checks} checks`); process.exit(1); }
// Same grammar rule as verify-external: the verdict line ends at the count, or
// tools/verdict.mjs reads the whole thing as prose and calls the run silent.
console.log(`  ${SCREENS.length} screens mounted from ${relative(ROOT, DIR)}; 0 broken images; 0 failed requests${PINNED_TIER ? `; ${seenObjects} images from the ${EXPECT_TIER} pack's objects; ${cssBackdrops} CSS backdrop(s) and ${fontsAsked} font(s) from objects, ${cssMasks} inline mask(s); ${tilesDrawn} map tile(s) and ${tracksDecoded} track(s) from common objects, decoded` : ''}.`);
console.log(`external-play: OK — ${checks} checks passed`);
console.log('BOUNDARY: four screens and the network. No run was played, and a screen that');
console.log('          mounts with the WRONG art passes this; a track that decodes is not');
console.log('          proven to be heard, and only the tiles the map screen shows are drawn.');
