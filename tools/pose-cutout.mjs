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
// TWO MODES. By default it ships NOTHING: output is one PNG per input, cropped
// to the figure with a small margin, plus a sheet of all of them on the game's
// ground so the set can be read at a glance. That is the mode for judging art.
//
//   node tools/pose-cutout.mjs --ship --in DIR --out assets/sprites [--pose NAME]
//
// `--ship` performs the shipping steps this note used to say lived elsewhere —
// frame to 450x570 bottom-aligned at ONE shared scale, dye all five tints,
// encode WebP, and rewrite the class-sprite manifest. It is here and not in
// concept-cutout.mjs because that tool reads the frozen packet's PINNED GIT
// BLOBS by oid: its inputs are a closed set that a pose is not a member of.
// Sharing the framing arithmetic by copying it would have been the second copy;
// sharing it by import is why every frame constant and every pixel routine
// below comes from concept-cutout rather than being restated here.
//
// In `--ship` mode `--in` is a DIRECTORY OF CLASS DIRECTORIES (`reaver/`,
// `starseer/`, ...), each holding the pose to ship, so the class a sprite
// belongs to is the directory's own name rather than a filename convention
// this tool would have to parse and could misread.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import {
  decodePng, encodePng, cutout, contentBox, tintOutfit, withRim, resample,
  TINTS, OUT_W, OUT_H,
} from './concept-cutout.mjs';
import { medallionPct, medallionDeclared } from '../src/content/classArtAnchors.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const inDir = arg('--in', null);
const outDir = arg('--out', null);
const tintId = arg('--tint', 'gold');
const ship = args.includes('--ship');
const poseName = arg('--pose', 'idle-full');
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

/**
 * THE GROUND SHADOW THE EDGE MATTE CANNOT REACH.
 *
 * Every pose is asked for on a plain plate with "no floor, no shadow", and the
 * generator mostly obeys. When it does not, the shadow it paints under the
 * boots is enclosed by the figure's own legs and feet, so the edge flood-fill
 * never arrives at it and the pocket remover sees it as part of the subject.
 * It survives as a pale puddle, which on the game's dark ground is a lamp.
 *
 * A row-based trim is what this looked like it wanted and it is wrong: measured
 * on the Rogue, the shadow spans the same rows as the boots (y 718-745, pale
 * rising 11%->83% and falling back while the lit count stays 120-330), so
 * dropping whole rows takes the feet with them. Per pixel it separates cleanly:
 * at the worst row 260 of 314 lit pixels are pale and the remaining 54 are boot.
 *
 * So the test is per pixel and the same one a matte uses — near-white and
 * nearly colourless — restricted to the foot of the figure, where a shadow can
 * be and where this art keeps nothing pale. It is a NO-OP on a clean source,
 * which is the claim that makes it safe to run on all of them: measured over
 * the same band, the Reaver carries 0-2 pale pixels per row and the Starseer
 * 0-2, against the Rogue's 223.
 *
 * WHY THE THRESHOLDS DO NOT MOVE, and this is the useful part, because the
 * obvious next thought is to widen them. Removing the shadow's pale CORE leaves
 * its soft outer gradient, which the rim then traces as a faint contour on the
 * ground. That gradient sits at max-channel 110-170 — and in exactly that band
 * the CLEAN sources are nearly colourless too: 100% of the Starseer's pixels
 * there and 89% of the Reaver's fall under the 0.22 saturation bar, being boot
 * and leather midtones rather than shadow. Lowering the floor to catch the
 * gradient would therefore punch 140 pixels out of one good pair of boots and
 * 108 out of another. Brightness and colour cannot separate the two at that
 * level, so this cleaner deliberately stops at the core and the remaining
 * contour stays a defect of the SOURCE, fixed by regenerating that plate with
 * the shadow actually suppressed — not by tuning these numbers.
 */
function dropGroundShadow(img, box, { band = 0.12, minMax = 170, maxSat = 0.22 } = {}) {
  const from = box.y1 - Math.round((box.y1 - box.y0 + 1) * band);
  let dropped = 0;
  for (let y = Math.max(box.y0, from); y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const q = (y * img.width + x) * 4;
      if (img.px[q + 3] < 128) continue;
      const r = img.px[q], g = img.px[q + 1], b = img.px[q + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx <= minMax) continue;
      if ((mx === 0 ? 0 : (mx - mn) / mx) >= maxSat) continue;
      img.px[q + 3] = 0;
      dropped++;
    }
  }
  return dropped;
}

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


