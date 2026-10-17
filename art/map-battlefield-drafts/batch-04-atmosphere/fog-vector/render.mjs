// Original oversized vector fog illustration; Chromium creates the native PNG.
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const sharp = require('sharp'); // PNG decode / alpha measurements only.
const root = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(root, {recursive: true});
const size = 4096, seed = 917231;
let state = seed;
const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
const n = value => Number(value.toFixed(3));
const hash = value => createHash('sha256').update(value).digest('hex');
const wisps = [];
const addWisp = (x, y, rx, ry, angle, opacity) => wisps.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" transform="rotate(${n(angle)} ${n(x)} ${n(y)})" fill="url(#wisp)" opacity="${n(opacity)}"/>`);
// Soft edge masses. Each is broad and blurred; no opaque cloud silhouette.
for (let i = 0; i < 16; i++) {
  const side = i % 4, along = 250 + random() * 3596;
  const near = 400 + random() * 380;
  const x = side === 0 ? near : side === 1 ? size - near : along;
  const y = side === 2 ? near : side === 3 ? size - near : along;
  addWisp(x, y, 800 + random() * 650, 270 + random() * 300, -45 + random() * 90, 0.6 + random() * 0.2);
}
// Central variation survives portrait, 16:9 and ultrawide center crops.
for (let i = 0; i < 10; i++) {
  addWisp(850 + random() * 2396, 900 + random() * 2296, 650 + random() * 700, 210 + random() * 330, -35 + random() * 70, 0.32 + random() * 0.28);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096" viewBox="0 0 4096 4096" role="img" aria-labelledby="title description">
<title id="title">Oversized neutral fog field · original vector draft</title>
<desc id="description">4096px transparent diffuse wisps with central texture and stronger peripheral variation. Non-tileable; use bounded oscillation over a viewport with maximum edge 2048px.</desc>
<defs>
<radialGradient id="wisp"><stop offset="0" stop-color="#bdc5c8" stop-opacity="0.8"/><stop offset="0.32" stop-color="#bdc5c8" stop-opacity="0.56"/><stop offset="0.65" stop-color="#bdc5c8" stop-opacity="0.2"/><stop offset="1" stop-color="#bdc5c8" stop-opacity="0"/></radialGradient>
<radialGradient id="haze"><stop offset="0" stop-color="#bdc5c8" stop-opacity="0.13"/><stop offset="0.75" stop-color="#bdc5c8" stop-opacity="0.1"/><stop offset="1" stop-color="#bdc5c8" stop-opacity="0"/></radialGradient>
<linearGradient id="edgeX"><stop offset="0" stop-color="black"/><stop offset="0.1" stop-color="white"/><stop offset="0.9" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
<linearGradient id="edgeY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black"/><stop offset="0.1" stop-color="white"/><stop offset="0.9" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
<mask id="fadeX" maskUnits="userSpaceOnUse" x="0" y="0" width="4096" height="4096"><rect width="4096" height="4096" fill="url(#edgeX)"/></mask>
<mask id="fadeY" maskUnits="userSpaceOnUse" x="0" y="0" width="4096" height="4096"><rect width="4096" height="4096" fill="url(#edgeY)"/></mask>
<filter id="diffuse" x="-50%" y="-100%" width="200%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="125"/></filter>
</defs>
<g mask="url(#fadeX)"><g mask="url(#fadeY)"><g opacity="0.28">
<ellipse cx="2048" cy="2048" rx="2700" ry="2700" fill="url(#haze)"/>
<g filter="url(#diffuse)">
${wisps.join('\n')}
</g>
</g></g></g>
</svg>\n`;
writeFileSync(root + 'fog-overscan-neutral.svg', svg);
const browser = await chromium.launch({executablePath: process.env.PARTICLE_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}, deviceScaleFactor: 1});
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
  const png64 = await page.evaluate(async svg => {
    const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4096;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, svg);
  const png = Buffer.from(png64, 'base64');
  writeFileSync(root + 'fog-overscan-neutral.png', png);
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  assert.equal(info.width, size); assert.equal(info.height, size); assert.equal(info.channels, 4);
  let min = 255, max = 0, total = 0, visible = 0;
  for (let i = 3; i < data.length; i += 4) { const a = data[i]; min = Math.min(min, a); max = Math.max(max, a); total += a; if (a) visible++; }
  assert.equal(min, 0); assert.ok(max >= 46 && max <= 72, `Expected max alpha 0.18..0.28; got ${max}/255`);
  let boundaryMax = 0;
  for (let i = 0; i < size; i++) {
    boundaryMax = Math.max(boundaryMax, data[i * 4 + 3], data[((size - 1) * size + i) * 4 + 3], data[(i * size) * 4 + 3], data[(i * size + size - 1) * 4 + 3]);
  }
  assert.equal(boundaryMax, 0, 'Outer alpha must fade completely to zero');
  const viewports = [{id: 'portrait', width: 1152, height: 2048}, {id: 'widescreen', width: 2048, height: 1152}, {id: 'ultrawide', width: 2048, height: 878}];
  const crops = [];
  for (const view of viewports) for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) {
    const x = Math.round((size - view.width) / 2 + sx * view.width * 0.2), y = Math.round((size - view.height) / 2 + sy * view.height * 0.2);
    assert.ok(x >= 0 && y >= 0 && x + view.width <= size && y + view.height <= size);
    let cropMin = 255, cropMax = 0, cropTotal = 0;
    for (let cy = y; cy < y + view.height; cy++) for (let cx = x; cx < x + view.width; cx++) {
      const alpha = data[(cy * size + cx) * 4 + 3]; cropMin = Math.min(cropMin, alpha); cropMax = Math.max(cropMax, alpha); cropTotal += alpha;
    }
    assert.ok(cropMin > 0 && cropMax - cropMin >= 8, `${view.id}: no continuous coverage or variation`);
    crops.push({viewport: view.id, offsetFraction: {x: sx * 0.2, y: sy * 0.2}, sourceCrop: {x, y, width: view.width, height: view.height}, alpha: {min: cropMin, max: cropMax, mean: cropTotal / (view.width * view.height)}});
  }
  const provenance = {
    formatVersion: 1, id: 'atmosphere.fog.overscan-neutral.draft.v1', status: 'draft',
    origin: 'original-vector-illustration', source: 'fog-overscan-neutral.svg', png: 'fog-overscan-neutral.png', generator: 'render.mjs seeded gradients and blurred ellipses; Chromium Canvas 2D native PNG rasterization',
    dimensions: {width: size, height: size}, mode: 'RGBA', transparentBackground: true, seed, wispCount: wisps.length,
    tileable: false, patternPeriod: null,
    recommendedMotion: {kind: 'bounded-sine-oscillation', maxTranslationViewportFraction: {x: 0.2, y: 0.2}, examplePeriodsSeconds: {x: 34, y: 47}, neverModuloWrap: true},
    placement: {fieldDisplaySide: '2 * max(viewportWidth, viewportHeight)', centered: true, supportedNativeViewportMaxEdge: 2048, sourcePixelEdgeClearanceAtWorstCase: 614, note: 'One square field covers the viewport with a side twice its longest edge. Center it, then translate by at most 0.2 of each corresponding viewport dimension. Scale uniformly when max viewport edge differs from 2048.'},
    alpha: {min, max, maxNormalized: max / 255, mean: total / (size * size), visiblePixels: visible, visibleFraction: visible / (size * size), outerBoundaryMax: boundaryMax},
    validation: {nativeDimensions: true, transparentBoundary: true, testedCropCount: crops.length, allCropsInsideSource: true, allCropsHaveCoverageAndVariation: true, crops},
    provenance: {imageGenerationServiceUsed: false, existingImageEdited: false, sourceImages: [], process: '26 seeded broad elliptical radial gradients, diffuse vector blur and soft frame masks; SVG source is retained.'},
    sha256: hash(png), svgSHA256: hash(svg), browserVersion: browser.version(), productionRegistered: false,
    limitations: ['Non-tileable: use bounded oscillation; never repeat or wrap this field.', 'Draft opacity and motion require actual scene review. Apply additional layer opacity if needed.', 'No terrain, particles, runtime weather logic or generated-fog edits are included.'],
  };
  writeFileSync(root + 'fog-overscan-neutral.provenance.json', JSON.stringify(provenance, null, 2) + '\n');
  const qa = await page.evaluate(async ({png64, viewports}) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png64; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 1060;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#182327'; ctx.fillRect(0, 0, 1280, 1060);
    ctx.fillStyle = '#e3e7e6'; ctx.font = '24px sans-serif'; ctx.fillText('4096px fog · portrait / widescreen / ultrawide crops', 24, 38);
    ctx.font = '16px sans-serif'; ctx.fillText('Left: centered on dark · Right: extreme +0.2 viewport shift on light · Actual fog alpha', 24, 68);
    viewports.forEach((view, i) => {
      const y = 102 + i * 314;
      ctx.fillStyle = '#e3e7e6'; ctx.fillText(view.id, 24, y + 18);
      for (let j = 0; j < 2; j++) {
        const x = 24 + j * 628, w = 600, h = 260;
        const scale = Math.min(w / view.width, h / view.height), dw = view.width * scale, dh = view.height * scale;
        const px = x + (w - dw) / 2, py = y + 32 + (h - dh) / 2;
        ctx.fillStyle = '#202b2f'; ctx.fillRect(x, y + 32, w, h);
        ctx.fillStyle = j === 0 ? '#25382e' : '#b9bbb2'; ctx.fillRect(px, py, dw, dh);
        ctx.save(); ctx.beginPath(); ctx.rect(px, py, dw, dh); ctx.clip();
        ctx.strokeStyle = j === 0 ? '#192b24' : '#8f958c'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(px, py + dh * 0.5); ctx.bezierCurveTo(px + dw * 0.3, py + dh * 0.15, px + dw * 0.6, py + dh * 0.88, px + dw, py + dh * 0.43); ctx.stroke();
        const cx = (4096 - view.width) / 2 + (j ? view.width * 0.2 : 0), cy = (4096 - view.height) / 2 + (j ? view.height * 0.2 : 0);
        // Preserve crop aspect ratio, letterbox with the same background.
        ctx.drawImage(img, cx, cy, view.width, view.height, px, py, dw, dh);
        ctx.restore();
      }
    });
    return canvas.toDataURL('image/png').split(',')[1];
  }, {png64, viewports});
  writeFileSync(root + 'qa-crops.png', Buffer.from(qa, 'base64'));
  console.log(JSON.stringify({dimensions: [size, size], maxAlpha: max, maxAlphaNormalized: max / 255, boundaryMax, cropChecksPassed: crops.length, sha256: hash(png)}));
} finally { await browser.close(); }
