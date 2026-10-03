// Reproducible native vector layers; painted masters are only resized/encoded.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE || 'sharp');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const save = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
const svg = (body, size = 128) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>\n`;
const shapes = {
  blade: '<path d="M64 10 76 29 70 78 89 83 86 92 70 88 70 108 77 115 51 115 58 108 58 88 42 92 39 83 58 78 52 29Z"/>',
  shield: '<path d="M64 12 105 28 99 72Q92 99 64 116 36 99 29 72L23 28Z"/><path d="M64 25V98M38 49H90" fill="none" stroke="#000" stroke-width="7"/>',
  focus: '<path d="m64 12 25 35-12 28H51L39 47Z M39 82H89L96 97H32ZM28 105H100V114H28Z"/><path d="M17 40H29M99 40H111M24 17 34 27M104 17 94 27" fill="none" stroke-width="6"/>',
  paired: '<path d="m26 13 13 10 15 49-9 5 9 23 8 1 3 10-24 8-2-10 5-5-9-23-10 3-3-9 9-5-17-45ZM102 13l-13 10-15 49 9 5-9 23-8 1-3 10 24 8 2-10-5-5 9-23 10 3 3-9-9-5 17-45Z"/>',
  spell: '<path d="M13 57Q35 48 59 63V111Q38 97 13 104ZM69 63Q94 48 115 57V104Q90 97 69 111ZM64 7 71 28 91 35 71 42 64 62 57 42 37 35 57 28Z"/>',
  universal: '<path d="M18 68C18 31 50 31 64 64S110 99 110 64 80 28 64 64 18 102 18 68Z" fill="none" stroke-width="13"/><path d="m64 8 5 12 13 5-13 5-5 12-5-12-13-5 13-5Z M64 91l5 11 13 5-13 5-5 11-5-11-13-5 13-5Z"/>',
  reaver: '<path d="m38 13 14 12-7 26 15-1 10-20 23 6 18 29-31 7-21-11-12 6-17 43-14-6 19-48-10-10Z"/><path d="m67 79 18 20-10 22 25-11 8-27-13 9-7-22Z"/>',
  starseer: '<path d="m74 10 8 30 30 8-27 14-2 31-20-23-30 8 16-27-17-26 30 7Z M19 77l24-4-24 29 31-12-9 25H8Z"/>',
  rogue: '<path d="M71 9 88 12 70 67 85 79 79 87 67 81 52 109 54 117 34 110 42 105 55 75 41 73 42 63 58 62Z"/><path d="M27 24Q9 52 23 73L31 56 25 45 37 25Z M101 32l-9 21 6 18-9 27 19-18 6-25Z"/>',
  herald: '<path d="M59 34H69V83H92V93H69V116H59V93H36V83H59Z"/><circle cx="64" cy="40" r="23" fill="none" stroke-width="8"/><path d="M64 3V11M29 11 36 20M9 39H24M104 39H119M92 20 99 11M18 64 31 58M97 58 110 64" fill="none" stroke-width="7"/>',
};
const paths = [];
function layer(rel, text) {
  for (const tier of ['assets', 'assets-mobile']) save(resolve(root, tier, 'shop/layers', rel), text);
  save(resolve(here, 'vectors', rel), text);
  paths.push(`assets/shop/layers/${rel}`);
}
for (const [name, shape] of Object.entries(shapes)) {
  for (const treatment of ['solid', 'line', 'seal']) {
    // Black shield engraving is a knockout, not paint: white SVGs are masks.
    const inner = `<g fill="${treatment === 'line' ? 'none' : 'white'}" stroke="white" stroke-width="${treatment === 'line' ? 4 : 2}" stroke-linejoin="round" stroke-linecap="round">${shape}</g>`;
    const body = treatment === 'seal' ? `<circle cx="64" cy="64" r="60" fill="none" stroke="white" stroke-width="3"/><circle cx="64" cy="64" r="54" fill="none" stroke="white" stroke-width="1"/><g transform="translate(19.2 19.2) scale(.7)">${inner}</g>` : inner;
    layer(`symbols/${name}-${treatment}.svg`, svg(`<defs><mask id="shape" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">${body}</mask></defs><rect width="128" height="128" fill="white" mask="url(#shape)"/>`));
  }
}
// Covers retain the generated 1280-square registration; do not trim them.
// Only the front leather is colored. Spine, page edges and ribbon stay neutral.
layer('cover-tint.svg', svg('<path fill="white" d="M185 180Q175 165 195 160L669 62Q687 58 695 78L942 620Q950 645 927 651L391 749Q378 751 373 729Z"/>', 1000));
const plane = 'matrix(.51 -.112 .222 .577 185 172)';
const trims = {
  corners: '<path d="M75 230V75H235M765 75H925V235M925 765V925H765M235 925H75V765"/><path d="M100 185V100H185M815 100H900V185M900 815V900H815M185 900H100V815"/>',
  frame: '<rect x="70" y="70" width="860" height="860" rx="18"/><rect x="90" y="90" width="820" height="820" rx="12"/><path d="m500 55 25 30-25 30-25-30ZM500 885l25 30-25 30-25-30Z"/>',
  arcane: '<path d="M90 240V90H240M760 90H910V240M910 760V910H760M240 910H90V760"/><circle cx="500" cy="500" r="355"/><circle cx="500" cy="500" r="335" stroke-dasharray="8 30"/><path d="M500 110V170M830 500H890M500 830V890M110 500H170"/>',
};
for (const [name, body] of Object.entries(trims)) layer(`trims/${name}.svg`, svg(`<g transform="${plane}" fill="none" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${body}</g>`, 1000));
for (const name of ['classic', 'scholar', 'field']) {
  const input = resolve(here, 'masters', `${name}.png`);
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) throw new Error(`${name}: transparent master required`);
  const high = resolve(root, 'assets/shop/layers/covers', `${name}.webp`);
  const light = resolve(root, 'assets-mobile/shop/layers/covers', `${name}.webp`);
  mkdirSync(dirname(high), { recursive: true }); mkdirSync(dirname(light), { recursive: true });
  await sharp(input).resize(320, 320).webp({ quality: 90, alphaQuality: 100 }).toFile(high);
  // Match the canonical art repository: encode the high WebP, not the PNG.
  const encoded = spawnSync('cwebp', ['-quiet', '-m', '6', '-q', '35', '-alpha_q', '40', '-alpha_filter', 'best', high, '-o', light], { encoding: 'utf8' });
  if (encoded.error || encoded.status !== 0) throw new Error(`cwebp 1.6.0 is required for light exports: ${encoded.error?.message || encoded.stderr}`);
  if (statSync(light).size >= statSync(high).size) copyFileSync(high, light);
  paths.push(`assets/shop/layers/covers/${name}.webp`);
}
save(resolve(here, 'manifest.json'), JSON.stringify({ schema: 1, paintedCovers: 3, symbols: 10, treatments: 3, trims: 3, paths }, null, 2) + '\n');
console.log(`Exported ${paths.length} independent layers and their mobile twins.`);
