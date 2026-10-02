// tests/asset-packs.test.mjs — the web edition's pack loader (src/ui/assetPacks.js,
// docs/EXTERNAL-ASSETS-PLAN.md §3, step 3a): the pin is checked, the tier falls
// back high → light → placeholders, and a single file or the source tree loads
// nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  loadBuiltInPacks, whenBuiltInArtReady, resetBuiltInArt, packsPinned, tierOrder, objectUrl, cleanBase,
  builtInArtStatus, ASSET_PACKS, musicHold, bootLine, ASSET_CSS, fillAssetCss, applyAssetCss,
  fontFaceRules, twinOf, unmappedFaceDescriptors,
} from '../src/ui/assetPacks.js';
import { readFileSync, readdirSync } from 'node:fs';
import { assetUrl, builtInSource, setBuiltInSource, setHighResSource } from '../src/ui/assetmap.js';
import { sha256Bytes, sha256Hex } from '../src/ui/sha256.js';
import { objectPath, indexText, twinText } from '../tools/asset-pack.mjs';

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
  return { pin: { schema: 1, tier, packs, fonts: null }, fetchImpl, asked, files: new Map([...files, ...Object.entries(indexes).map(([pack, text]) => [packs[pack]?.index, text]).filter(([k]) => k)]) };
}
const opts = (tree, extra = {}) => ({ pin: tree.pin, inlineMap: {}, fetchImpl: tree.fetchImpl, protocol: 'http:', ...extra });

const FONT_BYTES = Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4, 5]);
const FONT_SHA = sha(FONT_BYTES);
const FACE_CSS = { schema: 1, rules: [
  ':root{--as-css-bg-bg_act1-webp:url("{{assets/bg/bg_act1.webp}}")}',
  "@font-face { font-family:'AS Lore Fell'; font-style:italic; font-weight:400; font-display:swap; src:url(\"{{assets/fonts/x.woff2}}\") format('woff2'); }",
] };

/**
 * The same pack tree as file:// sees it: each index's .js twin (and, with
 * `fonts`, the font sidecar), loaded by a script loader that runs the twin's
 * text, and a fetch that must never be called.
 */
