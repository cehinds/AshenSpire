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
import { buildManifest, checkManifest, serialize, MANIFEST_PATH, dimensions, isCommonEntry, SCHEMA, LICENSE_ID } from '../tools/art-manifest.mjs';

test('art-manifest.json matches assets/, assets-mobile/ and the common sources', () => {
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
  assert.deepEqual(dimensions(Buffer.from('<!DOCTYPE svg [<!-- ] > --><?pi ] > ?>]><svg viewBox="0 0 40 20"/>'), '.svg'), { width: 40, height: 20 }, 'comments and PIs inside the subset are skipped whole');
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

test('every image id in the real manifest records a pixel size in both tiers (common ids have one record)', () => {
  const m = JSON.parse(readFileSync(new URL(`../${MANIFEST_PATH}`, import.meta.url), 'utf8'));
  const missing = Object.entries(m.assets)
    .filter(([id, e]) => /\.(webp|png|gif|jpe?g|svg)$/i.test(id) && !isCommonEntry(e))
    .filter(([, e]) => !(e.high?.width > 0 && e.light?.width > 0))
    .map(([id]) => id);
  assert.deepEqual(missing, []);
});

// SCHEMA 2 (docs/EXTERNAL-ASSETS-PLAN.md §2): the fonts, the licence, the score
// and the map tiles are `common` ids — one {path, bytes, sha256} record each.
const commonBase = {
  ...base,
  'assets/fonts/f-400-normal.woff2': Buffer.from('wOF2-face'),
  'assets-mobile/fonts/f-400-normal.woff2': Buffer.from('wOF2-face'),
  'asset-data/fonts/OFL.txt': 'SIL OPEN FONT LICENSE\r\nVersion 1.1\r\n',
  'music/manifest.json': '{"tracks":[]}\n',
  'music/title/title.mp3': Buffer.from('ID3-title'),
  'music/score/title.mjs': 'authoring source, not shipped\n',
  'map-detail/abc/256/0-0.webp': webp(256, 256),
};

test('schema 2: fonts, the licence, music and map tiles are common records; art keeps light and high', () => {
  withManifest(commonBase, (root) => {
    const m = buildManifest(root);
    assert.equal(m.schema, 2);
    assert.equal(SCHEMA, 2);
    assert.ok(m.tiers.common);
    assert.deepEqual(Object.keys(m.assets).sort(), ['assets/bg/a.webp', 'assets/fonts/f-400-normal.woff2', LICENSE_ID, 'map-detail/abc/256/0-0.webp', 'music/manifest.json', 'music/title/title.mp3']);
    assert.equal(m.count, 6);
    for (const id of ['assets/fonts/f-400-normal.woff2', LICENSE_ID, 'music/manifest.json', 'music/title/title.mp3', 'map-detail/abc/256/0-0.webp']) {
      assert.deepEqual(Object.keys(m.assets[id]), ['common'], `${id} has one common record`);
      assert.deepEqual(Object.keys(m.assets[id].common), ['path', 'bytes', 'sha256']);
    }
    assert.equal(m.assets[LICENSE_ID].common.path, 'licenses/OFL.txt', 'the licence sits at its pack path');
    assert.equal(m.assets[LICENSE_ID].common.bytes, 'SIL OPEN FONT LICENSE\nVersion 1.1\n'.length, 'text hashes by its LF form');
    assert.ok(m.assets['assets/bg/a.webp'].light && m.assets['assets/bg/a.webp'].high);
    assert.deepEqual(checkManifest(root), []);
  });
});

test('known-bad: a light font twin that differs from the common record is caught', () => {
  withManifest(commonBase, (root) => {
    writeFileSync(join(root, 'assets-mobile/fonts/f-400-normal.woff2'), 'other');
    assert.match(checkManifest(root).join('\n'), /f-400-normal\.woff2: the assets-mobile\/ copy differs/);
  });
});

test('known-bad: a changed track or a new tile without a regenerated manifest is caught', () => {
  withManifest(commonBase, (root) => {
    writeFileSync(join(root, 'music/title/title.mp3'), 'ID3-retake');
    mkdirSync(join(root, 'map-detail/abc/256'), { recursive: true });
    writeFileSync(join(root, 'map-detail/abc/256/1-0.webp'), webp(256, 256, 3));
    const problems = checkManifest(root).join('\n');
    assert.match(problems, /music\/title\/title\.mp3: the common file changed/);
    assert.match(problems, /map-detail\/abc\/256\/1-0\.webp: in the common sources but not in the manifest/);
  });
});
