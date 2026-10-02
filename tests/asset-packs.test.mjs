// tests/asset-packs.test.mjs — the web edition's pack loader (src/ui/assetPacks.js,
// docs/EXTERNAL-ASSETS-PLAN.md §3, step 3a): the pin is checked, the tier falls
// back high → light → placeholders, and a single file or the source tree loads
// nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  loadBuiltInPacks, whenBuiltInArtReady, resetBuiltInArt, packsPinned, tierOrder, objectUrl, cleanBase,
  builtInArtStatus, ASSET_PACKS,
} from '../src/ui/assetPacks.js';
import { assetUrl, builtInSource, setBuiltInSource, setHighResSource } from '../src/ui/assetmap.js';
import { sha256Bytes, sha256Hex } from '../src/ui/sha256.js';
import { objectPath, indexText } from '../tools/asset-pack.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

/** A pack tree in memory: index texts, a pin over them, and a fetch that serves them. */
function packTree({ tier = 'light', drop = [], corrupt = [], base = null } = {}) {
  const indexes = {
    light: indexText({ 'assets/bg/bg_act1.webp': [A, 10, 'image/webp'], 'assets/ui/frame.svg': [B, 5, 'image/svg+xml'] }),
    high: indexText({ 'assets/bg/bg_act1.webp': [C, 99, 'image/webp'], 'assets/ui/frame.svg': [B, 5, 'image/svg+xml'] }),
    common: indexText({ 'assets/fonts/x.woff2': [A, 10, 'font/woff2'] }),
  };
  const packs = {};
  const files = new Map();
  for (const [pack, text] of Object.entries(indexes)) {
    if (tier === 'light' && pack === 'high') continue;
    const name = `packs/${pack}-${sha(text).slice(0, 12)}.json`;
    packs[pack] = { index: name, sha256: sha(text), ids: 0, objects: 0, bytes: 0 };
    if (!drop.includes(pack)) files.set(name, corrupt.includes(pack) ? text.replace('{\n', '{\n"x":1,\n') : text);
  }
  if (base !== null) files.set('asset-base.json', JSON.stringify({ base }));
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    const key = url.replace(/^(\.\.\/)+|^\.\//, '');
    const body = files.get(key);
    if (body === undefined) return { ok: false, status: 404 };
    const bytes = new TextEncoder().encode(body);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(0), json: async () => JSON.parse(body) };
  };
  return { pin: { schema: 1, tier, packs, fonts: null }, fetchImpl, asked };
}
const opts = (tree, extra = {}) => ({ pin: tree.pin, inlineMap: {}, fetchImpl: tree.fetchImpl, protocol: 'http:', ...extra });

test('the bundled SHA-256 agrees with node:crypto, and SubtleCrypto is used where it exists', async () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 70000]) {
    const bytes = randomBytes(n);
    assert.equal(sha256Bytes(bytes), createHash('sha256').update(bytes).digest('hex'), `${n} bytes`);
  }
  const abc = new TextEncoder().encode('abc');
  const want = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert.equal(await sha256Hex(abc, null), want, 'no SubtleCrypto: the bundled digest');
  assert.equal(await sha256Hex(abc, globalThis.crypto.subtle), want, 'SubtleCrypto');
});

test('object URLs are the names tools/asset-pack.mjs writes', () => {
  for (const id of ['assets/bg/bg_act1.webp', 'assets/ui/Frame.SVG', 'assets/fonts/x.woff2']) {
    assert.equal(objectUrl('./', id, A), `./${objectPath(A, id)}`);
    assert.equal(objectUrl('../../', id, A), `../../${objectPath(A, id)}`);
  }
});

test('asset-base.json may name only a plain relative folder', () => {
  for (const ok of ['./', '', '../', '../../', 'site/', './site/']) assert.ok(cleanBase(ok), ok);
  for (const bad of ['https://example.com/', '//example.com/', '/', '/AshenSpire/', '../x', 'a/../../', null, 3]) assert.equal(cleanBase(bad), null, String(bad));
});

