// tests/boot-art.test.mjs — the web edition's loading UX and fallbacks
// (docs/EXTERNAL-ASSETS-PLAN.md step 5): the critical set content/config lists,
// the startup gate's status line, the warm-up that counts it, the boot load
// with its index blocked (placeholders, no source), the Retry that loads again
// through the Art quality queue, a high-default build whose high index is gone,
// and the decision that the common pack alone does not make a source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  CRITICAL_SET, CRITICAL_WAIT_MS, bootArtLine, bootArtPhase, warmCriticalSet, startBootArt, bootArtRetried, resetBootArt,
} from '../src/ui/bootArt.js';
import { loadBuiltInPacks, resetBuiltInArt, builtInArtStatus, BOOT_WAIT_MS } from '../src/ui/assetPacks.js';
import { retryBuiltInArt, retryOffered, tierStatus, onTierArrived, resetArtTier, applyArtTier } from '../src/ui/artTier.js';
import { builtInSource, assetUrl } from '../src/ui/assetmap.js';
import { startupGateModel } from '../src/ui/models/StartupGateModels.js';
import { artLoadNoticeModel, ART_NOTICE_STATES } from '../src/ui/models/ArtLoadNoticeModel.js';
import { artLoadNoticeHtml } from '../src/ui/components/artLoadNotice.js';
import { ART_QUALITY_KEY, ART_LIGHT, ART_AUTO } from '../src/ui/highResArt.js';
import { indexText } from '../tools/asset-pack.mjs';
import { t, tFull } from '../src/ui/strings.js';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const A = 'a'.repeat(64);
const C = 'c'.repeat(64);
const M = 'd'.repeat(64);
const ID = 'assets/bg/bg_act1.webp';
const MUSIC = 'music/manifest.json';
const TILE = 'map-detail/abc/256/0-0.webp';
const wide = { documentElement: { getAttribute: (name) => (name === 'data-layout' ? 'wide' : null) } };
const desktop = { deviceMemory: 8, connection: { saveData: false } };

/** A pack tree (light, high, common) whose index fetches can be blocked one by one. */
function packTree(tier = 'high') {
  const indexes = {
    light: indexText({ [ID]: [A, 10, 'image/webp'] }),
    high: indexText({ [ID]: [C, 99, 'image/webp'] }),
    common: indexText({ [MUSIC]: [M, 5, 'application/json'], [TILE]: [M, 5, 'image/webp'] }),
  };
  const packs = {};
  const files = new Map();
  for (const [pack, text] of Object.entries(indexes)) {
    if (tier === 'light' && pack === 'high') continue;
    const name = `packs/${pack}-${sha(text).slice(0, 12)}.json`;
    packs[pack] = { index: name, sha256: sha(text), ids: 1, objects: 1, bytes: 1 };
    files.set(name, text);
  }
  const tree = { pin: { schema: 1, tier, packs, fonts: null }, asked: [], blocked: new Set() };
  tree.fetchImpl = async (url) => {
    const path = url.replace(/^\.\//, '');
    tree.asked.push(path);
    const pack = (/^packs\/([a-z]+)-/.exec(path) || [])[1];
    if (tree.blocked.has('all') || tree.blocked.has(pack)) throw new TypeError('Failed to fetch');
    const body = files.get(path);
    if (body === undefined) return { ok: false, status: 404 };
    const bytes = new TextEncoder().encode(body);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(0), json: async () => JSON.parse(body) };
  };
  tree.load = { inlineMap: {}, fetchImpl: tree.fetchImpl, protocol: 'http:', doc: null };
  return tree;
}
const fresh = () => { resetBuiltInArt(); resetArtTier(); resetBootArt(); };
const tierOf = () => (assetUrl(ID).includes(`/${C.slice(0, 2)}/`) ? 'high' : assetUrl(ID).includes(`/${A.slice(0, 2)}/`) ? 'light' : 'none');

