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
  CRITICAL_SET, CRITICAL_WAIT_MS, RETRY_WAIT_MS, criticalIds, bootArtLine, bootArtPhase, warmCriticalSet, startBootArt, bootArtRetried, resetBootArt,
} from '../src/ui/bootArt.js';
import { loadBuiltInPacks, resetBuiltInArt, builtInArtStatus, BOOT_WAIT_MS } from '../src/ui/assetPacks.js';
import { retryBuiltInArt, retryOffered, tierStatus, onTierArrived, resetArtTier, applyArtTier } from '../src/ui/artTier.js';
import { builtInSource, assetUrl } from '../src/ui/assetmap.js';
import { startupGateModel } from '../src/ui/models/StartupGateModels.js';
import { bootArtStatusModel } from '../src/ui/models/BootArtStatusModel.js';
import { bootArtStatusHtml } from '../src/ui/components/bootArtStatus.js';
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
  const norm = (e) => (typeof e === 'string' ? { id: e, orientation: 'any' } : { id: e.id, orientation: e.orientation || 'any' });
  assert.deepEqual(CRITICAL_SET.map((e) => ({ ...e })), config.components.artLoading.critical.map(norm), 'read from content/config, not typed in code');
  const ids = CRITICAL_SET.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'no id twice');
  for (const e of CRITICAL_SET) assert.ok(['any', 'portrait', 'landscape'].includes(e.orientation), e.id);
  assert.equal(CRITICAL_WAIT_MS, config.behavior.artLoading.criticalWaitMs);
  const manifest = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8')).assets;
  const kit = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  const fonts = ids.filter((id) => id.startsWith('assets/fonts/'));
  const backdrops = CRITICAL_SET.filter((e) => e.id.startsWith('assets/bg/'));
  assert.equal(fonts.length + backdrops.length, ids.length, 'only faces and backdrops');
  const allFonts = Object.keys(manifest).filter((id) => id.startsWith('assets/fonts/'));
  assert.deepEqual([...fonts].sort(), [...allFonts].sort(), 'every face the common pack carries');
  for (const id of fonts) assert.ok(manifest[id].common, `${id} is a common record`);
  // Each backdrop is one the gate or the title's hall draws, in the orientation
  // it is tagged for: the portrait rule is kit.css's `@media (orientation: portrait)`.
  const portrait = kit.slice(kit.indexOf('@media (orientation: portrait) {\n  .tower-door-frame'));
  const portraitBlock = portrait.slice(0, portrait.indexOf('\n}\n'));
  for (const { id, orientation } of backdrops) {
    assert.ok(manifest[id]?.light && manifest[id]?.high, `${id} ships in both art tiers`);
    const named = `url('../${id}')`;
    assert.ok(kit.includes(named), `${id} is a backdrop the stylesheet names`);
    if (orientation === 'portrait') assert.ok(portraitBlock.includes(named), `${id} is drawn only in portrait`);
    if (orientation === 'landscape') assert.ok(portraitBlock.includes('tower-door-frame') && !portraitBlock.includes(named), `${id} is replaced in portrait`);
  }
  // title-city-tower is not in it: the gate's later `background: #100e0b` covers it, so nothing shows it.
  assert.ok(!ids.includes('assets/bg/title-city-tower.webp'));
  // One orientation warms 19: the 15 faces, three backdrops both use, and its own hall.
  assert.equal(criticalIds('portrait').length, 19);
  assert.equal(criticalIds('landscape').length, 19);
  assert.ok(criticalIds('portrait').includes('assets/bg/tower-entrance-hall-phone.webp') && !criticalIds('portrait').includes('assets/bg/tower-entrance-hall.webp'));
  assert.ok(criticalIds('landscape').includes('assets/bg/tower-entrance-hall.webp') && !criticalIds('landscape').includes('assets/bg/tower-entrance-hall-phone.webp'));
  assert.ok(RETRY_WAIT_MS > BOOT_WAIT_MS, 'a Retry is not held to the boot deadline');
  assert.equal(RETRY_WAIT_MS, config.behavior.artLoading.retryWaitMs);
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
  // Its own component, a polite status that is busy while it counts.
  const model = bootArtStatusModel(bootArtLine({ state: 'index' }));
  assert.equal(model.component, 'boot-art-status');
  assert.deepEqual(model.accessibility, { role: 'status', live: 'polite', busy: true });
  const html = bootArtStatusHtml(model);
  assert.match(html, /^<p class="boot-art-status" data-component="boot-art-status" data-boot-art-status data-state="loading"/);
  assert.match(html, /role="status" aria-live="polite" aria-busy="true">Loading art…<\/p>$/);
  assert.match(bootArtStatusHtml(bootArtStatusModel(bootArtLine({ state: 'failed' }))), /aria-busy="false">The art could not be loaded/);
});

