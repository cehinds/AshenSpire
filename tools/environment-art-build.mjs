// Encode approved original boards and complete maps. Runtime SVG viewBoxes
// select combat paintings without baking labels or layout into the backdrop.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ENVIRONMENTS, ENVIRONMENT_ATLAS_SIZE } from '../src/content/environments.js';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const path = p => join(root, p);
mkdirSync(path('assets/environments/'), { recursive: true });
for (const region of ENVIRONMENTS) {
  const board = path(`art/environments/${region.id}.png`);
  const size = await sharp(board).metadata();
  if (size.width !== ENVIRONMENT_ATLAS_SIZE[0] || size.height !== ENVIRONMENT_ATLAS_SIZE[1]) throw Error(`Unexpected atlas size: ${region.id}`);
  await sharp(board).webp({ quality: 88 }).toFile(path(region.atlas));
  await sharp(path(`art/environments/maps/${region.id}.png`)).webp({ quality: 84 }).toFile(path(region.map));
  console.log(`${region.id}: four combat paintings and one map`);
}