test('the critical set is content/config’s: the title backdrops and the faces, each an id the manifest ships', () => {
  const config = JSON.parse(readFileSync(new URL('../content/config/ui/presentation/startupGate.json', import.meta.url), 'utf8'));
  assert.deepEqual(CRITICAL_SET, config.components.artLoading.critical, 'read from content/config, not typed in code');
  assert.equal(new Set(CRITICAL_SET).size, CRITICAL_SET.length, 'no id twice');
  assert.equal(CRITICAL_WAIT_MS, config.behavior.artLoading.criticalWaitMs);
  const manifest = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8')).assets;
  const css = readdirSync(new URL('../styles/', import.meta.url)).filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(new URL(`../styles/${f}`, import.meta.url), 'utf8')).join('\n');
  const fonts = CRITICAL_SET.filter((id) => id.startsWith('assets/fonts/'));
  const backdrops = CRITICAL_SET.filter((id) => id.startsWith('assets/bg/'));
  assert.equal(fonts.length + backdrops.length, CRITICAL_SET.length, 'only faces and backdrops');
  const allFonts = Object.keys(manifest).filter((id) => id.startsWith('assets/fonts/'));
  assert.deepEqual([...fonts].sort(), [...allFonts].sort(), 'every face the common pack carries');
  for (const id of fonts) assert.ok(manifest[id].common, `${id} is a common record`);
  for (const id of backdrops) {
    assert.ok(manifest[id]?.light && manifest[id]?.high, `${id} ships in both art tiers`);
    assert.ok(css.includes(`url('../${id}')`), `${id} is a backdrop the stylesheets name`);
  }
  // The title's own backdrops: the gate's and the hall's, phone and desktop.
  for (const name of ['title-city-tower', 'river-citadel-unlit', 'river-citadel-lit', 'tower-city-background-unlit', 'tower-entrance-hall', 'tower-entrance-hall-phone']) {
    assert.ok(backdrops.includes(`assets/bg/${name}.webp`), name);
  }
});

test('the gate’s line: none when nothing is pinned, then loading, counting, nothing, or the failure', () => {
  fresh();
  assert.equal(bootArtLine({ state: 'off' }), null, 'a single file and the source tree draw no line');
  assert.deepEqual(bootArtLine({ state: 'index' }), { state: 'loading', text: t('art.loading') });
  assert.equal(t('art.loading'), 'Loading art…');
  assert.deepEqual(bootArtLine({ state: 'warming', done: 12, total: 21 }), { state: 'loading', text: 'Loading art · 12 of 21' });
  assert.deepEqual(bootArtLine({ state: 'done' }), { state: 'done', text: '' });
  assert.equal(bootArtLine({ state: 'failed' }).text, tFull('art.failed.gate'));
  assert.match(bootArtLine({ state: 'failed' }).text, /placeholders.*retry from the title screen/i);
  // The gate's model carries it; a build that pins nothing carries none.
  assert.equal(startupGateModel({}).properties.artStatus, null);
  assert.deepEqual(startupGateModel({ artStatus: bootArtLine({ state: 'index' }) }).properties.artStatus, { state: 'loading', text: 'Loading art…' });
  assert.equal(startupGateModel({}).accessibility.artStatusLive, 'polite');
});

test('the warm-up counts only what the source lists; faces under file:// are already loaded', async () => {
  const map = new Map([
    ['assets/bg/a.webp', 'objects/aa/a.webp'], ['assets/bg/b.webp', 'objects/bb/b.webp'], ['assets/fonts/f.woff2', 'objects/cc/f.woff2'],
  ]);
  const ids = ['assets/bg/a.webp', 'assets/bg/b.webp', 'assets/fonts/f.woff2', 'assets/bg/not-listed.webp'];
  const seen = [];
  const images = [];
  const fonts = [];
  let r = await warmCriticalSet({ ids, map, protocol: 'http:', loadImage: async (u) => { images.push(u); return !u.includes('/bb/'); },
    loadFont: async (u) => { fonts.push(u); return true; }, onProgress: (d, n) => seen.push(`${d}/${n}`) });
  assert.deepEqual(r, { done: 3, total: 3, failed: 1 }, 'an unlisted id is not counted; a failed file still settles');
  assert.deepEqual(seen, ['0/3', '1/3', '2/3', '3/3']);
  assert.deepEqual(images.sort(), ['objects/aa/a.webp', 'objects/bb/b.webp']);
  assert.deepEqual(fonts, ['objects/cc/f.woff2'], 'over http the face is warmed by its own url');
  fonts.length = 0;
  r = await warmCriticalSet({ ids, map, protocol: 'file:', loadImage: async () => true, loadFont: async (u) => { fonts.push(u); return true; } });
  assert.deepEqual(fonts, [], 'under file:// no face is asked for by url (the sidecar added them)');
  assert.equal(r.done, 3);
  // A file that never settles does not hold the line forever.
  r = await warmCriticalSet({ ids: ['assets/bg/a.webp'], map, loadImage: () => new Promise(() => {}), waitMs: 20 });
  assert.deepEqual(r, { done: 0, total: 1, failed: 0 });
  assert.deepEqual(await warmCriticalSet({ ids, map: null, waitMs: 20 }), { done: 0, total: 0, failed: 0 }, 'no source, nothing to warm');
});

