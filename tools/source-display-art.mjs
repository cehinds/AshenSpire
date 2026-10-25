// Source-only measurement precondition. These are the same data owners used by
// bundle.mjs; enumerate their declarations, never a remembered artwork count.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { artPath } from './art-source.mjs';

export const SOURCE_DISPLAY_ART_OWNERS = Object.freeze([
  ['src/ui/alternativeArtCatalog.js', 'alternativeArtCatalog'],
  ['src/content/alternativeCardAnimations.js', 'alternativeCardAnimations'],
  ['src/content/alternativeSelectedStances.js', 'alternativeSelectedStances'],
  ['src/content/classSmashAnimations.js', 'classSmashAnimations'],
]);
const record = value => value && typeof value === 'object' && !Array.isArray(value);

export function sourceDisplayArtInventory(root) {
  const files = new Set(), paths = new Set(), inventory = [];
  for (const [owner, name] of SOURCE_DISPLAY_ART_OWNERS) {
    // Like the bundler, accept a JSON literal only; never evaluate catalog JS.
    const source = readFileSync(resolve(root, owner), 'utf8');
    const literal = source.match(new RegExp(`^export const ${name} = (.+);\\r?$`, 'm'));
    if (!literal) throw new Error(`Unrecognized source art catalog: ${owner}`);
    const catalog = JSON.parse(literal[1]);
    if (!record(catalog.hashes) || !Object.keys(catalog.hashes).length
      || catalog.filePaths !== undefined && !record(catalog.filePaths)) throw new Error(`Empty or invalid source art catalog: ${owner}`);
    for (const [file, sha256] of Object.entries(catalog.hashes)) {
      const path = catalog.filePaths?.[file] || `assets-display/alternative/${file}`;
      if (!/^(?:stances\/[a-z]+\/)?[a-zA-Z0-9-]+\.webp$/.test(file)
        || typeof path !== 'string' || !/^assets-display\/(alternative|shared)\/(?:stances\/[a-z]+\/)?[a-zA-Z0-9-]+\.webp$/.test(path)
        || !path.endsWith('/' + file) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Invalid source art declaration: ${owner}: ${file}`);
      if (files.has(file) || paths.has(path)) throw new Error(`Duplicate source art declaration: ${owner}: ${file}`);
      files.add(file); paths.add(path); inventory.push({ owner, path, sha256 });
    }
  }
  return inventory;
}

export function assertSourceDisplayArt(root, { env = process.env } = {}) {
  if (env.ASHEN_ART_CHECKOUT) throw new Error('Clear ASHEN_ART_CHECKOUT before measuring pinned source display art; authoring previews may contain unpublished images.');
  const inventory = sourceDisplayArtInventory(root);
  for (const entry of inventory) {
    let bytes;
    try { bytes = readFileSync(artPath(entry.path, { root, env })); }
    catch { throw new Error(`Source display art is missing/unreadable: ${entry.path}; fetch the pinned common art pack before measuring`); }
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Source display art hash mismatch: ${entry.path}`);
  }
  return { checked: inventory.length };
}

// Also serialized into the source probe's already-running page. Metadata only:
// no paint, readback, layout measurement, waiting or image initialization.
export function readLoadedSourceBody(stage) {
  const art = stage?.currentArt, image = art?.image;
  const reading = {
    src: image?.currentSrc || image?.src || '',
    complete: image?.complete === true,
    naturalWidth: image?.naturalWidth || 0, naturalHeight: image?.naturalHeight || 0,
    canvasWidth: art?.canvas?.width || 0, canvasHeight: art?.canvas?.height || 0,
    width: art?.width || 0, height: art?.height || 0,
  };
  reading.ready = reading.complete && typeof reading.src === 'string' && reading.src.length > 0
    && ['naturalWidth', 'naturalHeight', 'canvasWidth', 'canvasHeight', 'width', 'height']
      .every(key => Number.isFinite(reading[key]) && reading[key] > 0);
  return reading;
}
