// tests/offline-zip.test.mjs — the in-game folder copy (docs/EXTERNAL-ASSETS-PLAN.md
// §5 B, step 7): src/model/zipStream.js writes tools/zip.mjs's bytes, and
// src/model/offlineDownload.js assembleZip packs a pack-shaped build's page,
// its light and common indexes, their twins, the font sidecar and every
// object, checking each against the pin and its own name, and refuses by code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readZip, writeZip } from '../tools/zip.mjs';
import { indexText, objectPath, twinText } from '../tools/asset-pack.mjs';
import { createZipWriter, crc32, zipNameOk } from '../src/model/zipStream.js';
import { assembleZip, coalesceSink, releasedZip, twinString, zipPinOf, ZipDownloadError } from '../src/model/offlineDownload.js';
import { offlinePlay } from '../src/content/offlinePlay.js';
import { t } from '../src/ui/strings.js';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const enc = (text) => new TextEncoder().encode(text);

async function zipBytes(entries) {
  const chunks = [];
  const zip = createZipWriter((chunk) => { chunks.push(Buffer.from(chunk)); });
  for (const { name, data } of entries) await zip.add(name, data);
  const done = await zip.finish();
  const out = Buffer.concat(chunks);
  assert.equal(done.bytes, out.length);
  return out;
}