test('the tier order is high → light, and light has only placeholders below it', () => {
  assert.deepEqual(tierOrder('high'), ['high', 'light']);
  assert.deepEqual(tierOrder('light'), ['light']);
});

test('a single file (ASSET_MAP filled) and the source tree (nothing pinned) load nothing', async () => {
  assert.equal(ASSET_PACKS, null, 'the source tree carries no pin; the bundler stamps it in memory');
  const tree = packTree();
  assert.equal(packsPinned(tree.pin, { 'assets/x.webp': 'data:' }), false);
  assert.equal(packsPinned(null, {}), false);
  resetBuiltInArt();
  const inline = await loadBuiltInPacks(opts(tree, { inlineMap: { 'assets/x.webp': 'data:image/webp;base64,AA' } }));
  assert.equal(inline.state, 'inline');
  const none = await loadBuiltInPacks(opts(tree, { pin: null }));
  assert.equal(none.state, 'none');
  assert.deepEqual(tree.asked, [], 'not one request');
  assert.equal(builtInSource(), null);
  let called = 0;
  whenBuiltInArtReady(() => { called += 1; }, { pin: null, inlineMap: {} });
  assert.equal(called, 1, 'the first screen is drawn at once, as before');
});

test('the light pack loads, with the common pack, and assetUrl resolves through it', async () => {
  resetBuiltInArt();
  const tree = packTree({ tier: 'light' });
  const result = await loadBuiltInPacks(opts(tree));
  assert.equal(result.state, 'loaded');
  assert.equal(result.tier, 'light');
  assert.deepEqual(result.failed, []);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`);
  assert.equal(assetUrl('assets/fonts/x.woff2'), `./objects/aa/${A}.woff2`);
  assert.equal(assetUrl('assets/not/listed.webp'), 'assets/not/listed.webp', 'an unknown id still passes through');
  assert.ok(tree.asked.includes('asset-base.json'));
  resetBuiltInArt();
});

test('asset-base.json moves where packs/ and objects/ are read from', async () => {
  resetBuiltInArt();
  const tree = packTree({ base: '../../' });
  await loadBuiltInPacks(opts(tree));
  assert.ok(tree.asked.some((u) => u.startsWith('../../packs/light-')));
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `../../objects/aa/${A}.webp`);
  resetBuiltInArt();
  const evil = packTree({ base: 'https://example.com/' });
  await loadBuiltInPacks(opts(evil));
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`, 'a base naming another origin is refused');
  resetBuiltInArt();
});

test('a high-default build uses high, and falls back to light when high is missing or fails its pin', async () => {
  resetBuiltInArt();
  const ok = await loadBuiltInPacks(opts(packTree({ tier: 'high' })));
  assert.equal(ok.tier, 'high');
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/cc/${C}.webp`);
  for (const how of ['drop', 'corrupt']) {
    resetBuiltInArt();
    const tree = packTree({ tier: 'high', [how]: ['high'] });
    const r = await loadBuiltInPacks(opts(tree));
    assert.equal(r.state, 'loaded', how);
    assert.equal(r.requested, 'high');
    assert.equal(r.tier, 'light', `${how}: the light pack stands in`);
    assert.equal(r.failed.length, 1);
    assert.match(r.failed[0], how === 'drop' ? /404/ : /hashes to/);
    assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`);
  }
  resetBuiltInArt();
});

test('with no art index the game keeps its placeholders: no source, ids pass through', async () => {
  resetBuiltInArt();
  setBuiltInSource(new Map([['assets/bg/bg_act1.webp', 'stale']]));
  const r = await loadBuiltInPacks(opts(packTree({ tier: 'high', corrupt: ['high', 'light'] })));
  assert.equal(r.state, 'failed');
  assert.equal(r.failed.length, 2);
  assert.equal(builtInSource(), null);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'assets/bg/bg_act1.webp');
  resetBuiltInArt();
});