// ═══ --ship: the shipping steps ═════════════════════════════════════════════
if (ship) {
  // FAIL RATHER THAN GUESS, the same gate concept-cutout keeps at the top of
  // its own run and for the same reason: the medallion overlay is positioned
  // from a MEASURED per-class anchor, and an unmeasured figure gets no
  // medallion at all. Caught before any bytes are written, so replacing art
  // surfaces as "measure this" rather than as a sigil silently missing from a
  // shipped sprite — or, worse, one sitting on a face.
  const classes = readdirSync(inDir)
    .filter((d) => statSync(join(inDir, d)).isDirectory())
    .sort();
  if (!classes.length) {
    console.error(`pose-cutout --ship: no class directories in ${inDir}`);
    process.exit(1);
  }
  const unanchored = classes.filter((c) => !medallionDeclared(c));
  if (unanchored.length) {
    console.error(
      `No medallion anchor for: ${unanchored.join(', ')}.\n`
      + '  Measure the chest position on each figure and add it to\n'
      + '  src/content/classArtAnchors.js — see that file for how the others were taken.',
    );
    process.exit(1);
  }

  // Cut every class first, because the scale below is shared and cannot be
  // chosen until the whole set has been measured.
  const shipCuts = {};
  for (const cls of classes) {
    const src = join(inDir, cls, `${poseName}.png`);
    let bytes;
    try { bytes = readFileSync(src); } catch {
      console.error(`pose-cutout --ship: ${cls} has no ${poseName}.png`);
      process.exit(1);
    }
    const cut = cutout(decodePng(bytes));
    const box = contentBox(cut);
    if (!box) { console.error(`pose-cutout --ship: ${cls} — nothing survived the matte`); process.exit(1); }
    // A full-body pose is generated with the boots and their ground-line inside
    // the frame, so the lowest row of the cutout is the character's own outline
    // and the rim is allowed all the way round. A source whose figure DOES run
    // off its canvas is the bust case, and saying so is better than ringing a
    // crop line as if it were a silhouette.
    const bottomIsCrop = box.y1 >= cut.height - 1;
    if (bottomIsCrop) {
      console.error(`pose-cutout --ship: ${cls}/${poseName}.png runs off the bottom of its canvas — that is a crop, not a full body.`);
      process.exit(1);
    }
    // Before framing, because dropping the shadow moves the figure's bottom and
    // the frame is bottom-aligned to it: measure, clean, measure again.
    const shed = dropGroundShadow(cut, box);
    const box2 = shed ? contentBox(cut) : box;
    shipCuts[cls] = { cut, box: box2 };
    console.log(`${cls.padEnd(9)} content ${box2.x1 - box2.x0 + 1}x${box2.y1 - box2.y0 + 1}`
      + (shed ? `  (shed ${shed} ground-shadow px)` : ''));
  }

  // ONE scale for the set, fit by BOTH axes — concept-cutout's own reasoning,
  // and it matters more here: a full-body figure is far taller than it is wide,
  // so height decides, and a class that happens to be drawn wider must not be
  // cropped at the sides to satisfy it.
  const MARGIN_TOP = 0.03;
  const MARGIN_BOTTOM = 0.02;
  const MARGIN_SIDE = 0.02;
  const tallest = Math.max(...Object.values(shipCuts).map(({ box }) => box.y1 - box.y0 + 1));
  const widest = Math.max(...Object.values(shipCuts).map(({ box }) => box.x1 - box.x0 + 1));
  const scale = Math.min(
    (OUT_H * (1 - MARGIN_TOP - MARGIN_BOTTOM)) / tallest,
    (OUT_W * (1 - 2 * MARGIN_SIDE)) / widest,
  );

  mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const [cls, { cut, box }] of Object.entries(shipCuts)) {
    const cw = box.x1 - box.x0 + 1;
    const ch = box.y1 - box.y0 + 1;
    const dw = Math.max(1, Math.round(cw * scale));
    const dh = Math.max(1, Math.round(ch * scale));
    const fig = resample(cut, box.x0, box.y0, cw, ch, dw, dh);
    // Bottom-aligned, to match `align-items: flex-end` on the sprite host: the
    // figure stands on the bottom of its frame rather than floating in it.
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
    for (const [tid, trgb] of Object.entries(TINTS)) {
      const png = join(outDir, `${cls}_${tid}.png`);
      // Cloth first, then the accent edge ON TOP of it, exactly as
      // concept-cutout orders them: the rim marks the silhouette and stays the
      // tint's own colour at full strength, so it must not be hue-rotated.
      const dyed = withRim(tintOutfit(framed, trgb), trgb, false);
      writeFileSync(png, encodePng(OUT_W, OUT_H, dyed.px));
      // -exact: without it cwebp rewrites the RGB under fully transparent
      // pixels to compress better, leaving colour hiding in invisible areas.
      execFileSync('cwebp', ['-quiet', '-exact', '-q', '88', '-alpha_q', '100', png,
        '-o', join(outDir, `${cls}_${tid}.webp`)]);
      rmSync(png);
    }
    rows.push({ cls, cw, ch, dw, dh, ox, oy });
    console.log(`${cls.padEnd(9)} framed ${dw}x${dh} at (${ox},${oy}) -> 5 tints`);
  }

  // THE MANIFEST IS PART OF SHIPPING (RUNBOOKS/art.md §3), so it is written
  // here rather than left for a hand to reconcile: every field below is read
  // back off the bytes that were just written. Only the rows for the classes
  // this run shipped are replaced — a class still on its old art keeps its own
  // row, because rewriting it would be claiming a recipe that did not run.
  const manifestPath = join(outDir, 'class-sprites.manifest.json');
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { manifest = null; }
  if (manifest && Array.isArray(manifest.assets)) {
    const cwebpVersion = execFileSync('cwebp', ['-version'], { encoding: 'utf8' }).split('\n')[0].trim();
    for (const { cls, cw, ch, dw, dh, ox, oy } of rows) {
      for (const tid of Object.keys(TINTS)) {
        const rel = `assets/sprites/${cls}_${tid}.webp`;
        const bytes = readFileSync(join(outDir, `${cls}_${tid}.webp`));
        const row = {
          asset_id: `class.sprite.${cls}.${tid}`,
          path: rel,
          format: 'WebP, lossy q88, alpha_q 100, -exact (RGBA)',
          dimensions: `${OUT_W}x${OUT_H}`,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          source_recipe: {
            source_path: `${inDir}/${cls}/${poseName}.png`,
            command: `node tools/pose-cutout.mjs --ship --in ${inDir} --out ${outDir}`,
            steps: 'edge flood-fill background removal, enclosed-pocket removal, '
              + 'detached-speck removal, 3x3 feather, un-premultiply against white, '
              + `box-filter downscale, bottom-align on ${OUT_W}x${OUT_H}, `
              + 'garment dye, accent rim all round (the figure is complete, so no crop edge)',
            tint_rgb: `#${TINTS[tid].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
            tool_versions: { node: process.version, cwebp: cwebpVersion },
          },
          anchor: {
            // The RESAMPLED box, not the source box. `ox`/`oy` are coordinates
            // in the 450x570 destination, so recording the pre-scale `cw`/`ch`
            // beside them described a 738px-tall figure inside a 570px image —
            // internally inconsistent, and not what concept-cutout records.
            content_box_px: { w: dw, h: dh },
            placed_at_px: { x: ox, y: oy },
            baseline: `bottom-aligned, ${MARGIN_BOTTOM * 100}% margin; shared scale across the shipped set`,
            medallion_center_pct: medallionPct(cls),
          },
          runtime_budget: 'embedded base64 in the single-file build; WebP chosen over PNG for that reason',
          fallback_id: `CLASS_SVG.${cls} — inline SVG silhouette in src/ui/assets.js`,
          provenance: 'AI-generated for this project; CC0. See CREDITS.md and the source folder README.',
          consumers: ['src/ui/assets.js renderedSpriteUrl()', 'src/ui/assets.js classSprite()'],
        };
        const at = manifest.assets.findIndex((x) => x.asset_id === row.asset_id);
        if (at >= 0) manifest.assets[at] = row; else manifest.assets.push(row);
      }
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`manifest: ${rows.length * Object.keys(TINTS).length} row(s) rewritten in ${manifestPath}`);
  } else {
    console.log('manifest: none found beside the output — nothing to rewrite');
  }

  console.log(`\nSHIPPED ${rows.length} class(es) x 5 tints to ${outDir}`);
  console.log(`shared scale ${scale.toFixed(4)} from tallest ${tallest}px, widest ${widest}px`);
  console.log('medallion anchors used: ' + rows
    .map(({ cls }) => `${cls} ${medallionPct(cls) == null ? 'none (measured unplaceable)' : `${medallionPct(cls)}%`}`)
    .join(', '));
  process.exit(0);
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
