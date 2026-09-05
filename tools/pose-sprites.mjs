// tools/pose-sprites.mjs — turn a folder of pose renders into shipped-shape sprites.
//
//   node tools/pose-sprites.mjs --in RENDER_DIR --out OUT_DIR [--manifest NAME]
//
// RENDER_DIR holds RGBA PNGs and a renders manifest (default
// lowpoly-renders.manifest.json, as tools/lowpoly-blender.py writes) whose rows
// carry `file`, `root` [x,y] and `ground` y, all in render pixels. For every
// render and every tint: dye the garment and light the rim with the SAME
// functions the class sprites use (tools/concept-cutout.mjs exports them), cut
// everything below the ground line (a kneel sinks through the floor on
// purpose), crop tight, write WebP. The output manifest records each crop's
// `offset` on the shared canvas plus `root` and `ground`, so a renderer
// registers every pose of a class to the same feet and floor without a
// fixed-size frame that would shrink the figure to fit a lunge.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { decodePng, encodePng, contentBox, tintOutfit, withRim, TINTS } from './concept-cutout.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const inDir = arg('--in', null), outDir = arg('--out', null);
const manifestName = arg('--manifest', 'lowpoly-renders.manifest.json');
if (!inDir || !outDir) { console.error('pose-sprites: --in DIR and --out DIR are required'); process.exit(2); }
const renders = JSON.parse(readFileSync(join(inDir, manifestName), 'utf8'));
let cwebpVersion = 'unknown';
try { cwebpVersion = execFileSync('cwebp', ['-version'], { encoding: 'utf8' }).trim(); }
catch { console.error('pose-sprites: cwebp is required (libwebp)'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
// The output folder is described entirely by the manifest written here, so it is
// cleared first. A run that carries fewer classes than the folder already held
// would quietly drop the rest, so say so rather than letting it pass unnoticed.
const outManifest = join(outDir, 'pose-sprites.manifest.json');
if (existsSync(outManifest)) {
  try {
    // By class AND pose. Comparing class names alone passed a run that carried
    // every class but only some of their poses — the clear below then took the
    // rest of the poses with it, which is the same silent loss one level down.
    const had = new Set((JSON.parse(readFileSync(outManifest, 'utf8')).sprites || []).map((s) => `${s.class}/${s.pose}`));
    const now = new Set(renders.renders.map((r) => `${r.class}/${r.pose}`));
    const dropped = [...had].filter((k) => !now.has(k));
    if (dropped.length) {
      const shown = dropped.slice(0, 6).join(', ') + (dropped.length > 6 ? `, and ${dropped.length - 6} more` : '');
      console.error(`pose-sprites: ${outDir} holds ${dropped.length} pose(s) this run does not carry: ${shown}.`);
      console.error('  Cut every class and pose into one render folder (--append) and publish them together, or pass --out to a different folder.');
      process.exit(1);
    }
  } catch { /* an unreadable manifest is not a reason to stop */ }
}
for (const f of readdirSync(outDir)) if (f.endsWith('.webp')) rmSync(join(outDir, f));

const sprites = [];
let canvas = null;
for (const r of renders.renders) {
  const img = decodePng(readFileSync(join(inDir, r.file)));
  if (img.bpp !== 4) { console.error(`pose-sprites: ${r.file} is not RGBA`); process.exit(1); }
  canvas = canvas || { width: img.width, height: img.height };
  const groundRow = Math.round(r.ground);
  // below the floor is not drawn: clear it before anything measures the figure
  for (let y = groundRow + 1; y < img.height; y++) img.px.fill(0, y * img.width * 4, (y + 1) * img.width * 4);
  const box = contentBox(img);
  const touchesGround = box.y1 >= groundRow;
  for (const [tint, rgb] of Object.entries(TINTS)) {
    const dyed = withRim(tintOutfit(img, rgb), rgb, touchesGround);
    const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) dyed.px.copy(out, y * w * 4, ((box.y0 + y) * img.width + box.x0) * 4, ((box.y0 + y) * img.width + box.x0 + w) * 4);
    const name = `${r.class}_${r.pose}_${tint}`;
    const png = join(outDir, name + '.png');
    writeFileSync(png, encodePng(w, h, out));
    execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '90', '-exact', png, '-o', join(outDir, name + '.webp')]);
    rmSync(png);
    sprites.push({ class: r.class, pose: r.pose, tint, file: name + '.webp', width: w, height: h,
      offset: [box.x0, box.y0], root: r.root, ground: r.ground, touches_ground: touchesGround });
  }
  console.log(`${r.class} ${r.pose}: ${box.x1 - box.x0 + 1}x${box.y1 - box.y0 + 1}`);
}
const manifest = {
  schema: 'ashenspire/pose-sprites/v2',
  _: 'DERIVED — written by tools/pose-sprites.mjs from renders of tools/lowpoly-blender.py. Coordinates are pixels on the shared render canvas; a renderer registers poses by root and ground, not by frame.',
  canvas,
  source_manifest: manifestName,
  strip: renders.strip,
  recipe: {
    figures: 'tools/lowpoly-blender.py — skin-modifier body on an armature, flat-shaded low poly, dressed per class',
    dye: 'tintOutfit() — hue toward the tint, saturation part-way, value untouched, greys held back; withRim() 3px accent',
    floor: 'rows below `ground` cleared before the crop',
    encoder: `cwebp ${cwebpVersion} -q 80 -alpha_q 90 -exact`,
  },
  tints: Object.fromEntries(Object.entries(TINTS).map(([k, v]) => [k, '#' + v.map((c) => c.toString(16).padStart(2, '0')).join('')])),
  sprites,
};
writeFileSync(join(outDir, 'pose-sprites.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`pose-sprites: ${sprites.length} sprites -> ${outDir}`);