function twinTree({ tier = 'light', drop = [], corruptTwin = [], silent = [], fonts = false, corruptFonts = null } = {}) {
  const tree = packTree({ tier });
  const common = indexText({ 'assets/fonts/x.woff2': [FONT_SHA, FONT_BYTES.length, 'font/woff2'] });
  if (fonts) tree.pin.packs.common = { index: `packs/common-${sha(common).slice(0, 12)}.json`, sha256: sha(common), ids: 1, objects: 1, bytes: 9 };
  const files = new Map();
  for (const [pack, p] of Object.entries(tree.pin.packs)) {
    if (drop.includes(pack)) continue;
    const name = p.index.replace(/^packs\/|\.json$/g, '');
    let text = pack === 'common' && fonts ? common : tree.files.get(p.index);
    if (corruptTwin.includes(pack)) text = text.replace('{\n', '{\n"x":1,\n');
    files.set(p.index.replace(/\.json$/, '.js'), silent.includes(pack) ? '/* calls nothing */\n' : twinText('window.__ashenPack', name, text));
  }
  if (fonts) {
    const faceBytes = corruptFonts === 'face' ? Uint8Array.from([9, 9, 9]) : FONT_BYTES;
    let text = `{\n${JSON.stringify('assets/fonts/x.woff2')}:${JSON.stringify(Buffer.from(faceBytes).toString('base64'))}\n}\n`;
    const pinned = sha(text);
    if (corruptFonts === 'text') text = text.replace('}', ',"y":"AA=="}');
    const name = `fonts-${pinned.slice(0, 12)}`;
    tree.pin.fonts = { file: `packs/${name}.js`, sha256: pinned, faces: 1 };
    files.set(`packs/${name}.js`, twinText('__ashenFonts', name, text));
  }
  const scripts = [];
  const scriptImpl = async (src) => {
    scripts.push(src);
    const body = files.get(src.replace(/^\.\//, ''));
    if (body === undefined) throw new Error(`${src} could not be loaded`);
    new Function('window', body)(globalThis);
  };
  return { ...tree, scripts, scriptImpl };
}
/** A FontFace stand-in: what it was given, and a load() that resolves. */
class FakeFontFace {
  constructor(family, source, descriptors) { Object.assign(this, { family, source, descriptors }); }
  async load() { return this; }
}
const fileOpts = (tree, extra = {}) => {
  const doc = extra.doc || fakeDoc('file:///p/AshenSpire.html');
  return { pin: tree.pin, inlineMap: {}, fetchImpl: tree.fetchImpl, protocol: 'file:', scriptImpl: tree.scriptImpl, FontFaceImpl: FakeFontFace, css: null, ...extra, doc };
};

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

test('file:// fetches nothing: the indexes come from their .js twins (step 4)', async () => {
  resetBuiltInArt();
  const tree = twinTree();
  const r = await loadBuiltInPacks(fileOpts(tree));
  assert.equal(r.state, 'loaded');
  assert.equal(r.tier, 'light');
  assert.equal(r.via, 'file');
  assert.deepEqual(tree.asked, [], 'no fetch at all, asset-base.json included');
  assert.ok(tree.scripts.some((u) => /^\.\/packs\/light-[0-9a-f]{12}\.js$/.test(u)), 'the light twin');
  assert.ok(tree.scripts.some((u) => /^\.\/packs\/common-[0-9a-f]{12}\.js$/.test(u)), 'the common twin');
  assert.ok(!tree.scripts.some((u) => /\.json$/.test(u)), 'never a .json index through a script');
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`);
  assert.equal(assetUrl('assets/fonts/x.woff2'), `./objects/aa/${A}.woff2`);
  resetBuiltInArt();
  // Without a document (or a script loader) nothing can be loaded, and it says so.
  const none = await loadBuiltInPacks({ ...fileOpts(twinTree()), scriptImpl: null, doc: null });
  assert.equal(none.state, 'failed');
  assert.match(none.failed[0], /file:\/\/: no document/);
  resetBuiltInArt();
});

test('file:// drops a twin whose string does not hash to the pin, unparsed, and the tier falls back', async () => {
  resetBuiltInArt();
  const tree = twinTree({ tier: 'high', corruptTwin: ['high'] });
  const r = await loadBuiltInPacks(fileOpts(tree));
  assert.equal(r.tier, 'light', 'high → light');
  assert.ok(r.failed.some((f) => /^high: packs\/high-[0-9a-f]{12}\.js hashes to [0-9a-f]{12}, the pin says/.test(f)), r.failed.join('; '));
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`, 'the light object, never the corrupt twin\'s');
  resetBuiltInArt();
  // A twin that is missing, or that never calls its hook, is a failed index.
  const gone = await loadBuiltInPacks(fileOpts(twinTree({ tier: 'high', drop: ['high'], silent: ['light'] })));
  assert.equal(gone.state, 'failed');
  assert.ok(gone.failed.some((f) => /^high: .*could not be loaded/.test(f)), gone.failed.join('; '));
  assert.ok(gone.failed.some((f) => /^light: packs\/light-[0-9a-f]{12}\.js did not call __ashenPack/.test(f)), gone.failed.join('; '));
  assert.equal(builtInSource(), null, 'placeholders');
  resetBuiltInArt();
});

test('file:// adds the faces from the font sidecar, each checked, and leaves the @font-face rules out of the CSS', async () => {
  resetBuiltInArt();
  const tree = twinTree({ fonts: true });
  const doc = fakeDoc('file:///home/p/AshenSpire/AshenSpire.html');
  const r = await loadBuiltInPacks(fileOpts(tree, { css: FACE_CSS, doc }));
  assert.equal(r.state, 'loaded');
  assert.equal(r.faces, 1);
  assert.deepEqual(r.failed, []);
  assert.equal(doc.fontList.length, 1);
  const [face] = doc.fontList;
  assert.equal(face.family, 'AS Lore Fell');
  assert.deepEqual(face.descriptors, { style: 'italic', weight: '400', display: 'swap' });
  assert.deepEqual([...new Uint8Array(face.source)], [...FONT_BYTES], 'the face is the sidecar\'s decoded bytes');
  assert.ok(tree.scripts.some((u) => /^\.\/packs\/fonts-[0-9a-f]{12}\.js$/.test(u)), 'the sidecar');
  assert.equal(r.css, 1, 'only the backdrop rule');
  assert.doesNotMatch(doc.styles[0].textContent, /font-face/, 'no url() font load Chrome would refuse');
  assert.ok(doc.styles[0].textContent.includes('url("file:///home/p/AshenSpire/objects/aa/'), 'the backdrop, absolute against the file');
  assert.ok(doc.styles[0].textContent.includes(`objects/aa/${A}.webp`), 'the light backdrop object');
  // A tier switch reloads the indexes, but never adds the same faces again.
  const again = await loadBuiltInPacks(fileOpts(tree, { css: FACE_CSS, doc }));
  assert.equal(again.faces, 1);
  assert.equal(doc.fontList.length, 1);
  resetBuiltInArt();
});

test('file:// refuses a sidecar off its pin, and a face whose bytes are not its common record; the art still loads', async () => {
  resetBuiltInArt();
  let doc = fakeDoc('file:///p/AshenSpire.html');
  const off = await loadBuiltInPacks(fileOpts(twinTree({ fonts: true, corruptFonts: 'text' }), { css: FACE_CSS, doc }));
  assert.equal(off.state, 'loaded');
  assert.equal(off.faces, 0);
  assert.ok(off.failed.some((f) => /^fonts: packs\/fonts-[0-9a-f]{12}\.js hashes to/.test(f)), off.failed.join('; '));
  assert.equal(doc.fontList.length, 0);
  resetBuiltInArt();
  doc = fakeDoc('file:///p/AshenSpire.html');
  const face = await loadBuiltInPacks(fileOpts(twinTree({ fonts: true, corruptFonts: 'face' }), { css: FACE_CSS, doc }));
  assert.equal(face.faces, 0);
  assert.ok(face.failed.some((f) => /^fonts: assets\/fonts\/x\.woff2 hashes to [0-9a-f]{12}, its common record says/.test(f)), face.failed.join('; '));
  assert.equal(doc.fontList.length, 0);
  resetBuiltInArt();
  // No common index: nothing to check a face against, so none is added.
  doc = fakeDoc('file:///p/AshenSpire.html');
  const noCommon = await loadBuiltInPacks(fileOpts(twinTree({ fonts: true, drop: ['common'] }), { css: FACE_CSS, doc }));
  assert.equal(noCommon.state, 'loaded');
  assert.equal(doc.fontList.length, 0);
  resetBuiltInArt();
});

test('file://: a face still loading at the deadline is never added after the load settles', async () => {
  resetBuiltInArt();
  const tree = twinTree({ fonts: true });
  const doc = fakeDoc('file:///p/AshenSpire.html');
  let release;
  const gate = new Promise((r) => { release = r; });
  class SlowFace extends FakeFontFace { async load() { await gate; return this; } }
  const r = await loadBuiltInPacks(fileOpts(tree, { css: FACE_CSS, doc, FontFaceImpl: SlowFace, deadlineMs: 60 }));
  assert.equal(r.state, 'loaded', 'the art is kept');
  assert.equal(r.faces, 0);
  assert.ok(r.failed.some((f) => /^fonts: the sidecar did not load within 60 ms/.test(f)), r.failed.join('; '));
  release();
  for (let i = 0; i < 20; i++) await new Promise((done) => setImmediate(done));
  assert.equal(doc.fontList.length, 0, 'no face added after the load settled');
  // And the cache was not written: a later load reads the sidecar again and adds the face.
  const again = await loadBuiltInPacks(fileOpts(tree, { css: FACE_CSS, doc }));
  assert.equal(again.faces, 1);
  assert.equal(doc.fontList.length, 1);
  resetBuiltInArt();
});

test('file://: a tier switch replaced while a face is loading publishes nothing', async () => {
  resetBuiltInArt();
  const tree = twinTree({ fonts: true });
  const doc = fakeDoc('file:///p/AshenSpire.html');
  let release;
  const gate = new Promise((r) => { release = r; });
  let started;
  const loading = new Promise((r) => { started = r; });
  class SlowFace extends FakeFontFace { async load() { started(); await gate; return this; } }
  let wanted = true;
  let published = 0;
  const pending = loadBuiltInPacks(fileOpts(tree, { css: FACE_CSS, doc, FontFaceImpl: SlowFace, stillWanted: () => wanted, onSource: () => { published++; } }));
  await loading;
  wanted = false; // the player switched again while the face was loading
  release();
  const r = await pending;
  assert.equal(r.superseded, true);
  assert.equal(published, 0, 'onSource never ran');
  assert.equal(builtInSource(), null, 'setBuiltInSource never ran');
  assert.equal(doc.styles.length, 0, 'no CSS injected');
  assert.equal(doc.fontList.length, 0, 'document.fonts unchanged: the superseded switch added no face');
  // Nor was the faces cache written: the next wanted load adds the face.
  const next = await loadBuiltInPacks(fileOpts(tree, { css: FACE_CSS, doc }));
  assert.equal(next.faces, 1);
  assert.equal(doc.fontList.length, 1);
  resetBuiltInArt();
});

test('file://: a twin call nobody is waiting for is dropped, and so is a late one', async () => {
  resetBuiltInArt();
  const tree = twinTree();
  await loadBuiltInPacks(fileOpts(tree)); // installs the hooks
  resetBuiltInArt();
  const name = tree.pin.packs.light.index.replace(/^packs\/|\.json$/g, '');
  const text = tree.files.get(tree.pin.packs.light.index);
  globalThis.__ashenPack(name, text); // unsolicited, even with the right text
  const silent = twinTree({ silent: ['light'] });
  const r = await loadBuiltInPacks(fileOpts(silent));
  assert.equal(r.state, 'failed', 'the unsolicited call was not kept for the next reader');
  assert.ok(r.failed.some((f) => /did not call __ashenPack/.test(f)), r.failed.join('; '));
  globalThis.__ashenPack(name, text); // late: the reader has given up
  const again = await loadBuiltInPacks(fileOpts(silent));
  assert.equal(again.state, 'failed', 'nor a late one');
  resetBuiltInArt();
});

test('fontFaceRules reads a FontFace from each ASSET_CSS @font-face rule', () => {
  const rules = fontFaceRules({ schema: 1, rules: [
    ':root{--as-css-bg-x-webp:url("{{assets/bg/x.webp}}")}',
    "@font-face { font-family:'AS Lore Inter'; font-style:normal; font-weight:400; font-display:swap; src:url(\"{{assets/fonts/inter-400-normal.woff2}}\") format('woff2'); }",
  ] });
  assert.deepEqual([...rules.keys()], ['assets/fonts/inter-400-normal.woff2']);
  assert.deepEqual(rules.get('assets/fonts/inter-400-normal.woff2'), { family: 'AS Lore Inter', descriptors: { style: 'normal', weight: '400', display: 'swap' } });
  assert.equal(fontFaceRules(null).size, 0);
  // Comments are stripped, and every standard descriptor is carried.
  const full = fontFaceRules({ schema: 1, rules: [
    "@font-face { /* the lore face; size: 1 */ font-family:'AS Lore X'; size-adjust:90%; ascent-override:80%; descent-override:20%; line-gap-override:0%; font-variation-settings:'wght' 400; /* end */ src:url(\"{{assets/fonts/x.woff2}}\"); }",
  ] });
  assert.deepEqual(full.get('assets/fonts/x.woff2'), { family: 'AS Lore X', descriptors: {
    sizeAdjust: '90%', ascentOverride: '80%', descentOverride: '20%', lineGapOverride: '0%', variationSettings: "'wght' 400" } });
});

test('a @font-face descriptor a FontFace would lose is found, and the shipped stylesheets carry none', () => {
  const css = { schema: 1, rules: ["@font-face { font-family:'AS Lore X'; font-palette:light; src:url(\"{{assets/fonts/x.woff2}}\"); }"] };
  assert.deepEqual(unmappedFaceDescriptors(css).map((d) => d.split(' ')[0]), ['font-palette']);
  assert.deepEqual(unmappedFaceDescriptors(FACE_CSS), []);
  for (const name of readdirSync(new URL('../styles/', import.meta.url)).filter((f) => f.endsWith('.css'))) {
    const text = readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8');
    const rules = [...text.matchAll(/@font-face\s*\{[^{}]*\}/g)].map((m) => m[0]);
    assert.deepEqual(unmappedFaceDescriptors({ rules }), [], `styles/${name}: a face the file:// door would declare differently`);
  }
});

test('twinOf names the .js twin of a pinned index', () => {
  assert.deepEqual(twinOf('packs/light-0123456789ab.json'), { name: 'light-0123456789ab', file: 'packs/light-0123456789ab.js' });
  assert.deepEqual(twinOf('packs/fonts-0123456789ab.js'), { name: 'fonts-0123456789ab', file: 'packs/fonts-0123456789ab.js' });
  for (const bad of ['../x.json', 'https://e.com/x.json', 'packs/x.txt', '', null]) assert.equal(twinOf(bad), null, String(bad));
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
  // The budget is what was LEFT of the 30 ms once asset-base.json answered,
  // so a slow millisecond there makes it 29: the number is not the point.
  assert.match(builtInArtStatus().failed[0], /^light: the index did not load within (?:[12]?\d|30) ms$/);
  assert.ok(aborted, 'the fetches are aborted');
  release();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(builtInSource(), null, 'the index that arrives late is never laid over the drawn screen');
  assert.equal(sourced, 0);
  assert.equal(builtInArtStatus().state, 'failed');
  resetBuiltInArt();
});

/** A fetch that never answers the URLs `hang` matches until released (abort rejects it). */
function stalling(tree, hang) {
  const released = [];
  const fetchImpl = (url, init = {}) => {
    if (!hang.test(url)) return tree.fetchImpl(url, init);
    return new Promise((resolve, reject) => {
      released.push(() => resolve(tree.fetchImpl(url, init)));
      init.signal?.addEventListener?.('abort', () => reject(new Error('aborted')));
    });
  };
  return { fetchImpl, release: () => released.forEach((r) => r()) };
}

test('a high index that hangs is abandoned at its sub-budget, and light still loads before the deadline', async () => {
  resetBuiltInArt();
  const tree = packTree({ tier: 'high' });
  const { fetchImpl, release } = stalling(tree, /packs\/high-/);
  const t0 = Date.now();
  const r = await loadBuiltInPacks(opts(tree, { fetchImpl, deadlineMs: 200 }));
  assert.equal(r.state, 'loaded');
  assert.equal(r.tier, 'light');
  assert.match(r.failed.join(';'), /high: the index did not load within 100 ms/);
  assert.ok(Date.now() - t0 < 200, 'light loaded inside the deadline');
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`);
  release();
  await new Promise((r2) => setTimeout(r2, 20));
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`, 'the late high index changes nothing');
  resetBuiltInArt();
});

