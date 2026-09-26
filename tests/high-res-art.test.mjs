// tests/high-res-art.test.mjs — Settings → Display → Art quality (src/ui/highResArt.js).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  idForRelativePath, highResFromFiles, highResFromManifest, findServedHighRes, applyArtQuality,
  artQualityStatus, resetHighResArt, wantsHighRes, ART_LOCAL_HIGH, ART_BUILT_IN, ART_QUALITY_KEY,
} from '../src/ui/highResArt.js';
import { assetUrl, assetTier } from '../src/ui/assetmap.js';
import { profileKeys, LOCAL_ONLY_KEYS, DEVICE_KEYS } from '../src/model/settingsSync.js';

const manifest = {
  assets: {
    'assets/bg/bg_act1.webp': { light: { path: 'assets-mobile/bg/bg_act1.webp' }, high: { path: 'assets/bg/bg_act1.webp' } },
    'assets/ui/frame.webp': { light: { path: 'assets-mobile/ui/frame.webp' }, high: { path: 'assets/ui/frame.webp' } },
  },
};
const file = (webkitRelativePath) => ({ webkitRelativePath, name: webkitRelativePath.split('/').pop() });
const json = (body, ok = true) => async () => ({ ok, json: async () => body });

beforeEach(() => resetHighResArt());

test('a picked file maps to its asset id from the first assets/ segment', () => {
  assert.equal(idForRelativePath('hd-assets-v1/assets/bg/bg_act1.webp'), 'assets/bg/bg_act1.webp');
  assert.equal(idForRelativePath('assets/ui/frame.webp'), 'assets/ui/frame.webp');
  assert.equal(idForRelativePath('Downloads\\hd\\assets\\bg\\x.webp'), 'assets/bg/x.webp');
  assert.equal(idForRelativePath('notes/readme.txt'), null);
  assert.equal(idForRelativePath('hd/assets'), null);
});

test('a picked folder keeps only the ids its manifest lists, and all assets/ files without one', () => {
  const files = [file('hd/assets/bg/bg_act1.webp'), file('hd/assets/stray/extra.webp'), file('hd/readme.md')];
  const toUrl = (f) => `blob:${f.webkitRelativePath}`;
  const withManifest = highResFromFiles(files, { manifest, toUrl });
  assert.deepEqual([...withManifest.keys()], ['assets/bg/bg_act1.webp']);
  const without = highResFromFiles(files, { toUrl });
  assert.deepEqual([...without.keys()].sort(), ['assets/bg/bg_act1.webp', 'assets/stray/extra.webp']);
});

test('a served hd/ manifest maps each id to its file under hd/', () => {
  const map = highResFromManifest(manifest);
  assert.equal(map.get('assets/ui/frame.webp'), 'hd/assets/ui/frame.webp');
  assert.equal(map.size, 2);
});

test('the served folder is looked for over http only, and a miss is null, not a throw', async () => {
  assert.equal(await findServedHighRes({ fetchImpl: json(manifest), protocol: 'file:' }), null);
  assert.equal(await findServedHighRes({ fetchImpl: json(null, false), protocol: 'https:' }), null);
  assert.equal(await findServedHighRes({ fetchImpl: async () => { throw new Error('offline'); }, protocol: 'http:' }), null);
  const found = await findServedHighRes({ fetchImpl: json(manifest), protocol: 'https:' });
  assert.equal(found.size, 2);
});

test('Local high-res with a served folder swaps covered ids and keeps the rest built-in', async () => {
  const settings = { [ART_QUALITY_KEY]: ART_LOCAL_HIGH };
  assert.ok(wantsHighRes(settings));
  const n = await applyArtQuality(settings, { fetchImpl: json(manifest), protocol: 'https:' });
  assert.equal(n, 2);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'hd/assets/bg/bg_act1.webp');
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'high');
  assert.equal(assetUrl('assets/bg/bg_act2.webp'), 'assets/bg/bg_act2.webp', 'missing from the folder → built-in');
  assert.match(artQualityStatus(), /2 high-res files served beside the game; anything it lacks stays built-in/);
});

test('Local high-res with no folder says so and changes nothing', async () => {
  const n = await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(null, false), protocol: 'file:' });
  assert.equal(n, 0);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'assets/bg/bg_act1.webp');
  assert.match(artQualityStatus(), /No high-res folder found/);
});

test('Built-in clears a high-res source', async () => {
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(manifest), protocol: 'https:' });
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'high');
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'built-in');
  assert.equal(artQualityStatus(), '');
});

test('Art quality is never synced, even on a device that shares its screen settings', () => {
  assert.ok(LOCAL_ONLY_KEYS.includes(ART_QUALITY_KEY));
  assert.ok(!DEVICE_KEYS.includes(ART_QUALITY_KEY));
  const rows = [{ key: ART_QUALITY_KEY, type: 'choice' }, { key: 'uiScale', type: 'choice' }, { key: 'accent', type: 'choice' }];
  assert.ok(!profileKeys(rows).includes(ART_QUALITY_KEY));
  assert.ok(!profileKeys(rows, { includeDevice: true }).includes(ART_QUALITY_KEY));
});

test('a change of source tells the listener once, and a repeat apply does not', async () => {
  const { onArtSourceChange } = await import('../src/ui/highResArt.js');
  const seen = [];
  onArtSourceChange((n) => seen.push(n));
  const opts = { fetchImpl: json(manifest), protocol: 'https:' };
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, opts);
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, opts);
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
  assert.deepEqual(seen, [2, 0]);
});