test('the status line is not part of the startup gate: the gate’s model and markup are SPEC §7.1’s, unchanged', () => {
  const gate = readFileSync(new URL('../src/ui/components/startupGate.js', import.meta.url), 'utf8');
  assert.doesNotMatch(gate, /boot-art|art-status|artStatus/, 'the gate renders no art status');
  assert.equal('artStatus' in startupGateModel({}).properties, false, 'the gate model carries no art status');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // Mounted after the gate, as a sibling in #app (outside its role="button").
  assert.match(main, /const artLine = bootArtLine\(\);\n  if \(artLine\) mountBootArtStatus\(app, bootArtStatusModel\(artLine\)\);/);
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /#app > \.boot-art-status \{[^}]*pointer-events: none;/, 'it takes no input: a press on it is a press on the gate');
  assert.match(css, /\.reduced-motion #app > \.boot-art-status \{ animation: none; \}/);
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
  assert.equal(tierStatus(settings, { pin: tree.pin, inlineMap: {} }), tFull('art.failed.settings'), 'the sentence is a uiStrings row');
  assert.match(tFull('art.failed.settings'), /placeholders\. Choose Retry/);
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
  assert.match(busy, /aria-disabled="true" aria-busy="true"/, 'aria-disabled, so the focus on it is kept');
  assert.doesNotMatch(busy, / disabled/);
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
  // The debug profile auto-load (Settings → Advanced → Defaults & sync) no
  // longer leaves the cold boot blank: the gate is drawn at once and the title
  // waits for the profile as well as the art (Codex on #1471).
  assert.match(main, /if \(gateFirst\) \{\n    \/\/ A pack build's cold boot draws the gate at once \(step 5\): the profile\n    \/\/ keeps loading behind it, and the title waits for it as well as the art\.\n    holdTitleFor\(profileSettled\);\n    showTitle\(\);\n  \}/);
  assert.match(main, /const go = \(\) => \(titleHolds\.length \? Promise\.all\(titleHolds\)\.then\(fn\) : fn\(\)\);/);
  assert.match(main, /artNotice: drawArtNotice,/, 'the title carries the notice');
});

test('a Retry is not held to the boot deadline: an index slower than BOOT_WAIT_MS loads on Retry', async () => {
  fresh();
  const tree = packTree('light');
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load }, env: { doc: wide, nav: desktop } };
  assert.equal(await applyArtTier(settings, opts), null);
  // A slow link: every index answers only after BOOT_WAIT_MS.
  const slow = tree.fetchImpl;
  const fetchImpl = (url, o) => new Promise((done, fail) => {
    const t = setTimeout(() => slow(url, o).then(done, fail), BOOT_WAIT_MS + 300);
    o?.signal?.addEventListener?.('abort', () => { clearTimeout(t); fail(new Error('aborted')); });
  });
  const boot = await loadBuiltInPacks({ pin: tree.pin, ...tree.load, fetchImpl, tier: 'light' });
  assert.equal(boot.state, 'failed', 'the boot load gives up at BOOT_WAIT_MS');
  const r = await retryBuiltInArt(settings, { ...opts, load: { ...tree.load, fetchImpl } });
  assert.equal(r.state, 'loaded', 'Retry waits RETRY_WAIT_MS, so the same link brings the index');
  assert.equal(tierOf(), 'light');
});

test('Settings’ Retry is aria-disabled while it runs and hands focus to the row’s line when it loads', async () => {
  fresh();
  const tree = packTree('light');
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load, deadlineMs: 300 }, env: { doc: wide, nav: desktop } };
  await applyArtTier(settings, opts);
  tree.blocked.add('all');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'light', deadlineMs: 200 });
  tree.blocked.clear();
  const attrs = (el) => ({ ...el.a });
  const element = (id) => ({ id, a: {}, hidden: false, textContent: '',
    setAttribute(k, v) { this.a[k] = String(v); }, removeAttribute(k) { delete this.a[k]; }, getAttribute(k) { return this.a[k] ?? null; },
    focus() { doc.activeElement = this; } });
  const button = element('retry');
  const line = element('set-artQuality-tier');
  const doc = { activeElement: button, querySelectorAll: (sel) => (sel === '[data-art-retry]' ? [button] : sel === '[data-art-tier-status]' ? [line] : []),
    getElementById: (id) => (id === 'set-artQuality-tier' ? line : null) };
  const saved = globalThis.document;
  globalThis.document = doc;
  // ASSET_PACKS is null under test, so the button's "offered" reads false; drive the attributes through a running Retry.
  try {
    // The answer is held until the busy state has been read: a fetch that
    // answers at once could finish the whole load before this test looks.
    let release;
    const held = new Promise((r) => { release = r; });
    const fetchImpl = async (url, o) => { await held; return tree.fetchImpl(url, o); };
    const run = retryBuiltInArt(settings, { ...opts, load: { ...opts.load, fetchImpl } });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(attrs(button)['aria-disabled'], 'true', 'aria-disabled while it runs');
    assert.equal(doc.activeElement, button, 'the focus stays on it while it runs');
    release();
    const r = await run;
    assert.equal(r.state, 'loaded');
    assert.equal(button.hidden, true);
    assert.equal(attrs(button)['aria-disabled'], undefined);
    assert.equal(doc.activeElement, line, 'the focus moves to the live line');
    assert.equal(attrs(line).tabindex, '-1');
  } finally {
    globalThis.document = saved;
  }
});

