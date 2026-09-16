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
//   node assets/classes/check-look-conformance.mjs <file> ...      # score candidates
//   node assets/classes/check-look-conformance.mjs --selftest      # replay known attacks
//
// Candidates may be PNG or WEBP. WEBP is converted with dwebp/ffmpeg/magick if
// one is installed — the class renderer emits WEBP, so scoring its output
// directly has to work.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const manifest = JSON.parse(readFileSync(join(here, 'successor-packet.manifest.json'), 'utf8'));
const PIN = manifest.evidence_pin.commit;
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const OPAQUE = 200; // score the figure body, not its soft antialiased rim

// tools/sprites-blender.py emits WEBP, so the documented render-and-score command
// hands this WEBP bytes. decodePng is PNG-only and used to die on them with
// "unsupported bit depth undefined" — the gate was unusable against real
// pipeline output. Convert first, with whatever the machine has, and say
// exactly what to install when it has nothing.
const WEBP_CONVERTERS = [
  ['dwebp', (i, o) => [i, '-o', o]],
  ['ffmpeg', (i, o) => ['-v', 'error', '-y', '-i', i, o]],
  ['magick', (i, o) => [i, o]],
  ['convert', (i, o) => [i, o]],
];

function isWebp(b) {
  return b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF'
    && b.toString('ascii', 8, 12) === 'WEBP';
}

function webpToPng(bytes, label) {
  const dir = mkdtempSync(join(tmpdir(), 'lookconf-'));
  const src = join(dir, 'in.webp');
  const dst = join(dir, 'out.png');
  try {
    writeFileSync(src, bytes);
    for (const [tool, args] of WEBP_CONVERTERS) {
      const r = spawnSync(tool, args(src, dst), { stdio: 'ignore' });
      if (r.error || r.status !== 0) continue;
      try { return readFileSync(dst); } catch { /* tool lied about success */ }
    }
    throw new Error(
      `${label} is WEBP and no converter is available. This checker decodes PNG.\n`
      + `  Install one of: ${WEBP_CONVERTERS.map((c) => c[0]).join(', ')}\n`
      + `  or convert first:  dwebp ${label} -o candidate.png`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function decodeImage(bytes, label) {
  return decodePng(isWebp(bytes) ? webpToPng(bytes, label) : bytes);
}

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

// WHERE the colours sit, not just how many there are.
//
// Every trait above this point is a histogram, and a histogram cannot see a
// picture: shuffling the RGB among the opaque pixels while keeping the alpha
// mask preserves all seven of them *bit for bit* — Δ0.0 on every row — for an
// image that is visual noise. Two structural measures close that.
const EDGE_BAND_PX = 6;

function spatial(img) {
  const { width: w, height: h, bpp, px } = img;
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = px[i * bpp + 3] >= OPAQUE ? 1 : 0;

  // Local coherence: mean |Δvalue| between horizontally and vertically adjacent
  // opaque pixels. Rendered art is locally smooth; noise is not.
  let sumDelta = 0;
  let pairs = 0;
  const valueAt = (i) => Math.max(px[i * bpp], px[i * bpp + 1], px[i * bpp + 2]) / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!on[i]) continue;
      const v = valueAt(i);
      if (x + 1 < w && on[i + 1]) { sumDelta += Math.abs(v - valueAt(i + 1)); pairs++; }
      if (y + 1 < h && on[i + w]) { sumDelta += Math.abs(v - valueAt(i + w)); pairs++; }
    }
  }

  // Edge band: mask pixels within EDGE_BAND_PX of the silhouette boundary,
  // found by eroding the mask that many times.
  let eroded = on;
  for (let k = 0; k < EDGE_BAND_PX; k++) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        next[i] = eroded[i] && eroded[i - 1] && eroded[i + 1]
          && eroded[i - w] && eroded[i + w] ? 1 : 0;
      }
    }
    eroded = next;
  }

  let maskN = 0;
  let edgeN = 0;
  let rim = 0;
  let rimEdge = 0;
  for (let i = 0; i < w * h; i++) {
    if (!on[i]) continue;
    maskN++;
    const inEdge = !eroded[i];
    if (inEdge) edgeN++;
    const c = toHsv(px[i * bpp], px[i * bpp + 1], px[i * bpp + 2]);
    if (c.s > 0.15 && c.h >= 200 && c.h < 220) { rim++; if (inEdge) rimEdge++; }
  }

  // Rim light belongs on the silhouette edge. Enrichment normalises for figures
  // of different bulk: 1.0 means the rim hue is spread as though placed at
  // random, which is what a shuffle produces however much of it survives.
  const edgeShare = maskN ? edgeN / maskN : 0;
  const rimEdgeShare = rim ? rimEdge / rim : 0;
  return {
    neighbour_delta: pairs ? sumDelta / pairs : 0,
    rim_edge_enrichment: edgeShare ? rimEdgeShare / edgeShare : 0,
  };
}

