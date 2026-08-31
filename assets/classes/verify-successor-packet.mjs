#!/usr/bin/env node
// AS-HD-040 — proof-only successor packet verifier.
//
// Re-derives every measured fact in successor-packet.manifest.json from the
// frozen packet bytes and fails on any drift. Read-only: it opens the packet
// files, writes nothing, and no runtime code path imports it.
//
//   node assets/classes/verify-successor-packet.mjs
//
// Exit 0 = the frozen packet still satisfies the recorded acceptance criteria.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const manifest = JSON.parse(readFileSync(join(here, 'successor-packet.manifest.json'), 'utf8'));
const rejected = JSON.parse(readFileSync(join(here, 'rejected-inputs.json'), 'utf8'));

const PIN = manifest.evidence_pin.commit;

// Read packet bytes from git objects, never from the working tree. The Hub
// rebuild removed review-approval-hub/evidence/** from the tree, so a
// path-based read passes only in a stale clone and fails everywhere else. A
// blob OID is content-addressed, so it survives the paths moving again.
function readPinned(entry) {
  const spec = entry.git_blob || `${PIN}:${entry.path}`;
  try {
    return execFileSync('git', ['cat-file', 'blob', spec], {
      cwd: repo,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

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

function measure(img) {
  const { width: w, height: h, bpp, px } = img;
  let transparent = 0, semi = 0, opaque = 0, residue = 0, edge = 0;
  let sx = 0, sy = 0, wsum = 0;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * bpp;
      const a = px[i + 3];
      if (a === 0) {
        transparent++;
        if (px[i] || px[i + 1] || px[i + 2]) residue++;
      } else if (a === 255) opaque++;
      else semi++;
      if (a) { sx += x * a; sy += y * a; wsum += a; }
      if (a >= 128) {
        mask[y * w + x] = 1;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) edge++;
      }
    }
  }
  return {
    transparent, semi, opaque, residue, edge,
    bbox: { x0, x1, y0, y1 },
    centroid: { x: sx / wsum, y: sy / wsum },
    mask,
  };
}

// The whole check phase runs over injected inputs so --selftest can replay it
// against deliberately broken copies. A contract nobody has seen fail is a
// contract nobody has tested.
function run(manifest, rejected, { quiet = false } = {}) {
const fails = [];
const check = (ok, label) => { if (!quiet) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) fails.push(label); };

const masks = new Map();
for (const crop of manifest.successor_packet.crops) {
  const bytes = readPinned(crop);
  if (!bytes) {
    check(false, `${crop.class}: bytes unreadable at the pin (${crop.git_blob || `${PIN}:${crop.path}`})`);
    continue;
  }
  const sha = createHash('sha256').update(bytes).digest('hex');

  // AC11 — the recorded OID and the recorded path must name the same bytes,
  // so neither can drift into decoration.
  const viaPath = readPinned({ path: crop.path });
  check(
    viaPath !== null && viaPath.equals(bytes),
    `${crop.class}: AC11 git_blob and ${PIN}:<path> resolve to identical bytes`,
  );
  check(sha === crop.sha256, `${crop.class}: sha256 ${sha.slice(0, 12)}… matches frozen pin`);
  check(bytes.length === crop.bytes, `${crop.class}: ${bytes.length} bytes matches frozen pin`);

  const img = decodePng(bytes);
  const m = measure(img);
  masks.set(crop.class, { mask: m.mask, w: img.width, h: img.height });

  check(img.width === crop.width && img.height === crop.height, `${crop.class}: AC1 canvas ${img.width}x${img.height}`);
  check(img.colorType === 6, `${crop.class}: AC2 genuine RGBA (color type ${img.colorType}) with ${m.semi} partial-alpha px`);
  check(m.residue === 0, `${crop.class}: AC3 zero transparent-pixel RGB residue (${m.residue})`);
  check(m.edge === 0, `${crop.class}: AC4 no canvas-edge contact (${m.edge} px)`);
  check(
    m.transparent === crop.alpha.transparent && m.semi === crop.alpha.semi && m.opaque === crop.alpha.opaque,
    `${crop.class}: alpha histogram matches manifest`,
  );
  check(
    m.bbox.x0 === crop.bbox.x0 && m.bbox.x1 === crop.bbox.x1 && m.bbox.y0 === crop.bbox.y0 && m.bbox.y1 === crop.bbox.y1,
    `${crop.class}: bbox x[${m.bbox.x0}..${m.bbox.x1}] y[${m.bbox.y0}..${m.bbox.y1}] matches manifest`,
  );

  // AC10 — the recorded anchor is a measurement, so it has to keep measuring
  // true. Horizontal centring is what lets one card layout hold all four.
  const cx = m.centroid.x, cy = m.centroid.y;
  check(
    Math.abs(cx - crop.anchor.alpha_weighted_centroid_x) < 0.05 && Math.abs(cy - crop.anchor.alpha_weighted_centroid_y) < 0.05,
    `${crop.class}: AC10 centroid (${cx.toFixed(1)}, ${cy.toFixed(1)}) matches recorded anchor`,
  );
  check(Math.abs(cx - img.width / 2) <= 1, `${crop.class}: AC10 horizontally centred (centroid x offset ${(cx - img.width / 2).toFixed(2)} px)`);
  check(crop.anchor.baseline_y === crop.bbox.y1, `${crop.class}: AC10 recorded baseline_y equals the measured bottom cut`);
}

// AC5 — the upper-body cut is shared, not per-class framing.
const cuts = new Set(manifest.successor_packet.crops.map((c) => c.bbox.y1));
check(cuts.size === 1, `AC5 shared upper-body bottom cut at y=${[...cuts].join(',')} across all four crops`);

// AC6 — no two class silhouettes are the same shape.
const names = [...masks.keys()].sort();
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = masks.get(names[i]);
    const b = masks.get(names[j]);
    let inter = 0, union = 0;
    for (let k = 0; k < a.mask.length; k++) {
      if (a.mask[k] && b.mask[k]) inter++;
      if (a.mask[k] || b.mask[k]) union++;
    }
    const iou = inter / union;
    check(iou < 1, `AC6 ${names[i]} vs ${names[j]} distinct silhouettes (IoU ${iou.toFixed(4)})`);
  }
}

