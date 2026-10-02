// tests/music-tiles-index.test.mjs — the shipped score and the map-detail
// tiles go through the asset index (docs/EXTERNAL-ASSETS-PLAN.md §3.8–3.9,
// step 3c).
//
// In the web edition src/ui/assetPacks.js hands assetmap.js the common pack's
// ids, so `music/manifest.json`, `music/<context>/<track>.mp3` and
// `map-detail/<hash>/<edge>/<x>-<y>.webp` resolve to content-addressed
// objects. Without a pack (a single file, the source tree) the same ids pass
// through as the paths of the folders beside the page, exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { installWebAudioStub, stubGraph } = await import('../tools/webaudio-stub.mjs');
installWebAudioStub();
const graph = stubGraph();

const OBJ = (n) => `./objects/${n}${n}/${n.repeat(64)}`;
const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  if (String(url) === `${OBJ('a')}.json` || String(url) === 'music/manifest.json') {
    return { ok: true, json: async () => ({ _comment: 'x', title: ['title/title.mp3'], map: ['map/map.mp3', 'https://elsewhere.example/x.mp3'] }) };
  }
  return { ok: false, json: async () => ({}) };
};

const { initAudio } = await import('../src/ui/audio.js');
const { setBuiltInSource, assetUrl } = await import('../src/ui/assetmap.js');
const { tileId } = await import('../src/ui/components/mapDetail.js');
const { SHIPPED_MUSIC_FOLDER } = await import('../src/content/music.js');
const { MAP_ART } = await import('../src/content/mapArt.generated.js');
const { visibleTiles } = await import('../src/ui/models/MapDetailModel.js');

async function tracksFor(context) {
  const engine = initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });
  await engine.configureMusic({ folder: SHIPPED_MUSIC_FOLDER, indexed: true });
  graph.reset();
  engine.music(context);
  const srcs = graph.elements.map((el) => el.src);
  engine.stopMusic(0);
  return srcs;
}

test('the shipped score is read through the common index when a pack is loaded', async () => {
  setBuiltInSource(new Map([
    ['music/manifest.json', `${OBJ('a')}.json`],
    ['music/title/title.mp3', `${OBJ('b')}.mp3`],
  ]));
  try {
    asked.length = 0;
    const srcs = await tracksFor('title');
    assert.deepEqual(asked, [`${OBJ('a')}.json`], 'the manifest came from its object, not music/');
    assert.deepEqual(srcs, [`${OBJ('b')}.mp3`], 'the track is its object');
  } finally {
    setBuiltInSource(null);
  }
});

test('an id the index lacks, and an absolute url, pass through unchanged', async () => {
  setBuiltInSource(new Map([['music/manifest.json', `${OBJ('a')}.json`]]));
  try {
    const engine = initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });
    await engine.configureMusic({ folder: SHIPPED_MUSIC_FOLDER, indexed: true });
    // Two tracks: the pick is random, so play until both have been seen.
    const seen = new Set();
    for (let i = 0; i < 60 && seen.size < 2; i++) {
      graph.reset();
      engine.music('map');
      for (const el of graph.elements) seen.add(el.src);
      engine.music('title');
      engine.stopMusic(0);
    }
    assert.ok(seen.has('music/map/map.mp3'), `an unlisted track stays a path: ${[...seen]}`);
    assert.ok(seen.has('https://elsewhere.example/x.mp3'), 'an absolute url is left alone');
  } finally {
    setBuiltInSource(null);
  }
});

test('without a pack (single file, source tree) the music/ folder beside the page is read, as before', async () => {
  setBuiltInSource(null);
  asked.length = 0;
  const srcs = await tracksFor('title');
  assert.deepEqual(asked, ['music/manifest.json']);
  assert.deepEqual(srcs, ['music/title/title.mp3']);
});

