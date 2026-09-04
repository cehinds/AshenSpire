// tools/painted-poses.mjs — cut a painted pose sheet into single-pose frames.
//
//   node tools/painted-poses.mjs --sheet SHEET.png --class rogue \
//     --poses idle,guard,attack1,attack2,attack3,hit,kneel,down [--out DIR]
//     [--append] [--canvas 720x900] [--grid 3x3]
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
// the sprites downstream are identical in shape. Every class appended to one
// manifest shares one canvas; --canvas fixes that size up front when the classes
// are cut in separate runs.
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
const speckArea = Number(arg('--speck', '0.00004'));  // below this is noise, not a piece of the art
if (!sheetPath || !cls || !outDir) {
  console.error('painted-poses: --sheet FILE --class NAME --out DIR are required');
  process.exit(2);
}

// Sheets arrive as truecolour or greyscale, with or without alpha. Normalise to
// RGBA up front so nothing downstream has to know which. A one-byte-per-pixel PNG
// is either greyscale or palette-indexed and the decoder cannot tell them apart,
// so that one is refused rather than silently rendered as grey mush.
const raw = decodePng(readFileSync(sheetPath));
if (raw.bpp === 1) {
  console.error('painted-poses: greyscale or palette-indexed PNG is not supported — save the sheet as RGB or RGBA');
  process.exit(2);
}
const img = raw.bpp === 4 ? raw : (() => {
  const px = Buffer.alloc(raw.width * raw.height * 4);
  for (let i = 0; i < raw.width * raw.height; i++) {
    const o = i * raw.bpp, q = i * 4;
    if (raw.bpp === 3) { px[q] = raw.px[o]; px[q + 1] = raw.px[o + 1]; px[q + 2] = raw.px[o + 2]; px[q + 3] = 255; }
    else { px[q] = px[q + 1] = px[q + 2] = raw.px[o]; px[q + 3] = raw.px[o + 1]; }   // grey + alpha
  }
  return { width: raw.width, height: raw.height, px, bpp: 4 };
})();
const { width: W, height: H } = img;
const bpp = 4;
const at = (x, y) => (y * W + x) * bpp;

// ---- foreground mask -------------------------------------------------------------
// Transparent sheets say what is figure outright. Opaque ones (a flattened export,
// a checkerboard behind the art) are read from the border inwards: everything the
// background colours reach is background, everything they cannot reach is figure.
const fg = new Uint8Array(W * H);
// Whether the sheet is cut out or flat is decided by its border, not by any one
// pixel: a flat sheet with a single soft edge somewhere in the art would otherwise
// switch to the alpha path, where its opaque background reads as one huge figure.
let clear = 0, edge = 0;
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { edge++; if (img.px[(y * W + x) * 4 + 3] < alphaMin) clear++; }
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { edge++; if (img.px[(y * W + x) * 4 + 3] < alphaMin) clear++; }
const hasAlpha = clear >= 0.6 * edge;
if (hasAlpha) {
  for (let i = 0; i < W * H; i++) fg[i] = img.px[i * 4 + 3] >= alphaMin ? 1 : 0;
} else {
  // The border says what the background is — one colour for a flat export, two for
  // a checkerboard. Collect those, then flood inwards over pixels close to any of
  // them, so a soft shadow cannot walk the fill into the figure.
  const tol = Number(arg('--tolerance', '42'));
  // Count what the border is made of rather than trusting every sample: a figure
  // that runs off the edge of the sheet puts its own colour on the border, and
  // taking that for background would flood the fill straight into the figure.
  // Only colours covering a real share of the border count.
  const seen = [];
  const note = (x, y) => {
    const o = at(x, y);
    const c = [img.px[o], img.px[o + 1], img.px[o + 2]];
    const hit = seen.find(b => Math.abs(b.c[0] - c[0]) + Math.abs(b.c[1] - c[1]) + Math.abs(b.c[2] - c[2]) <= tol);
    if (hit) hit.n++; else seen.push({ c, n: 1 });
  };
  for (let x = 0; x < W; x++) { note(x, 0); note(x, H - 1); }
  for (let y = 0; y < H; y++) { note(0, y); note(W - 1, y); }
  const samples = 2 * (W + H);
  const share = Number(arg('--bg-share', '0.06'));
  const bg = seen.filter((b) => b.n >= share * samples).map((b) => b.c);
  if (!bg.length) bg.push(seen.sort((a, b) => b.n - a.n)[0].c);   // nothing dominant: the commonest wins
  const isBg = (o) => bg.some(b => Math.abs(b[0] - img.px[o]) + Math.abs(b[1] - img.px[o + 1]) + Math.abs(b[2] - img.px[o + 2]) <= tol);
  const filled = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (!filled[i] && isBg(at(x, y))) { filled[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) push(x + dx, y + dy);
  }
  for (let i = 0; i < W * H; i++) fg[i] = filled[i] ? 0 : 1;
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
const parts = boxes.map((b, i) => ({ ...b, id: i })).filter(b => b.area >= speckArea * W * H);
parts.sort((a, b) => b.area - a.area);
// A body is one big blob; a spell burst or a dropped blade is a small one beside it.
// Only blobs that clear the figure threshold start a figure; everything larger than
// a speck stays a candidate for adoption, however small — that is what the effects
// and detached blades are.
const big = parts[0]?.area || 1;
const bodyFloor = Math.max(minArea * W * H, 0.22 * big);
const groups = parts.filter(b => b.area >= bodyFloor)
  // bodyY0/bodyY1 stay the body's own bounds: a spark below the feet or a staff
  // above the head must not move where this figure stands
  .map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, bodyY0: b.y0, bodyY1: b.y1, area: b.area, ids: [b.id] }));
