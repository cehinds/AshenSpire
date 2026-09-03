#!/usr/bin/env node
// tools/concept-cutout.mjs — turn the four class concept paintings into the
// transparent, tinted class sprites the game loads.
//
// WHY THIS EXISTS
// The concept art (review-approval-hub/evidence/classes/*-concept-v1.png) is the
// design the owner approved by eye. It was recorded as "rejected/ineligible" for
// one purely technical reason: PNG colour type 2, no alpha, so it cannot be cut
// out of its background. That is a solvable problem, and this solves it. The
// rejection was never about the art.
//
// HOW THE BACKGROUND COMES OFF
// Not a threshold — a threshold eats the white highlights inside a figure and
// leaves holes. This flood-fills inward from the border, so only background
// CONNECTED to the edge is removed. It also refuses to seed from a dark border
// pixel, because the reaver's shoulder reaches the bottom-right corner.
//
// Edge quality matters more than edge detection here: a hard mask leaves a white
// fringe that reads as a halo on a dark card. Pixels between the two thresholds
// get partial alpha, and their colour is un-premultiplied against white so the
// fringe is removed rather than hidden.
//
// FRAMING
// Concepts are square (1254x1254); the game draws sprites at 150x190 and stores
// them at 3x (450x570). Cover-cropping a square to 0.789 is inside the safe band
// measured in assets/classes/LOOK-REFERENCE-ROGUE.md, so nothing is clipped that
// matters. The figure is bottom-aligned to match `align-items: flex-end` in
// classSprite(), and every class shares one baseline so the four line up.
//
// TINTS
// A concept painting has no accent surface, but the sprite system needs five
// tints per class and the stated purpose of that system is "the silhouette that
// glows is always yours". So each tint gets a rim light of that colour along the
// silhouette edge. The body art is identical across tints; the glow is not.
//
// Usage: node tools/concept-cutout.mjs [--out <dir>]

import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inflateSync, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// The medallion anchors are the game's, not this tool's — one home, two
// readers. classArtAnchors.js is data only and touches no document, which is
// what makes it importable from a build tool at all.
import { medallionPct } from '../src/content/classArtAnchors.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CONCEPTS = {
  reaver: '1769879947b4e9e908e6846b21047d3336386d80',
  starseer: 'a4f3dd20961dae978d003baea8615a46847972df',
  rogue: '401945b10fa11d016fde229adbfac1fa1c0960d0',
  herald: '613adb7468e073042b25bdcd27148ca0c181ecc1',
};

// Same five as PORTRAIT_TINTS in src/ui/assets.js and TINTS in sprites-blender.py.
const TINTS = {
  gold: [0xC9, 0xA2, 0x27],
  ember: [0xC9, 0x50, 0x2E],
  frost: [0x7F, 0xA8, 0xC9],
  rot: [0xB5, 0x54, 0x1C],
  grace: [0x9F, 0xC3, 0xE8],
};

