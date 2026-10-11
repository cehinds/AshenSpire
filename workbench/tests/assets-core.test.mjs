// node --test workbench/tests/assets-core.test.mjs — the Asset Gallery's listing core: the tracked
// trees and the fetched packs, header dimensions, the pack status, and the path checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listArt, resolveArt, dimsOf, packsOf, pinOf, clearArtCache } from '../core/assets.mjs';

function png(w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function webpVp8x(w, h) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(22, 4); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii'); b.writeUInt32LE(10, 16);
  b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3);
  return b;
}
function webpVp8(w, h) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(22, 4); b.write('WEBP', 8, 'ascii'); b.write('VP8 ', 12, 'ascii');
  b[23] = 0x9d; b[24] = 0x01; b[25] = 0x2a; b.writeUInt16LE(w, 26); b.writeUInt16LE(h, 28);
  return b;
}
function webpVp8l(w, h) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(22, 4); b.write('WEBP', 8, 'ascii'); b.write('VP8L', 12, 'ascii');
  const bits = (w - 1) | ((h - 1) << 14);
  b[21] = bits & 0xff; b[22] = (bits >> 8) & 0xff; b[23] = (bits >> 16) & 0xff; b[24] = (bits >> 24) & 0xff;
  return b;
}

async function project(t, { pin = true } = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'assets-core-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  clearArtCache();
  const put = async (rel, bytes) => { await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true }); await fs.writeFile(path.join(root, rel), bytes); };
  await put('assets-mobile/poses/idle.webp', webpVp8x(640, 480));
  await put('assets-mobile/equipment/sword.png', png(128, 64));
  await put('assets-mobile/bg/hall.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="100"></svg>');
  await put('assets-mobile/notes.txt', 'not art');
  await put('assets-display/classic/a.webp', webpVp8(320, 200));
  await put('music/theme.ogg', Buffer.from('OggS0000'));
  // The high pack is fetched; it holds one file the tree also has (listed once, from the tree) and one it alone has.
  await put('.art-cache/hd-assets-v19/high/assets/sprites/hero.webp', webpVp8l(300, 150));
  await put('.art-cache/hd-assets-v19/high/assets-mobile/poses/idle.webp', webpVp8x(1, 1));
  if (pin) await put('art-release.json', JSON.stringify({ schema: 2, tag: 'hd-assets-v19', packs: { high: { zip: 'hd-assets-v19.zip', sha256: 'a' }, light: { zip: 'light-assets-v19.zip', sha256: 'b' }, common: { zip: 'common-assets-v19.zip', sha256: 'c' } } }));
  return root;
}

test('dimsOf reads PNG, WebP (VP8X, VP8, VP8L), GIF and SVG headers and says null otherwise', () => {
  assert.deepEqual(dimsOf(png(128, 64), '.png'), { w: 128, h: 64 });
  assert.deepEqual(dimsOf(webpVp8x(640, 480), '.webp'), { w: 640, h: 480 });
  assert.deepEqual(dimsOf(webpVp8(320, 200), '.webp'), { w: 320, h: 200 });
  assert.deepEqual(dimsOf(webpVp8l(300, 150), '.webp'), { w: 300, h: 150 });
  assert.deepEqual(dimsOf(Buffer.from('GIF89a\x10\x00\x20\x00', 'binary'), '.gif'), { w: 16, h: 32 });
  assert.deepEqual(dimsOf(Buffer.from('<svg width="200px" height="100"></svg>'), '.svg'), { w: 200, h: 100 });
  assert.deepEqual(dimsOf(Buffer.from('<svg viewBox="0 0 48 24"></svg>'), '.svg'), { w: 48, h: 24 });
  assert.equal(dimsOf(Buffer.from('<svg width="50%"></svg>'), '.svg'), null, 'a percentage size names no pixels');
  assert.equal(dimsOf(Buffer.from('not a png at all, just bytes here.....'), '.png'), null);
  assert.equal(dimsOf(Buffer.alloc(40), '.jpg'), null, 'JPEG is not read: no dimensions');
});

