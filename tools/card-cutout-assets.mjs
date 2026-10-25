// Branch-owned PNGs use the same verified common-pack path as alternative art.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { artPath, addDisplayRecord } from './art-source.mjs';
export function cardCutoutAssets(root, opts = {}) {
  const file = resolve(root, 'asset-data/card-art/layered-runtime.json');
  if (!existsSync(file)) return [];
  const catalog = JSON.parse(readFileSync(file, 'utf8'));
  return Object.values(catalog.assets).map(asset => {
    if (!/^assets-display\/card-cutouts\/[A-Za-z0-9.]+\.png$/.test(asset.path)) throw Error(`Invalid cutout path: ${asset.path}`);
    const bytes = readFileSync(artPath(asset.path, { ...opts, root }));
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256 || bytes.length !== asset.bytes) throw Error(`Card cutout changed: ${asset.path}; export its catalog`);
    return {id:asset.path, sha256:asset.sha256, bytes};
  });
}
export function withCardCutouts(manifest, root, opts = {}) {
  const assets = {...manifest.assets};
  for (const asset of cardCutoutAssets(root, opts)) {
    addDisplayRecord(assets, asset.id, {path:asset.id, sha256:asset.sha256, bytes:asset.bytes.length});
  }
  return {...manifest, assets};
}
