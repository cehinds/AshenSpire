// tools/pose-cutout.mjs — cut generated full-body combat poses out of their
// flat backdrop, using the class-sprite matte, and lay them on a contact sheet.
//
//   node tools/pose-cutout.mjs --in DIR --out DIR [--tint gold]
//
// WHAT THIS IS FOR. The per-position combat art is generated as full-body
// paintings on a plain off-white backdrop (see the flow named in the evidence
// README). Before any of it can be judged as a SPRITE — on the game's dark
// ground, at the game's scale — the backdrop has to come off. This runs each
// input through the same matte, dye and rim as tools/concept-cutout.mjs, by
// importing them, so a pose and the class sprite it must sit beside were cut by
// the same code. A second matte written here would be the thing that drifts.
//
// WHAT IT DOES NOT DO. It does not frame to 450x570, bottom-align, or emit a
// manifest — those are the shipping steps, and nothing here ships yet. Output
// is one PNG per input, cropped to the figure with a small margin, plus a sheet
// of all of them on the game's ground so the set can be read at a glance.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  decodePng, encodePng, cutout, contentBox, tintOutfit, withRim, TINTS,
} from './concept-cutout.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const inDir = arg('--in', null);
const outDir = arg('--out', null);
const tintId = arg('--tint', 'gold');
if (!inDir || !outDir) {
  console.error('pose-cutout: --in DIR and --out DIR are required');
  process.exit(1);
}
const rgb = TINTS[tintId];
if (!rgb) {
  console.error(`pose-cutout: unknown tint "${tintId}" — one of ${Object.keys(TINTS).join(', ')}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const MARGIN = 0.03; // of the figure's own size, each side

/** Crop an RGBA image to a box, with the box clamped to the image. */
function crop(img, x0, y0, x1, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(img.width - 1, x1); y1 = Math.min(img.height - 1, y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.px.copy(px, y * w * 4, ((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4);
  }
  return { width: w, height: h, px };
}

const inputs = readdirSync(inDir).filter((f) => /\.png$/i.test(f)).sort();
if (!inputs.length) {
  console.error(`pose-cutout: no .png in ${inDir}`);
  process.exit(1);
}

const done = [];
for (const f of inputs) {
  const src = decodePng(readFileSync(join(inDir, f)));
  const cut = cutout(src);
  const box = contentBox(cut);
  if (!box) { console.error(`  ✗ ${f}: nothing survived the matte`); continue; }
  const mw = Math.round((box.x1 - box.x0 + 1) * MARGIN);
  const mh = Math.round((box.y1 - box.y0 + 1) * MARGIN);
  const fig = crop(cut, box.x0 - mw, box.y0 - mh, box.x1 + mw, box.y1 + mh);
  // The figure is complete — nothing is cropped at a canvas edge — so the rim
  // is allowed all the way round. That is the case bottomIsCrop=false exists for.
  const dyed = withRim(tintOutfit(fig, rgb), rgb, false);
  const name = basename(f, '.png');
  writeFileSync(join(outDir, `${name}.cut.png`), encodePng(fig.width, fig.height, fig.px));
  writeFileSync(join(outDir, `${name}.${tintId}.png`), encodePng(dyed.width, dyed.height, dyed.px));
  done.push({ name, img: dyed, raw: fig });
  console.log(`  ✓ ${name}  ${src.width}x${src.height} → figure ${fig.width}x${fig.height}`);
}

// ---- contact sheet on the game's ground ----------------------------------
// Every figure is scaled to one shared height so the poses read at the same
// size — which is how they will sit in a fight — rather than at whatever size
// the generator happened to place them in its frame.
const GROUND = [16, 13, 10];
const SHEET_H = 640;
const PAD = 18;
const scaled = done.map(({ name, img }) => {
  const s = SHEET_H / img.height;
  return { name, img, w: Math.round(img.width * s), h: SHEET_H, s };
});
const W = scaled.reduce((a, c) => a + c.w + PAD, PAD);
const H = SHEET_H + PAD * 2;
const out = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { out[i * 4] = GROUND[0]; out[i * 4 + 1] = GROUND[1]; out[i * 4 + 2] = GROUND[2]; out[i * 4 + 3] = 255; }
let ox = PAD;
for (const { img, w, h, s } of scaled) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / s));
      const sy = Math.min(img.height - 1, Math.floor(y / s));
      const q = (sy * img.width + sx) * 4;
      const a = img.px[q + 3] / 255;
      const d = ((PAD + y) * W + ox + x) * 4;
      for (let c = 0; c < 3; c++) out[d + c] = Math.round(img.px[q + c] * a + GROUND[c] * (1 - a));
    }
  }
  ox += w + PAD;
}
writeFileSync(join(outDir, `sheet.${tintId}.png`), encodePng(W, H, out));
console.log(`\nWROTE ${done.length} figures + sheet.${tintId}.png (${W}x${H}) to ${outDir}`);