test('listArt lists tracked trees and fetched packs at their game paths, each path once, with sizes and dims', async (t) => {
  const root = await project(t);
  const list = await listArt(root);
  const byPath = Object.fromEntries(list.files.map((f) => [f.path, f]));
  assert.deepEqual(Object.keys(byPath).sort(), [
    'assets-display/classic/a.webp', 'assets-mobile/bg/hall.svg', 'assets-mobile/equipment/sword.png', 'assets-mobile/poses/idle.webp',
    'assets/sprites/hero.webp', 'music/theme.ogg',
  ]);
  assert.equal(byPath['assets-mobile/poses/idle.webp'].from, 'tree', 'a path both places hold comes from the tree');
  assert.equal(byPath['assets-mobile/poses/idle.webp'].w, 640);
  assert.equal(byPath['assets/sprites/hero.webp'].from, 'high');
  assert.equal(byPath['assets/sprites/hero.webp'].w, 300);
  assert.equal(byPath['assets-mobile/equipment/sword.png'].h, 64);
  assert.equal(byPath['assets-mobile/bg/hall.svg'].w, 200);
  assert.equal(byPath['music/theme.ogg'].w, undefined, 'audio has no dimensions');
  assert.equal(byPath['music/theme.ogg'].bytes, 8);
  assert.equal(list.tag, 'hd-assets-v19');
  assert.equal(list.truncated, false);
  assert.ok(!list.files.some((f) => f.path.endsWith('.txt')), 'files that are not shippable art are not listed');
});

test('packs say which are fetched, and a project with no pin lists trees only', async (t) => {
  const root = await project(t);
  const list = await listArt(root);
  // light is available from the tracked assets-mobile/ tree, so it needs no fetch; common is not fetched here.
  assert.deepEqual(list.packs.map((p) => [p.id, p.fetched]), [['high', true], ['light', true], ['common', false]]);
  assert.equal(list.packs[0].zip, 'hd-assets-v19.zip');
  const bare = await project(t, { pin: false });
  const none = await listArt(bare);
  assert.equal(none.tag, null);
  assert.deepEqual(none.packs.map((p) => [p.id, p.fetched]), [['high', false], ['light', true], ['common', false]], 'light is tracked, so it stays available');
  assert.ok(!none.files.some((f) => f.path.startsWith('assets/')), 'no pin, no pack: the high paths are absent');
});

test('listArt stops at its limit and says so', async (t) => {
  const root = await project(t);
  const list = await listArt(root, { limit: 2 });
  assert.equal(list.truncated, true);
  assert.ok(list.files.length <= 3);
});

test('resolveArt finds a game path in its tree or a fetched pack, and refuses anything else', async (t) => {
  const root = await project(t);
  const tree = await resolveArt(root, 'assets-mobile/poses/idle.webp');
  assert.equal(tree, path.join(root, 'assets-mobile/poses/idle.webp'));
  assert.equal(await resolveArt(root, 'assets/sprites/hero.webp'), path.join(root, '.art-cache/hd-assets-v19/high/assets/sprites/hero.webp'));
  assert.equal(await resolveArt(root, 'assets/sprites/missing.webp'), null, 'a missing file is null, not an error');
  assert.equal(await resolveArt(root, 'assets/fonts/x.woff2'), null, 'an unpacked tier is null');
  for (const bad of ['../secret.webp', 'assets-mobile/../../art-release.json', '.art-cache/hd-assets-v19/high/assets/sprites/hero.webp', 'assets-mobile/notes.txt', '/etc/passwd.png', 'assets-mobile/a\\b.webp']) {
    assert.equal(await resolveArt(root, bad), null, bad);
  }
});

