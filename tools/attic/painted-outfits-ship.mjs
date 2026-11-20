// Ship the reviewed artwork without recoloring outfit identities.
// Requires sharp (npm package); source artwork remains in art/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PAINTED_OUTFITS } from '../../src/content/paintedOutfits.js';
import { authoringNeeds } from '../art-authoring.mjs';
authoringNeeds(import.meta.url, ['art']);
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('../../build/animation-tools/node_modules/sharp'); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = 'art/painted-combat-2026-09-07';
const manifest = JSON.parse(readFileSync(resolve(root, source, 'manifest.json')));
const techniqueManifest=resolve(root,source,'animation-groups/frames.json');
const techniques=existsSync(techniqueManifest)?JSON.parse(readFileSync(techniqueManifest)).frames:[];
const outfits = {};
const techniquesOnly=process.argv.includes('--techniques-only');
for (const outfit of manifest.outfits) {
  const dir = `assets/painted-outfits/${outfit.id}`;
  mkdirSync(resolve(root, dir), { recursive: true });
  const frames = techniquesOnly ? { ...PAINTED_OUTFITS[outfit.id].frames } : {};
  for (const frame of techniquesOnly ? [] : outfit.frames) {
    const file = `${dir}/${frame.pose}.webp`;
    await sharp(resolve(root, source, frame.file)).webp({ quality: 88, alphaQuality: 100 }).toFile(resolve(root, file));
    frames[frame.pose] = { file, box: frame.box };
  }
  for (const frame of techniques.filter(frame => frame.id === outfit.id)) {
    const file = `${dir}/${frame.pose}.webp`;
    await sharp(resolve(root,source,'animation-groups',frame.file)).webp({quality:88,alphaQuality:100}).toFile(resolve(root,file));
    frames[frame.pose]={file,box:frame.box};
  }
  const menu = techniquesOnly ? { ...PAINTED_OUTFITS[outfit.id].menu } : {};
  for (const [pose, input] of Object.entries(techniquesOnly ? {} : outfit.menu)) {
    const file = `${dir}/${pose === 'stand' ? 'menu' : pose}.webp`;
    await sharp(resolve(root, source, input)).webp({ quality: 90, alphaQuality: 100 }).toFile(resolve(root, file));
    menu[pose] = file;
  }
  outfits[outfit.id] = { frames, menu };
}
// The manifest's authored home is content/source/paintedOutfits.json;
// tools/content-build.mjs compiles it to src/content/generated/paintedOutfits.js
// (src/content/paintedOutfits.js re-exports it as PAINTED_OUTFITS).
writeFileSync(resolve(root, 'content/source/paintedOutfits.json'), JSON.stringify(outfits, null, 2) + '\n');
const build = spawnSync(process.execPath, [resolve(root, 'tools/content-build.mjs')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
console.log(`Shipped ${Object.keys(outfits).length} painted outfits.`);