test('startBootArt: index → warming → done when the load loads; failed when it fails; off when nothing is pinned', async () => {
  fresh();
  await startBootArt({ pinned: false, settled: Promise.resolve({ state: 'loaded' }) });
  assert.equal(bootArtPhase().state, 'off');
  const map = new Map([['assets/bg/a.webp', 'objects/aa/a.webp']]);
  const phases = [];
  let release;
  const settled = new Promise((done) => { release = done; });
  const run = startBootArt({ pinned: true, settled, source: () => map, doc: null,
    warm: (o) => warmCriticalSet({ ...o, ids: ['assets/bg/a.webp'], loadImage: async () => { phases.push(bootArtPhase().state); return true; } }) });
  assert.equal(bootArtPhase().state, 'index', 'while the indexes load');
  release({ state: 'loaded' });
  await run;
  assert.deepEqual(phases, ['warming']);
  assert.equal(bootArtPhase().state, 'done');
  await startBootArt({ pinned: true, settled: Promise.resolve({ state: 'failed' }), doc: null });
  assert.equal(bootArtPhase().state, 'failed');
  bootArtRetried({ state: 'loaded' }, null);
  assert.equal(bootArtPhase().state, 'done', 'a Retry that loads clears the failed line');
});

test('the index blocked: the boot load fails, no source and no CSS, so every screen shows its placeholders', async () => {
  fresh();
  const tree = packTree('high');
  tree.blocked.add('all');
  const s = await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high', deadlineMs: 200 });
  assert.equal(s.state, 'failed');
  assert.equal(builtInSource(), null, 'placeholders: no built-in source');
  assert.equal(assetUrl(ID), ID, 'ids pass through as their paths, which the images’ own handlers turn into placeholders');
  assert.equal(s.css, 0);
  assert.ok(s.failed.length >= 2, 'both art tiers were tried');
  assert.ok(tree.asked.some((u) => /^packs\/high-/.test(u)) && tree.asked.some((u) => /^packs\/light-/.test(u)), 'high, then light');
  assert.ok(BOOT_WAIT_MS >= 1000, 'the boot wait is still the deadline');
});

test('the common pack alone does not make a source: the score and the tiles fall back with the art (decision, step 5)', async () => {
  fresh();
  const tree = packTree('light');
  tree.blocked.add('light');
  const s = await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'light', deadlineMs: 200 });
  assert.equal(s.state, 'failed');
  assert.equal(builtInSource(), null, 'common verified, but no art: nothing is published');
  assert.equal(assetUrl(MUSIC), MUSIC, 'the shipped score falls back to the synth');
  assert.equal(assetUrl(TILE), TILE, 'the map keeps its low-detail fallback');
});

test('a high-default build whose high index is gone loads light (the remove-high pass)', async () => {
  fresh();
  const tree = packTree('high');
  tree.blocked.add('high');
  const s = await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high', deadlineMs: 400 });
  assert.equal(s.state, 'loaded');
  assert.equal(s.tier, 'light');
  assert.equal(s.requested, 'high');
  assert.equal(tierOf(), 'light');
  assert.equal(assetUrl(MUSIC).includes(M), true, 'common still loads beside light');
});

