#!/usr/bin/env node
// AS-HD-040 — look conformance checker.
//
// The owner's ruling (2026-09-02) is that of the four frozen crops only ROGUE
// carries the approved look; reaver, starseer and herald must be remodelled to
// match it. This turns "match the rogue look" into a measurable gate so a
// remodel can be checked instead of eyeballed.
//
// Reference envelope is measured from the pinned rogue blob every run — it is
// never a copied constant, so it cannot drift away from the asset it describes.
//
// Usage:
//   node assets/classes/check-look-conformance.mjs                 # score all four
//   node assets/classes/check-look-conformance.mjs <file.png> ...  # score candidates

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const manifest = JSON.parse(readFileSync(join(here, 'successor-packet.manifest.json'), 'utf8'));
const PIN = manifest.evidence_pin.commit;
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const OPAQUE = 200; // score the figure body, not its soft antialiased rim

function decodePng(bytes) {
  let pos = 8;
  let width, height, depth, colorType;
  const idat = [];
  while (pos < bytes.length) {
    const len = bytes.readUInt32BE(pos);
    const type = bytes.toString('ascii', pos + 4, pos + 8);
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
  const bpp = CHANNELS[colorType];
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  if (bpp < 4) throw new Error(`no alpha channel (colour type ${colorType})`);
  return { width, height, bpp, px: out };
}

function toHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: mx ? d / mx : 0, v: mx };
}

// The five traits that separate the approved look from the three rejected ones.
function profile(img) {
  const { width: w, height: h, bpp, px } = img;
  let n = 0, sat = 0, val = 0, gold = 0, rim = 0;
  const vb = new Array(10).fill(0);
  const hb = new Array(18).fill(0);
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp;
    if (px[o + 3] < OPAQUE) continue;
    const c = toHsv(px[o], px[o + 1], px[o + 2]);
    n++; sat += c.s; val += c.v;
    vb[Math.min(9, Math.floor(c.v * 10))]++;
    if (c.s > 0.35 && c.h >= 35 && c.h <= 60 && c.v > 0.45) gold++;
    if (c.s > 0.15 && c.h >= 200 && c.h < 220) rim++;
    if (c.s > 0.15) hb[Math.floor(c.h / 20) % 18]++;
  }
  if (!n) throw new Error('no opaque pixels to profile');
  const warmEarth = (hb[1] + hb[2] + hb[3]) / n; // 20-80 degrees
  return {
    n,
    mean_saturation: sat / n,
    mean_value: val / n,
    deep_shadow: (vb[0] + vb[1] + vb[2]) / n, // below v=0.3
    highlight: vb.slice(5).reduce((a, b) => a + b, 0) / n, // above v=0.5
    gold_fraction: gold / n,
    cool_rim_fraction: rim / n,
    warm_earth_fraction: warmEarth,
    hue_bands: hb.map((v) => v / n),
  };
}

function readBlob(oid) {
  return execFileSync('git', ['cat-file', 'blob', oid], {
    cwd: repo, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const crops = Object.fromEntries(manifest.successor_packet.crops.map((c) => [c.class, c]));
const REFERENCE = 'rogue';
const ref = profile(decodePng(readBlob(crops[REFERENCE].git_blob)));

// Tolerances are set so the reference passes every trait and the three the owner
// rejected each fail at least one. They encode the ruling, not a preference.
const TRAITS = [
  ['deep shadow (v<0.3)', 'deep_shadow', 0.12, (x) => `${(100 * x).toFixed(1)}%`],
  ['highlights (v>0.5)', 'highlight', 0.05, (x) => `${(100 * x).toFixed(1)}%`],
  ['mean value', 'mean_value', 0.05, (x) => x.toFixed(3)],
  ['warm earth hue 20-80°', 'warm_earth_fraction', 0.15, (x) => `${(100 * x).toFixed(1)}%`],
  ['gold accent restraint', 'gold_fraction', 0.010, (x) => `${(100 * x).toFixed(1)}%`],
  ['cool rim light 200-220°', 'cool_rim_fraction', 0.030, (x) => `${(100 * x).toFixed(1)}%`],
];

function score(name, prof) {
  const rows = [];
  let fails = 0;
  for (const [label, key, tol, fmt] of TRAITS) {
    const delta = Math.abs(prof[key] - ref[key]);
    const ok = delta <= tol;
    if (!ok) fails++;
    rows.push(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(24)} ${fmt(prof[key]).padStart(7)}`
      + `   ref ${fmt(ref[key]).padStart(7)}   Δ${fmt(delta)}`);
  }
  console.log(`\n${name}${name === REFERENCE ? '  (reference)' : ''}`);
  console.log(rows.join('\n'));
  console.log(`  => ${fails === 0 ? 'CONFORMS to the approved look' : `${fails} trait(s) off the approved look`}`);
  return fails;
}

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let total = 0;
if (targets.length) {
  for (const f of targets) total += score(basename(f), profile(decodePng(readFileSync(f))));
} else {
  console.log(`look conformance vs ${REFERENCE} at pin ${PIN}  (opaque alpha >= ${OPAQUE})`);
  for (const cls of ['rogue', 'reaver', 'starseer', 'herald']) {
    total += score(cls, profile(decodePng(readBlob(crops[cls].git_blob))));
  }
}
console.log(`\n${total === 0 ? 'ALL CONFORM' : `${total} trait failure(s) across ${targets.length || 4} asset(s)`}`);
process.exit(total === 0 ? 0 : 1);