// The traits that separate the approved look from the three rejected ones.
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
    ...spatial(img),
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
const ref = profile(decodeImage(readBlob(crops[REFERENCE].git_blob), REFERENCE));

// Tolerances are set so the reference passes every trait and the three the owner
// rejected each fail at least one. They encode the ruling, not a preference.
// Saturation is scored, not just measured. The approved look is high chroma held
// at LOW value, so value and hue alone do not pin it: desaturating every pixel
// toward its own grey preserves each value bucket and each hue bucket exactly,
// and a candidate at 0.205 mean saturation against the reference 0.565 — barely
// a third of the chroma, with every gold pixel gone — used to score ALL CONFORM.
// The bound is stated rather than tuned: a candidate may lose at most 20% of the
// reference's mean chroma, which at 0.565 is 0.113.
const CHROMA_LOSS_ALLOWED = 0.20;
// A trait may carry its own comparator instead of a symmetric tolerance. The
// structural rows are one-sided: they assert a floor or a ceiling on structure
// rather than a resemblance to the reference's exact number.
const NOISE_MULTIPLE_ALLOWED = 2.0; // local noise may not exceed 2x the reference's
const RIM_ENRICHMENT_FLOOR = 1.8;   // measured 2.0-5.3 across all four real assets
const TRAITS = [
  ['deep shadow (v<0.3)', 'deep_shadow', 0.12, (x) => `${(100 * x).toFixed(1)}%`],
  ['highlights (v>0.5)', 'highlight', 0.05, (x) => `${(100 * x).toFixed(1)}%`],
  ['mean value', 'mean_value', 0.05, (x) => x.toFixed(3)],
  ['mean saturation', 'mean_saturation', null, (x) => x.toFixed(3)],
  ['warm earth hue 20-80°', 'warm_earth_fraction', 0.15, (x) => `${(100 * x).toFixed(1)}%`],
  // 0.005, not 0.010: at one point a candidate could lose EVERY gold pixel
  // (0.0% against the reference 0.6%) and still pass the accent trait.
  ['gold accent restraint', 'gold_fraction', 0.005, (x) => `${(100 * x).toFixed(1)}%`],
  ['cool rim light 200-220°', 'cool_rim_fraction', 0.030, (x) => `${(100 * x).toFixed(1)}%`],
  ['local coherence', 'neighbour_delta', {
    ok: (v, r) => v <= r * NOISE_MULTIPLE_ALLOWED,
    bound: (r) => `<= ${(r * NOISE_MULTIPLE_ALLOWED).toFixed(4)}`,
  }, (x) => x.toFixed(4)],
  ['rim on the silhouette', 'rim_edge_enrichment', {
    ok: (v) => v >= RIM_ENRICHMENT_FLOOR,
    bound: () => `>= ${RIM_ENRICHMENT_FLOOR.toFixed(2)}`,
  }, (x) => `${x.toFixed(2)}x`],
];

