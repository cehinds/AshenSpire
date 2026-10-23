import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const sharp = createRequire(import.meta.url)('sharp');
const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));
assert.equal(manifest.assets.length, 24);
assert.equal(new Set(manifest.assets.map(asset => asset.id)).size, 24);
assert.deepEqual(manifest.canvas, {width: 512, height: 512, background: 'transparent'});
const referencedFiles = new Set();
for (const asset of manifest.assets) {
  assert.match(asset.id, /^[a-z]+(?:-[a-z]+)*$/);
  assert.equal(asset.placeholder, true);
  assert.equal(asset.status, 'wireframe-placeholder');
  assert.equal(asset.pngAssetId, null);
  assert.ok(asset.tags.length > 0);
  assert.equal(new Set(asset.tags).size, asset.tags.length);
  for (const key of ['x', 'y']) assert.ok(asset.anchor[key] >= 0 && asset.anchor[key] <= 1);
  const f = asset.footprint;
  assert.equal(f.shape, 'rectangle');
  assert.ok(f.x >= 0 && f.y >= 0 && f.width > 0 && f.height > 0);
  assert.ok(f.x + f.width <= 1 && f.y + f.height <= 1);
  for (const extension of ['png', 'svg']) {
    assert.equal(asset[extension], `${asset.id}.${extension}`);
    referencedFiles.add(asset[extension]);
  }
  const meta = await sharp(root + asset.png).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.hasAlpha, true);
  const {data, info} = await sharp(root + asset.png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let transparent = 0, visible = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * info.channels + info.channels - 1];
      if (alpha === 0) transparent++;
      else visible++;
      if (x === 0 || y === 0 || x === 511 || y === 511) assert.equal(alpha, 0, `${asset.id}: clipped edge`);
    }
  }
  assert.ok(transparent > 0 && visible > 0, `${asset.id}: empty or opaque canvas`);
  const svg = readFileSync(root + asset.svg, 'utf8');
  assert.match(svg, /width="512" height="512" viewBox="0 0 512 512"/);
  assert.ok(!/<image\b|<script\b/.test(svg));
  const raster = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  assert.ok(data.equals(raster), `${asset.id}: SVG and PNG differ`);
}
for (const file of readdirSync(root).filter(file => /\.(png|svg)$/.test(file))) {
  assert.ok(referencedFiles.has(file), `Unlisted asset: ${file}`);
}
for (const file of [manifest.source, manifest.metadataSource]) readFileSync(root + file);
console.log('Validated 24 prop examples: 48 file references, 512px RGBA PNGs, transparent edges, SVG parity and placement metadata.');