test('file:// fetches nothing yet (the .js twins are step 4) and says so', async () => {
  resetBuiltInArt();
  const tree = packTree();
  const r = await loadBuiltInPacks(opts(tree, { protocol: 'file:' }));
  assert.equal(r.state, 'failed');
  assert.deepEqual(tree.asked, []);
  resetBuiltInArt();
});

test('the high-res overlay still wins over the built-in pack, which wins over ASSET_MAP', async () => {
  resetBuiltInArt();
  await loadBuiltInPacks(opts(packTree()));
  setHighResSource(new Map([['assets/bg/bg_act1.webp', 'blob:hd']]));
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'blob:hd');
  setHighResSource(null);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`);
  resetBuiltInArt();
});

test('the first screen waits for the load, and is drawn once', async () => {
  resetBuiltInArt();
  const tree = packTree();
  let calls = 0;
  let sourced = null;
  await new Promise((done) => whenBuiltInArtReady(() => { calls += 1; done(); }, { ...opts(tree), onSource: (m) => { sourced = m; } }));
  assert.equal(calls, 1);
  assert.ok(sourced && sourced.size === 3, 'the source listener sees the merged map');
  assert.equal(builtInArtStatus().state, 'loaded');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(calls, 1);
  resetBuiltInArt();
});

test('a screen drawn before the index arrived is re-pointed at the objects, and Local high-res returns to them', async () => {
  const { builtInArtArrived, applyArtQuality, resetHighResArt, ART_QUALITY_KEY, ART_LOCAL_HIGH, ART_BUILT_IN } = await import('../src/ui/highResArt.js');
  resetBuiltInArt();
  resetHighResArt();
  const attrs = { src: 'assets/bg/bg_act1.webp' };
  const img = { tagName: 'IMG', getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  const events = [];
  globalThis.document = { querySelectorAll: () => [img], dispatchEvent: (e) => { events.push(e.type); return true; }, addEventListener: () => {} };
  try {
    await loadBuiltInPacks(opts(packTree(), { onSource: builtInArtArrived }));
    assert.equal(attrs.src, `./objects/aa/${A}.webp`, 'swapped in place');
    assert.deepEqual(events, ['ashen:art-source'], 'the warmers hear the change');
    const manifest = { assets: { 'assets/bg/bg_act1.webp': { high: { path: 'assets/bg/bg_act1.webp' } } } };
    const json = async () => ({ ok: true, json: async () => manifest });
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: json, protocol: 'https:' });
    assert.equal(attrs.src, 'hd/assets/bg/bg_act1.webp');
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
    assert.equal(attrs.src, `./objects/aa/${A}.webp`, 'back to the pack, not the bare path');
  } finally {
    delete globalThis.document;
    resetHighResArt();
    resetBuiltInArt();
  }
});

test('a load past its deadline settles as failed before the first screen, and the late index is dropped', async () => {
  resetBuiltInArt();
  const tree = packTree();
  let release;
  const gate = new Promise((r) => { release = r; });
  let aborted = false;
  const slow = async (url, init = {}) => {
    init.signal?.addEventListener?.('abort', () => { aborted = true; });
    if (url.includes('packs/light-')) await gate; // the index hangs past the deadline
    return tree.fetchImpl(url, init);
  };
  let drawnWith = null;
  let sourced = 0;
  await new Promise((done) => whenBuiltInArtReady(() => {
    drawnWith = { state: builtInArtStatus().state, url: assetUrl('assets/bg/bg_act1.webp') };
    done();
  }, { ...opts(tree), fetchImpl: slow, deadlineMs: 30, onSource: () => { sourced += 1; } }));
  assert.equal(drawnWith.state, 'failed', 'the first screen draws only after the load has settled');
  assert.equal(drawnWith.url, 'assets/bg/bg_act1.webp', 'placeholders: no source');
  assert.match(builtInArtStatus().failed[0], /did not load within 30 ms/);
  assert.ok(aborted, 'the fetches are aborted');
  release();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(builtInSource(), null, 'the index that arrives late is never laid over the drawn screen');
  assert.equal(sourced, 0);
  assert.equal(builtInArtStatus().state, 'failed');
  resetBuiltInArt();
});