// AC7 — the desktop/mobile context proofs are present and unchanged.
for (const proof of manifest.successor_packet.context_proofs) {
  const bytes = readPinned(proof);
  const sha = bytes && createHash('sha256').update(bytes).digest('hex');
  check(
    bytes !== null && sha === proof.sha256 && bytes.length === proof.bytes,
    `AC7 ${proof.surface} proof ${proof.path.split('/').pop()} unchanged at the pin`,
  );
}

// AC8 — proof-only: the manifest must never claim adoption.
check(manifest.adopted === false && manifest.scope === 'proof-only', 'AC8 manifest still records scope=proof-only, adopted=false');

// AC9 — no rejected input was substituted into the packet, and none was
// "repaired" in place. Both are named failure modes in the contract, and both
// are silent unless something checks: a repaired concept would gain an alpha
// channel, and a substituted one would show up as a hash collision.
const packetHashes = new Set([
  ...manifest.successor_packet.crops.map((c) => c.sha256),
  ...manifest.successor_packet.context_proofs.map((p) => p.sha256),
]);
for (const r of rejected.rejected) {
  check(!packetHashes.has(r.sha256), `AC9 ${r.id} is not present in the successor packet`);

  // The rejected inputs no longer exist at a working-tree path, so "was it
  // repaired in place" is no longer the question. What still matters is that
  // the objects resolve, are byte-unchanged, and never gained an alpha channel
  // that would let one pass as a successor.
  const bytes = readPinned(r);
  if (!bytes) {
    check(false, `AC9 ${r.id} object resolves at the pin`);
    continue;
  }
  const sha = createHash('sha256').update(bytes).digest('hex');
  check(sha === r.sha256 && bytes.length === r.bytes, `AC9 ${r.id} unchanged at the pin (still rejected evidence)`);
  const img = decodePng(bytes);
  check(
    img.colorType === r.png_color_type && img.colorType !== 6,
    `AC9 ${r.id} still color type ${img.colorType} — never gained an alpha channel`,
  );
}

return fails;
}

// --selftest: every acceptance criterion must actually reject its own failure
// mode. Each plant breaks exactly one thing in an in-memory copy; none touches
// a file on disk.
if (process.argv.includes('--selftest')) {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const plants = [
    ['AC1 wrong canvas size', (m) => { m.successor_packet.crops[0].width = 256; }],
    ['AC5 bottom cut moved for one class', (m) => { m.successor_packet.crops[0].bbox.y1 = 400; }],
    ['AC10 anchor drift', (m) => { m.successor_packet.crops[1].anchor.alpha_weighted_centroid_x += 5; }],
    ['AC10 baseline disagrees with bbox', (m) => { m.successor_packet.crops[2].anchor.baseline_y = 300; }],
    ['alpha histogram drift', (m) => { m.successor_packet.crops[1].alpha.opaque += 1; }],
    ['crop hash drift', (m) => { m.successor_packet.crops[2].sha256 = 'f'.repeat(64); }],
    ['crop byte-count drift', (m) => { m.successor_packet.crops[3].bytes += 1; }],
    ['AC7 context proof drift', (m) => { m.successor_packet.context_proofs[0].sha256 = '0'.repeat(64); }],
    ['AC8 packet claims adoption', (m) => { m.adopted = true; }],
    ['AC8 scope silently widened', (m) => { m.scope = 'production'; }],
    ['AC9 rejected input substituted into packet', (m, r) => { r.rejected[0].sha256 = m.successor_packet.crops[0].sha256; }],
    ['AC9 rejected input OID unresolvable', (_m, r) => { r.rejected[1].git_blob = '0'.repeat(40); }],
    ['AC11 git_blob names different bytes than the path', (m) => { m.successor_packet.crops[0].git_blob = m.successor_packet.crops[1].git_blob; }],
    ['crop OID unresolvable at the pin', (m) => { m.successor_packet.crops[3].git_blob = 'f'.repeat(40); }],
    ['AC9 rejected input claimed to have alpha', (_m, r) => { r.rejected[2].png_color_type = 6; }],
  ];
  let bad = 0;
  for (const [label, breakIt] of plants) {
    const m = clone(manifest);
    const r = clone(rejected);
    breakIt(m, r);
    const caught = run(m, r, { quiet: true }).length > 0;
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${label}`);
    if (!caught) bad++;
  }
  console.log(`\n${bad === 0 ? `SELFTEST OK: all ${plants.length} negative plants correctly caught.` : `SELFTEST FAIL: ${bad} plant(s) went uncaught.`}`);
  process.exit(bad === 0 ? 0 : 1);
}

const fails = run(manifest, rejected);
console.log(`\n${fails.length === 0 ? 'PACKET INTACT' : 'PACKET DRIFT'} — ${fails.length} failing check(s)`);
process.exit(fails.length === 0 ? 0 : 1);
