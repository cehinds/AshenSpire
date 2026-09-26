// tests/art-manifest.test.mjs — the art manifest is current, and its check can fail.
//
// art-manifest.json (tools/art-manifest.mjs) lists every asset id with
// the file each tier ships. The first test is the gate on the real tree; the
// rest plant known-bads into a throwaway tree and require the named failure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildManifest, checkManifest, serialize, MANIFEST_PATH, dimensions } from '../tools/art-manifest.mjs';

test('art-manifest.json matches assets/ and assets-mobile/', () => {
  const problems = checkManifest();
  assert.deepEqual(problems, [], `run node tools/art-manifest.mjs --write:\n${problems.slice(0, 10).join('\n')}`);
});

// A minimal VP8L WebP header: RIFF, WEBP, VP8L chunk, signature 0x2f, then
// 14-bit width-1 and height-1. Enough for webpDimensions to read a size.
function webp(width, height, salt = 0) {
  const buf = Buffer.alloc(40);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(32, 4); buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii'); buf.writeUInt32LE(20, 16); buf[20] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  buf.writeUInt32LE(bits >>> 0, 21);
  buf[39] = salt;
  return buf;
}

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'art-manifest-'));
  for (const [rel, bytes] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), bytes);
  }
  return root;
}

function withManifest(files, fn) {
  const root = tree(files);
  try {
    writeFileSync(join(root, MANIFEST_PATH), serialize(buildManifest(root)));
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const base = {
  'assets/bg/a.webp': webp(1536, 1024),
  'assets-mobile/bg/a.webp': webp(614, 410),
};

test('a fresh manifest records both tiers with path, bytes, sha256 and size', () => {
  withManifest(base, (root) => {
    const m = buildManifest(root);
    assert.equal(m.count, 1);
    const entry = m.assets['assets/bg/a.webp'];
    assert.equal(entry.high.path, 'assets/bg/a.webp');
    assert.equal(entry.light.path, 'assets-mobile/bg/a.webp');
    assert.equal(entry.high.width, 1536);
    assert.equal(entry.light.height, 410);
    assert.match(entry.high.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(checkManifest(root), []);
  });
});

test('known-bad: a re-encoded light twin without a regenerated manifest is caught', () => {
  withManifest(base, (root) => {
    writeFileSync(join(root, 'assets-mobile/bg/a.webp'), webp(614, 410, 7));
    assert.match(checkManifest(root).join('\n'), /the light file changed/);
  });
});

test('known-bad: a new asset missing from the manifest is caught', () => {
  withManifest(base, (root) => {
    mkdirSync(join(root, 'assets/ui'), { recursive: true });
    writeFileSync(join(root, 'assets/ui/b.webp'), webp(64, 64));
    assert.match(checkManifest(root).join('\n'), /assets\/ui\/b\.webp: in assets\/ but not in the manifest/);
  });
});

test('known-bad: an asset with no light twin is caught, not skipped', () => {
  withManifest({ ...base, 'assets/ui/c.webp': webp(32, 32) }, (root) => {
    assert.match(checkManifest(root).join('\n'), /assets\/ui\/c\.webp: no light file/);
  });
});

test('known-bad: a deleted asset still listed is caught', () => {
  withManifest(base, (root) => {
    rmSync(join(root, 'assets/bg/a.webp'));
    assert.match(checkManifest(root).join('\n'), /in the manifest but not in assets\//);
  });
});

test('known-bad: a hand-edited pixel size is caught, not only a changed file', () => {
  withManifest(base, (root) => {
    const p = join(root, MANIFEST_PATH);
    writeFileSync(p, readFileSync(p, 'utf8').replace('"width":1536', '"width":2048'));
    assert.match(checkManifest(root).join('\n'), /differs from what --write produces/);
  });
});

test('an SVG hashes the same from an LF and a CRLF checkout', () => {
  const svgLf = '<svg width="4" height="4">\n<rect/>\n</svg>\n';
  const lf = tree({ 'assets/ui/i.svg': svgLf, 'assets-mobile/ui/i.svg': svgLf });
  const crlf = tree({ 'assets/ui/i.svg': svgLf.replace(/\n/g, '\r\n'), 'assets-mobile/ui/i.svg': svgLf.replace(/\n/g, '\r\n') });
  try {
    assert.deepEqual(buildManifest(crlf).assets, buildManifest(lf).assets);
  } finally {
    rmSync(lf, { recursive: true, force: true });
    rmSync(crlf, { recursive: true, force: true });
  }
});

test('authoring-only equipment components are not assets', () => {
  withManifest({ ...base, 'assets/equipment/components/x.webp': webp(8, 8) }, (root) => {
    assert.equal(buildManifest(root).count, 1);
  });
});

test('dimensions reads webp, png, gif, jpeg and svg sizes (svg by viewBox too) and declines what it cannot read', () => {
  assert.deepEqual(dimensions(webp(512, 256), '.webp'), { width: 512, height: 256 });
  const png = Buffer.alloc(24); png.write('IHDR', 12, 'ascii'); png.writeUInt32BE(10, 16); png.writeUInt32BE(20, 20);
  assert.deepEqual(dimensions(png, '.png'), { width: 10, height: 20 });
  assert.deepEqual(dimensions(Buffer.from('<svg width="24" height="12"></svg>'), '.svg'), { width: 24, height: 12 });
  assert.deepEqual(dimensions(Buffer.from('<svg xmlns="x" viewBox="0 0 32 16"></svg>'), '.svg'), { width: 32, height: 16 });
  assert.deepEqual(dimensions(Buffer.from('<svg width="100%" viewBox="0,0,8,4"></svg>'), '.svg'), { width: 8, height: 4 });
  const prolog = `<?xml version="1.0"?>\n<!-- ${'x'.repeat(5000)} <svg width="1" height="1"> -->\n`;
  assert.deepEqual(dimensions(Buffer.from(`${prolog}<svg viewBox="0 0 40 20"></svg>`), '.svg'), { width: 40, height: 20 }, 'root found past a 5 KB prolog, not inside a comment');
  // Markup-like text inside a processing instruction or a DOCTYPE subset is not the root.
  assert.deepEqual(dimensions(Buffer.from('<?xml version="1.0"?><?pi <svg width="1" height="1">?>\n<!DOCTYPE svg [ <!ENTITY e "<svg width=\'2\' height=\'2\'>"> ]>\n<svg viewBox="0 0 40 20"></svg>'), '.svg'), { width: 40, height: 20 });
  assert.equal(dimensions(Buffer.from('<?xml version="1.0"?><g/>'), '.svg'), null, 'a document whose root is not <svg> has no size');
  // TEM (FF 01) and a restart marker before SOF carry no length and are stepped over.
  const tem = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x09, 0x00, 0x0b, 0x03, 0x00, 0x00]);
  assert.deepEqual(dimensions(tem, '.jpg'), { width: 11, height: 9 });
  const gif = Buffer.alloc(13); gif.write('GIF89a', 0, 'ascii'); gif.writeUInt16LE(7, 6); gif.writeUInt16LE(5, 8);
  assert.deepEqual(dimensions(gif, '.gif'), { width: 7, height: 5 });
  // SOI, an APP0 segment of length 4, then SOF0: length, precision, height 9, width 11.
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x09, 0x00, 0x0b, 0x03]);
  assert.deepEqual(dimensions(jpg, '.jpg'), { width: 11, height: 9 });
  // The same file with 0xFF fill bytes before each marker.
  const filled = Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x09, 0x00, 0x0b, 0x03]);
  assert.deepEqual(dimensions(filled, '.jpg'), { width: 11, height: 9 });
  assert.equal(dimensions(Buffer.from('wOF2'), '.woff2'), null);
});

test('every image id in the real manifest records a pixel size in both tiers', () => {
  const m = JSON.parse(readFileSync(new URL(`../${MANIFEST_PATH}`, import.meta.url), 'utf8'));
  const missing = Object.entries(m.assets)
    .filter(([id]) => /\.(webp|png|gif|jpe?g|svg)$/i.test(id))
    .filter(([, e]) => !(e.high?.width > 0 && e.light?.width > 0))
    .map(([id]) => id);
  assert.deepEqual(missing, []);
});