test('a redraw waits until no dialog or title door is open over the screen', async () => {
  const { whenNoOverlay, overlayOpen, OVERLAY_SELECTOR } = await import('../src/ui/whenNoOverlay.js');
  assert.match(OVERLAY_SELECTOR, /\[aria-modal="true"\]/);
  assert.match(OVERLAY_SELECTOR, /\.title-modal-veil/);
  let open = true;
  const doc = { body: {}, querySelector: () => (open ? {} : null) };
  let observer = null;
  class Observer { constructor(fn) { this.fn = fn; observer = this; } observe() { this.on = true; } disconnect() { this.on = false; } }
  let ran = 0;
  whenNoOverlay(() => { ran += 1; }, { doc, Observer });
  assert.equal(ran, 0, 'Settings is open: not yet');
  observer.fn();
  assert.equal(ran, 0, 'a change while it is still open: not yet');
  open = false;
  observer.fn();
  assert.equal(ran, 1, 'run once it has closed');
  assert.equal(observer.on, false, 'and the watch ends');
  observer.fn();
  assert.equal(ran, 1, 'only once');
  assert.equal(overlayOpen(doc), false);
  whenNoOverlay(() => { ran += 1; }, { doc, Observer });
  assert.equal(ran, 2, 'nothing open: at once');
});