for (const b of parts.filter(b => b.area < bodyFloor)) {
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
// Reading order and floors. A figure ending above the floor is off the ground on
// purpose and keeps that gap, so the floor has to come from somewhere: normally
// the other figures in its row, or from the cells of a declared grid.
let figures, layout;
const gridArg = arg('--grid', null);
if (gridArg) {
  // --grid RxC: the sheet is a regular grid, so each figure's floor is the bottom of
  // its own cell, less the margin the artist left under the lowest-standing figure.
  // This is the only way to see lift on a sheet with one figure per row — with no
  // peers beside it, a single figure has nothing to be higher than.
  const [gr, gc] = gridArg.split(/[x,]/).map(Number);
  if (!(gr > 0 && gc > 0)) { console.error('painted-poses: --grid wants RxC, e.g. 3x3'); process.exit(2); }
  const cellH = H / gr, cellW = W / gc;
  const cell = (g) => {
    const r = Math.min(gr - 1, Math.max(0, Math.floor(((g.bodyY0 + g.bodyY1) / 2) / cellH)));
    const c = Math.min(gc - 1, Math.max(0, Math.floor(((g.x0 + g.x1) / 2) / cellW)));
    return { r, c, bottom: (r + 1) * cellH };
  };
  for (const g of groups) { const k = cell(g); g.cellR = k.r; g.cellC = k.c; g.gap = k.bottom - g.bodyY1; }
  const margin = Math.min(...groups.map((g) => g.gap));
  for (const g of groups) g.lift = Math.round(g.gap - margin);
  figures = [...groups].sort((a, b) => (a.cellR - b.cellR) || (a.cellC - b.cellC));
  layout = `${gr}x${gc} grid`;
} else {
  // Rows are decided by the bodies alone. A staff reaching into the row above or a
  // blade thrown into the one below would otherwise merge two rows into one, which
  // gets both the pose names and the floors wrong; the expanded bounds are for
  // cropping, nothing else.
  const rows = [];
  for (const g of [...groups].sort((a, b) => a.bodyY0 - b.bodyY0)) {
    const row = rows.find(r => Math.min(r.y1, g.bodyY1) - Math.max(r.y0, g.bodyY0) > 0.35 * Math.min(r.y1 - r.y0, g.bodyY1 - g.bodyY0));
    if (row) { row.items.push(g); row.y0 = Math.min(row.y0, g.bodyY0); row.y1 = Math.max(row.y1, g.bodyY1); }
    else rows.push({ y0: g.bodyY0, y1: g.bodyY1, items: [g] });
  }
  for (const r of rows) {
    const floor = Math.max(...r.items.map(i => i.bodyY1));
    for (const g of r.items) g.lift = floor - g.bodyY1;
  }
  figures = rows.flatMap(r => r.items.sort((a, b) => a.x0 - b.x0));
  layout = `${rows.length} row(s)`;
  const alone = rows.filter((r) => r.items.length === 1).length;
  if (alone) console.log(`  ${alone} row(s) hold one figure: with no peers to be higher than, those stand on the floor. Pass --grid RxC to measure them against the sheet's cells instead.`);
}
console.log(`${basename(sheetPath)}: ${figures.length} figures in ${layout}`);
if (figures.length !== poses.length) {
  // Taking the first few would be worse than stopping: one stray blob early in
  // reading order shifts every pose name after it, and the run would still report
  // success.
  console.error(`painted-poses: found ${figures.length} figures but ${poses.length} pose names were given`);
  console.error(figures.length > poses.length
    ? '  Name every figure with --poses, or raise --min-area so stray artwork is not read as a figure.'
    : '  Name fewer poses with --poses, or lower --min-area so a small figure is not missed.');
  process.exit(1);
}

// ---- lay them out on one canvas --------------------------------------------------
const PAD = 24;
const used = figures.slice(0, poses.length);
const maxW = Math.max(...used.map(f => f.x1 - f.x0 + 1));
// above the floor line and below it are measured apart: a figure is placed by where
// its feet are, and anything hanging past them needs room of its own
const maxAbove = Math.max(...used.map(f => f.bodyY1 - f.y0 + 1));
const maxBelow = Math.max(0, ...used.map(f => f.y1 - f.bodyY1));
const maxLift = Math.max(...used.map(f => f.lift));
const maxH = maxAbove + maxBelow;
mkdirSync(outDir, { recursive: true });
const mfPath = join(outDir, 'lowpoly-renders.manifest.json');
const prev = has('--append') && existsSync(mfPath) ? JSON.parse(readFileSync(mfPath, 'utf8')) : null;
// Every class in a manifest has to share one canvas: the sprite tool writes a single
// canvas declaration, and offsets, roots and floors are all read against it. An
// appended class either fits the canvas already there or the run stops and says so.
const forced = arg('--canvas', null);
let CW = maxW + PAD * 2, CH = maxAbove + maxLift + maxBelow + PAD * 2;
if (forced) {
  const [fw, fh] = forced.split(/[x,]/).map(Number);
  if (!(fw > 0 && fh > 0)) { console.error('painted-poses: --canvas wants WxH, e.g. 720x900'); process.exit(2); }
  // frames already in the manifest were placed on the canvas it names; a different
  // one here would leave their offsets and floors describing a canvas that is gone
  if (prev?.canvas?.w && (prev.canvas.w !== fw || prev.canvas.h !== fh)) {
    console.error(`painted-poses: this manifest is on a ${prev.canvas.w}x${prev.canvas.h} canvas and --canvas says ${fw}x${fh}.`);
    console.error('  Pass the canvas the manifest already uses, or cut every class again in one run.');
    process.exit(1);
  }
  CW = fw; CH = fh;
} else if (prev?.canvas?.w) { CW = prev.canvas.w; CH = prev.canvas.h; }
// the floor sits PAD above the bottom, so a figure needs its own height, its lift
// off the floor, and that padding — anything less places it off the top edge
if (CW < maxW || CH < maxAbove + maxLift + maxBelow + PAD) {
  console.error(`painted-poses: these figures need at least ${maxW + PAD * 2}x${maxAbove + maxLift + maxBelow + PAD * 2}, but the canvas is ${CW}x${CH}.`);
  console.error('  Cut every class in one run, or give them all the same --canvas WxH.');
  process.exit(1);
}
const ground = CH - PAD;                        // the lowest line a figure rests on
const renders = [];
for (let i = 0; i < poses.length; i++) {
  const f = figures[i], pose = poses[i];
  const fw = f.x1 - f.x0 + 1, fh = f.y1 - f.y0 + 1;
  const out = Buffer.alloc(CW * CH * 4);
  // The floor line is the lowest ink in the figure, so a blade lying past its feet
  // rests on the floor and the body stands that much above it. Placing the feet on
  // the line instead would put the blade below it, and the sprite step clears
  // everything below the floor before it crops.
  const oy = ground - f.lift - (f.y1 - f.y0), ox = Math.round((CW - fw) / 2);
  // the lower quarter of the body, in rows of this crop
  const footLine = (f.bodyY0 - f.y0) + 0.75 * (f.bodyY1 - f.bodyY0);
  let sumX = 0, count = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const sx = f.x0 + x, sy = f.y0 + y, si = sy * W + sx;
      if (label[si] < 0 || !f.ids.includes(label[si])) continue;
      const isBody = label[si] === f.ids[0];
      const s = at(sx, sy), d = ((oy + y) * CW + ox + x) * 4;
      out[d] = img.px[s]; out[d + 1] = img.px[s + 1]; out[d + 2] = img.px[s + 2];
      out[d + 3] = hasAlpha ? img.px[s + 3] : 255;
      // centre on the feet of the body itself — not on the cape, and not on a
      // dropped blade lying beside it. The quarter is of the body's own height:
      // measured against the whole group, a long piece below the feet could put
      // every body pixel above the line and leave nothing to average.
      if (isBody && y > footLine) { sumX += ox + x; count++; }
    }
  }
  const file = `${cls}_${pose}.png`;
  writeFileSync(join(outDir, file), encodePng(CW, CH, out));
  // the body's feet sit `below` above the floor when something hangs past them, and
  // the pelvis rides up with it
  const below = f.y1 - f.bodyY1;
  renders.push({ class: cls, pose, file, root: [Math.round(count ? sumX / count : CW / 2), ground - f.lift - below - Math.round((f.bodyY1 - f.bodyY0) * 0.45)], ground });
  console.log(`  ${pose}: ${fw}x${fh}`);
}

const manifest = {
  schema: 'ashenspire/lowpoly-renders/v1',
  _: 'DERIVED — written by tools/painted-poses.mjs from painted pose sheets. Same shape as the Blender renders manifest so tools/pose-sprites.mjs can read either.',
  canvas: { ortho: null, cx: null, cz: null, w: CW, h: CH },
  // the strip names every pose in the manifest, so an appended class adds its own
  // names to the ones already there rather than replacing them
  strip: prev?.strip ? [...prev.strip, ...poses.filter((p) => !prev.strip.includes(p))] : poses,
  // replace only the (class, pose) rows this run supplies: a second sheet for a
  // class that carries other poses must not delete the ones already cut
  renders: [...(prev?.renders || []).filter(r => !(r.class === cls && poses.includes(r.pose))), ...renders],
};
writeFileSync(mfPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`painted-poses -> ${outDir} (canvas ${CW}x${CH}, floor ${ground})`);