test('the browser zip writer writes tools/zip.mjs writeZip bytes, and readZip reads them', async () => {
  const entries = [
    { name: 'a/AshenSpire.html', data: Buffer.from('<!doctype html>') },
    { name: 'a/objects/ab/x.webp', data: Buffer.from([0, 1, 2, 3, 255]) },
    { name: 'a/packs/light-000000000000.json', data: Buffer.from('{}\n') },
    { name: 'a/empty.txt', data: Buffer.alloc(0) },
    { name: 'a/ünï.txt', data: Buffer.from('utf-8 name') },
  ].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  const dir = mkdtempSync(join(tmpdir(), 'offline-zip-'));
  try {
    writeZip(join(dir, 'ref.zip'), entries);
    const ours = await zipBytes(entries);
    assert.ok(ours.equals(readFileSync(join(dir, 'ref.zip'))), 'same entries, same order → byte-identical archives');
    assert.deepEqual(readZip(ours).map((e) => [e.name, e.data.toString('hex')]), entries.map((e) => [e.name, e.data.toString('hex')]));
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
});

test('the zip writer refuses unsafe names, duplicates and an add after finish', async () => {
  for (const name of ['', '/abs', 'a\\b', 'a/../b', 'a//b', './a', 'a/']) assert.equal(zipNameOk(name), false, name);
  const zip = createZipWriter(() => {});
  await assert.rejects(zip.add('../x', new Uint8Array(1)), /refusing/);
  await zip.add('A/b.txt', new Uint8Array(1));
  await assert.rejects(zip.add('a/B.txt', new Uint8Array(1)), /twice/);
  await zip.finish();
  await assert.rejects(zip.add('c', new Uint8Array(1)), /after finish/);
  const failing = createZipWriter(() => { throw new Error('disk full'); });
  await assert.rejects(failing.add('x', new Uint8Array(1)), /disk full/);
});

test('coalesceSink gathers small chunks into large writes and flushes the rest', async () => {
  const writes = [];
  const { sink, flush } = coalesceSink(async (chunk) => { writes.push([...chunk]); }, 4);
  for (const part of [[1], [2, 3], [4], [5]]) await sink(new Uint8Array(part));
  await flush(); await flush();
  assert.deepEqual(writes, [[1, 2, 3, 4], [5]]);
});

const MANIFEST = 'https://example.org/AshenSpire/dev/latest/build.json';
function packInfo(extra = {}) {
  return { branch: 'dev', ordinal: 760, version: '0.7.1', bytes: null, pageBytes: 0, shape: 'pack',
    download: { path: 'download/AshenSpire.html', bytes: 30, sha256: 'a'.repeat(64) }, ...extra };
}

test('releasedZip offers a folder copy for a pack-shaped build only, named like the download', () => {
  const plan = releasedZip(packInfo({ pageBytes: 9, pageSha256: 'b'.repeat(64), packBytes: { light: 100, common: 50, high: 900 } }), MANIFEST, 'dev');
  assert.deepEqual(plan, { version: '0.7.1.760', folder: 'AshenSpire-dev-0.7.1.760', page: 'AshenSpire-dev-0.7.1.760.html', filename: 'AshenSpire-dev-0.7.1.760.zip',
    bytes: 159, pageBytes: 9, pageSha256: 'b'.repeat(64),
    pageUrl: 'https://example.org/AshenSpire/dev/760/index.html', baseUrl: 'https://example.org/AshenSpire/dev/760/asset-base.json' });
  assert.equal(releasedZip(packInfo({ pageBytes: 9 }), MANIFEST, 'dev').bytes, null, 'no packBytes: the size is unknown, the zip still offered');
  assert.equal(releasedZip({ branch: 'dev', ordinal: 5, version: '0.7.1', bytes: 500 }, MANIFEST, 'dev'), null, 'a single-file build offers no zip');
  for (const bad of [{ pageBytes: 0 }, { pageBytes: 9, pageSha256: 'nope' }, { pageBytes: -1 }]) assert.throws(() => releasedZip(packInfo(bad), MANIFEST, 'dev'));
});

test('the pin and twin readers take exactly the shapes the bundler writes', () => {
  const pin = { tier: 'light', packs: { light: { index: 'packs/light-aaaaaaaaaaaa.json', sha256: 'c'.repeat(64) } } };
  assert.deepEqual(zipPinOf(`x\nconst ASSET_PACKS = ${JSON.stringify(pin)};\ny`), pin);
  assert.equal(zipPinOf('const ASSET_PACKS = null;\n'), null);
  assert.equal(twinString(twinText('window.__ashenPack', 'light-x', '{"a":1}\n'), 'window.__ashenPack'), '{"a":1}\n');
  assert.equal(twinString(twinText('__ashenFonts', 'fonts-x', 'q"\\'), '__ashenFonts'), 'q"\\');
  assert.equal(twinString('evil();window.__ashenPack("a", "b");\n', 'window.__ashenPack'), null);
  assert.equal(twinString(twinText('window.__ashenPack', 'light-x', 't'), 'window.__ashenPack', 'light-x'), 't', 'the id the file name gives');
  assert.equal(twinString(twinText('window.__ashenPack', 'light-y', 't'), 'window.__ashenPack', 'light-x'), null, 'another id is a twin the loader drops (Codex, #1480)');
  assert.equal(twinString('window.__ashenPack("a", "b", "c");\n', 'window.__ashenPack'), null);
});

// A small pack-shaped site: two light objects (one shared by two ids), a
// common font and track, a font sidecar, and a page whose pin names them.
function fixtureSite({ highPinned = true } = {}) {
  const files = new Map();
  const ids = {
    light: { 'assets/bg/a.webp': Buffer.from('light-a'), 'assets/bg/b.webp': Buffer.from('light-a'), 'assets/ui/c.svg': Buffer.from('<svg/>') },
    common: { 'assets/fonts/x.woff2': Buffer.from('font-bytes'), 'music/manifest.json': Buffer.from('{}') },
    high: { 'assets/bg/a.webp': Buffer.from('HIGH-A') },
  };
  const pin = { schema: 1, tier: highPinned ? 'high' : 'light', packs: {} };
  for (const [pack, list] of Object.entries(ids)) {
    if (pack === 'high' && !highPinned) continue;
    const entries = {};
    for (const [id, bytes] of Object.entries(list)) {
      entries[id] = [sha(bytes), bytes.length, 'application/octet-stream'];
      files.set(objectPath(sha(bytes), id), bytes);
    }
    const text = indexText(entries);
    const name = `${pack}-${sha(text).slice(0, 12)}`;
    files.set(`packs/${name}.json`, Buffer.from(text));
    files.set(`packs/${name}.js`, Buffer.from(twinText('window.__ashenPack', name, text)));
    pin.packs[pack] = { index: `packs/${name}.json`, sha256: sha(text), objects: Object.keys(list).length, bytes: 0 };
  }
  const faces = JSON.stringify({ 'assets/fonts/x.woff2': Buffer.from('font-bytes').toString('base64') });
  files.set('packs/fonts-abcdefabcdef.js', Buffer.from(twinText('__ashenFonts', 'fonts-abcdefabcdef', faces)));
  pin.fonts = { file: 'packs/fonts-abcdefabcdef.js', sha256: sha(faces), faces: 1 };
  const html = Buffer.from(`<!doctype html><script>\nconst ASSET_PACKS = ${JSON.stringify(pin)};\n</script>`);
  const site = new Map([...files].map(([path, bytes]) => [`https://example.org/AshenSpire/${path}`, bytes]));
  site.set('https://example.org/AshenSpire/dev/760/index.html', html);
  site.set('https://example.org/AshenSpire/dev/760/asset-base.json', Buffer.from('{"base":"../../"}\n'));
  const plan = releasedZip(packInfo({ pageBytes: html.length, pageSha256: sha(html) }), MANIFEST, 'dev');
  const asked = [];
  const fetchImpl = async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    asked.push(url);
    const body = site.get(url);
    return body ? new Response(body) : new Response('missing', { status: 404 });
  };
  return { site, plan, pin, html, files, fetchImpl, asked };
}