test('main.js: a superseded Retry is not a failure, and the title redraw waits for dialogs and keeps focus', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /artNoticeState = result \? 'again' : \(artNoticeBefore \|\| 'failed'\);/, 'null (superseded) restores what the notice said');
  // The notice follows a Retry from Settings too (onRetryProgress), not only its own button.
  assert.match(main, /onRetryProgress\(\(\{ phase, result \}\) => \{/);
  assert.match(main, /cancelTitleRedraw = whenNoOverlay\(\(\) => \{/);
  assert.match(main, /if \(action\) app\.querySelector\(`\.title-screen \[data-title-action="\$\{action\}"\]`\)\?\.focus/);
  const notice = readFileSync(new URL('../src/ui/components/artLoadNotice.js', import.meta.url), 'utf8');
  assert.match(notice, /insertAdjacentHTML\('afterbegin'/, 'first in the title’s reading and tab order');
  assert.match(notice, /\} else \{ text\.textContent = message; announced = model\.variant; \}/, 'a state change rewrites the one live node in place');
});

test('a Settings slot rebuilt mid-retry draws Retry busy, and a second press is refused (Codex on #1471)', async () => {
  fresh();
  const { retryRunning } = await import('../src/ui/artTier.js');
  const { settingsRows } = await import('../src/ui/screens/settings.js');
  const row = settingsRows().find((r) => r.key === ART_QUALITY_KEY);
  const tree = packTree('light');
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load, deadlineMs: 2000 }, env: { doc: wide, nav: desktop } };
  await applyArtTier(settings, opts);
  tree.blocked.add('all');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'light', deadlineMs: 200 });
  tree.blocked.clear();
  // A slow answer, so the Retry is still in flight while the slot is rebuilt.
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetchImpl = async (url, o) => { await gate; return tree.fetchImpl(url, o); };
  const before = tree.asked.length;
  assert.equal(retryRunning(), false);
  assert.doesNotMatch(row.applied(settings), /aria-disabled/, 'idle: the button is not busy');
  const first = retryBuiltInArt(settings, { ...opts, load: { ...opts.load, fetchImpl } });
  assert.equal(retryRunning(), true, 'in flight from the press');
  // The slot rebuilt now (Settings opened mid-retry, or refreshApplied): busy in the markup.
  assert.match(row.applied(settings), /data-art-retry[^>]*aria-disabled="true" aria-busy="true"/);
  // A second press meanwhile starts nothing: the same outcome comes back.
  const second = retryBuiltInArt(settings, { ...opts, load: { ...opts.load, fetchImpl } });
  assert.equal(second, first, 'one Retry at a time');
  release();
  const r = await first;
  assert.equal(r.state, 'loaded');
  assert.equal(tree.asked.slice(before).filter((u) => u.startsWith('packs/')).length, 2, 'one load: the light and common indexes, once');
  assert.equal(retryRunning(), false, 'settled');
  assert.doesNotMatch(row.applied(settings), /aria-busy/);
  // The click handler refuses on the shared flag, whatever the button says.
  const src = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(src, /if \(retry\) \{ if \(!retryRunning\(\) && retry\.getAttribute\('aria-disabled'\) !== 'true'\) retryBuiltInArt/);
});

