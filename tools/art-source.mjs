#!/usr/bin/env node
// tools/art-source.mjs — where a tool reads the art packs' files: the fetched
// release, or (until step 13) the trees still in this checkout.
//
//   node tools/art-source.mjs --dir <tree>     print the directory a tree's files are
//                                             read from (assets-mobile, assets/fonts,
//                                             music, map-detail) and exit
//   node tools/art-source.mjs --which          one line per tree: cache or trees, and where
//
// WHY (docs/EXTERNAL-ASSETS-PLAN.md step 12). Four trees leave this repository
// at step 13: assets-mobile/ (the light pack), and assets/fonts/, music/ and
// map-detail/ (the common pack). Step 11 made the release a build input:
// tools/fetch-art.mjs verifies each pack into .art-cache/<tag>/<pack>/, whose
// files sit at the same paths as the trees (`assets-mobile/bg/…`,
// `assets/fonts/…`, `music/…`, `map-detail/…`). Step 12 points every reader of
// those trees here, so this file is the ONE place that knows a tree may still
// be on disk, and step 13 deletes the fallback with the trees.
//
// THE RULE. A pack is read from its verified cache (fetch-art's marker matches
// the current pin and manifest). When it is not fetched:
//
//   ASHEN_ART_SOURCE unset (or `auto`)  the tree in this checkout, with one note
//                                       naming the fetch that replaces it;
//   ASHEN_ART_SOURCE=cache              refused for the light and common packs (the
//                                       high pack's assets/ tree leaves with
//                                       ART-REPO-PLAN step 6): the error names the
//                                       fetch. CI sets
//                                       this, so a job that reads the trees
//                                       without fetching is red now, not at step 13.
//                                       It binds the checkout CI runs in
//                                       (GITHUB_WORKSPACE) when that is set, so a
//                                       tool's temporary sandbox (a copied tree,
//                                       no cache) still builds from its copy;
//   ASHEN_ART_SOURCE=trees              the trees, silently (a sandbox or fixture
//                                       that copies them on purpose).
//
// The cache and the trees hold the same bytes while `fetch-art --agree` is
// green (every building workflow runs it), so which one a build read never
// changes what it ships.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifiedPackDir } from './fetch-art.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENV = 'ASHEN_ART_SOURCE';
export const MODES = Object.freeze(['auto', 'cache', 'trees']);
/** The trees step 13 deletes, and the pack whose cache holds each at the same path. */
export const MOVING_TREES = Object.freeze({
  'assets-mobile': 'light',
  'assets/fonts': 'common',
  music: 'common',
  'map-detail': 'common',
});

/** The packs that carry a moving tree: the ones ASHEN_ART_SOURCE=cache holds to their cache. */
const TREE_PACKS = new Set(Object.values(MOVING_TREES));
const posix = (p) => p.split(/[\\/]/g).join('/');
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** The mode ASHEN_ART_SOURCE names (unset → auto); an unknown value is an error, not a guess. */
export function sourceMode(env = process.env) {
  const v = (env[ENV] || 'auto').trim();
  if (!MODES.includes(v)) throw new Error(`${ENV}=${JSON.stringify(v)}: one of ${MODES.join(', ')}`);
  return v;
}

/** Does `cache` mode bind this root? Every root, or only the CI checkout when GITHUB_WORKSPACE is set. */
export function strictFor(root, env = process.env) {
  if (sourceMode(env) !== 'cache') return false;
  if (!env.GITHUB_WORKSPACE) return true;
  return real(root) === real(env.GITHUB_WORKSPACE);
}