test('Retry after a failed boot load: loads through the Art quality queue, re-points through onTierArrived, and the row says so', async () => {
  fresh();
  const tree = packTree('high');
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load, deadlineMs: 300 }, env: { doc: wide, nav: desktop } };
  // main.js applies the display settings before the boot load starts.
  assert.equal(await applyArtTier(settings, opts), null);
  tree.blocked.add('all');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high', deadlineMs: 200 });
  assert.equal(builtInArtStatus().state, 'failed');
  assert.equal(retryOffered({ pin: tree.pin, inlineMap: {} }), true, 'the row offers Retry');
  assert.match(tierStatus(settings, { pin: tree.pin, inlineMap: {} }), /placeholders\. Choose Retry/);
  assert.equal(await applyArtTier(settings, opts), null, 'the same choice again loads nothing: that is what Retry is for');
  const arrived = [];
  onTierArrived((map) => arrived.push(map));
  // Still blocked: Retry fails, keeps the placeholders, and is offered again.
  let r = await retryBuiltInArt(settings, opts);
  assert.equal(r.state, 'failed');
  assert.equal(arrived.length, 0);
  assert.equal(retryOffered({ pin: tree.pin, inlineMap: {} }), true);
  // The network is back: Retry loads the tier the setting asks for.
  tree.blocked.clear();
  r = await retryBuiltInArt(settings, opts);
  assert.equal(r.state, 'loaded');
  assert.equal(r.tier, 'high', 'Auto on a wide desktop: the build’s default');
  assert.equal(arrived.length, 1, 'onTierArrived re-points the images (main.js also redraws the title)');
  assert.ok(arrived[0].has(MUSIC), 'the common entries come with it, so the score and tiles come back');
  assert.equal(tierOf(), 'high');
  assert.equal(retryOffered({ pin: tree.pin, inlineMap: {} }), false);
  assert.match(tierStatus(settings, { pin: tree.pin, inlineMap: {} }), /^Showing high art\.$/);
});

test('a Retry replaced by a tier switch publishes nothing (the stillWanted guard)', async () => {
  fresh();
  const tree = packTree('high');
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load, deadlineMs: 300 }, env: { doc: wide, nav: desktop } };
  tree.blocked.add('all');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high', deadlineMs: 200 });
  tree.blocked.clear();
  const arrived = [];
  onTierArrived((map) => arrived.push(map.get(ID)));
  const retry = retryBuiltInArt({ [ART_QUALITY_KEY]: ART_AUTO }, opts);
  const light = applyArtTier({ [ART_QUALITY_KEY]: ART_LIGHT }, opts);
  assert.equal(await retry, null, 'superseded before it ran');
  assert.equal((await light).tier, 'light');
  assert.equal(arrived.length, 1);
  assert.equal(tierOf(), 'light');
});

test('a single file and the source tree: Retry does nothing and is never offered', async () => {
  fresh();
  assert.equal(await retryBuiltInArt({}, { pin: null, inlineMap: {} }), null);
  assert.equal(retryOffered({ pin: null, inlineMap: {} }), false);
});

test('the title’s notice: three states, a polite message, and Retry disabled while it runs', () => {
  assert.deepEqual(ART_NOTICE_STATES, ['failed', 'retrying', 'again']);
  const failed = artLoadNoticeModel({ state: 'failed' });
  assert.equal(failed.component, 'art-load-notice');
  assert.equal(failed.properties.message, tFull('art.failed.notice'));
  assert.equal(failed.accessibility.live, 'polite');
  const html = artLoadNoticeHtml(failed);
  assert.match(html, /data-component="art-load-notice"/);
  assert.match(html, /data-component="art-load-notice-retry"[^>]*>Retry<\/button>/);
  assert.doesNotMatch(html, /disabled/);
  const busy = artLoadNoticeHtml(artLoadNoticeModel({ state: 'retrying' }));
  assert.match(busy, /disabled aria-busy="true"/);
  assert.match(busy, /Loading art…/);
  assert.match(artLoadNoticeHtml(artLoadNoticeModel({ state: 'again' })), /still could not be loaded/);
  assert.equal(artLoadNoticeModel({ state: 'nonsense' }).variant, 'failed');
});

test('main.js draws the gate before the load settles and holds the title until it has (step 5)', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const gateFirst = packsPinned\(\) && \(!shotState \|\| shotState === 'startup'\);/, 'only the cold boot, only a pack build');
  assert.match(main, /const dropBootLine = gateFirst \? \(\) => \{\} : bootLine\(app\);/, 'a ?shot= boot keeps the static line');
  assert.match(main, /if \(gateFirst\) \{\n  startBootArt\(\{ settled: builtInArtSettled\(\), source: builtInSource \}\);\n  showFirstScreen\(\);\n\}/);
  assert.match(main, /afterBootArt\(\(\) => showTitle\(\{\n        skipStartup: true,/, 'a press during the load reveals the title once it settles');
  assert.match(main, /artStatus: bootArtLine\(\)/, 'the gate carries the line');
  assert.match(main, /artNotice: drawArtNotice,/, 'the title carries the notice');
});
