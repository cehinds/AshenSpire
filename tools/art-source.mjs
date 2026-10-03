#!/usr/bin/env node
// tools/art-source.mjs — where a tool reads the art packs' files: the fetched
// release, and nothing else.
//
//   node tools/art-source.mjs --dir <tree>     print the directory a tree's files are
//                                             read from (assets, assets-mobile,
//                                             assets/fonts, music, map-detail) and exit
//   node tools/art-source.mjs --which          one line per tree: its pack and where
//
// WHY (docs/EXTERNAL-ASSETS-PLAN.md steps 12 and 13). The art trees left this
// repository at step 13 (with ART-REPO-PLAN step 6): assets/ (the high pack),
// assets-mobile/ (the light pack), and assets/fonts/, music/ and map-detail/
// (the common pack) live in cehinds/AshenSpire-art and come back only as the
// pinned release. tools/fetch-art.mjs verifies each pack into
// .art-cache/<tag>/<pack>/, whose files sit at the trees' old paths
// (`assets/bg/…`, `assets-mobile/bg/…`, `assets/fonts/…`, `music/…`,
// `map-detail/…`). Every reader of those paths asks this file.
//
// THE RULE. A pack is read from its verified cache (fetch-art's marker matches
// the current pin and manifest), or not at all: a pack that is not fetched is
// an error naming the fetch (`node tools/fetch-art.mjs --pack <pack>`). Step 12
// fell back to the trees here; step 13 deleted them, and the fallback with
// them. ASHEN_ART_SOURCE:
//
//   unset, `auto` or `cache`   the verified cache (CI still sets `cache`; it is
//                              now the only behaviour, kept as a name so an
//                              older workflow line stays valid);
//   `trees`                    the files at the trees' paths under the root
//                              itself, silently: for a tool's temporary sandbox
//                              that copies them there on purpose (a fixture),
//                              never for this checkout, which has none.
//
// It is listed in BUILD_IDENTITY_FILES (tools/buildversion.mjs), with every
// other tools/ module tools/bundle.mjs reaches (tests/build-identity.test.mjs):
// it decides which bytes the bundler reads, so a change here is a new build.

import { cpSync, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE_DIR, MANIFEST_PATH, PIN_PATH, verifiedPackDir } from './fetch-art.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENV = 'ASHEN_ART_SOURCE';
export const MODES = Object.freeze(['auto', 'cache', 'trees']);
/**
 * The four trees step 12 switched (the light and common packs' files), and the
 * pack whose cache holds each at the same path. tools/bundle.mjs keeps them
 * out of an art tier's sweep, and tools/serve.mjs answers them from the cache.
 */
export const MOVING_TREES = Object.freeze({
  'assets-mobile': 'light',
  'assets/fonts': 'common',
  music: 'common',
  'map-detail': 'common',
});
/** The high tier's tree: what was assets/ here (less the fonts), the high pack since step 13. */
export const HIGH_TREE = 'assets';
/** Every tree a pack carries, most specific first (assets/fonts before assets). */
export const PACK_TREES = Object.freeze({ ...MOVING_TREES, [HIGH_TREE]: 'high' });

const posix = (p) => p.split(/[\\/]/g).join('/');
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** The mode ASHEN_ART_SOURCE names (unset → auto); an unknown value is an error, not a guess. */
export function sourceMode(env = process.env) {
  const v = (env[ENV] || 'auto').trim();
  if (!MODES.includes(v)) throw new Error(`${ENV}=${JSON.stringify(v)}: one of ${MODES.join(', ')}`);
  return v;
}