const OUT_W = 450;
const OUT_H = 570;
const BG_SURE = 248;   // at or above this, and edge-connected: background
const FG_SURE = 224;   // at or below this: figure, never removed
const CHROMA_MAX = 14; // background is grey; coloured pixels are never background

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

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
  return { width, height, bpp, px: out };
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = ~0;
    for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8);
    return (~c) >>> 0;
  };
})();

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const b = Buffer.alloc(8 + data.length + 4);
    b.writeUInt32BE(data.length, 0);
    b.write(type, 4, 'ascii');
    data.copy(b, 8);
    b.writeUInt32BE(CRC(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Background alpha by edge-connected flood fill, with a soft band so the cut
// keeps the painting's own anti-aliasing instead of stair-stepping it.
function cutout(img) {
  const { width: w, height: h, bpp, px } = img;
  const lum = new Uint8Array(w * h);
  const grey = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp;
    const r = px[o], g = px[o + 1], b = px[o + 2];
    lum[i] = Math.max(r, g, b);
    grey[i] = (Math.max(r, g, b) - Math.min(r, g, b)) <= CHROMA_MAX ? 1 : 0;
  }
  const canFill = (i) => grey[i] && lum[i] > FG_SURE;

  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (!bg[i] && canFill(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // Enclosed pockets of background. The herald's halo is a closed ring, so the
  // sky inside it is background that the edge fill can never reach — it came out
  // as an opaque white disc behind the hood. Any remaining region of background-
  // coloured pixels big enough not to be a highlight is background too.
  // Size-gated on purpose: a small bright patch is paint (an eye, a glint), a
  // large one is a hole. These are dark-fantasy paintings with no broad white
  // surfaces, and the tool prints what it removes so a wrong call is visible.
  const POCKET_MIN = Math.round(w * h * 0.0003);
  const seen = new Uint8Array(w * h);
  let pockets = 0;
  let pocketPx = 0;
  for (let start = 0; start < w * h; start++) {
    if (bg[start] || seen[start] || !canFill(start)) continue;
    const region = [];
    seen[start] = 1;
    const q = [start];
    while (q.length) {
      const i = q.pop();
      region.push(i);
      const x = i % w, y = (i / w) | 0;
      const step = (j) => { if (!seen[j] && !bg[j] && canFill(j)) { seen[j] = 1; q.push(j); } };
      if (x > 0) step(i - 1);
      if (x < w - 1) step(i + 1);
      if (y > 0) step(i - w);
      if (y < h - 1) step(i + w);
    }
    if (region.length >= POCKET_MIN) {
      for (const i of region) bg[i] = 1;
      pockets++;
      pocketPx += region.length;
    }
  }
  if (pockets) console.log(`  (removed ${pockets} enclosed background pocket(s), ${pocketPx} px)`);

  // Specks. Treating everything the fill did not reach as figure kept two
  // isolated bright pixels near the rogue's upper-left corner — 4 px and 2 px
  // beside a 90,117 px figure — and they shipped, scaled up with the class art.
  // Source-canvas noise, not paint.
  //
  // Gated against the LARGEST component rather than an absolute count, so this
  // cannot quietly eat a genuinely detached part of a design: the herald's halo
  // is orders of magnitude above the line, a stray pixel is orders below.
  {
    const fgSeen = new Uint8Array(w * h);
    const comps = [];
    for (let start = 0; start < w * h; start++) {
      if (bg[start] || fgSeen[start]) continue;
      const region = [];
      fgSeen[start] = 1;
      const q = [start];
      while (q.length) {
        const i = q.pop();
        region.push(i);
        const x = i % w, y = (i / w) | 0;
        const step = (j) => { if (!fgSeen[j] && !bg[j]) { fgSeen[j] = 1; q.push(j); } };
        if (x > 0) step(i - 1);
        if (x < w - 1) step(i + 1);
        if (y > 0) step(i - w);
        if (y < h - 1) step(i + w);
      }
      comps.push(region);
    }
    if (comps.length > 1) {
      const largest = comps.reduce((a, b) => (b.length > a.length ? b : a));
      const floor = Math.max(16, largest.length * 0.0005);
      let dropped = 0;
      let droppedPx = 0;
      for (const region of comps) {
        if (region === largest || region.length >= floor) continue;
        for (const i of region) bg[i] = 1;
        dropped++;
        droppedPx += region.length;
      }
      if (dropped) console.log(`  (dropped ${dropped} detached speck(s), ${droppedPx} px)`);
    }
  }

  // Coverage is binary first. An earlier version graded alpha by luminance for
  // every filled pixel, which was wrong: this background sits at 243-247, under
  // the "certainly background" line, so the whole field came back faintly opaque
  // and nothing was actually cut out. The fill already knows what is background;
  // luminance only has a say at the boundary.
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = bg[i] ? 0 : 1;

  // One 3x3 box pass feathers the cut so the painting's own soft edge survives
  // instead of stair-stepping. Wider would smear the silhouette.
  const soft = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += alpha[yy * w + xx]; n++;
        }
      }
      soft[y * w + x] = s / n;
    }
  }

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp, q = i * 4;
    const a = soft[i];
    if (a <= 0.004) { out[q] = out[q + 1] = out[q + 2] = out[q + 3] = 0; continue; }
    // Un-premultiply against the white it was composited over, so no fringe.
    for (let c = 0; c < 3; c++) {
      const v = a < 1 ? (px[o + c] - (1 - a) * 255) / a : px[o + c];
      out[q + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out[q + 3] = Math.round(a * 255);
  }
  return { width: w, height: h, px: out };
}

function contentBox(img) {
  const { width: w, height: h, px } = img;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] >= 16) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, x1, y0, y1 };
}

