// tools/component-refs.mjs — cut each costume component out of its painting and
// sample its palette, so the low-poly parts are built against a reference crop
// and coloured from the paint, not from memory.
//
//   node tools/component-refs.mjs [--out DIR]     (default build/components)
//
// Reads tools/lowpoly-components.json. Writes <out>/<class>/<part>.png (the crop,
// matted) and <out>/palette.json: per part, the mean colour of its opaque pixels,
// its darker quartile and lighter quartile, and how much of the crop is gold.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, cutout } from './concept-cutout.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const outRoot = arg('--out', join(ROOT, 'build', 'components'));
const INV = JSON.parse(readFileSync(join(ROOT, 'tools', 'lowpoly-components.json'), 'utf8'));
const palette = {};
const isGold = (r, g, b) => r > 120 && g > 90 && b < 90 && r - b > 60;
for (const cls of Object.keys(INV)) {
  if (cls.startsWith('_')) continue;
  const img = cutout(decodePng(readFileSync(join(ROOT, 'docs', 'art-evidence', '2026-09-03', 'concepts', `${cls}-concept-v1.png`))));
  mkdirSync(join(outRoot, cls), { recursive: true });
  palette[cls] = {};
  const jobs = Object.entries(INV[cls]).filter(([k]) => k !== 'slots').map(([name, part]) => [name, part.crop, img]);
  for (const [slot, box] of Object.entries(INV[cls].slots || {})) {
    if (slot === 'legs' || slot === 'feet') {
      if (cls !== 'rogue') continue;
      const fb = decodePng(readFileSync(join(ROOT, 'docs', 'art-evidence', '2026-09-03', 'poses', 'rogue', 'idle-a.png')));
      jobs.push([`slot_${slot}`, box, fb.bpp === 4 ? fb : { ...fb, px: (() => { const o = Buffer.alloc(fb.width * fb.height * 4); for (let i = 0; i < fb.width * fb.height; i++) { o[i*4] = fb.px[i*fb.bpp]; o[i*4+1] = fb.px[i*fb.bpp+1]; o[i*4+2] = fb.px[i*fb.bpp+2]; o[i*4+3] = 255; } return o; })() }]);
    } else jobs.push([`slot_${slot}`, box, img]);
  }
  for (const [name, crop, src] of jobs) {
    const { width: w, px } = src;
    const [x0, y0, x1, y1] = crop; const cw = Math.max(1, Math.min(x1, src.width) - x0), ch = Math.max(1, Math.min(y1, src.height) - y0);
    const out = Buffer.alloc(cw * ch * 4);
    const lum = []; let gold = 0, n = 0; const sum = [0, 0, 0];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const s = ((y0 + y) * w + x0 + x) * 4, d = (y * cw + x) * 4;
      out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3];
      if (px[s + 3] < 200) continue;
      n++; if (isGold(px[s], px[s + 1], px[s + 2])) { gold++; continue; }
      sum[0] += px[s]; sum[1] += px[s + 1]; sum[2] += px[s + 2];
      lum.push([px[s] * 0.3 + px[s + 1] * 0.59 + px[s + 2] * 0.11, px[s], px[s + 1], px[s + 2]]);
    }
    lum.sort((a, b) => a[0] - b[0]);
    const q = (f) => { const i = Math.floor(lum.length * f); const sl = lum.slice(Math.max(0, i - lum.length * 0.05), i + lum.length * 0.05 + 1); const m = [0, 0, 0]; for (const l of sl) { m[0] += l[1]; m[1] += l[2]; m[2] += l[3]; } return m.map((v) => Math.round(v / Math.max(1, sl.length))); };
    const cnt = Math.max(1, n - gold);
    palette[cls][name] = { mean: sum.map((v) => Math.round(v / cnt)), dark: q(0.25), light: q(0.8), gold_share: +(gold / Math.max(1, n)).toFixed(3), pixels: n };
    writeFileSync(join(outRoot, cls, `${name}.png`), encodePng(cw, ch, out));
  }
  console.log(`${cls}: ${jobs.length} crops`);
}
writeFileSync(join(outRoot, 'palette.json'), JSON.stringify(palette, null, 2) + '\n');
console.log(`component-refs -> ${outRoot}`);