test('a common index that hangs or fails never throws away a verified art map', async () => {
  for (const how of ['hang', 'fail']) {
    resetBuiltInArt();
    const tree = packTree({ drop: how === 'fail' ? ['common'] : [] });
    const { fetchImpl, release } = stalling(tree, how === 'hang' ? /packs\/common-/ : /^$/);
    const r = await loadBuiltInPacks(opts(tree, { fetchImpl, deadlineMs: 80 }));
    assert.equal(r.state, 'loaded', how);
    assert.equal(r.tier, 'light');
    assert.match(r.failed.join(';'), how === 'hang' ? /common: the index did not load/ : /common: .*404/);
    assert.equal(assetUrl('assets/bg/bg_act1.webp'), `./objects/aa/${A}.webp`, `${how}: the art is in place`);
    assert.equal(assetUrl('assets/fonts/x.woff2'), 'assets/fonts/x.woff2', `${how}: common is left out`);
    release();
  }
  resetBuiltInArt();
});

test('a later load (a tier switch) whose common fetch fails keeps the common entries the earlier load verified', async () => {
  resetBuiltInArt();
  const tree = packTree({ tier: 'high' });
  const first = await loadBuiltInPacks(opts(tree));
  assert.equal(first.state, 'loaded');
  assert.equal(assetUrl('assets/fonts/x.woff2'), `./objects/aa/${A}.woff2`, 'common loaded at boot');
  // The switch: same pin, light asked for, and common now 404s.
  const broken = async (url) => (/packs\/common-/.test(url) ? { ok: false, status: 404 } : tree.fetchImpl(url));
  const second = await loadBuiltInPacks(opts(tree, { fetchImpl: broken, tier: 'light' }));
  assert.equal(second.state, 'loaded');
  assert.match(second.failed.join(';'), /common: kept the entries verified by the earlier load/);
  assert.equal(assetUrl('assets/fonts/x.woff2'), `./objects/aa/${A}.woff2`, 'common survives the switch');
  // A different common pin is never served from the earlier entries.
  const other = { ...tree.pin, packs: { ...tree.pin.packs, common: { ...tree.pin.packs.common, sha256: 'd'.repeat(64) } } };
  const third = await loadBuiltInPacks(opts(tree, { pin: other, fetchImpl: broken }));
  assert.equal(third.state, 'loaded');
  assert.equal(assetUrl('assets/fonts/x.woff2'), 'assets/fonts/x.woff2', 'another pin: left out');
  resetBuiltInArt();
});