async function assemble(fixture, options = {}) {
  const chunks = [];
  const progress = [];
  const result = await assembleZip(fixture.plan, { sink: (c) => { chunks.push(Buffer.from(c)); }, fetchImpl: fixture.fetchImpl, concurrency: 3,
    onProgress: (...values) => progress.push(values), ...options });
  return { result, zip: Buffer.concat(chunks), progress };
}

test('assembleZip packs the page, light and common, their twins, the sidecar and every object — never high', async () => {
  const fx = fixtureSite();
  const { result, zip, progress } = await assemble(fx);
  const entries = readZip(zip);
  const names = entries.map((e) => e.name);
  const folder = 'AshenSpire-dev-0.7.1.760/';
  assert.ok(names.every((n) => n.startsWith(folder)));
  const inside = names.map((n) => n.slice(folder.length));
  assert.deepEqual(inside, [...inside].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), 'writeZip order');
  const want = ['AshenSpire-dev-0.7.1.760.html', 'asset-base.json', fx.pin.packs.light.index, fx.pin.packs.light.index.replace('.json', '.js'),
    fx.pin.packs.common.index, fx.pin.packs.common.index.replace('.json', '.js'), fx.pin.fonts.file];
  for (const name of want) assert.ok(inside.includes(name), `zip carries ${name}`);
  assert.ok(!inside.includes(fx.pin.packs.high.index), 'the high index is not packed');
  const objects = inside.filter((n) => n.startsWith('objects/'));
  assert.equal(objects.length, 4, 'two light objects (one shared by two ids) and two common ones; no high object');
  for (const e of entries) {
    const rel = e.name.slice(folder.length);
    if (rel.startsWith('objects/')) assert.equal(sha(e.data), /([0-9a-f]{64})/.exec(rel)[1], `${rel} hashes to its name`);
  }
  assert.ok(entries.find((e) => e.name.endsWith('.html')).data.equals(fx.html), 'the page is the published page, byte for byte');
  assert.equal(entries.find((e) => e.name.endsWith('asset-base.json')).data.toString(), '{"base":"./"}\n');
  assert.equal(result.count, entries.length);
  assert.equal(result.objects, 4);
  assert.deepEqual(progress.at(-1).slice(0, 2), [entries.length, entries.length]);
  assert.equal(progress.at(-1)[2], progress.at(-1)[3], 'every byte counted is written');
  assert.ok(!fx.asked.some((u) => u.includes('HIGH') || u.includes(fx.pin.packs.high.index)), 'nothing of high is fetched');
  // Same bytes as tools/zip.mjs writes for those entries.
  const dir = mkdtempSync(join(tmpdir(), 'offline-zip-'));
  try {
    writeZip(join(dir, 'ref.zip'), entries.map((e) => ({ name: e.name, data: Buffer.from(e.data) })));
    assert.ok(zip.equals(readFileSync(join(dir, 'ref.zip'))));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a light-default build without a high pin packs the same shape', async () => {
  const { zip } = await assemble(fixtureSite({ highPinned: false }));
  assert.equal(readZip(zip).filter((e) => e.name.includes('/objects/')).length, 4);
});

async function refusedWith(fx, code, options) {
  await assert.rejects(assemble(fx, options), (error) => {
    assert.ok(error instanceof ZipDownloadError, `a ZipDownloadError, got ${error}`);
    assert.equal(error.code, code, error.message);
    return true;
  });
}