const inTree = (p, t) => p === t || p.startsWith(`${t}/`);
/** The step-12 tree (light or common pack) a repository-relative path lies in, or null. */
export function treeOf(rel) {
  const p = posix(rel).replace(/^\.\//, '');
  return Object.keys(MOVING_TREES).find((t) => inTree(p, t)) || null;
}
/** Any pack's tree a repository-relative path lies in (assets/… is the high pack's), or null. */
export function packTreeOf(rel) {
  const p = posix(rel).replace(/^\.\//, '');
  return Object.keys(PACK_TREES).find((t) => inTree(p, t)) || null;
}

// One verification per root and pack while nothing it depends on moves:
// verifiedPackDir re-reads the pin and the manifest and digests the pack's
// rows, and artPath runs per file.
const verified = new Map();
const mtimeOf = (p) => { try { const st = statSync(p); return `${st.mtimeMs}:${st.size}`; } catch { return '-'; } };
/** What a verification decision depends on: the pin, the manifest and the pack's marker, by mtime and size. */
function stampOf(root, pack) {
  let tag = '';
  try { tag = String(JSON.parse(readFileSync(join(root, PIN_PATH), 'utf8')).tag || ''); } catch { /* verifiedPackDir names it */ }
  const marker = tag && /^[A-Za-z0-9._-]+$/.test(tag) ? mtimeOf(join(root, CACHE_DIR, tag, pack, '.verified')) : '-';
  return [mtimeOf(join(root, PIN_PATH)), mtimeOf(join(root, MANIFEST_PATH)), marker, tag].join('|');
}

/**
 * packSource(pack, { root, env }) → { from: 'cache', dir } | { from: 'trees', dir: null, why }.
 * `dir` is the verified .art-cache/<tag>/<pack>/ directory. 'trees' is given
 * only under ASHEN_ART_SOURCE=trees (a sandbox that copied the files to the
 * trees' paths under its root); otherwise a pack that is not fetched throws,
 * and the message names the fetch.
 */
export function packSource(pack, { root = ROOT, env = process.env } = {}) {
  const mode = sourceMode(env);
  if (mode === 'trees') return { from: 'trees', dir: null, why: `${ENV}=trees` };
  const vkey = `${real(root)}\0${pack}`;
  // The decision is kept only while the pin, the manifest and every pack's
  // verified marker are unchanged, so a long-running server (tools/serve.mjs)
  // sees a fetch, a re-pin or a manifest edit on its next request.
  const stamp = stampOf(root, pack);
  let hit = verified.get(vkey);
  if (!hit || hit.stamp !== stamp) {
    try { hit = { stamp, dir: resolve(verifiedPackDir(pack, { root })) }; } catch (e) { hit = { stamp, why: e.message }; }
    verified.set(vkey, hit);
  }
  if (hit.dir) return { from: 'cache', dir: hit.dir };
  throw new Error(`the art trees left this repository (docs/EXTERNAL-ASSETS-PLAN.md step 13), and ${hit.why}`);
}

/**
 * artDir(tree, opts) → { dir, from, pack }: the directory holding `tree`'s
 * files — .art-cache/<tag>/<pack>/<tree> (or <root>/<tree> under
 * ASHEN_ART_SOURCE=trees). Throws when the pack is not fetched, naming the fetch.
 */
export function artDir(tree, opts = {}) {
  const root = opts.root || ROOT;
  const pack = PACK_TREES[tree];
  if (!pack) throw new Error(`${JSON.stringify(tree)} is not one of the trees the art packs carry (${Object.keys(PACK_TREES).join(', ')})`);
  const src = packSource(pack, opts);
  if (src.from === 'cache') return { dir: join(src.dir, ...tree.split('/')), from: 'cache', pack };
  const dir = resolve(root, ...tree.split('/'));
  if (!existsSync(dir)) throw new Error(`${tree}/ is not under ${root} (${src.why}): copy the files there, or unset ${ENV} and run node tools/fetch-art.mjs --pack ${pack}`);
  return { dir, from: 'trees', pack };
}

/**
 * artPath(rel, opts) → the absolute file a repository-relative path inside a
 * pack's tree is read from (it may not exist: the caller checks, as before).
 * A path outside those trees resolves against the checkout unchanged.
 */
export function artPath(rel, opts = {}) {
  const root = opts.root || ROOT;
  const tree = packTreeOf(rel);
  if (!tree) return resolve(root, rel);
  const { dir } = artDir(tree, opts);
  const rest = posix(rel).replace(/^\.\//, '').slice(tree.length + 1);
  const abs = rest ? resolve(dir, ...rest.split('/')) : dir;
  if (abs !== dir && !abs.startsWith(dir + sep)) throw new Error(`${rel} escapes ${tree}/`);
  return abs;
}

/**
 * copyPackTrees(toRoot, trees, { root, env }) — a SANDBOX'S ART. A tool that
 * builds in a throwaway copy of the checkout (tools/bundle.test.mjs,
 * tools/sfx-filename-convention.mjs, …) used to copy the trees; since step 13
 * it copies each named tree's files from this checkout's verified cache to the
 * tree's path under `toRoot`, and runs its child with ASHEN_ART_SOURCE=trees
 * (SANDBOX_ENV), so a fixture may edit its copy without touching the cache.
 * Throws, naming the fetch, when a pack is not fetched.
 */
export const SANDBOX_ENV = Object.freeze({ [ENV]: 'trees' });
export function copyPackTrees(toRoot, trees, { root = ROOT, env = process.env } = {}) {
  for (const tree of trees) {
    // Under ASHEN_ART_SOURCE=trees the root is itself a sandbox: its own copies.
    const { dir } = artDir(tree, { root, env });
    cpSync(dir, resolve(toRoot, ...tree.split('/')), { recursive: true });
  }
}

/**
 * copySourceArt(toRoot, opts) — the `assets/` tree a served SOURCE sandbox used
 * to copy from this checkout (src/ + styles/ + assets/, played through
 * assetUrl() in source mode): the high pack's assets/ and the common pack's
 * fonts, written to <toRoot>/assets/. A sandbox that also carries
 * art-release.json is served as a checkout (tools/serve.mjs), so it reads them
 * with ASHEN_ART_SOURCE=trees (SANDBOX_ENV).
 */
export function copySourceArt(toRoot, opts = {}) {
  copyPackTrees(toRoot, [HIGH_TREE, 'assets/fonts'], opts);
}

/**
 * fetchPlanFor(root, { fullArt }) → the `node` arguments that fetch the packs a
 * build of the checkout at `root` reads, with that checkout's OWN fetch-art
 * (its pin, its manifest, its rules), or null when it has nothing to fetch: no
 * tools/fetch-art.mjs, or a pin from before the packs (schema 1, whose builds
 * read the trees). tools/pages-site.mjs runs it before rebuilding an
 * uncommitted build (--build-missing), because after step 13 a commit's tree
 * no longer carries the art its build reads.
 */
export function fetchPlanFor(root, { fullArt = false } = {}) {
  if (!existsSync(join(root, 'tools', 'fetch-art.mjs'))) return null;
  let pin = null;
  try { pin = JSON.parse(readFileSync(join(root, PIN_PATH), 'utf8')); } catch { return null; }
  if (!pin || pin.schema !== 2) return null;
  return ['tools/fetch-art.mjs', '--pack', fullArt ? 'all' : 'light,common'];
}

/**
 * manifestIds(root) → the Set of every id art-manifest.json lists: what a check
 * asks when it wants to know whether the game's art includes a file (an id is
 * in the manifest exactly when a pinned pack carries it), without reading any
 * tree or cache. The committed manifest outlives the trees (step 13).
 */
const idSets = new Map();
const rowMaps = new Map();
function manifestRows(root) {
  const key = real(root);
  if (!rowMaps.has(key)) rowMaps.set(key, JSON.parse(readFileSync(join(root, 'art-manifest.json'), 'utf8')).assets || {});
  return rowMaps.get(key);
}
export function manifestIds(root = ROOT) {
  const key = real(root);
  if (!idSets.has(key)) idSets.set(key, new Set(Object.keys(manifestRows(root))));
  return idSets.get(key);
}

/**
 * artRecord(id, root) → the manifest's row for an art id ({light, high} or
 * {common}), or null: its bytes, sha256 and pixel size per tier, read from the
 * committed manifest with no tree or cache. A check that compares artwork (six
 * distinct frames) compares these hashes instead of reading the files.
 */
export function artRecord(id, root = ROOT) {
  const rows = manifestRows(root);
  return Object.prototype.hasOwnProperty.call(rows, id) ? rows[id] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const at = args.indexOf('--dir');
    if (at >= 0) {
      const tree = (args[at + 1] || '').replace(/\/+$/, '');
      console.log(relative(process.cwd(), artDir(tree).dir) || '.');
    } else if (args.includes('--which')) {
      for (const tree of Object.keys(PACK_TREES)) {
        const { dir, from, pack } = artDir(tree);
        console.log(`${tree.padEnd(14)} ${pack.padEnd(7)} ${from.padEnd(6)} ${posix(relative(ROOT, dir))}`);
      }
    } else {
      console.error('usage: node tools/art-source.mjs --dir <assets|assets-mobile|assets/fonts|music|map-detail> | --which');
      process.exit(2);
    }
  } catch (e) {
    console.error(`art-source: FAIL — ${e.message}`);
    process.exit(1);
  }
}