test('common is fetched alongside the art tiers, not after them', async () => {
  resetBuiltInArt();
  const tree = packTree({ tier: 'high' });
  const order = [];
  const { fetchImpl } = stalling(tree, /packs\/high-/);
  const watched = (url, init) => { order.push(url.replace(/^\.\//, '').replace(/-[0-9a-f]{12}\.json$/, '')); return fetchImpl(url, init); };
  await loadBuiltInPacks(opts(tree, { fetchImpl: watched, deadlineMs: 100 }));
  assert.deepEqual(order.slice(0, 3), ['asset-base.json', 'packs/common', 'packs/high'], `common is requested with the first tier: ${order.join(', ')}`);
  resetBuiltInArt();
});

test('an asset-base.json that hangs falls back to ./ and the art still loads', async () => {
  resetBuiltInArt();
  const tree = packTree({ base: './' });
  const { fetchImpl, release } = stalling(tree, /asset-base\.json/);
  const r = await loadBuiltInPacks(opts(tree, { fetchImpl, deadlineMs: 200 }));
  assert.equal(r.state, 'loaded');
  release();
  resetBuiltInArt();
});

test('the music folder: a single file applies it before the first screen, as on dev; a pack build holds it until after', () => {
  const calls = [];
  const configureMusic = ({ folder }) => calls.push(`music:${folder}`);
  const single = musicHold({ pinned: false, configureMusic });
  single.apply('music');
  calls.push('-- first screen');
  single.firstScreen(() => calls.push('screen'));
  assert.deepEqual(calls, ['music:music', '-- first screen', 'screen'], 'unpinned: configureMusic before the first screen, and not again after');

  calls.length = 0;
  const web = musicHold({ pinned: true, configureMusic });
  web.apply('music');
  assert.deepEqual(calls, [], 'held while the load settles');
  web.firstScreen(() => calls.push('screen'));
  assert.deepEqual(calls, ['screen', 'music:music']);
  web.apply('other');
  assert.deepEqual(calls, ['screen', 'music:music', 'music:other'], 'released: later changes apply at once');

  calls.length = 0;
  const throwing = musicHold({ pinned: true, configureMusic });
  throwing.apply('music');
  assert.throws(() => throwing.firstScreen(() => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(calls, ['music:music'], 'the hold releases even when the first screen throws');
  assert.equal(musicHold({ configureMusic }).apply('x') ?? null, null);
  assert.deepEqual(calls.slice(-1), ['music:x'], 'the default reads the pin: the source tree pins nothing');

  const seen = [];
  const passes = musicHold({ pinned: true, configureMusic: (o) => seen.push(o) });
  passes.apply('music', { indexed: true });
  passes.firstScreen(() => {});
  passes.apply('music/', { indexed: false });
  assert.deepEqual(seen, [{ indexed: true, folder: 'music' }, { indexed: false, folder: 'music/' }], 'the options travel with the folder, held or not');

  // A failed boot load: the shipped score was configured with no source, so it
  // is configured again once a later tier switch sets one; a player's folder,
  // or a configure that already had a source, is not.
  let source = false;
  const again = [];
  const late = musicHold({ pinned: true, configureMusic: (o) => again.push(o.folder), hasSource: () => source });
  late.apply('music', { indexed: true });
  late.firstScreen(() => {});
  late.sourceArrived();
  assert.deepEqual(again, ['music'], 'no source yet: nothing to re-apply');
  source = true;
  late.sourceArrived();
  assert.deepEqual(again, ['music', 'music'], 'the source arrived: the shipped score is read through it');
  late.sourceArrived();
  assert.deepEqual(again, ['music', 'music'], 'once only');
  source = false;
  late.apply('mine', { indexed: false });
  source = true;
  late.sourceArrived();
  assert.deepEqual(again, ['music', 'music', 'mine'], 'a typed folder is never re-applied');

  // The default test is the manifest itself: art loaded but common did not, so
  // a source exists and the score still missed; a switch that lists the
  // manifest brings it back.
  const real = [];
  setBuiltInSource(new Map([['assets/bg/bg_act1.webp', `./objects/aa/${A}.webp`]]));
  const art = musicHold({ pinned: true, configureMusic: (o) => real.push(o.folder) });
  art.apply('music', { indexed: true });
  art.firstScreen(() => {});
  art.sourceArrived();
  assert.deepEqual(real, ['music'], 'art only: the manifest still does not resolve');
  setBuiltInSource(new Map([['assets/bg/bg_act1.webp', `./objects/aa/${A}.webp`], ['music/manifest.json', `./objects/bb/${B}.json`]]));
  art.sourceArrived();
  assert.deepEqual(real, ['music', 'music'], 'common arrived with the switch: the score is configured again');
  art.sourceArrived();
  assert.deepEqual(real, ['music', 'music'], 'and not again once it resolved');
  setBuiltInSource(null);
});

test('main.js routes the boot music and the first screen through musicHold', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const bootMusic = musicHold\(\{ configureMusic:/);
  assert.match(main, /bootMusic\.apply\(folder, \{ indexed \}\)/);
  assert.match(main, /const indexed = !settings\.musicFolder && served;/, 'only the shipped score is indexed');
  assert.match(main, /onTierArrived\(\(map\) => \{ builtInArtArrived\(map\); bootMusic\.sourceArrived\(\); artArrivedAfterFailure\(\); \}\)/, 'a tier switch or a Retry can bring the score back');
  // Step 5: the music hold is released once the load has settled, whichever
  // way the first screen was drawn (the gate at once, or a ?shot= screen after).
  assert.match(main, /bootMusic\.firstScreen\(\(\) => \{ dropBootLine\(\); if \(!gateFirst\) showFirstScreen\(\); \}\)/);
  assert.doesNotMatch(main, /audio\.configureMusic\(\{ folder \}\)/, 'no second, unheld call');
});

test('an object shared by byte-identical assets resolves to the alias a high-res source covers', async () => {
  const { builtInArtArrived, applyArtQuality, resetHighResArt, ART_QUALITY_KEY, ART_LOCAL_HIGH, ART_BUILT_IN } = await import('../src/ui/highResArt.js');
  resetBuiltInArt();
  resetHighResArt();
  const shared = `./objects/aa/${A}.webp`;
  const map = new Map([['assets/ui/a.webp', shared], ['assets/ui/b.webp', shared]]);
  setBuiltInSource(map);
  const attrs = { src: shared };
  const img = { tagName: 'IMG', getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  globalThis.document = { querySelectorAll: () => [img], addEventListener: () => {} };
  try {
    builtInArtArrived(map);
    // urlToId remembers the shared object under the LAST id (b); the source covers a.
    const only = { assets: { 'assets/ui/a.webp': { high: { path: 'assets/ui/a.webp' } } } };
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_LOCAL_HIGH }, { fetchImpl: async () => ({ ok: true, json: async () => only }), protocol: 'https:' });
    assert.equal(attrs.src, 'hd/assets/ui/a.webp', 'the covered alias, not whichever id the object URL was remembered under');
    await applyArtQuality({ [ART_QUALITY_KEY]: ART_BUILT_IN });
    assert.equal(attrs.src, shared, 'back to the shared object');
  } finally {
    delete globalThis.document;
    resetHighResArt();
    resetBuiltInArt();
  }
});

test('a pack build shows a static loading line while it waits; a single file shows nothing', () => {
  const children = [];
  const app = { append: (el) => children.push(el) };
  const doc = { createElement: () => { const el = { dataset: {}, style: {}, setAttribute() {}, remove: () => children.splice(children.indexOf(el), 1) }; return el; } };
  const none = bootLine(app, { pinned: false, doc });
  assert.equal(children.length, 0);
  none();
  const drop = bootLine(app, { pinned: true, doc });
  assert.equal(children.length, 1);
  assert.match(children[0].textContent, /Loading art/);
  drop();
  assert.equal(children.length, 0, 'removed before the first screen');
});

// ---- the CSS assets (step 3b) ----------------------------------------------

const CSS = {
  schema: 1,
  rules: [
    ':root{--as-css-bg-bg_act1-webp:url("{{assets/bg/bg_act1.webp}}")}',
    "@font-face { font-family:'AS Lore X'; src:url(\"{{assets/fonts/x.woff2}}\") format('woff2'); }",
  ],
};

/** A document just big enough for applyAssetCss: a head, styles, a base URL. */
function fakeDoc(baseURI = 'https://example.com/AshenSpire/dev/0001/index.html') {
  const head = [];
  const fontList = [];
  const make = () => {
    const el = { attrs: {}, textContent: '', setAttribute(k, v) { el.attrs[k] = v; }, replaceWith(next) { head.splice(head.indexOf(el), 1, next); } };
    return el;
  };
  return {
    head: { appendChild: (el) => head.push(el) },
    baseURI,
    createElement: make,
    querySelector: (sel) => (sel === 'style[data-asset-css]' ? head.find((el) => 'data-asset-css' in el.attrs) || null : null),
    styles: head,
    fonts: { add: (face) => fontList.push(face) },
    fontList,
  };
}

test('the source tree carries no ASSET_CSS; the bundler stamps it in memory', () => {
  assert.equal(ASSET_CSS, null);
  const src = readFileSync(new URL('../src/ui/assetPacks.js', import.meta.url), 'utf8');
  assert.match(src, /\/\* ASSET_CSS_START \*\/\nexport const ASSET_CSS = null;\n\/\* ASSET_CSS_END \*\//, 'the bundler anchors on these markers');
});

test('fillAssetCss fills every slot from the map, and leaves out a rule whose id the map lacks', () => {
  const map = new Map([['assets/bg/bg_act1.webp', './objects/aa/a.webp'], ['assets/fonts/x.woff2', './objects/bb/b.woff2']]);
  const all = fillAssetCss(CSS, map);
  assert.equal(all.rules, 2);
  assert.deepEqual(all.dropped, []);
  assert.match(all.text, /--as-css-bg-bg_act1-webp:url\("\.\/objects\/aa\/a\.webp"\)/);
  assert.match(all.text, /src:url\("\.\/objects\/bb\/b\.woff2"\)/);
  assert.doesNotMatch(all.text, /\{\{/);
  const noFonts = fillAssetCss(CSS, new Map([['assets/bg/bg_act1.webp', './objects/aa/a.webp']]));
  assert.equal(noFonts.rules, 1, 'the face stays on the system fallback');
  assert.deepEqual(noFonts.dropped, ['assets/fonts/x.woff2']);
  const quoted = fillAssetCss(CSS, map, { resolveUrl: () => 'x"y\\z' });
  assert.doesNotMatch(quoted.text, /x"y/, 'a quote in a url cannot close the string');
  assert.equal(fillAssetCss(null, map).rules, 0, 'a single file has no template');
  assert.equal(fillAssetCss(CSS, null).rules, 0, 'no map, nothing filled');
});

test('applyAssetCss injects one <style>, with object urls made absolute against the page', () => {
  const doc = fakeDoc();
  const map = new Map([['assets/bg/bg_act1.webp', '../../objects/aa/a.webp'], ['assets/fonts/x.woff2', '../../objects/bb/b.woff2']]);
  const first = applyAssetCss(map, { css: CSS, doc });
  assert.equal(first.rules, 2);
  assert.equal(doc.styles.length, 1);
  assert.match(doc.styles[0].textContent, /url\("https:\/\/example\.com\/AshenSpire\/objects\/aa\/a\.webp"\)/);
  applyAssetCss(new Map([['assets/fonts/x.woff2', './objects/cc/c.woff2']]), { css: CSS, doc });
  assert.equal(doc.styles.length, 1, 'a second fill replaces the first');
  assert.doesNotMatch(doc.styles[0].textContent, /--as-css/);
  const empty = fakeDoc();
  applyAssetCss(map, { css: null, doc: empty });
  assert.equal(empty.styles.length, 0, 'no template, nothing injected');
});

test('the CSS assets follow the tier the loader used: light when high failed, nothing when every tier failed', async () => {
  const css = {
    schema: 1,
    rules: [':root{--as-css-bg-bg_act1-webp:url("{{assets/bg/bg_act1.webp}}")}', "@font-face { src:url(\"{{assets/fonts/x.woff2}}\"); }"],
  };
  resetBuiltInArt();
  let doc = fakeDoc('http://localhost/AshenSpire.html');
  const high = await loadBuiltInPacks(opts(packTree({ tier: 'high' }), { css, doc }));
  assert.equal(high.css, 2);
  assert.match(doc.styles[0].textContent, new RegExp(`objects/cc/${C}\\.webp`), 'the high backdrop');
  assert.match(doc.styles[0].textContent, new RegExp(`objects/aa/${A}\\.woff2`), 'the font from common');

  resetBuiltInArt();
  doc = fakeDoc('http://localhost/AshenSpire.html');
  const fell = await loadBuiltInPacks(opts(packTree({ tier: 'high', drop: ['high'] }), { css, doc }));
  assert.equal(fell.tier, 'light');
  assert.match(doc.styles[0].textContent, new RegExp(`objects/aa/${A}\\.webp`), 'the light backdrop');
  assert.doesNotMatch(doc.styles[0].textContent, new RegExp(C), 'never the high object whose index failed');

  resetBuiltInArt();
  doc = fakeDoc('http://localhost/AshenSpire.html');
  const noCommon = await loadBuiltInPacks(opts(packTree({ tier: 'light', drop: ['common'] }), { css, doc }));
  assert.equal(noCommon.css, 1, 'the backdrop only');
  assert.ok(noCommon.failed.some((f) => /^css: 1 rule/.test(f)), 'the face left on its fallback is reported');
  assert.doesNotMatch(doc.styles[0].textContent, /font-face/);

  resetBuiltInArt();
  doc = fakeDoc('http://localhost/AshenSpire.html');
  const none = await loadBuiltInPacks(opts(packTree({ tier: 'high', drop: ['high', 'light'] }), { css, doc }));
  assert.equal(none.state, 'failed');
  assert.equal(none.css, 0);
  assert.equal(doc.styles.length, 0, 'a failed load injects nothing: the CSS stays on its fallbacks');
  resetBuiltInArt();
});
