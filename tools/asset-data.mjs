// tools/asset-data.mjs — where the non-art files that used to sit beside the art
// under assets/ now live (docs/ART-REPO-PLAN.md, step 4).
//
// assets/ is the high-res art that moves to cehinds/AshenSpire-art. The files
// that were never art — JSON manifests, the class-art notes and checkers, the
// OFL text and the silent audio stub — stay in this repository under
// asset-data/, at the same path below the root (assets/equipment/manifest.json
// is now asset-data/equipment/manifest.json).
//
// A ship tool writes its frames into an art folder and its manifest beside
// them. dataHome() is where that manifest now goes: a folder under assets/ maps
// to the same folder under asset-data/; any other folder (a scratch --out, a
// source folder under art/) is returned unchanged, so a manifest written there
// still sits beside its frames.
//
// Zero dependencies, Node core only.

import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ASSET_DATA = 'asset-data';

/**
 * The folder a manifest for art written into `dir` lives in. `dir` is resolved
 * against the working directory, exactly as the frame writes beside it are, and
 * the result is always absolute.
 */
export function dataHome(dir, root = ROOT) {
  const abs = resolve(dir);
  const rel = relative(root, abs).split(sep).join('/');
  if (rel === 'assets') return resolve(root, ASSET_DATA);
  if (rel.startsWith('assets/')) return resolve(root, ASSET_DATA, rel.slice('assets/'.length));
  return abs;
}
