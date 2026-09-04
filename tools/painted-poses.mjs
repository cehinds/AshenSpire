// tools/painted-poses.mjs — cut a painted pose sheet into single-pose frames.
//
//   node tools/painted-poses.mjs --sheet SHEET.png --class rogue \
//     --poses idle,guard,attack1,attack2,attack3,hit,kneel,down [--out DIR] [--append]
//
// A pose sheet is one image holding several paintings of the same character, laid
// out in rows. This finds each figure (background is transparency, or whatever
// colour the border is — a checkerboard counts), names them in reading order from
// --poses, and writes one RGBA PNG per pose onto a shared canvas with every figure
// standing on the same floor line and centred on its own feet.
//
// The output folder gets `lowpoly-renders.manifest.json`, the same shape
// tools/lowpoly-blender.py writes, so tools/pose-sprites.mjs dyes, tints, crops
// and encodes these exactly as it does the Blender renders — painted or modelled,
// the sprites downstream are identical in shape.
//
// A figure whose lowest pixels sit well above the sheet's floor (a lunge that
// leaves the ground, a body lying down) keeps its own offset from that floor, so
// poses do not all get glued to the same feet height.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { decodePng, encodePng } from './concept-cutout.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const sheetPath = arg('--sheet', null);
const cls = arg('--class', null);
const poses = (arg('--poses', 'idle,guard,attack1,attack2,attack3,hit,kneel,down') || '').split(',').filter(Boolean);
const outDir = arg('--out', null);
const alphaMin = Number(arg('--alpha', '40'));
const minArea = Number(arg('--min-area', '0.0015'));   // fraction of the sheet a real figure must cover
if (!sheetPath || !cls || !outDir) {
  console.error('painted-poses: --sheet FILE --class NAME --out DIR are required');
  process.exit(2);
}

const img = decodePng(readFileSync(sheetPath));
const { width: W, height: H, bpp } = img;
const at = (x, y) => (y * W + x) * bpp;

// ---- foreground mask -------------------------------------------------------------
// Transparent sheets say what is figure outright. Opaque ones (a flattened export,
// a checkerboard behind the art) are read from the border inwards: everything the
// background colours reach is background, everything they cannot reach is figure.
const fg = new Uint8Array(W * H);
let hasAlpha = false;
if (bpp === 4) for (let i = 0; i < W * H && !hasAlpha; i++) if (img.px[i * 4 + 3] < 250) hasAlpha = true;
if (hasAlpha) {
  for (let i = 0; i < W * H; i++) fg[i] = img.px[i * 4 + 3] >= alphaMin ? 1 : 0;
} else {
  // The border says what the background is — one colour for a flat export, two for
  // a checkerboard. Collect those, then flood inwards over pixels close to any of
  // them, so a soft shadow cannot walk the fill into the figure.
  const tol = Number(arg('--tolerance', '42'));
  const bg = [];
  const noteBg = (x, y) => {
    const o = at(x, y);
    const c = [img.px[o], img.px[o + 1], img.px[o + 2]];
    if (!bg.some(b => Math.abs(b[0] - c[0]) + Math.abs(b[1] - c[1]) + Math.abs(b[2] - c[2]) <= tol)) bg.push(c);
  };
  for (let x = 0; x < W; x += 3) { noteBg(x, 0); noteBg(x, H - 1); }
  for (let y = 0; y < H; y += 3) { noteBg(0, y); noteBg(W - 1, y); }
  const isBg = (o) => bg.some(b => Math.abs(b[0] - img.px[o]) + Math.abs(b[1] - img.px[o + 1]) + Math.abs(b[2] - img.px[o + 2]) <= tol);
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (!seen[i] && isBg(at(x, y))) { seen[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) push(x + dx, y + dy);
  }
  for (let i = 0; i < W * H; i++) fg[i] = seen[i] ? 0 : 1;
}

// ---- find the figures ------------------------------------------------------------
const label = new Int32Array(W * H).fill(-1);
const boxes = [];
for (let start = 0; start < W * H; start++) {
  if (!fg[start] || label[start] >= 0) continue;
  const id = boxes.length;
  const box = { x0: W, y0: H, x1: -1, y1: -1, area: 0 };
  const stack = [start];
  label[start] = id;
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i - x) / W;
    box.area++;
    if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x;
    if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (fg[ni] && label[ni] < 0) { label[ni] = id; stack.push(ni); }
    }
  }
  boxes.push(box);
}
// Effects break off from the body — a spell burst, a thrown spark, the tip of a
// staff past a gap. Anything overlapping a figure's column and near it in height
// belongs to that figure.
const keep = boxes.map((b, i) => ({ ...b, id: i })).filter(b => b.area >= minArea * W * H);
keep.sort((a, b) => b.area - a.area);
// A body is one big blob; a spell burst or a dropped blade is a small one beside it.
// Big blobs are always separate figures — only small ones get adopted, and only by
// the figure they are actually next to.
const big = keep[0]?.area || 1;
const groups = keep.filter(b => b.area >= 0.22 * big)
  .map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, area: b.area, ids: [b.id] }));
