// Encode approved original boards and complete maps. Runtime SVG viewBoxes
// select combat paintings without baking labels or layout into the backdrop.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ENVIRONMENTS, MEGA_MAPS, ENVIRONMENT_ATLAS_SIZE } from '../src/content/environments.js';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const path = p => join(root, p);
mkdirSync(path('assets/environments/'), { recursive: true });
for (const region of ENVIRONMENTS) {
  const board = path(`art/environments/combat-fields/${region.id}.png`);
  const size = await sharp(board).metadata();
  if (size.width !== ENVIRONMENT_ATLAS_SIZE[0] || size.height !== ENVIRONMENT_ATLAS_SIZE[1]) throw Error(`Unexpected atlas size: ${region.id}`);
  await sharp(board).webp({ quality: 80, effort: 6 }).toFile(path(region.atlas));
  await sharp(path(`art/environments/maps/${region.id}.png`)).webp({ quality: 78, effort: 6 }).toFile(path(region.map));
  console.log(`${region.id}: four combat paintings and one map`);
}
for (const world of MEGA_MAPS) {
  await sharp(path(`art/environments/worlds/${world.id}.png`)).webp({ quality: 82, effort: 6 }).toFile(path(world.map));
  console.log(`${world.id}: all five biomes in one world`);
}
for (const [source, target] of [
  ['worlds/fractured-realm-square.png', 'fractured-realm-square.webp'],
  ['locations/crownfall-landmark.png', 'crownfall-landmark.webp'],
  ['locations/crownfall-local.png', 'crownfall-local.webp'],
]) {
  await sharp(path(`art/environments/${source}`)).webp({ quality: 84, effort: 6 }).toFile(path(`assets/environments/${target}`));
}
