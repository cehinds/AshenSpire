#!/usr/bin/env node
// AS-HD-040 — crop/size/state measurement for the frozen four-crop successor
// packet. Reads the pinned git objects named by successor-packet.manifest.json,
// decodes them, and derives the object-fit behaviour a UI steward needs.
//
// Nothing here is asserted: every field this prints is computed from the bytes.
// Usage:
//   node assets/classes/measure-crop-state.mjs            human table
//   node assets/classes/measure-crop-state.mjs --json     full measurement
//   node assets/classes/measure-crop-state.mjs --emit     write class-assets.manifest.json
//   node assets/classes/measure-crop-state.mjs --check    regenerate and diff it (exit 1 on drift)

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const manifest = JSON.parse(
  readFileSync(join(here, 'successor-packet.manifest.json'), 'utf8'),
);
const PIN = manifest.evidence_pin.commit;
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ALPHA_ON = 128; // the same mask threshold the packet verifier uses

function readPinned(entry) {
  const spec = entry.git_blob || `${PIN}:${entry.path}`;
  return execFileSync('git', ['cat-file', 'blob', spec], {
    cwd: repo, maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
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
  return { width, height, colorType, bpp, px: out };
}

// Content box at the mask threshold, plus the softest row/column still lit.
// faint_* use alpha>0 so the receipt can say what a naive tight-crop would eat.
function contentBox(img) {
  const { width: w, height: h, bpp, px } = img;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  let fx0 = w, fx1 = -1, fy0 = h, fy1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[(y * w + x) * bpp + 3];
      if (a > 0) {
        if (x < fx0) fx0 = x;
        if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y;
        if (y > fy1) fy1 = y;
      }
      if (a >= ALPHA_ON) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return {
    box: { x0, x1, y0, y1 },
    faint: { x0: fx0, x1: fx1, y0: fy0, y1: fy1 },
  };
}

// object-fit: cover into a target of aspect A = tw/th, source square of side S.
// A > 1 fills width and clips top/bottom; A < 1 fills height and clips sides.
// Returns the aspect band within which no pixel of the content box is clipped.
function coverBand(box, S) {
  const c = S / 2;
  // landscape bound: visible half-height is c/A, needs to cover both y edges
  const needY = Math.max(c - box.y0, box.y1 - c);
  const maxAspect = needY > 0 ? c / needY : Infinity;
  // portrait bound: visible half-width is c*A, needs to cover both x edges
  const needX = Math.max(c - box.x0, box.x1 - c);
  const minAspect = needX > 0 ? needX / c : 0;
  return { minAspect, maxAspect };
}

// object-fit: contain into the same target: how much of the box is empty band.
function containWaste(box, S) {
  return {
    top_px: box.y0,
    bottom_px: S - 1 - box.y1,
    left_px: box.x0,
    right_px: S - 1 - box.x1,
    // share of the square that carries no thresholded content at all
    filled_fraction: +(((box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1)) / (S * S)).toFixed(4),
  };
}

const rows = [];
for (const crop of manifest.successor_packet.crops) {
  const img = decodePng(readPinned(crop));
  if (img.width !== img.height) throw new Error(`${crop.class}: non-square source`);
  const S = img.width;
  const { box, faint } = contentBox(img);
  rows.push({
    class: crop.class,
    git_blob: crop.git_blob,
    canvas: { width: img.width, height: img.height, aspect: 1 },
    content_box: box,
    faint_box: faint,
    // rows/columns that carry only sub-threshold alpha — a tight crop loses them
    soft_margin_px: {
      top: box.y0 - faint.y0,
      bottom: faint.y1 - box.y1,
      left: box.x0 - faint.x0,
      right: faint.x1 - box.x1,
    },
    contain: containWaste(box, S),
    cover_safe_aspect: coverBand(box, S),
  });
}

const band = {
  min: Math.max(...rows.map((r) => r.cover_safe_aspect.minAspect)),
  max: Math.min(...rows.map((r) => r.cover_safe_aspect.maxAspect)),
};
band.bound_by_portrait = rows.find((r) => r.cover_safe_aspect.minAspect === band.min).class;
band.bound_by_landscape = rows.find((r) => r.cover_safe_aspect.maxAspect === band.max).class;

const result = { pin: PIN, alpha_threshold: ALPHA_ON, classes: rows, shared_cover_safe_aspect: band };

// The manifest is generated, never hand-edited: --check regenerates it from the
// pinned bytes and fails on any drift, so a stale number cannot survive review.
function buildManifest() {
  const classes = {};
  for (const r of rows) {
    classes[r.class] = {
      id: `class.portrait.${r.class}.future`,
      status: 'proof-only',
      source: {
        git_blob: r.git_blob,
        path: manifest.successor_packet.crops.find((c) => c.class === r.class).path,
        pin: PIN,
      },
      size: {
        canvas_px: [r.canvas.width, r.canvas.height],
        aspect: r.canvas.aspect,
        content_box: r.content_box,
        content_fraction: r.contain.filled_fraction,
      },
      crop: {
        contain_margin_px: {
          top: r.contain.top_px, bottom: r.contain.bottom_px,
          left: r.contain.left_px, right: r.contain.right_px,
        },
        soft_alpha_margin_px: r.soft_margin_px,
        cover_safe_aspect: {
          min: +r.cover_safe_aspect.minAspect.toFixed(4),
          max: +r.cover_safe_aspect.maxAspect.toFixed(4),
        },
      },
      states: {
        declared: ['default'],
        note: 'The packet ships one look per class. hover/selected/disabled/locked '
          + 'have no distinct asset and are UNKNOWN until the catalog names them.',
      },
      provenance: {
        creator: 'UNKNOWN',
        method: 'UNKNOWN',
        licence: 'UNKNOWN — CREDITS.md declares first-party CC0 at folder level for '
          + 'assets/equipment/**; that declaration does not reach this path.',
        modification_history: 'UNKNOWN',
        restrictions: 'UNKNOWN',
        blocking: true,
      },
    };
  }
  return {
    schema: 'ashenspire.class-assets/1',
    ticket: 'AS-HD-040',
    generated_by: 'assets/classes/measure-crop-state.mjs --emit',
    generated_from_pin: PIN,
    adopted: false,
    authority_note: 'Decision D1 authorises a proof-only successor. This manifest '
      + 'describes the frozen packet for a future reader; it adopts nothing, maps no '
      + 'runtime path, and grants no integration authority.',
    alpha_threshold: ALPHA_ON,
    shared_cover_safe_aspect: {
      min: +band.min.toFixed(4),
      max: +band.max.toFixed(4),
      bound_by_portrait: band.bound_by_portrait,
      bound_by_landscape: band.bound_by_landscape,
      rule: 'A square slot (aspect 1.0) sits inside this band, so object-fit: cover '
        + 'clips no thresholded content at 1:1 for any of the four.',
    },
    classes,
    open_items: [
      'Per-file provenance is absent for all four sources; every provenance field above is UNKNOWN and blocking.',
      'No repository code path reads assets/classes/**; the reader lives in src/ui/** which this lease does not hold.',
      'Non-default states (hover/selected/disabled/locked) have no asset and no catalog entry.',
    ],
  };
}

const MANIFEST_PATH = join(here, 'class-assets.manifest.json');

if (process.argv.includes('--emit')) {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(buildManifest(), null, 2)}\n`);
  console.log(`wrote ${MANIFEST_PATH}`);
} else if (process.argv.includes('--check')) {
  const want = `${JSON.stringify(buildManifest(), null, 2)}\n`;
  let have = null;
  try { have = readFileSync(MANIFEST_PATH, 'utf8'); } catch { /* absent */ }
  if (have === null) {
    console.error('DRIFT: class-assets.manifest.json is missing; run --emit');
    process.exit(1);
  }
  if (have !== want) {
    console.error('DRIFT: class-assets.manifest.json does not match the pinned bytes; run --emit');
    process.exit(1);
  }
  console.log('MANIFEST CURRENT: class-assets.manifest.json matches the pinned bytes');
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`pin ${PIN}  alpha>=${ALPHA_ON}\n`);
  console.log('class     content box (x0,x1,y0,y1)   contain margins T/B/L/R    cover-safe aspect');
  for (const r of rows) {
    const b = r.content_box, c = r.contain, a = r.cover_safe_aspect;
    console.log(
      `${r.class.padEnd(9)} ${String(b.x0).padStart(3)},${String(b.x1).padStart(3)},` +
      `${String(b.y0).padStart(3)},${String(b.y1).padStart(3)}      ` +
      `${String(c.top_px).padStart(3)}/${String(c.bottom_px).padStart(3)}/` +
      `${String(c.left_px).padStart(3)}/${String(c.right_px).padStart(3)}         ` +
      `${a.minAspect.toFixed(4)} … ${a.maxAspect.toFixed(4)}`,
    );
  }
  console.log(
    `\nshared cover-safe aspect band: ${band.min.toFixed(4)} … ${band.max.toFixed(4)}` +
    `  (portrait bound by ${band.bound_by_portrait}, landscape bound by ${band.bound_by_landscape})`,
  );
}
