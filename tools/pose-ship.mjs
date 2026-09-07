// tools/pose-ship.mjs — publish a subset of the pose sprites into assets/.
//
//   node tools/pose-ship.mjs [--in art/poses] [--out assets/poses]
//     [--poses idle,guard,attack1,attack2,attack3,attack4,hit] [--scale 0.75] [--quality 78]
//
// art/poses holds every pose at render resolution — currently 720 files — and the
// bundler inlines everything under assets/, so shipping that folder whole would
// add most of it to the single file a player downloads. The combat figure is
// drawn into a 150x190 CSS box, so a frame taller than about 400px is detail
// nobody can see. This copies the poses the animation actually plays, scaled to
// what the box needs, and rewrites the manifest geometry by the same factor so
// registration still lines up: canvas, crop offset, root and floor all move
// together.
//
// The output folder is a build input, not a build product: it is committed, and
// the animation service reads its manifest at runtime. Rerun this after
// regenerating art/poses.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decodePng, encodePng, resample } from './concept-cutout.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const inDir = arg('--in', 'art/poses');
const outDir = arg('--out', 'assets/poses');
const wanted = (arg('--poses', 'idle,guard,attack1,attack2,attack3,attack4,hit') || '').split(',').filter(Boolean);
// 0.75 is what the committed set was cut at — see the quality note below for why a
// default that disagrees with the committed output is a defect rather than a taste.
const scale = Number(arg('--scale', '0.75'));
// 78 is what the committed set was cut at: a default that disagrees rewrites all
// shipped files on a rerun that changed nothing.
const quality = Number(arg('--quality', '78'));
if (!(scale > 0 && scale <= 1)) { console.error('pose-ship: --scale must be between 0 and 1'); process.exit(2); }
if (!(quality >= 0 && quality <= 100)) { console.error('pose-ship: --quality must be between 0 and 100'); process.exit(2); }

const srcManifest = join(inDir, 'pose-sprites.manifest.json');
if (!existsSync(srcManifest)) {
  console.error(`pose-ship: ${srcManifest} not found — run tools/pose-sprites.mjs first`);
  process.exit(2);
}
const src = JSON.parse(readFileSync(srcManifest, 'utf8'));
const keep = src.sprites.filter((s) => wanted.includes(s.pose));
if (!keep.length) {
  console.error(`pose-ship: none of ${wanted.join(', ')} are in ${srcManifest}`);
  console.error(`  it holds: ${[...new Set(src.sprites.map((s) => s.pose))].join(', ')}`);
  process.exit(1);
}
const classes = [...new Set(src.sprites.map((s) => s.class))];
const tints = [...new Set(src.sprites.map((s) => s.tint))];
const gaps = [];
for (const c of classes) {
  for (const t of tints) {
    for (const p of wanted) if (!keep.some((s) => s.class === c && s.pose === p && s.tint === t)) gaps.push(`${c}/${p}/${t}`);
  }
}
if (gaps.length) {
  // Per class, pose AND tint. Pooling them across classes passed a set where one
  // class was missing a pose entirely: the figure still chose the animated style
  // (which only checks that idle exists) and that pose then did nothing at all.
  console.error(`pose-ship: ${srcManifest} is missing ${gaps.length} frame(s) the shipped set needs: ${gaps.slice(0, 6).join(', ')}${gaps.length > 6 ? ', …' : ''}`);
  process.exit(1);
}

try { execFileSync('cwebp', ['-version'], { encoding: 'utf8' }); execFileSync('dwebp', ['-version'], { encoding: 'utf8' }); }
catch { console.error('pose-ship: cwebp and dwebp are required (libwebp)'); process.exit(2); }

mkdirSync(outDir, { recursive: true });
const tmp = join(tmpdir(), `pose-ship-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const staged = join(tmp, 'staged');
mkdirSync(staged, { recursive: true });
const round = (n) => Math.round(n * 10) / 10;

let bytes = 0;
const sprites = [];
for (const s of keep) {
  const png = join(tmp, 'a.png'), small = join(tmp, 'b.png');
  execFileSync('dwebp', [join(inDir, s.file), '-o', png], { stdio: 'ignore' });
  const img = decodePng(readFileSync(png));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  // resample hands back an image object; the PNG writer takes its pixels
  writeFileSync(small, encodePng(w, h, resample(img, 0, 0, img.width, img.height, w, h).px));
  // into the scratch directory: the committed frames are only replaced once every
  // one of these has encoded, so a failure part-way leaves the shipped set intact
  // rather than half-deleted with a stale table beside it
  const out = join(staged, s.file);
  execFileSync('cwebp', ['-q', String(quality), '-alpha_q', '100', '-exact', small, '-o', out], { stdio: 'ignore' });
  bytes += readFileSync(out).length;
  sprites.push({
    ...s,
    width: w,
    height: h,
    offset: [Math.round(s.offset[0] * scale), Math.round(s.offset[1] * scale)],
    root: [round(s.root[0] * scale), round(s.root[1] * scale)],
    ground: round(s.ground * scale),
  });
}
// every frame encoded: now swap them in
for (const f of readdirSync(outDir)) if (f.endsWith('.webp')) rmSync(join(outDir, f));
for (const f of readdirSync(staged)) writeFileSync(join(outDir, f), readFileSync(join(staged, f)));
rmSync(tmp, { recursive: true, force: true });

writeFileSync(join(outDir, 'pose-sprites.manifest.json'), `${JSON.stringify({
  schema: 'ashenspire/pose-sprites/v2',
  _: 'Generated by tools/pose-ship.mjs from ' + srcManifest + ' — do not hand-edit.',
  scaled_from: { manifest: srcManifest, scale, quality },
  canvas: { width: Math.round(src.canvas.width * scale), height: Math.round(src.canvas.height * scale) },
  strip: wanted,
  tints: src.tints,
  sprites,
}, null, 1)}\n`);

// The manifest also ships as a source module. The bundler inlines files under
// assets/ by extension and .json is not one of them, so a build that fetched the
// JSON would find nothing; a generated table is read as source, needs no fetch,
// and works from file:// where fetch does not.
const table = sprites.map((s) => `  ['${s.class}_${s.pose}_${s.tint}', { f: '${s.file}', w: ${s.width}, h: ${s.height}, x: ${s.offset[0]}, y: ${s.offset[1]}, rx: ${s.root[0]}, ry: ${s.root[1]}, g: ${s.ground} }],`);
writeFileSync('src/content/poseSprites.js', `// src/content/poseSprites.js — GENERATED by tools/pose-ship.mjs. Do not edit.
//
// One row per shipped pose frame, keyed \`class_pose_tint\`. The geometry is in
// canvas pixels: x/y is where the crop sits on the shared canvas, rx/ry the
// pelvis, g the floor line. Registration comes from these — frames differ in
// size, and a figure swapped by size alone would jump.
//
// Rerun: node tools/pose-ship.mjs
export const POSE_CANVAS = { width: ${Math.round(src.canvas.width * scale)}, height: ${Math.round(src.canvas.height * scale)} };
export const POSE_DIR = '${outDir}/';
export const POSE_STRIP = ${JSON.stringify(wanted)};
export const POSE_TINTS = ${JSON.stringify(src.tints || [])};
export const POSE_FRAMES = new Map([
${table.join('\n')}
]);
`);

const poses = [...new Set(sprites.map((s) => s.pose))];
console.log(`pose-ship: ${sprites.length} sprites (${poses.join(', ')}) at ${scale}x -> ${outDir}, ${(bytes / 1024).toFixed(0)} KB`);
console.log('           src/content/poseSprites.js rewritten');