test('a Custom music folder spelled music/ is the player\'s own: fetched by its path, never the built-in objects', async () => {
  setBuiltInSource(new Map([
    ['music/manifest.json', `${OBJ('a')}.json`],
    ['music/title/title.mp3', `${OBJ('b')}.mp3`],
  ]));
  try {
    for (const folder of ['music/', 'music']) {
      asked.length = 0;
      const engine = initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });
      await engine.configureMusic({ folder }); // no `indexed`: what main.js passes for a typed folder
      graph.reset();
      engine.music('title');
      const srcs = graph.elements.map((el) => el.src);
      engine.stopMusic(0);
      assert.deepEqual(asked, ['music/manifest.json'], `${folder}: the sibling manifest, not the object`);
      assert.deepEqual(srcs, ['music/title/title.mp3'], `${folder}: the sibling track, not the object`);
    }
  } finally {
    setBuiltInSource(null);
  }
});

test('bundle.mjs clears old map-detail/ and music/ copies only strictly inside build/ or dist/', async () => {
  const { strictlyUnderBuild } = await import('../tools/asset-pack.mjs');
  const { resolve } = await import('node:path');
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const out of ['build', 'dist', 'build/', 'src', 'music']) assert.equal(strictlyUnderBuild(resolve(root, out), root), false, out);
  for (const out of ['build/web', 'dist/web', 'build/a/b']) assert.equal(strictlyUnderBuild(resolve(root, out), root), true, out);
  const bundle = readFileSync(new URL('../tools/bundle.mjs', import.meta.url), 'utf8');
  assert.match(bundle, /const underBuild = strictlyUnderBuild\(OUT_DIR, ROOT\);/);
});

test('a map-detail tile id is the path the tree and the pack both use', () => {
  assert.equal(tileId('c0903c6d0ba56c76', '512/0-1'), 'map-detail/c0903c6d0ba56c76/512/0-1.webp');
  const manifest = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8'));
  const ids = new Set(Object.keys(manifest.assets));
  let n = 0;
  for (const art of Object.values(MAP_ART)) for (const level of art.levels) {
    for (const tile of visibleTiles(level, { x0: 0, y0: 0, x1: 1, y1: 1 })) {
      n++;
      assert.ok(ids.has(tileId(art.assetHash, tile.key)), `art-manifest.json lists ${tileId(art.assetHash, tile.key)}`);
    }
  }
  assert.ok(n > 0);
});

test('a tile id resolves to its object when the pack lists it, else to its path', () => {
  const id = tileId('c0903c6d0ba56c76', '512/0-0');
  assert.equal(assetUrl(id), id);
  setBuiltInSource(new Map([[id, `${OBJ('c')}.webp`]]));
  try {
    assert.equal(assetUrl(id), `${OBJ('c')}.webp`);
  } finally {
    setBuiltInSource(null);
  }
});

