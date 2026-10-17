#!/usr/bin/env node
// tools/asset-catalog.mjs - the asset catalog (engine/contracts/asset-catalog.schema.json).
//
//   node tools/asset-catalog.mjs            write games/ashenspire/assets/catalog.json
//                                           (or catalog.summary.json when it is too big)
//   node tools/asset-catalog.mjs --check    exit 1 when the committed file is not current
//
// DERIVED, never hand-edited. Input: art-manifest.json (itself derived: the art ids,
// the fonts, the score under music/ and the map detail tiles) and
// games/ashenspire/assets/missing.json (ids the game names that ship no file yet).
//
// An asset id is a dotted word path: the manifest path without its leading assets/
// and without its extension, with '/' turned into '.', so
// assets/bg/bg_act1.webp is bg.bg_act1 and music/map/map.mp3 is music.map.map.
// Two paths that differ only by extension keep it as a final word.
//
// Tiers: placeholder (no file, the style guide draws it from the id), light
// (assets-mobile/), high (assets/) and common (one file for every tier).
//
// Size rule (CONTRIBUTING.md, 256 KiB cap on tracked JSON): the full catalog is
// committed only when it is under 256 KiB. Otherwise catalog.summary.json holds the
// counts and the sha256 of the full catalog, and the full catalog is build output:
// the build compiler calls buildAssetCatalog().

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { canonicalGameJSON } from '../engine/kernel/gameConfig.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GAME = 'ashenspire';
export const MAX_BYTES = 256 * 1024;
export const TIERS = ['placeholder', 'light', 'high', 'common'];
export const SOURCES = ['art-manifest.json', `games/${GAME}/assets/missing.json`];
export const CATALOG_FILE = `games/${GAME}/assets/catalog.json`;
export const SUMMARY_FILE = `games/${GAME}/assets/catalog.summary.json`;
export const MISSING_FILE = `games/${GAME}/assets/missing.json`;

const KINDS = {
  image: ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.avif'],
  audio: ['.mp3', '.ogg', '.wav', '.flac', '.m4a'],
  font: ['.woff2', '.woff', '.ttf', '.otf'],
  data: ['.json', '.csv'],
  text: ['.txt', '.md'],
  model: ['.glb', '.gltf', '.fbx', '.obj'],
};
export function kindOf(path) {
  const ext = extname(path).toLowerCase();
  return Object.keys(KINDS).find(k => KINDS[k].includes(ext)) || 'other';
}

export function idOf(path) {
  const bare = path.replace(/^assets\//, '');
  const ext = extname(bare);
  return (ext ? bare.slice(0, -ext.length) : bare).split('/').join('.');
}

export function readMissing(root = ROOT) {
  const file = join(root, MISSING_FILE);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).missing || {} : {};
}

export function buildAssetCatalog({ root = ROOT } = {}) {
  const manifest = JSON.parse(readFileSync(join(root, 'art-manifest.json'), 'utf8'));
  const assets = {};
  for (const path of Object.keys(manifest.assets).sort()) {
    let id = idOf(path);
    if (assets[id]) { id = `${id}.${extname(path).slice(1)}`; if (assets[id]) throw new Error(`asset-catalog: id collision on ${path}`); }
    const files = {};
    for (const tier of ['light', 'high', 'common']) if (manifest.assets[path][tier]) files[tier] = manifest.assets[path][tier].path;
    assets[id] = { kind: kindOf(path), files };
  }
  for (const id of Object.keys(readMissing(root)).sort()) {
    if (assets[id]) throw new Error(`asset-catalog: ${id} is listed as missing but the manifest has it`);
    assets[id] = { kind: 'image', files: {}, placeholder: true };
  }
  for (const entry of Object.values(assets)) if (!Object.keys(entry.files).length) entry.placeholder = true;
  return { format: 'ashen.assets@1', source: SOURCES, tiers: TIERS, assets };
}

export const digestOf = catalog => createHash('sha256').update(canonicalGameJSON(catalog)).digest('hex');

export function buildSummary(catalog) {
  const byKind = {}, byTier = {};
  let placeholder = 0;
  for (const a of Object.values(catalog.assets)) {
    byKind[a.kind] = (byKind[a.kind] || 0) + 1;
    for (const tier of Object.keys(a.files)) byTier[tier] = (byTier[tier] || 0) + 1;
    if (a.placeholder) placeholder++;
  }
  const sort = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  return {
    _: 'DERIVED by node tools/asset-catalog.mjs, never by hand. The full catalog is build output (buildAssetCatalog()); this file pins it by sha256.',
    format: 'ashen.assets.summary@1',
    source: catalog.source,
    tiers: catalog.tiers,
    count: Object.keys(catalog.assets).length,
    byKind: sort(byKind),
    byTier: sort(byTier),
    placeholderOnly: placeholder,
    sha256: digestOf(catalog),
  };
}

// One asset per line so the committed file diffs well.
export function serializeCatalog(catalog) {
  const ids = Object.keys(catalog.assets);
  const rows = ids.map((id, i) => `    ${JSON.stringify(id)}: ${JSON.stringify(catalog.assets[id])}${i < ids.length - 1 ? ',' : ''}`);
  return `{\n  "format": ${JSON.stringify(catalog.format)},\n  "source": ${JSON.stringify(catalog.source)},\n  "tiers": ${JSON.stringify(catalog.tiers)},\n  "assets": {\n${rows.join('\n')}\n  }\n}\n`;
}

/** What the committed files should be: { file, text } to write, { stale } to remove. */
export function plan(root = ROOT) {
  const catalog = buildAssetCatalog({ root });
  const text = serializeCatalog(catalog);
  if (Buffer.byteLength(text) < MAX_BYTES) return { catalog, write: { file: CATALOG_FILE, text }, stale: SUMMARY_FILE };
  return { catalog, write: { file: SUMMARY_FILE, text: JSON.stringify(buildSummary(catalog), null, 2) + '\n' }, stale: CATALOG_FILE };
}

export function checkCatalog(root = ROOT) {
  const { write, stale } = plan(root);
  const problems = [];
  const file = join(root, write.file);
  if (!existsSync(file)) problems.push(`${write.file} is missing`);
  else if (readFileSync(file, 'utf8') !== write.text) problems.push(`${write.file} is not current`);
  if (existsSync(join(root, stale))) problems.push(`${stale} should not exist next to ${write.file}`);
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const problems = checkCatalog();
    for (const p of problems) console.log(p);
    if (problems.length) { console.log('run node tools/asset-catalog.mjs'); process.exit(1); }
    console.log('asset catalog is current');
  } else {
    const { write, stale, catalog } = plan();
    mkdirSync(dirname(join(ROOT, write.file)), { recursive: true });
    writeFileSync(join(ROOT, write.file), write.text);
    rmSync(join(ROOT, stale), { force: true });
    console.log(`wrote ${write.file} (${Object.keys(catalog.assets).length} assets)`);
  }
}