test('a Retry pressed inside the announcement delay is not overwritten by the older failure (Codex on #1471)', async () => {
  const { mountArtLoadNotice, resetArtLoadNotice } = await import('../src/ui/components/artLoadNotice.js');
  resetArtLoadNotice();
  // The smallest DOM the notice touches: one root, one notice, its message and its button.
  const button = { a: {}, setAttribute(k, v) { this.a[k] = String(v); }, removeAttribute(k) { delete this.a[k]; }, getAttribute(k) { return this.a[k] ?? null; }, addEventListener() {} };
  const root = {
    notice: null,
    insertAdjacentHTML(where, html) {
      assert.equal(where, 'afterbegin');
      const text = { isConnected: true, textContent: /role="status" aria-live="polite">([^<]*)<\/p>/.exec(html)[1] };
      this.notice = { dataset: {}, querySelector: (sel) => (sel === '.art-load-notice-text' ? text : sel === '[data-art-notice-retry]' ? button : null), text };
    },
    querySelector(sel) { return sel === ':scope > .art-load-notice' ? this.notice : null; },
  };
  const later = [];
  const schedule = (fn) => later.push(fn);
  // The title draws the failed notice: its words are written after the delay.
  mountArtLoadNotice(root, { model: artLoadNoticeModel({ state: 'failed' }), schedule });
  assert.equal(root.notice.text.textContent, '', 'empty until the delayed write, so it is announced');
  assert.equal(later.length, 1);
  // Retry pressed inside the delay: the notice says it is loading.
  mountArtLoadNotice(root, { model: artLoadNoticeModel({ state: 'retrying' }), schedule });
  assert.equal(root.notice.text.textContent, 'Loading art…');
  assert.equal(button.a['aria-disabled'], 'true');
  // The old delayed write fires now: it must not bring the failure back.
  later.shift()();
  assert.equal(root.notice.text.textContent, 'Loading art…', 'the newer write wins');
  // Without a newer write, the delayed one still lands.
  resetArtLoadNotice();
  root.notice = null;
  mountArtLoadNotice(root, { model: artLoadNoticeModel({ state: 'failed' }), schedule });
  later.shift()();
  assert.equal(root.notice.text.textContent, tFull('art.failed.notice'));
  resetArtLoadNotice();
});