function score(name, prof) {
  const rows = [];
  let fails = 0;
  for (const [label, key, rule, fmt] of TRAITS) {
    const cell = `  ${'%s'}  ${label.padEnd(24)} ${fmt(prof[key]).padStart(8)}   ref ${fmt(ref[key]).padStart(8)}`;
    if (rule && typeof rule === 'object') {
      const ok = rule.ok(prof[key], ref[key]);
      if (!ok) fails++;
      rows.push(cell.replace('%s', ok ? 'PASS' : 'FAIL') + `   ${rule.bound(ref[key])}`);
      continue;
    }
    // A null tolerance is derived from the reference itself, so it tracks the
    // asset rather than a constant that can drift away from it.
    const tol = rule === null ? ref[key] * CHROMA_LOSS_ALLOWED : rule;
    const delta = Math.abs(prof[key] - ref[key]);
    const ok = delta <= tol;
    if (!ok) fails++;
    rows.push(cell.replace('%s', ok ? 'PASS' : 'FAIL') + `   Δ${fmt(delta)}`);
  }
  console.log(`\n${name}${name === REFERENCE ? '  (reference)' : ''}`);
  console.log(rows.join('\n'));
  console.log(`  => ${fails === 0 ? 'CONFORMS to the approved look' : `${fails} trait(s) off the approved look`}`);
  return fails;
}

// --selftest replays the two attacks that got past earlier versions of this
// gate, synthesised in memory from the reference itself. Both once scored
// ALL CONFORM. A gate nobody has seen fail is a gate nobody has tested.
function selftest() {
  const base = decodeImage(readBlob(crops[REFERENCE].git_blob), REFERENCE);
  const plants = [];

  // 1. Wash out: pull every pixel toward its own grey. Value buckets and hue
  //    buckets survive exactly; chroma dies.
  {
    const px = Buffer.from(base.px);
    for (let i = 0; i < base.width * base.height; i++) {
      const o = i * base.bpp;
      if (!px[o + 3]) continue;
      const mx = Math.max(px[o], px[o + 1], px[o + 2]);
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(mx - (mx - px[o + c]) * 0.40);
    }
    plants.push(['washed out (chroma drained, value and hue intact)', { ...base, px }]);
  }

  // 2. Shuffle: permute RGB among opaque pixels, keeping the alpha mask. Every
  //    histogram trait is preserved bit for bit; all structure is destroyed.
  {
    const px = Buffer.from(base.px);
    const idx = [];
    for (let i = 0; i < base.width * base.height; i++) {
      if (px[i * base.bpp + 3] >= OPAQUE) idx.push(i);
    }
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      for (let c = 0; c < 3; c++) {
        const t = px[idx[i] * base.bpp + c];
        px[idx[i] * base.bpp + c] = px[idx[j] * base.bpp + c];
        px[idx[j] * base.bpp + c] = t;
      }
    }
    plants.push(['pixel shuffle (every histogram identical, no structure)', { ...base, px }]);
  }

  let missed = 0;
  for (const [label, img] of plants) {
    const fails = score(label, profile(img));
    if (fails === 0) { console.log(`  !! NOT CAUGHT: ${label}`); missed++; }
  }
  console.log(`\n${missed === 0
    ? `SELFTEST OK: all ${plants.length} negative plants correctly caught.`
    : `SELFTEST FAILED: ${missed} plant(s) scored as conforming.`}`);
  process.exit(missed === 0 ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest();

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let total = 0;
if (targets.length) {
  for (const f of targets) total += score(basename(f), profile(decodeImage(readFileSync(f), f)));
} else {
  console.log(`look conformance vs ${REFERENCE} at pin ${PIN}  (opaque alpha >= ${OPAQUE})`);
  for (const cls of ['rogue', 'reaver', 'starseer', 'herald']) {
    total += score(cls, profile(decodeImage(readBlob(crops[cls].git_blob), cls)));
  }
}
console.log(`\n${total === 0 ? 'ALL CONFORM' : `${total} trait failure(s) across ${targets.length || 4} asset(s)`}`);
process.exit(total === 0 ? 0 : 1);