test('every plant is refused by its code, and nothing reports success', async () => {
  { const fx = fixtureSite(); const obj = [...fx.files.keys()].find((p) => p.endsWith('.svg'));
    fx.site.set(`https://example.org/AshenSpire/${obj}`, Buffer.from('<svg>tampered</svg>')); await refusedWith(fx, 'hash'); }
  { const fx = fixtureSite(); const twin = fx.pin.packs.common.index.replace('.json', '.js');
    fx.site.set(`https://example.org/AshenSpire/${twin}`, Buffer.from(twinText('window.__ashenPack', 'x', '{}\n'))); await refusedWith(fx, 'hash'); }
  // The right text under the wrong id: under file:// the loader waits for the basename's id and drops it (Codex, #1480).
  { const fx = fixtureSite(); const index = fx.pin.packs.light.index; const text = fx.files.get(index).toString();
    fx.site.set(`https://example.org/AshenSpire/${index.replace('.json', '.js')}`, Buffer.from(twinText('window.__ashenPack', 'light-000000000000', text))); await refusedWith(fx, 'hash'); }
  { const fx = fixtureSite(); const faces = JSON.stringify({ 'assets/fonts/x.woff2': Buffer.from('font-bytes').toString('base64') });
    fx.site.set(`https://example.org/AshenSpire/${fx.pin.fonts.file}`, Buffer.from(twinText('__ashenFonts', 'fonts-000000000000', faces))); await refusedWith(fx, 'hash'); }
  { const fx = fixtureSite(); fx.site.set(`https://example.org/AshenSpire/${fx.pin.fonts.file}`, Buffer.from(twinText('__ashenFonts', 'x', '{}'))); await refusedWith(fx, 'hash'); }
  { const fx = fixtureSite(); fx.site.set(`https://example.org/AshenSpire/${fx.pin.packs.light.index}`, Buffer.from('{}\n')); await refusedWith(fx, 'hash'); }
  { const fx = fixtureSite(); fx.site.delete(`https://example.org/AshenSpire/${[...fx.files.keys()].find((p) => p.endsWith('.woff2'))}`); await refusedWith(fx, 'unreachable'); }
  { const fx = fixtureSite(); fx.plan.pageSha256 = 'd'.repeat(64); await refusedWith(fx, 'page'); }
  { const fx = fixtureSite(); fx.plan.pageBytes += 1; await refusedWith(fx, 'page'); }
  { const fx = fixtureSite(); fx.site.set('https://example.org/AshenSpire/dev/760/asset-base.json', Buffer.from('{"base":"https://evil.example/"}')); await refusedWith(fx, 'pack'); }
  { const fx = fixtureSite(); const html = Buffer.from('<!doctype html>no pin'); fx.site.set(fx.plan.pageUrl, html);
    fx.plan.pageBytes = html.length; fx.plan.pageSha256 = sha(html); await refusedWith(fx, 'page'); }
  { const fx = fixtureSite(); await refusedWith(fx, 'pack', { packs: ['light', 'common', 'missing'] }); }
});

test('an abort stops the zip with an AbortError and no finished archive', async () => {
  const fx = fixtureSite();
  const controller = new AbortController();
  let calls = 0;
  const chunks = [];
  await assert.rejects(assembleZip(fx.plan, { sink: (c) => { chunks.push(c); }, signal: controller.signal,
    fetchImpl: async (url, init) => { if (++calls === 4) controller.abort(); return fx.fetchImpl(url, init); } }), (e) => e.name === 'AbortError');
  assert.throws(() => readZip(Buffer.concat(chunks.map((c) => Buffer.from(c)))), /end-of-central-directory/);
});

test('every folder-copy sentence the screen asks for is an authored uiStrings row', () => {
  const tokens = { mb: '57.0', filename: 'AshenSpire-dev-0.7.1.760.zip', done: 1, total: 2, totalMb: '57.0', files: 9 };
  for (const id of [...offlinePlay.zip.instructions, 'offline.zip.step.saveUnsized', 'offline.zip.heading', 'offline.zip.button', 'offline.zip.save',
    'offline.zip.unavailable', 'offline.zip.choose', 'offline.zip.working', 'offline.zip.finishing', 'offline.zip.saved', 'offline.zip.sent',
    'offline.zip.canceled', ...['unreachable', 'page', 'pack', 'hash'].map((code) => `offline.zip.error.${code}`)]) {
    const text = t(id, tokens);
    assert.ok(text && !/[{}]/.test(text), `${id} resolves to a sentence`);
  }
  assert.deepEqual(offlinePlay.zip.packs, ['light', 'common'], 'the folder copy carries light and common, never high (plan §5 B)');
});
