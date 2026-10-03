// Encode the retained transparent PNG masters; no painted content is changed.
// SHARP_MODULE may point to a shared installation of sharp.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE || 'sharp');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const files = [
  ['shield-manual', 'books/shield-manual', 320, 320],
  ['blade-manual', 'books/blade-manual', 320, 320],
  ['skill-book', 'books/skill-book', 320, 320],
  ['brass-button', 'brass-button', 320, 112],
];
const receipt = [];
for (const [name, path, width, height] of files) {
  const input = resolve(here, 'masters', `${name}.png`);
  const output = resolve(root, 'assets/shop', `${path}.webp`);
  mkdirSync(dirname(output), { recursive: true });
  const source = await sharp(input).metadata();
  if (!source.hasAlpha) throw new Error(`${name}: expected transparent master`);
  const result = await sharp(input).trim().resize(width, height, {
    fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(output);
  receipt.push({ name, master: `${source.width}x${source.height}`, output: `assets/shop/${path}.webp`, width, height, bytes: result.size });
}
writeFileSync(resolve(here, 'exports.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt);