/** The moving tree a repository-relative path lies in, or null. */
export function treeOf(rel) {
  const p = posix(rel).replace(/^\.\//, '');
  return Object.keys(MOVING_TREES).find((t) => p === t || p.startsWith(`${t}/`)) || null;
}

const noted = new Set();
// One verification per root and pack per process: verifiedPackDir re-reads the
// pin and the manifest and digests the pack's rows, and artPath runs per file.
const verified = new Map();
const defaultWarn = (m) => console.warn(m);

/**
 * packSource(pack, { root, env, warn }) → { from: 'cache', dir } | { from: 'trees', dir: null, why }.
 * `dir` is the verified .art-cache/<tag>/<pack>/ directory. 'trees' means the
 * caller reads the files from this checkout; a `cache`-mode root never gets it.
 */
export function packSource(pack, { root = ROOT, env = process.env, warn = defaultWarn } = {}) {
  const mode = sourceMode(env);
  if (mode === 'trees') return { from: 'trees', dir: null, why: `${ENV}=trees` };
  const vkey = `${real(root)}\0${pack}`;
  if (!verified.has(vkey)) {
    try { verified.set(vkey, { dir: resolve(verifiedPackDir(pack, { root })) }); } catch (e) { verified.set(vkey, { why: e.message }); }
  }
  const hit = verified.get(vkey);
  if (hit.dir) return { from: 'cache', dir: hit.dir };
  const why = hit.why;
  // The refusal guards the four trees step 13 deletes. The high pack's tree,
  // assets/, leaves with ART-REPO-PLAN step 6, so a build that packs the high
  // tier without the 203 MB high zip (a high-default web edition on dev) still
  // reads assets/ here, with the note.
  if (TREE_PACKS.has(pack) && strictFor(root, env)) throw new Error(`${ENV}=cache: ${why}`);
  if (!noted.has(vkey)) {
    noted.add(vkey);
    warn(`art-source: ${why}; reading the ${pack} pack's files from the trees in this checkout until docs/EXTERNAL-ASSETS-PLAN.md step 13 removes them`);
  }
  return { from: 'trees', dir: null, why };
}

/**
 * artDir(tree, opts) → { dir, from }: the directory holding `tree`'s files —
 * .art-cache/<tag>/<pack>/<tree> when the pack is fetched, else <root>/<tree>.
 * Throws when neither exists, naming the fetch.
 */
export function artDir(tree, opts = {}) {
  const root = opts.root || ROOT;
  const pack = MOVING_TREES[tree];
  if (!pack) throw new Error(`${JSON.stringify(tree)} is not one of the trees the art packs carry (${Object.keys(MOVING_TREES).join(', ')})`);
  const src = packSource(pack, opts);
  if (src.from === 'cache') return { dir: join(src.dir, ...tree.split('/')), from: 'cache', pack };
  const dir = resolve(root, ...tree.split('/'));
  if (!existsSync(dir)) throw new Error(`${tree}/ is not in this checkout and the ${pack} pack is not fetched (${src.why}): node tools/fetch-art.mjs --pack ${pack}`);
  return { dir, from: 'trees', pack };
}

/**
 * artPath(rel, opts) → the absolute file a repository-relative path inside a
 * moving tree is read from (it may not exist: the caller checks, as before).
 * A path outside the four trees resolves against the checkout unchanged.
 */
export function artPath(rel, opts = {}) {
  const root = opts.root || ROOT;
  const tree = treeOf(rel);
  if (!tree) return resolve(root, rel);
  const { dir } = artDir(tree, opts);
  const rest = posix(rel).replace(/^\.\//, '').slice(tree.length + 1);
  const abs = rest ? resolve(dir, ...rest.split('/')) : dir;
  if (abs !== dir && !abs.startsWith(dir + sep)) throw new Error(`${rel} escapes ${tree}/`);
  return abs;
}

/**
 * manifestIds(root) → the Set of every id art-manifest.json lists: what a check
 * asks when it wants to know whether the game's art includes a file (an id is
 * in the manifest exactly when a pinned pack carries it), without reading any
 * tree or cache. The committed manifest outlives the trees (step 13).
 */
const idSets = new Map();
export function manifestIds(root = ROOT) {
  const key = real(root);
  if (!idSets.has(key)) idSets.set(key, new Set(Object.keys(JSON.parse(readFileSync(join(root, 'art-manifest.json'), 'utf8')).assets || {})));
  return idSets.get(key);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const at = args.indexOf('--dir');
    if (at >= 0) {
      const tree = (args[at + 1] || '').replace(/\/+$/, '');
      console.log(relative(process.cwd(), artDir(tree, { warn: (m) => console.error(m) }).dir) || '.');
    } else if (args.includes('--which')) {
      for (const tree of Object.keys(MOVING_TREES)) {
        const { dir, from, pack } = artDir(tree, { warn: (m) => console.error(m) });
        console.log(`${tree.padEnd(14)} ${pack.padEnd(7)} ${from.padEnd(6)} ${posix(relative(ROOT, dir))}`);
      }
    } else {
      console.error('usage: node tools/art-source.mjs --dir <assets-mobile|assets/fonts|music|map-detail> | --which');
      process.exit(2);
    }
  } catch (e) {
    console.error(`art-source: FAIL — ${e.message}`);
    process.exit(1);
  }
}