test('mapDetail loads tiles as images through assetUrl, not fetch and blob URLs', () => {
  const src = readFileSync(new URL('../src/ui/components/mapDetail.js', import.meta.url), 'utf8');
  assert.match(src, /assetUrl\(tileId\(art\.assetHash, tile\.key\)\)/);
  assert.doesNotMatch(src, /\bfetch\(/);
  assert.doesNotMatch(src, /createObjectURL/);
});

test('a tile that failed before common was listed is retried when the art source changes', async () => {
  // A minimal DOM: one map, one detail layer, Images that decode only objects.
  const listeners = new Map();
  const frames = [];
  const el = (extra = {}) => ({
    attrs: {}, dataset: {}, style: { setProperty() {} }, classList: { add() {} }, children: [], isConnected: true,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    append() {}, remove() {}, replaceChildren(...n) { this.children = n; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 }),
    ...extra,
  });
  const saved = {};
  for (const k of ['document', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'Image', 'location', 'devicePixelRatio']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  set('document', {
    body: el(), createElementNS: () => el(),
    addEventListener: (t, f) => listeners.set(t, f), removeEventListener: (t) => listeners.delete(t),
  });
  set('MutationObserver', class { observe() {} disconnect() {} });
  set('ResizeObserver', class { observe() {} disconnect() {} });
  set('requestAnimationFrame', (f) => { frames.push(f); return frames.length; });
  set('cancelAnimationFrame', () => {});
  set('location', { protocol: 'http:' });
  set('devicePixelRatio', 1);
  set('Image', class { decode() { return /^\.\/objects\//.test(this.src || '') ? Promise.resolve() : Promise.reject(new Error('404')); } removeAttribute() { this.src = ''; } });
  const settle = async () => { for (let i = 0; i < 20; i++) { while (frames.length) frames.shift()(); await new Promise((r) => setImmediate(r)); } };
  try {
    const { mountMapDetail } = await import('../src/ui/components/mapDetail.js');
    const { ART_SOURCE_EVENT } = await import('../src/ui/highResArt.js');
    const [source, art] = Object.entries(MAP_ART)[0];
    const svg = el({ querySelectorAll: () => [], parentElement: null });
    const base = el({ ownerSVGElement: svg, getScreenCTM: () => null });
    base.attrs = { width: '1000', height: '1000' };
    const surface = el({ querySelector: () => base });
    const port = el();
    setBuiltInSource(null);
    const dispose = mountMapDetail(port, surface, source);
    await settle();
    assert.equal(port.dataset.detailState, 'fallback', 'no common index: every tile failed, the low-detail map stays');
    assert.ok(listeners.has(ART_SOURCE_EVENT), 'the layer listens for a source change');
    const ids = new Map();
    for (const level of art.levels) for (const t of visibleTiles(level, { x0: 0, y0: 0, x1: 1, y1: 1 })) ids.set(tileId(art.assetHash, t.key), `${OBJ('d')}.webp`);
    setBuiltInSource(ids);
    listeners.get(ART_SOURCE_EVENT)();
    await settle();
    assert.equal(port.dataset.detailState, 'ready', 'the switch listed the tiles: they are retried and drawn');
    dispose();
    assert.ok(!listeners.has(ART_SOURCE_EVENT), 'dispose stops listening');
  } finally {
    setBuiltInSource(null);
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});

test('a source change while a tile is still loading: the old failure is not recorded, and the tile is asked for again', async () => {
  const listeners = new Map();
  const frames = [];
  const held = []; // decodes of bare paths, settled by the test
  const el = (extra = {}) => ({
    attrs: {}, dataset: {}, style: { setProperty() {} }, classList: { add() {} }, children: [], isConnected: true,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    append() {}, remove() {}, replaceChildren(...n) { this.children = n; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 }),
    ...extra,
  });
  const saved = {};
  for (const k of ['document', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'Image', 'location', 'devicePixelRatio']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  set('document', { body: el(), createElementNS: () => el(), addEventListener: (t, f) => listeners.set(t, f), removeEventListener: (t) => listeners.delete(t) });
  set('MutationObserver', class { observe() {} disconnect() {} });
  set('ResizeObserver', class { observe() {} disconnect() {} });
  set('requestAnimationFrame', (f) => { frames.push(f); return frames.length; });
  set('cancelAnimationFrame', () => {});
  set('location', { protocol: 'http:' });
  set('devicePixelRatio', 1);
  set('Image', class {
    decode() {
      if (/^\.\/objects\//.test(this.src || '')) return Promise.resolve();
      return new Promise((_, reject) => held.push(() => reject(new Error('404'))));
    }
    removeAttribute() { this.src = ''; }
  });
  const settle = async () => { for (let i = 0; i < 20; i++) { while (frames.length) frames.shift()(); await new Promise((r) => setImmediate(r)); } };
  try {
    const { mountMapDetail } = await import('../src/ui/components/mapDetail.js');
    const { ART_SOURCE_EVENT } = await import('../src/ui/highResArt.js');
    const [source, art] = Object.entries(MAP_ART)[0];
    const svg = el({ querySelectorAll: () => [], parentElement: null });
    const base = el({ ownerSVGElement: svg, getScreenCTM: () => null });
    base.attrs = { width: '1000', height: '1000' };
    const port = el();
    setBuiltInSource(null);
    const dispose = mountMapDetail(port, el({ querySelector: () => base }), source);
    await settle();
    assert.ok(held.length > 0, 'bare-path loads are in flight');
    assert.notEqual(port.dataset.detailState, 'ready');
    // The switch lands while those loads are still pending.
    const ids = new Map();
    for (const level of art.levels) for (const t of visibleTiles(level, { x0: 0, y0: 0, x1: 1, y1: 1 })) ids.set(tileId(art.assetHash, t.key), `${OBJ('e')}.webp`);
    setBuiltInSource(ids);
    listeners.get(ART_SOURCE_EVENT)();
    await settle();
    // Now the old loads fail: their failures belong to the old source.
    for (const reject of held.splice(0)) reject();
    await settle();
    for (const reject of held.splice(0)) reject();
    await settle();
    assert.equal(port.dataset.detailState, 'ready', 'the tiles were asked for again through the new source and drawn');
    dispose();
  } finally {
    setBuiltInSource(null);
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});

test('file:// (step 4): a tile the pack index lists is requested; without an index nothing is asked for', async () => {
  const { tileReachable } = await import('../src/ui/components/mapDetail.js');
  const id = tileId('c0903c6d0ba56c76', '512/0-0');
  assert.equal(tileReachable(id, { protocol: 'http:', source: null }), true, 'over http(s) every tile is asked for, as before');
  assert.equal(tileReachable(id, { protocol: 'file:', source: null }), false, 'a single file under file:// asks for nothing');
  assert.equal(tileReachable(id, { protocol: 'file:', source: new Map([[id, `${OBJ('c')}.webp`]]) }), true, 'a double-clicked web edition reads its objects');
  assert.equal(tileReachable(id, { protocol: 'file:', source: new Map() }), false, 'an id the index lacks is not asked for');

  // The mounted layer, under file://.
  const listeners = new Map();
  const frames = [];
  const el = (extra = {}) => ({
    attrs: {}, dataset: {}, style: { setProperty() {} }, classList: { add() {} }, children: [], isConnected: true,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    append() {}, remove() {}, replaceChildren(...n) { this.children = n; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 }),
    ...extra,
  });
  const saved = {};
  for (const k of ['document', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'Image', 'location', 'devicePixelRatio']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  let images = 0;
  set('document', {
    body: el(), createElementNS: () => el(),
    addEventListener: (t, f) => listeners.set(t, f), removeEventListener: (t) => listeners.delete(t),
  });
  set('MutationObserver', class { observe() {} disconnect() {} });
  set('ResizeObserver', class { observe() {} disconnect() {} });
  set('requestAnimationFrame', (f) => { frames.push(f); return frames.length; });
  set('cancelAnimationFrame', () => {});
  set('location', { protocol: 'file:' });
  set('devicePixelRatio', 1);
  set('Image', class { constructor() { images++; } decode() { return /^\.\/objects\//.test(this.src || '') ? Promise.resolve() : Promise.reject(new Error('missing')); } removeAttribute() { this.src = ''; } });
  const settle = async () => { for (let i = 0; i < 20; i++) { while (frames.length) frames.shift()(); await new Promise((r) => setImmediate(r)); } };
  try {
    const { mountMapDetail } = await import('../src/ui/components/mapDetail.js');
    const { ART_SOURCE_EVENT } = await import('../src/ui/highResArt.js');
    const [source, art] = Object.entries(MAP_ART)[0];
    const svg = el({ querySelectorAll: () => [], parentElement: null });
    const base = el({ ownerSVGElement: svg, getScreenCTM: () => null });
    base.attrs = { width: '1000', height: '1000' };
    const surface = el({ querySelector: () => base });
    const port = el();
    setBuiltInSource(null);
    const dispose = mountMapDetail(port, surface, source);
    await settle();
    assert.equal(images, 0, 'a single file under file:// requests no tile');
    assert.equal(port.dataset.detailState, 'offline-fallback', 'and keeps the low-detail map, as before');
    const ids = new Map();
    for (const level of art.levels) for (const t of visibleTiles(level, { x0: 0, y0: 0, x1: 1, y1: 1 })) ids.set(tileId(art.assetHash, t.key), `${OBJ('d')}.webp`);
    setBuiltInSource(ids);
    listeners.get(ART_SOURCE_EVENT)();
    await settle();
    assert.ok(images > 0, 'the tiles the index lists are requested as images');
    assert.equal(port.dataset.detailState, 'ready', 'and drawn from the objects beside the page');
    dispose();
  } finally {
    setBuiltInSource(null);
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});