// Box-filtered scale: these are large downscales, so a box average is both
// correct and cheap, and it keeps the painting's soft edges soft.
function resample(src, sx0, sy0, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const fx = sw / dw, fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const ya = sy0 + y * fy, yb = ya + fy;
    const y0 = Math.max(0, Math.floor(ya)), y1 = Math.min(src.height, Math.ceil(yb));
    for (let x = 0; x < dw; x++) {
      const xa = sx0 + x * fx, xb = xa + fx;
      const x0 = Math.max(0, Math.floor(xa)), x1 = Math.min(src.width, Math.ceil(xb));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * src.width + xx) * 4;
          const al = src.px[o + 3] / 255;
          r += src.px[o] * al; g += src.px[o + 1] * al; b += src.px[o + 2] * al;
          a += al; n++;
        }
      }
      const q = (y * dw + x) * 4;
      const alpha = n ? Math.round((a / n) * 255) : 0;
      // Colour and coverage have to agree. Averaging can leave a coverage so
      // small it rounds to zero while the colour sum does not — which writes
      // visible colour into a fully transparent pixel. That is the matte
      // residue AC3 forbids, and it survives every compressor because it is
      // baked in here, not added later.
      if (!n || a <= 0 || alpha === 0) { out[q] = out[q + 1] = out[q + 2] = out[q + 3] = 0; continue; }
      out[q] = Math.round(r / a); out[q + 1] = Math.round(g / a); out[q + 2] = Math.round(b / a);
      out[q + 3] = alpha;
    }
  }
  return { width: dw, height: dh, px: out };
}

// The accent rim: the pixels just inside the silhouette, lit in the tint. This
// is what makes the player figure yours at a glance, and it is the one thing the
// concept paintings cannot carry on their own.
// bottomIsCrop: the source painting ends mid-torso, so the figure's lowest row
// is where the CANVAS stopped, not where the character does. Lighting it as a
// silhouette edge drew a bright horizontal stripe across the bottom of all
// twenty sprites — measured at goldness 110.6 on the last row against 12-18
// through the body. A rim marks an outline; a crop line is not one.
function withRim(img, rgb, bottomIsCrop, depth = 3, strength = 0.85) {
  const { width: w, height: h, px } = img;
  const out = Buffer.from(px);
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
  let lastRow = -1;
  if (bottomIsCrop) {
    for (let y = h - 1; y >= 0 && lastRow < 0; y--) {
      for (let x = 0; x < w; x++) if (on[y * w + x]) { lastRow = y; break; }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!on[i]) continue;
      let d = Infinity;
      // Stop at `d > 1`, not `d > depth`. The earlier guard exited the scan as
      // soon as ANY transparent neighbour was found, so a pixel that first saw
      // transparency at the far row (dy === -depth) kept d = depth and never
      // looked at the adjacent one that would have given d = 1. Pixels along the
      // top and sides of a silhouette hit that case constantly and came out with
      // the WEAKEST rim where they should have had the strongest — an
      // asymmetric accent in every generated variant. 1 is the true minimum, so
      // stopping there is the only safe early exit.
      for (let dy = -depth; dy <= depth && d > 1; dy++) {
        for (let dx = -depth; dx <= depth; dx++) {
          const nx = x + dx, ny = y + dy;
          // Anything at or below the crop line counts as inside: the figure
          // continues there in the original painting, it is simply not drawn.
          if (lastRow >= 0 && ny > lastRow) continue;
          const outside = nx < 0 || ny < 0 || nx >= w || ny >= h || !on[ny * w + nx];
          if (outside) { d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy))); }
        }
      }
      if (d > depth) continue;
      const k = strength * (1 - (d - 1) / depth);
      const q = i * 4;
      if (px[q + 3] === 0) continue; // never light a pixel nobody can see
      for (let c = 0; c < 3; c++) {
        out[q + c] = Math.round(px[q + c] * (1 - k) + rgb[c] * k);
      }
    }
  }
  return { width: w, height: h, px: out };
}