test('resolveArt refuses a linked file or folder inside an art root', async (t) => {
  const root = await project(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'assets-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'secret.webp'), webpVp8x(1, 1));
  await fs.symlink(outside, path.join(root, 'assets-mobile', 'linked'), 'dir');
  assert.equal(await resolveArt(root, 'assets-mobile/linked/secret.webp'), null);
  const list = await listArt(root);
  assert.ok(!list.files.some((f) => f.path.includes('linked')), 'links are not listed');
});

test('packsOf and pinOf read the pin and report an unfetched pack as not fetched', async (t) => {
  const root = await project(t);
  const pin = await pinOf(root);
  assert.equal(pin.tag, 'hd-assets-v19');
  const packs = await packsOf(root, pin);
  assert.equal(packs.find((p) => p.id === 'high').fetched, true);
  assert.equal(packs.find((p) => p.id === 'common').fetched, false);
  assert.equal(await pinOf(path.join(root, 'nowhere')), null);
});

test('listArt reads at most 32 headers at once, so a large art tree does not run out of file descriptors', async (t) => {
  const root = await project(t, { pin: false });
  clearArtCache();
  const dir = path.join(root, 'assets-mobile/many');
  await fs.mkdir(dir, { recursive: true });
  const N = 2000;
  await Promise.all(Array.from({ length: N }, (_, i) => fs.writeFile(path.join(dir, `tile-${i}.png`), png(16, 16))));
  // Count the handles open at once: a header read holds one from fs.open until its close.
  const realOpen = fs.open;
  let open = 0, peak = 0;
  fs.open = async (...args) => {
    const fh = await realOpen.apply(fs, args);
    open += 1; peak = Math.max(peak, open);
    const close = fh.close.bind(fh);
    fh.close = async () => { open -= 1; return close(); };
    return fh;
  };
  t.after(() => { fs.open = realOpen; });
  const list = await listArt(root, { limit: N + 100 });
  fs.open = realOpen;
  assert.equal(list.files.filter((f) => f.path.startsWith('assets-mobile/many/')).length, N);
  assert.equal(list.files.find((f) => f.path === 'assets-mobile/many/tile-7.png').w, 16, 'the header is still read');
  assert.ok(peak <= 32, `at most 32 handles open at once, saw ${peak}`);
  assert.ok(peak > 1, 'the reads do run concurrently');
});

test('one unreadable file lists without dimensions; the rest of the listing still comes back', async (t) => {
  const root = await project(t, { pin: false });
  clearArtCache();
  const realOpen = fs.open;
  // Every header read of one file fails, as an unreadable file would.
  fs.open = async (file, ...rest) => {
    if (String(file).replace(/\\/g, '/').endsWith('equipment/sword.png')) throw Object.assign(Error('EACCES: permission denied'), { code: 'EACCES' });
    return realOpen.call(fs, file, ...rest);
  };
  t.after(() => { fs.open = realOpen; });
  const list = await listArt(root);
  fs.open = realOpen;
  const sword = list.files.find((f) => f.path === 'assets-mobile/equipment/sword.png');
  assert.ok(sword, 'the unreadable file is still listed');
  assert.equal(sword.w, undefined, 'with no dimensions');
  assert.equal(sword.h, undefined);
  assert.equal(list.files.find((f) => f.path === 'assets-mobile/poses/idle.webp').w, 640, 'the other files keep their dimensions');
  assert.ok(list.files.length >= 5, 'the listing is not rejected');
});

test('a symlinked pack folder is refused: nothing is listed or served from it', async (t) => {
  const root = await project(t);
  const outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'assets-outside-')));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.mkdir(path.join(outside, 'assets/sprites'), { recursive: true });
  await fs.writeFile(path.join(outside, 'assets/sprites/linked.webp'), webpVp8x(7, 7));
  // The common pack folder is a link to a folder outside the project.
  await fs.mkdir(path.join(root, '.art-cache/hd-assets-v19'), { recursive: true });
  await fs.symlink(outside, path.join(root, '.art-cache/hd-assets-v19/common'), 'dir');
  clearArtCache();
  const packs = await packsOf(root, await pinOf(root));
  assert.equal(packs.find((p) => p.id === 'common').fetched, false, 'a linked pack is not fetched');
  assert.equal(packs.find((p) => p.id === 'common').dir, null, 'and has no folder to read');
  const list = await listArt(root);
  assert.ok(!list.files.some((f) => f.path.includes('linked')), 'its files are not listed');
  assert.equal(await resolveArt(root, 'assets/sprites/linked.webp'), null, 'nor served');
  // The cache folder itself linked: every pack under it is refused.
  await fs.rm(path.join(root, '.art-cache'), { recursive: true, force: true });
  await fs.mkdir(path.join(outside, 'hd-assets-v19/high/assets/sprites'), { recursive: true });
  await fs.writeFile(path.join(outside, 'hd-assets-v19/high/assets/sprites/linked.webp'), webpVp8x(7, 7));
  await fs.symlink(outside, path.join(root, '.art-cache'), 'dir');
  clearArtCache();
  assert.equal(await resolveArt(root, 'assets/sprites/linked.webp'), null, 'a linked cache folder serves nothing');
  assert.ok(!(await listArt(root)).files.some((f) => f.path.includes('linked')), 'nor lists anything');
});

test('a pin tag of . or .. is rejected, so the pack folder cannot leave the cache', async (t) => {
  const root = await project(t, { pin: false });
  for (const tag of ['..', '.', '../x']) {
    await fs.writeFile(path.join(root, 'art-release.json'), JSON.stringify({ schema: 2, tag, packs: {} }));
    assert.equal(await pinOf(root), null, `tag ${JSON.stringify(tag)} is refused`);
  }
  await fs.writeFile(path.join(root, 'art-release.json'), JSON.stringify({ schema: 2, tag: 'hd-assets-v19..x', packs: {} }));
  assert.equal((await pinOf(root)).tag, 'hd-assets-v19..x', 'a tag that merely contains dots is fine');
});
