// Original procedural vector illustrations. Chromium rasterizes SVG to PNG.
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const sharp = require('sharp'); // Decode exported PNGs for numerical QA only.
const out = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(out, {recursive: true});
const size = 1024, period = 256;
const hash = value => createHash('sha256').update(value).digest('hex');
const n = value => Number(value.toFixed(3));
function random(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const definitions = [
  {id: 'rain', seed: 47217, count: 22, speed: {x: 64, y: 256}, loopSeconds: 4, opacity: 0.45, direction: 'down-right', description: 'Sparse pale blue-gray diagonal strokes, varied length and opacity.'},
  {id: 'snow', seed: 66379, count: 14, speed: {x: 8, y: 32}, loopSeconds: 32, opacity: 0.65, direction: 'down-right', description: 'Sparse soft round pale flakes, varied radius and opacity.'},
  {id: 'ash', seed: 19031, count: 16, speed: {x: -16, y: -8}, loopSeconds: 32, opacity: 0.5, direction: 'up-left', description: 'Sparse dark gray and pale gray irregular flecks, varied size and opacity.'},
];
function makeSVG(definition) {
  const rng = random(definition.seed), particles = [];
  for (let i = 0; i < definition.count; i++) {
    // First particle deliberately crosses a repeat boundary in every asset.
    const x = i === 0 ? 255 : n(rng() * period);
    const y = i === 0 ? 254 : n(rng() * period);
    let primitive;
    if (definition.id === 'rain') {
      const dy = n(12 + rng() * 18), dx = n(dy / 4);
      primitive = `<path d="M0 0l${dx} ${dy}" fill="none" stroke="#b8c8d0" stroke-width="${n(0.65 + rng() * 0.65)}" stroke-linecap="round" opacity="${n(0.18 + rng() * 0.35)}"/>`;
    } else if (definition.id === 'snow') {
      primitive = `<circle r="${n(0.9 + rng() * 1.9)}" fill="#e0e5e6" opacity="${n(0.23 + rng() * 0.4)}" filter="url(#soft)"/>`;
    } else {
      const w = n(0.65 + rng() * 1.2), h = n(1 + rng() * 2.3);
      const color = i % 3 === 0 ? '#c1c5c5' : '#596267';
      primitive = `<path d="M${-w} 0L0 ${-h}L${w} ${n(h * 0.45)}L${n(-w * 0.4)} ${h}Z" fill="${color}" opacity="${n(0.2 + rng() * 0.36)}" transform="rotate(${n(-35 + rng() * 70)})"/>`;
    }
    // Toroidal wrapping: include all nine neighbor copies before pattern clipping.
    const copies = [];
    for (const dx of [-period, 0, period]) for (const dy of [-period, 0, period]) {
      copies.push(`<g transform="translate(${n(x + dx)} ${n(y + dy)})">${primitive}</g>`);
    }
    particles.push(`<g id="particle-${i + 1}">${copies.join('')}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="title description">
<title id="title">${definition.id} seamless particle overlay</title>
<desc id="description">Original sparse vector particle illustration. Transparent; ${period}px repeat period in both axes. No terrain or lighting background.</desc>
<defs>
<filter id="soft" x="-200%" y="-200%" width="500%" height="500%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.38"/></filter>
<pattern id="particles" width="${period}" height="${period}" patternUnits="userSpaceOnUse" overflow="hidden">
${particles.join('\n')}
</pattern>
</defs>
<rect width="${size}" height="${size}" fill="url(#particles)"/>
</svg>\n`;
}
const browser = await chromium.launch({executablePath: process.env.PARTICLE_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 800}, deviceScaleFactor: 1});
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
  const rasterize = svg => page.evaluate(async ({svg, size}) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, {svg, size});
  const previewImages = [];
  for (const definition of definitions) {
    const svg = makeSVG(definition);
    writeFileSync(out + definition.id + '.svg', svg);
    const png = Buffer.from(await rasterize(svg), 'base64');
    writeFileSync(out + definition.id + '.png', png);
    const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    assert.equal(info.width, size); assert.equal(info.height, size); assert.equal(info.channels, 4);
    let transparent = 0, visible = 0, minAlpha = 255, maxAlpha = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const alpha = data[i + 3];
      if (alpha === 0) transparent++; else visible++;
      minAlpha = Math.min(minAlpha, alpha); maxAlpha = Math.max(maxAlpha, alpha);
      // Exact full RGBA period comparison, including all seam antialiasing.
      for (let c = 0; c < 4; c++) {
        if (x + period < size) assert.equal(data[i + c], data[(y * size + x + period) * 4 + c], `${definition.id}: horizontal periodicity`);
        if (y + period < size) assert.equal(data[i + c], data[((y + period) * size + x) * 4 + c], `${definition.id}: vertical periodicity`);
      }
    }
    assert.ok(transparent > 0 && visible > 0 && maxAlpha < 255);
    // Compare boundary-adjacent edge strips to an internal 256px join.
    // Opposite first/last pixels need not equal: they are adjacent samples.
    for (let v = 0; v < size; v++) for (let c = 0; c < 4; c++) {
      assert.equal(data[(v * size + size - 1) * 4 + c], data[(v * size + period - 1) * 4 + c]);
      assert.equal(data[(v * size) * 4 + c], data[(v * size + period) * 4 + c]);
      assert.equal(data[((size - 1) * size + v) * 4 + c], data[((period - 1) * size + v) * 4 + c]);
      assert.equal(data[v * 4 + c], data[(period * size + v) * 4 + c]);
    }
    const shifted = svg.replace('patternUnits="userSpaceOnUse"', `patternUnits="userSpaceOnUse" patternTransform="translate(${period} ${period})"`);
    const shiftedData = await sharp(Buffer.from(await rasterize(shifted), 'base64')).ensureAlpha().raw().toBuffer();
    assert.ok(data.equals(shiftedData), `${definition.id}: full-period translation mismatch`);
    const provenance = {
      formatVersion: 1, id: `atmosphere.particles.${definition.id}.draft.v1`, status: 'draft',
      origin: 'original-vector-illustration', generator: 'render.mjs deterministic SVG geometry; Chromium Canvas 2D PNG rasterization',
      description: definition.description, source: definition.id + '.svg', png: definition.id + '.png',
      dimensions: {width: size, height: size}, mode: 'RGBA', transparentBackground: true,
      patternPeriod: {x: period, y: period, units: 'source-pixels'}, seed: definition.seed, particlesPerPeriod: definition.count,
      boundaryWrapping: 'Each particle has all nine toroidal neighbor copies, clipped inside a repeating 256px SVG pattern. Snow blur is applied before tile clipping.',
      recommendedMotion: {direction: definition.direction, velocityPixelsPerSecond: definition.speed, loopSeconds: definition.loopSeconds, layerOpacity: definition.opacity, coordinateSystem: 'screen x-right, y-down; source pixels at 1:1 display scale', note: 'Move texture in this direction; reduce speed proportionally when scaling the texture. One loop translates by integer multiples of both repeat periods.'},
      sha256: hash(png), svgSHA256: hash(svg), browserVersion: browser.version(),
      alpha: {min: minAlpha, max: maxAlpha, transparentPixels: transparent, visiblePixels: visible, visibleFraction: visible / (size * size)},
      validation: {exactRGBAPeriodAcrossAllPixels: true, outerEdgePairsMatchInternalJoin: true, exactRGBAAfterFullPeriodTranslation: true, width: size, height: size},
      provenance: {imageGenerationServiceUsed: false, existingImageEdited: false, sourceImages: [], process: 'Simple original seeded strokes, circles and polygon flecks; no terrain or background pixels are painted.'},
      productionRegistered: false, limitations: ['Draft particle density, opacity and speeds need motion review in the actual scene.', 'Pattern repeats every 256 pixels; the small repeat unit can become visible at high opacity.', 'These files contain particle art only. No runtime animation, weather logic, terrain, fog or gameplay changes are included.'],
    };
    writeFileSync(out + definition.id + '.provenance.json', JSON.stringify(provenance, null, 2) + '\n');
    previewImages.push({id: definition.id, data: png.toString('base64')});
    console.log(`${definition.id}: 1024x1024 RGBA; 256px exact period; alpha ${minAlpha}..${maxAlpha}; ${visible} visible pixels; edge and translation checks passed.`);
  }
  const preview = await page.evaluate(async assets => {
    const canvas = document.createElement('canvas'); canvas.width = 1060; canvas.height = 1164;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#182327'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#e5e7e5'; ctx.fillText('Particle overlay QA · dark and light backgrounds', 24, 37);
    for (let i = 0; i < assets.length; i++) {
      const img = new Image(); img.src = 'data:image/png;base64,' + assets[i].data; await img.decode();
      const y = 68 + i * 360;
      ctx.fillStyle = '#e5e7e5'; ctx.font = '20px sans-serif'; ctx.fillText(assets[i].id + ' · 1:1 crop · 256px repeat', 24, y + 22);
      for (let j = 0; j < 2; j++) {
        const x = 24 + j * 516;
        ctx.fillStyle = j === 0 ? '#26363c' : '#e6e5df'; ctx.fillRect(x, y + 38, 488, 288);
        ctx.drawImage(img, 0, 0, 488, 288, x, y + 38, 488, 288);
      }
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, previewImages);
  writeFileSync(out + 'qa-preview.png', Buffer.from(preview, 'base64'));
} finally { await browser.close(); }