// cwebp is an external binary and this repo has no package manifest, so nothing
// installs it for you. Fail here, once, naming it — rather than part-way through
// the first class with `spawnSync cwebp ENOENT`, which says nothing about what
// to install. CREDITS.md advertises this command as the way to regenerate the
// sprites, so it has to be honest about what it needs on a clean clone.
let cwebpVersion = 'unknown';
try {
  cwebpVersion = `cwebp ${String(execFileSync('cwebp', ['-version'])).trim().split('\n')[0]}`;
} catch {
  console.error(
    'cwebp not found. This tool encodes the sprites as WebP and cannot run without it.\n'
    + '  Debian/Ubuntu : sudo apt-get install webp\n'
    + '  macOS         : brew install webp\n'
    + '  Fedora        : sudo dnf install libwebp-tools\n'
    + 'It provides both cwebp (encode) and dwebp (decode, used to inspect output).',
  );
  process.exit(1);
}

const outDir = (() => {
  const i = process.argv.indexOf('--out');
  return i > -1 ? process.argv[i + 1] : join(root, 'assets', 'sprites');
})();
mkdirSync(outDir, { recursive: true });

// FAIL RATHER THAN GUESS. Every class this tool paints needs a measured
// medallion anchor, because the overlay is positioned from it at runtime and an
// unmeasured figure gets no medallion at all. Caught here, at the top of the
// run, so replacing a concept surfaces as "measure this" before any bytes are
// written — not as a sigil silently missing from a shipped sprite.
const unanchored = Object.keys(CONCEPTS).filter((c) => medallionPct(c) == null);
if (unanchored.length) {
  console.error(
    `No medallion anchor for: ${unanchored.join(', ')}.\n`
    + '  Measure the chest position on each new figure and add it to\n'
    + '  src/content/classArtAnchors.js — see that file for how the others were taken.',
  );
  process.exit(1);
}

// One shared baseline across the four, so the classes line up in a row exactly
// the way the frozen packet's four crops do.
const MARGIN_TOP = 0.03;
const MARGIN_BOTTOM = 0.02;