test('images already on the page move to the high-res file and back', async () => {
  const { refreshMountedArt } = await import('../src/ui/highResArt.js');
  const imgs = ['assets/bg/bg_act1.webp', 'assets/bg/bg_act2.webp', 'data:image/png;base64,AAAA'].map((src) => {
    const attrs = { src };
    return { tagName: 'IMG', getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  });
  const root = { querySelectorAll: () => imgs };
  globalThis.document = root;
  try {
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(manifest), protocol: 'https:' });
    assert.equal(imgs[0].getAttribute('src'), 'hd/assets/bg/bg_act1.webp', 'covered id swapped in place');
    assert.equal(imgs[1].getAttribute('src'), 'assets/bg/bg_act2.webp', 'uncovered id stays built-in');
    assert.equal(imgs[2].getAttribute('src'), 'data:image/png;base64,AAAA', 'an unknown URL is left alone');
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
    assert.equal(imgs[0].getAttribute('src'), 'assets/bg/bg_act1.webp', 'back to built-in');
    assert.equal(refreshMountedArt(root), 0, 'nothing left to move');
  } finally {
    delete globalThis.document;
  }
});

test('switching to Built-in while the served manifest loads stays built-in', async () => {
  let release;
  const slow = () => new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => manifest }); });
  const pending = applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: slow, protocol: 'https:' });
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
  release();
  assert.equal(await pending, 0);
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'built-in');
  assert.equal(artQualityStatus(), '');
});

test('overlapping Local high-res calls share one manifest fetch', async () => {
  let fetches = 0;
  const counted = async () => { fetches += 1; return { ok: true, json: async () => manifest }; };
  const opts = { fetchImpl: counted, protocol: 'https:' };
  await Promise.all([
    applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, opts),
    applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, opts),
  ]);
  assert.equal(fetches, 1);
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'high');
});

test('a served file that fails to load falls back to the built-in art', async () => {
  const listeners = [];
  const attrs = { src: 'assets/bg/bg_act1.webp' };
  const img = { tagName: 'IMG', getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  globalThis.document = { querySelectorAll: () => [img], addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }) };
  try {
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(manifest), protocol: 'https:' });
    assert.equal(attrs.src, 'hd/assets/bg/bg_act1.webp');
    const onError = listeners.find((l) => l.type === 'error' && l.capture);
    assert.ok(onError, 'a capture-phase error listener is installed');
    let stopped = false;
    onError.fn({ target: img, stopPropagation: () => { stopped = true; } });
    assert.equal(attrs.src, 'assets/bg/bg_act1.webp', 'back to built-in');
    assert.ok(stopped, "the image's own placeholder handler does not run");
    assert.equal(assetTier('assets/bg/bg_act1.webp'), 'built-in', 'the missing id is dropped from the source');
    assert.equal(assetTier('assets/ui/frame.webp'), 'high', 'other ids keep their high-res file');
    // A second copy of the same image fails after the id was already dropped.
    const attrs2 = { src: 'hd/assets/bg/bg_act1.webp' };
    const twin = { tagName: 'IMG', getAttribute: (k) => attrs2[k], setAttribute: (k, v) => { attrs2[k] = v; } };
    let stopped2 = false;
    onError.fn({ target: twin, stopPropagation: () => { stopped2 = true; } });
    assert.equal(attrs2.src, 'assets/bg/bg_act1.webp', 'the duplicate falls back too');
    assert.ok(stopped2, 'and gets no placeholder');
  } finally {
    delete globalThis.document;
  }
});

test('SVG <image href> art moves tier too', async () => {
  const attrs = { href: 'assets/bg/bg_act1.webp' };
  const image = { tagName: 'image', hasAttribute: (k) => k in attrs, getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  globalThis.document = { querySelectorAll: () => [image] };
  try {
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(manifest), protocol: 'https:' });
    assert.equal(attrs.href, 'hd/assets/bg/bg_act1.webp');
  } finally {
    delete globalThis.document;
  }
});

test('the status counts one file in the singular', async () => {
  const one = { assets: { 'assets/bg/bg_act1.webp': manifest.assets['assets/bg/bg_act1.webp'] } };
  await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(one), protocol: 'https:' });
  assert.match(artQualityStatus(), /^1 high-res file served/);
});

test('an inlined URL shared by byte-identical assets resolves to the alias the source covers', async () => {
  const { ASSET_MAP } = await import('../src/ui/assetmap.js');
  const data = 'data:image/webp;base64,SAME';
  ASSET_MAP['assets/ui/a.webp'] = data;
  ASSET_MAP['assets/ui/b.webp'] = data;
  const attrs = { src: data };
  const img = { tagName: 'IMG', getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  globalThis.document = { querySelectorAll: () => [img] };
  try {
    const only = { assets: { 'assets/ui/b.webp': { high: { path: 'assets/ui/b.webp' } } } };
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json(only), protocol: 'https:' });
    assert.equal(attrs.src, 'hd/assets/ui/b.webp', 'the covered alias, not the first listed');
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
    assert.equal(attrs.src, data, 'back to the shared inlined art');
  } finally {
    delete globalThis.document;
    delete ASSET_MAP['assets/ui/a.webp'];
    delete ASSET_MAP['assets/ui/b.webp'];
  }
});