test('a Retry that loads mid-run redraws the active screen’s art in place (Codex on #1471)', async () => {
  const { ART_REDRAW_EVENT } = await import('../src/ui/highResArt.js');
  assert.equal(ART_REDRAW_EVENT, 'ashen:art-redraw');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // Off the title, once nothing is open over the screen, the screen is told to redraw its art.
  assert.match(main, /if \(!root\) \{ try \{ document\.dispatchEvent\(new CustomEvent\(ART_REDRAW_EVENT\)\); \}/);
  const combat = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  // Combat forgets its cached figures (the placeholders) and renders from its own state; no remount.
  // Never mid-animation, and the focus kept: the browser pass (external-play
  // --block-index) checks the rebuild itself and the kept focus.
  assert.match(combat, /function redrawArt\(\) \{[\s\S]*?if \(busy\) \{ setTimeout\(redrawArt, ART_REDRAW_RETRY_MS\); return; \}[\s\S]*?enemyFrames\.clear\(\);\n    playerArtKey = null;\n    render\(\);[\s\S]*?target\?\.focus\?\.\(/);
  assert.match(combat, /document\.addEventListener\(ART_REDRAW_EVENT, redrawArt\);/);
  assert.match(combat, /document\.removeEventListener\(ART_REDRAW_EVENT, redrawArt\);/, 'released with the combat');
});

test('a tier change during a stalled Retry aborts it and starts at once (Codex on #1471)', async () => {
  fresh();
  const tree = packTree('high');
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load }, env: { doc: wide, nav: desktop } };
  await applyArtTier(settings, opts);
  tree.blocked.add('all');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high', deadlineMs: 200 });
  tree.blocked.clear();
  // A stalled link for the Retry: nothing answers until the request is aborted.
  const aborted = [];
  const stalled = (url, o) => new Promise((_, fail) => {
    o?.signal?.addEventListener?.('abort', () => { aborted.push(url); fail(new Error('aborted')); });
  });
  const retry = retryBuiltInArt(settings, { ...opts, load: { ...tree.load, fetchImpl: stalled } });
  await new Promise((r) => setTimeout(r, 30));
  // The player chooses Light meanwhile, on a link that answers.
  const t0 = Date.now();
  const light = applyArtTier({ [ART_QUALITY_KEY]: ART_LIGHT }, opts);
  assert.equal(await retry, null, 'the Retry settles as superseded (the notice reverts)');
  const switched = await light;
  const took = Date.now() - t0;
  assert.equal(switched.state, 'loaded');
  assert.equal(switched.tier, 'light');
  assert.ok(took < 2000, `the switch started at once, not after the Retry's 60 s deadline (${took} ms)`);
  assert.ok(aborted.length >= 1, 'the stalled requests were aborted');
  assert.equal(tierOf(), 'light');
});

test('every art placeholder is marked, and one pass puts them all back (Codex on #1471)', async () => {
  const { markArtPlaceholder, swapOnError, hideOnError, restoreArtPlaceholders, ART_PLACEHOLDER_ATTR } = await import('../src/ui/artFallback.js');
  assert.equal(ART_PLACEHOLDER_ATTR, 'data-art-placeholder');
  // A minimal DOM: nodes with attributes, listeners and a parent slot.
  const node = (tag) => {
    const n = { tag, a: {}, l: {}, isConnected: true, hidden: false, parent: null,
      setAttribute(k, v) { this.a[k] = String(v); }, getAttribute(k) { return this.a[k] ?? null; },
      hasAttribute(k) { return k in this.a; }, removeAttribute(k) { delete this.a[k]; },
      addEventListener(t, fn) { (this.l[t] ||= []).push(fn); }, fire(t) { for (const fn of this.l[t] || []) fn(); },
      replaceWith(other) { other.parent = this.parent; this.parent.child = other; this.isConnected = false; other.isConnected = true; } };
    return n;
  };
  const slot = { child: null };
  const img = node('img'); img.parent = slot; slot.child = img; img.setAttribute('src', 'assets/ui/x.webp');
  swapOnError(img, () => node('span'));
  img.fire('error');
  assert.equal(slot.child.tag, 'span', 'the glyph stands in');
  assert.ok(slot.child.hasAttribute('data-art-placeholder'), 'marked');
  const hid = node('img'); hid.setAttribute('src', 'assets/ui/y.webp');
  hideOnError(hid);
  hid.fire('error');
  assert.equal(hid.hidden, true);
  let rebuilt = 0;
  const own = markArtPlaceholder(node('div'), () => { rebuilt += 1; });
  const root = { querySelectorAll: () => [slot.child, hid, own].filter((n) => n.hasAttribute('data-art-placeholder')) };
  assert.equal(restoreArtPlaceholders(root), 3, 'one pass, every screen');
  assert.equal(slot.child, img, 'the same <img> is back');
  assert.equal(rebuilt, 1, 'a site with its own builder rebuilds');
  hid.fire('load');
  assert.equal(hid.hidden, false, 'shown once it loads');
  assert.equal(restoreArtPlaceholders(root), 0, 'each placeholder is restored once');
});

test('no image error handler in src/ui swaps or removes art without marking it (the census)', () => {
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${dir}${e.name}/`); else if (e.name.endsWith('.js')) files.push(`${dir}${e.name}`);
  } };
  walk('../src/ui/');
  // The handler's body, however many lines it spans: from the registration to
  // its closing bracket (a named handler is looked up by name in the file).
  const bodyAt = (text, from) => {
    let depth = 0;
    for (let k = from; k < text.length; k++) {
      const c = text[k];
      if (c === '(' || c === '{') depth += 1;
      else if (c === ')' || c === '}') { depth -= 1; if (depth < 0) return text.slice(from, k); }
      else if (c === ';' && depth === 0) return text.slice(from, k);
    }
    return text.slice(from);
  };
  const SWAPS = /\.remove\(\)|replaceWith\(|textContent\s*=|innerHTML\s*=|placeholder\(\)|fallbackToSvg\(\)/;
  const MARKS = /markArtPlaceholder|swapOnError|hideOnError/;
  // Handlers that swap nothing a restore must bring back, by file and why.
  const ALLOWED = new Map([
    ['assets.js:enemySprite', 'its placeholder() marks the node itself (markArtPlaceholder inside placeholder)'],
  ]);
  const bad = [];
  let seen = 0;
  for (const f of files) {
    if (f.endsWith('/artFallback.js') || f.endsWith('/debuglog.js') || f.endsWith('/audio.js') || f.endsWith('/highResArt.js')) continue;
    const text = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of text.matchAll(/addEventListener\(\s*'error'\s*,|\.onerror\s*=/g)) {
      seen += 1;
      let body = bodyAt(text, m.index + m[0].length);
      const named = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(body);
      if (named) {
        const def = new RegExp(`(?:const|let|function)\\s+${named[1]}\\b[^\\n]*`).exec(text);
        if (def) body += bodyAt(text, def.index + def[0].length - 1);
      }
      if (!SWAPS.test(body) || MARKS.test(body)) continue;
      const site = `${f.split('/').pop()}:${/enemySprite/.test(text.slice(Math.max(0, m.index - 4000), m.index)) && /placeholder\(\)/.test(body) ? 'enemySprite' : m.index}`;
      if (!ALLOWED.has(site)) bad.push(`${f}: ${body.replace(/\s+/g, ' ').slice(0, 100)}`);
    }
  }
  assert.ok(seen >= 10, `the census found the handlers (${seen})`);
  assert.deepEqual(bad, []);
  // The census reads multi-line handlers and onerror assignments too.
  const probe = "img.addEventListener('error', () => {\n  icon.textContent = 'x';\n});\nother.onerror = () => { other.remove(); };";
  const hits = [...probe.matchAll(/addEventListener\(\s*'error'\s*,|\.onerror\s*=/g)].map((m) => bodyAt(probe, m.index + m[0].length)).filter((b) => SWAPS.test(b) && !MARKS.test(b));
  assert.equal(hits.length, 2, 'a multi-line handler and an onerror assignment are both caught');
  // enemySprite's placeholder() marks its node; classSprite and relicIcon mark theirs.
  const assets = readFileSync(new URL('../src/ui/assets.js', import.meta.url), 'utf8');
  assert.match(assets, /markArtPlaceholder\(el, \(\) => el\.replaceWith\(enemySprite\(enemyDef, entity\)\)\);/);
  assert.match(assets, /markArtPlaceholder\(el, \(\) => \{ const again = classSprite\(/);
  assert.match(assets, /markArtPlaceholder\(icon, \(\) => \{ const again = relicIcon\(relic\);/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /whenNoOverlay\(\(\) => \{[\s\S]{0,400}restoreArtPlaceholders\(document\);/, 'main runs the pass once nothing is open');
});

test('restore shows a hidden image that re-pointing already loaded, and marks a swap made before the image was attached (review 5394761200)', async () => {
  const { swapOnError, hideOnError, restoreArtPlaceholders } = await import('../src/ui/artFallback.js');
  const node = (tag) => ({ tag, a: {}, l: {}, isConnected: false, hidden: false, complete: false, naturalWidth: 0,
    setAttribute(k, v) { this.a[k] = String(v); }, getAttribute(k) { return this.a[k] ?? null; },
    hasAttribute(k) { return k in this.a; }, removeAttribute(k) { delete this.a[k]; },
    addEventListener(t, fn) { (this.l[t] ||= []).push(fn); }, fire(t) { const fns = this.l[t] || []; this.l[t] = fns.filter((f) => !f.once); for (const fn of fns) fn(); },
    replaceWith(other) { if (this.parent) { this.parent.child = other; other.parent = this.parent; } } });
  // hideOnError: the art failed, then re-pointing loaded it (its load fired with nobody listening).
  const img = node('img');
  img.setAttribute('src', 'objects/aa/' + 'a'.repeat(64) + '.webp');
  hideOnError(img);
  img.fire('error');
  assert.equal(img.hidden, true);
  img.complete = true; img.naturalWidth = 64; // loaded already, on the url it has now
  restoreArtPlaceholders({ querySelectorAll: () => [img] });
  assert.equal(img.hidden, false, 'shown at once: no second load is needed');
  // swapOnError: an image inside a well that is not in the page yet.
  const well = { child: null };
  const piece = node('img'); piece.parent = well; well.child = piece; piece.setAttribute('src', 'assets/x.webp');
  swapOnError(piece, () => node('span'));
  piece.fire('error');
  assert.equal(well.child.tag, 'span', 'the glyph stands in although the well is detached');
  assert.ok(well.child.hasAttribute('data-art-placeholder'), 'and it is marked, so a restore brings the art back');
});

test('the notice’s state counts as announced only once its words land (review 5394761200)', async () => {
  const { mountArtLoadNotice, resetArtLoadNotice } = await import('../src/ui/components/artLoadNotice.js');
  resetArtLoadNotice();
  const button = { a: {}, setAttribute(k, v) { this.a[k] = String(v); }, removeAttribute(k) { delete this.a[k]; }, getAttribute(k) { return this.a[k] ?? null; }, addEventListener() {} };
  const makeRoot = () => ({
    notice: null,
    insertAdjacentHTML(where, html) {
      const text = { isConnected: true, textContent: /role="status" aria-live="polite">([^<]*)<\/p>/.exec(html)[1] };
      this.notice = { dataset: {}, querySelector: (sel) => (sel === '.art-load-notice-text' ? text : sel === '[data-art-notice-retry]' ? button : null), text };
    },
    querySelector(sel) { return sel === ':scope > .art-load-notice' ? this.notice : null; },
  });
  const later = [];
  const schedule = (fn) => later.push(fn);
  const first = makeRoot();
  mountArtLoadNotice(first, { model: artLoadNoticeModel({ state: 'failed' }), schedule });
  // The title redraws inside the delay: the first node leaves the page before its write.
  first.notice.text.isConnected = false;
  const second = makeRoot();
  mountArtLoadNotice(second, { model: artLoadNoticeModel({ state: 'failed' }), schedule });
  assert.equal(second.notice.text.textContent, '', 'not drawn as already said: the delay is armed again');
  for (const fn of later.splice(0)) fn();
  assert.equal(second.notice.text.textContent, tFull('art.failed.notice'), 'and the words land on the node in the page');
  // Now it was announced: a further redraw draws the words in place.
  const third = makeRoot();
  mountArtLoadNotice(third, { model: artLoadNoticeModel({ state: 'failed' }), schedule });
  assert.equal(third.notice.text.textContent, tFull('art.failed.notice'));
  resetArtLoadNotice();
});

test('a Retry fetches the indexes past the HTTP cache; the boot load does not (Codex on #1471)', async () => {
  fresh();
  const tree = packTree('light');
  const modes = [];
  const fetchImpl = (url, o) => { if (/^(?:\.\/)?packs\//.test(url)) modes.push([url.replace(/^\.\//, '').split('-')[0], o?.cache ?? 'default']); return tree.fetchImpl(url, o); };
  const settings = { [ART_QUALITY_KEY]: ART_AUTO };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load, fetchImpl }, env: { doc: wide, nav: desktop } };
  await applyArtTier(settings, opts);
  tree.blocked.add('all');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, fetchImpl, tier: 'light', deadlineMs: 200 });
  assert.ok(modes.length && modes.every(([, m]) => m === 'default'), `the boot load uses the cache's default (${JSON.stringify(modes)})`);
  tree.blocked.clear();
  modes.length = 0;
  const r = await retryBuiltInArt(settings, opts);
  assert.equal(r.state, 'loaded');
  assert.ok(modes.length >= 2 && modes.every(([, m]) => m === 'reload'), `every index a Retry asks for is fetched with cache: 'reload' (${JSON.stringify(modes)})`);
});