for (const b of keep.filter(b => b.area < 0.22 * big)) {
  let best = null, bestGap = Infinity;
  for (const g of groups) {
    const gap = Math.max(0, Math.max(g.x0 - b.x1, b.x0 - g.x1)) + Math.max(0, Math.max(g.y0 - b.y1, b.y0 - g.y1));
    if (gap < bestGap) { bestGap = gap; best = g; }
  }
  if (!best || bestGap > 0.06 * (W + H) / 2) continue;   // too far from any figure: drop it
  best.x0 = Math.min(best.x0, b.x0); best.y0 = Math.min(best.y0, b.y0);
  best.x1 = Math.max(best.x1, b.x1); best.y1 = Math.max(best.y1, b.y1);
  best.ids.push(b.id); best.area += b.area;
}
// reading order: rows top to bottom, then left to right inside a row
const rows = [];
for (const g of [...groups].sort((a, b) => a.y0 - b.y0)) {
  const row = rows.find(r => Math.min(r.y1, g.y1) - Math.max(r.y0, g.y0) > 0.35 * Math.min(r.y1 - r.y0, g.y1 - g.y0));
  if (row) { row.items.push(g); row.y0 = Math.min(row.y0, g.y0); row.y1 = Math.max(row.y1, g.y1); }
  else rows.push({ y0: g.y0, y1: g.y1, items: [g] });
}
const figures = rows.flatMap(r => r.items.sort((a, b) => a.x0 - b.x0));
console.log(`${basename(sheetPath)}: ${figures.length} figures in ${rows.length} row(s)`);
if (figures.length < poses.length) {
  console.error(`painted-poses: found ${figures.length} figures but ${poses.length} pose names were given`);
  process.exit(1);
}

// ---- lay them out on one canvas --------------------------------------------------
const PAD = 24;
const maxW = Math.max(...figures.map(f => f.x1 - f.x0 + 1));
const maxH = Math.max(...figures.map(f => f.y1 - f.y0 + 1));
const CW = maxW + PAD * 2, CH = maxH + PAD * 2;
const ground = CH - PAD;                        // the floor every pose stands on
const sheetFloor = Math.max(...figures.map(f => f.y1));
mkdirSync(outDir, { recursive: true });
const renders = [];
for (let i = 0; i < poses.length; i++) {
  const f = figures[i], pose = poses[i];
  const fw = f.x1 - f.x0 + 1, fh = f.y1 - f.y0 + 1;
  const out = Buffer.alloc(CW * CH * 4);
  // a figure that ends above the sheet's floor is off the ground on purpose
  const lift = Math.round((sheetFloor - f.y1) * (CH - PAD * 2) / Math.max(1, maxH) * 0);
  const oy = ground - fh - lift, ox = Math.round((CW - fw) / 2);
  let sumX = 0, count = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const sx = f.x0 + x, sy = f.y0 + y, si = sy * W + sx;
      if (label[si] < 0 || !f.ids.includes(label[si])) continue;
      const s = at(sx, sy), d = ((oy + y) * CW + ox + x) * 4;
      out[d] = img.px[s]; out[d + 1] = img.px[s + 1]; out[d + 2] = img.px[s + 2];
      out[d + 3] = hasAlpha ? img.px[s + 3] : 255;
      if (y > fh * 0.75) { sumX += ox + x; count++; }        // centre on the feet, not the cape
    }
  }
  const file = `${cls}_${pose}.png`;
  writeFileSync(join(outDir, file), encodePng(CW, CH, out));
  renders.push({ class: cls, pose, file, root: [Math.round(count ? sumX / count : CW / 2), ground - Math.round(fh * 0.45)], ground });
  console.log(`  ${pose}: ${fw}x${fh}`);
}

const mfPath = join(outDir, 'lowpoly-renders.manifest.json');
const prev = has('--append') && existsSync(mfPath) ? JSON.parse(readFileSync(mfPath, 'utf8')) : null;
const manifest = {
  schema: 'ashenspire/lowpoly-renders/v1',
  _: 'DERIVED — written by tools/painted-poses.mjs from painted pose sheets. Same shape as the Blender renders manifest so tools/pose-sprites.mjs can read either.',
  canvas: { ortho: null, cx: null, cz: null, w: CW, h: CH },
  strip: poses,
  renders: [...(prev?.renders || []).filter(r => r.class !== cls), ...renders],
};
writeFileSync(mfPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`painted-poses -> ${outDir} (canvas ${CW}x${CH}, floor ${ground})`);