const cuts = {};
for (const [cls, oid] of Object.entries(CONCEPTS)) {
  const src = decodePng(execFileSync('git', ['cat-file', 'blob', oid], {
    cwd: root, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const cut = cutout(src);
  const box = contentBox(cut);
  // The painting runs off the bottom of its own canvas, so the lowest row of
  // the cutout is a crop line rather than the character's outline.
  const bottomIsCrop = box.y1 >= cut.height - 1;
  cuts[cls] = { cut, box, bottomIsCrop };
  const kept = ((box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1)) / (src.width * src.height);
  console.log(`${cls.padEnd(9)} ${src.width}x${src.height} -> content `
    + `${box.x1 - box.x0 + 1}x${box.y1 - box.y0 + 1} (${(100 * kept).toFixed(1)}% of canvas)`);
}

// ONE scale factor for all four, so their relative heights survive framing and
// a taller class still reads as taller. Fit by BOTH axes: the concepts are wide
// (the reaver's pauldrons span nearly the full canvas), and fitting by height
// alone pushed it 41 px past each edge and cut its arms off.
const MARGIN_SIDE = 0.02;
const tallest = Math.max(...Object.values(cuts).map(({ box }) => box.y1 - box.y0 + 1));
const widest = Math.max(...Object.values(cuts).map(({ box }) => box.x1 - box.x0 + 1));
const usableH = OUT_H * (1 - MARGIN_TOP - MARGIN_BOTTOM);
const usableW = OUT_W * (1 - 2 * MARGIN_SIDE);
const scale = Math.min(usableH / tallest, usableW / widest);

let written = 0;
const manifestRows = [];
for (const [cls, { cut, box, bottomIsCrop }] of Object.entries(cuts)) {
  const cw = box.x1 - box.x0 + 1;
  const ch = box.y1 - box.y0 + 1;
  const dw = Math.max(1, Math.round(cw * scale));
  const dh = Math.max(1, Math.round(ch * scale));
  const fig = resample(cut, box.x0, box.y0, cw, ch, dw, dh);

  const canvas = Buffer.alloc(OUT_W * OUT_H * 4);
  const ox = Math.round((OUT_W - dw) / 2);
  const oy = Math.round(OUT_H * (1 - MARGIN_BOTTOM)) - dh;
  for (let y = 0; y < dh; y++) {
    const ty = oy + y;
    if (ty < 0 || ty >= OUT_H) continue;
    for (let x = 0; x < dw; x++) {
      const tx = ox + x;
      if (tx < 0 || tx >= OUT_W) continue;
      fig.px.copy(canvas, (ty * OUT_W + tx) * 4, (y * dw + x) * 4, (y * dw + x) * 4 + 4);
    }
  }
  const framed = { width: OUT_W, height: OUT_H, px: canvas };

  for (const [tintId, rgb] of Object.entries(TINTS)) {
    const png = join(outDir, `${cls}_${tintId}.png`);
    writeFileSync(png, encodePng(OUT_W, OUT_H, withRim(framed, rgb, bottomIsCrop).px));
    // -exact: without it cwebp rewrites the RGB under fully transparent pixels
    // to compress better, which leaves colour hiding in the invisible areas.
    // The packet's own AC3 requires zero transparent pixels carrying non-zero
    // RGB, and art shipped from this tool is held to the same bar.
    execFileSync('cwebp', ['-quiet', '-exact', '-q', '88', '-alpha_q', '100', png,
      '-o', join(outDir, `${cls}_${tintId}.webp`)]);
    // rmSync, not a shelled-out `rm`: execFileSync launches an executable
    // directly, and stock Windows has none by that name — PowerShell's `rm` is
    // an alias the child-process lookup never sees. CI declares a three-OS
    // matrix, so "works on my Linux" is not the bar.
    if (!process.argv.includes('--keep-png')) rmSync(png, { force: true });

    // RUNBOOKS/art.md §3 requires an inventory row for every added, changed,
    // replaced or removed binary. Emitted by the tool that writes the bytes,
    // from the bytes themselves, so the record cannot drift from the file it
    // describes — a hand-kept inventory of twenty binaries is wrong the first
    // time anyone regenerates.
    const webp = join(outDir, `${cls}_${tintId}.webp`);
    const bytes = readFileSync(webp);
    manifestRows.push({
      asset_id: `class.sprite.${cls}.${tintId}`,
      path: `assets/sprites/${cls}_${tintId}.webp`,
      format: 'WebP, lossy q88, alpha_q 100, -exact (RGBA)',
      dimensions: `${OUT_W}x${OUT_H}`,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      source_recipe: {
        source_blob: CONCEPTS[cls],
        source_path: `review-approval-hub/evidence/classes/${cls}-concept-v1.png`,
        command: 'node tools/concept-cutout.mjs',
        steps: 'edge flood-fill background removal, enclosed-pocket removal, '
          + 'detached-speck removal, 3x3 feather, un-premultiply against white, '
          + `box-filter downscale, bottom-align on ${OUT_W}x${OUT_H}, accent rim`,
        tool_versions: { node: process.version, cwebp: cwebpVersion },
      },
      anchor: {
        content_box_px: { w: dw, h: dh },
        placed_at_px: { x: ox, y: oy },
        baseline: `bottom-aligned, ${MARGIN_BOTTOM * 100}% margin; shared scale across all four classes`,
        // Imported from src/content/classArtAnchors.js rather than restated, so
        // the inventory records the anchor the GAME uses. A number typed here
        // as well would be a second copy of a measurement, and this PR has
        // already produced three findings about derived records drifting.
        medallion_center_pct: medallionPct(cls),
      },
      runtime_budget: 'embedded base64 in the single-file build; WebP chosen over '
        + 'PNG for that reason (see tools/sprites-blender.py header)',
      fallback_id: `CLASS_SVG.${cls} — inline SVG silhouette in src/ui/assets.js`,
      provenance: 'AI-generated with ChatGPT Codex for this project (owner statement, '
        + '2026-09-03); CC0. See CREDITS.md.',
      consumers: ['src/ui/assets.js renderedSpriteUrl()', 'src/ui/assets.js classSprite()'],
    });
    written++;
  }
  console.log(`${cls.padEnd(9)} framed ${dw}x${dh} at (${ox},${oy}) -> 5 tints`);
}

const manifestPath = join(outDir, 'class-sprites.manifest.json');
writeFileSync(manifestPath, `${JSON.stringify({
  schema: 'ashenspire.binary-asset-manifest/1',
  ticket: 'AS-HD-040',
  covers: 'RUNBOOKS/art.md §3 — binary asset manifest',
  generated_by: 'node tools/concept-cutout.mjs',
  replaces: 'the previous Blender-rendered class sprites (tools/sprites-blender.py); '
    + 'enemy_*.webp in the same folder are still Blender output and are not covered here',
  assets: manifestRows,
}, null, 2)}\n`);

console.log(`\nWROTE ${written} sprites + manifest to ${outDir}`);
