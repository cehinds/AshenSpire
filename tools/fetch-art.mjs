#!/usr/bin/env node
// tools/fetch-art.mjs — fetch the pinned art release, one pack at a time, and check it.
//
//   node tools/fetch-art.mjs                      every pack art-release.json pins (high,
//                                                 light, common): download, verify, unpack
//                                                 each into .art-cache/<tag>/<pack>/
//   node tools/fetch-art.mjs --pack light,common  only these packs (`all` = every pinned one)
//   node tools/fetch-art.mjs --from <zip> [--pack <p>]
//                                                 verify and unpack a zip already on disk;
//                                                 its pack is read from its name when
//                                                 --pack is not given
//   node tools/fetch-art.mjs --recheck            hash a reused cache's files again
//   node tools/fetch-art.mjs --agree [--pack …]   prove the verified caches and the trees in
//                                                 this repository agree byte for byte
//   node tools/fetch-art.mjs --print-dir [--pack <p>]   print the cache directory and exit
//
// WHY (docs/ART-REPO-PLAN.md step 4; docs/EXTERNAL-ASSETS-PLAN.md §2, step 11).
// The art, fonts, music and map tiles are released from cehinds/AshenSpire-art
// as three zips under one tag, hd-assets-v<N>:
//
//   high    hd-assets-v<N>.zip       assets/…          each art id's `high` record
//   light   light-assets-v<N>.zip    assets-mobile/…   each art id's `light` record
//   common  common-assets-v<N>.zip   assets/fonts/…, licenses/OFL.txt, music/…, map-detail/…
//
// Each zip carries its own art-manifest.json: the release manifest's header,
// `"pack": "<pack>"`, and that pack's rows only (that repository's
// tools/pack.mjs). This tool is the only door through which those files come
// back in, and it lets nothing through unchecked:
//
//   1. the zip's sha256 must equal the one art-release.json pins for its pack;
//   2. every id art-manifest.json lists for the pack must be in the zip, with
//      the bytes and sha256 its record names;
//   3. the zip's own art-manifest.json names its pack and the same ids with the
//      same records, and nothing more;
//   4. the zip holds nothing else.
//
// The high pack is also the zip the game's Local high-res setting reads (a
// served `hd/` folder is found by its art-manifest.json). The hd-assets-v1 zip
// predates the packs and still carried the fonts under assets/fonts/; a `common`
// id is therefore optional in a high zip, and checked when the zip carries it.
//
// THE PIN (art-release.json). Schema 2 pins every pack under "packs"; its
// top-level `zip` and `sha256` stay equal to packs.high for one release, so a
// reader that predates schema 2 still fetches the high zip, and readPin refuses
// a pin whose top level disagrees. A pin with no "schema" is schema 1: the high
// zip only.
//
// Any mismatch exits 1 before anything is unpacked. A cache is marked verified
// LAST, with the zip's sha256 and a digest of the manifest's records for its
// pack, and is reused only while both still match; --recheck hashes its files
// again. A cache without that marker (an interrupted unpack) is never reused. A
// cache is unpacked beside its final name and published in one rename, so runs
// at the same time never see each other's half-written files.
//
// THE TREES ARE STILL HERE (step 11). assets/, assets-mobile/, the fonts, music/
// and map-detail/ stay in this repository until step 13, and the builds still
// read them. --agree is the proof that the two sources are one: every file each
// verified cache holds equals the tree's file byte for byte (text compared in
// its LF form, as the manifest records it), every shippable tree file is in the
// cache, and the release's rows equal the rows derived from the trees.
//
// THE TOKEN. None is needed: cehinds/AshenSpire-art is public (owner answer 1,
// step 10a), so the zip is downloaded from the release's public URL. When
// ART_REPO_TOKEN (CI passes the secret of that name on protected branches only)
// or else GITHUB_TOKEN is set, it is sent (to the API only: fetch drops
// Authorization on the redirect to storage), which only raises
// GitHub's rate limit. Every failure names its cause: the token refused, the
// repository unreadable, the rate limit, the network. Node's fetch ignores
// HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set; behind a proxy, set it.

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readZip } from './zip.mjs';
import { MIME, runtimeAsset } from './assetmime.mjs';
import { LIGHT_DIR, buildManifest, canonicalBytes, commonSources } from './art-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PIN_PATH = 'art-release.json';
export const MANIFEST_PATH = 'art-manifest.json';
export const CACHE_DIR = '.art-cache';
/** The packs a schema-2 pin names, in the order they are fetched. */
export const PACKS = Object.freeze(['high', 'light', 'common']);
const STEM = Object.freeze({ high: 'hd', light: 'light', common: 'common' });
const VERIFIED = '.verified';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const has = (o, k) => Boolean(o) && Object.prototype.hasOwnProperty.call(o, k);
const posix = (p) => p.split(/[\\/]/g).join('/');
const same = (a, b) => Boolean(a && b && a.path === b.path && a.bytes === b.bytes && a.sha256 === b.sha256);
/** The `common` record of a schema-2 entry, or null for an art id (light/high). */
const commonOf = (entry) => (entry && entry.common) || null;
/** Does a manifest entry belong to `pack`? Common ids to `common`; art ids to `light` and `high`. */
const inPack = (entry, pack) => (pack === 'common' ? Boolean(commonOf(entry)) : Boolean(entry) && !commonOf(entry));
/**
 * Does a release manifest's entry agree with this tree's common record? A
 * high release may omit the id, list it as common, or (hd-assets-v1, schema 1)
 * list it as high with the same bytes.
 */
function agreesCommon(theirs, rec) {
  if (!theirs) return true;
  if (theirs.common) return same(theirs.common, rec);
  if (theirs.high) return theirs.high.bytes === rec.bytes && theirs.high.sha256 === rec.sha256;
  return false;
}

/** The zip a pack is released as under `tag` (hd-assets-v<N> → <stem>-assets-v<N>.zip). */
export function zipNameFor(pack, tag) {
  if (!PACKS.includes(pack)) throw new Error(`unknown pack ${JSON.stringify(pack)} (one of ${PACKS.join(', ')})`);
  return `${STEM[pack]}-assets-v${String(tag).replace(/^hd-assets-v/, '')}.zip`;
}

/**
 * The pin, or an error naming what is wrong. Always returns `packs`: a
 * schema-1 pin is read as { high: { zip, sha256 } }.
 */
export function readPin(root = ROOT) {
  const pin = JSON.parse(readFileSync(join(root, PIN_PATH), 'utf8'));
  const missing = ['repo', 'tag', 'zip', 'sha256'].filter((k) => !pin[k]);
  if (missing.length) {
    throw new Error(`${PIN_PATH} pins no release yet (${missing.join(', ')} unset). The owner publishes hd-assets-v<N> from cehinds/AshenSpire-art first; a PR then pins its tag, zip names and sha256s here.`);
  }
  // Strict shapes: the tag names a directory this tool deletes and recreates,
  // so it can never be `..` or a path, and each zip is that tag's own asset.
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(pin.repo)) throw new Error(`${PIN_PATH}: repo must be owner/name`);
  if (!/^hd-assets-v[1-9]\d*$/.test(pin.tag)) throw new Error(`${PIN_PATH}: tag must be hd-assets-v<N>`);
  if (pin.zip !== `${pin.tag}.zip`) throw new Error(`${PIN_PATH}: zip must be ${pin.tag}.zip`);
  if (!/^[0-9a-f]{64}$/.test(pin.sha256)) throw new Error(`${PIN_PATH}: sha256 must be 64 lowercase hex characters`);
  const schema = pin.schema === undefined ? 1 : pin.schema;
  if (schema === 1) {
    if (pin.packs !== undefined) throw new Error(`${PIN_PATH}: "packs" needs "schema": 2`);
    return { ...pin, schema: 1, packs: { high: { zip: pin.zip, sha256: pin.sha256 } } };
  }
  if (schema !== 2) throw new Error(`${PIN_PATH}: schema must be 1 or 2, not ${JSON.stringify(pin.schema)}`);
  const packs = pin.packs;
  if (!packs || typeof packs !== 'object' || Array.isArray(packs)) throw new Error(`${PIN_PATH}: schema 2 pins every pack under "packs"`);
  const names = Object.keys(packs);
  if (names.length !== PACKS.length || !PACKS.every((p) => names.includes(p))) throw new Error(`${PIN_PATH}: "packs" must name exactly ${PACKS.join(', ')} (it names ${names.join(', ') || 'none'})`);
  const out = {};
  for (const p of PACKS) {
    const { zip, sha256: sum } = packs[p] || {};
    if (zip !== zipNameFor(p, pin.tag)) throw new Error(`${PIN_PATH}: packs.${p}.zip must be ${zipNameFor(p, pin.tag)}`);
    if (!/^[0-9a-f]{64}$/.test(sum || '')) throw new Error(`${PIN_PATH}: packs.${p}.sha256 must be 64 lowercase hex characters`);
    out[p] = { zip, sha256: sum };
  }
  if (out.high.zip !== pin.zip || out.high.sha256 !== pin.sha256) {
    throw new Error(`${PIN_PATH}: the top-level zip and sha256 must equal packs.high (readers that predate schema 2 fetch the top level)`);
  }
  return { ...pin, packs: out };
}

/** The packs a pin names, or the ones asked for: `all`, one name, or a comma list. */
export function packsOf(pin, asked = null) {
  const pinned = PACKS.filter((p) => has(pin.packs, p));
  if (asked === null || asked === undefined || asked === 'all') return pinned;
  const list = (Array.isArray(asked) ? asked : String(asked).split(',')).map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw new Error('--pack needs high, light, common or all');
  for (const p of list) {
    if (!PACKS.includes(p)) throw new Error(`unknown pack ${JSON.stringify(p)} (one of ${PACKS.join(', ')}, or all)`);
    if (!pinned.includes(p)) throw new Error(`${PIN_PATH} (schema ${pin.schema}) pins no ${p} zip`);
  }
  return PACKS.filter((p) => list.includes(p));
}

/** The tag's cache directory, .art-cache/<tag>; each pack is a directory inside it. */
export function cacheDirFor(pin, root = ROOT) {
  // readPin already limits the tag to hd-assets-v<N>; this is the second lock,
  // because unpack() deletes the pack directories inside it before it writes.
  const base = resolve(root, CACHE_DIR);
  const dir = resolve(base, String(pin.tag));
  if (!dir.startsWith(base + sep) || dir.slice(base.length + 1).includes(sep)) throw new Error(`${PIN_PATH}: tag ${JSON.stringify(pin.tag)} is not a single directory name`);
  return dir;
}

/** .art-cache/<tag>/<pack>: where one pack is unpacked. */
export function packDirFor(pin, pack, root = ROOT) {
  if (!PACKS.includes(pack)) throw new Error(`unknown pack ${JSON.stringify(pack)} (one of ${PACKS.join(', ')})`);
  return join(cacheDirFor(pin, root), pack);
}

/** Is the pin schema 1 (the high zip alone, from before the packs)? A raw pin with no schema is. */
const legacyPin = (pin) => (pin && pin.schema !== undefined ? pin.schema : 1) === 1;

/** What the verified marker records: the zip, and the manifest rows it was checked against. */
export function markerFor(pin, manifest, pack = 'high') {
  const zipSha = (pin.packs && pin.packs[pack] && pin.packs[pack].sha256) || (pack === 'high' ? pin.sha256 : null);
  if (!zipSha) throw new Error(`${PIN_PATH} pins no ${pack} zip`);
  const assets = manifest.assets || {};
  let ids;
  let recOf;
  if (pack === 'high') {
    // The high records. Under a schema-1 pin, also the common ids a legacy high
    // release can carry (the fonts under assets/, as hd-assets-v1 does); which
    // ones it lists is only known after the download, so the `assets/` prefix
    // stands in for it. Music and tiles never ride in the high zip. A schema-2
    // high zip carries no common id at all (rowAgrees refuses one), so its
    // marker leaves them out: a font change must not force the 203 MB high
    // pack to download again.
    const legacy = legacyPin(pin);
    ids = Object.keys(assets).filter((id) => assets[id].high || (legacy && commonOf(assets[id]) && id.startsWith('assets/')));
    recOf = (e) => e.high || commonOf(e) || {};
  } else {
    ids = Object.keys(assets).filter((id) => inPack(assets[id], pack));
    recOf = (e) => e[pack] || {};
  }
  const rows = ids.sort().map((id) => {
    const h = recOf(assets[id]);
    return `${id}\t${h.path}\t${h.bytes}\t${h.sha256}`;
  }).join('\n');
  return `${zipSha} ${sha256(Buffer.from(rows, 'utf8'))}`;
}

/**
 * The pack a zip's own manifest must name. Only the high zip of a schema-1 pin
 * (hd-assets-v1, packed before the packs) may name none; every zip a schema-2
 * pin names must carry `"pack"`.
 */
function packProblem(doc, pack, legacy) {
  const named = doc.pack === undefined && pack === 'high' && legacy ? 'high' : doc.pack;
  return named === pack ? null : `the release's ${MANIFEST_PATH} is for pack ${JSON.stringify(doc.pack === undefined ? null : doc.pack)}, not ${pack}`;
}

const plainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * parseManifestDoc(text, whose, problems) → the embedded manifest when it is a
 * JSON object whose `assets` (if present) is an object too; otherwise null,
 * with the reason pushed. `null`, `[]`, `42` or `"x"` parse, and must not skip
 * the checks that follow.
 */
function parseManifestDoc(text, whose, problems) {
  let doc;
  try { doc = JSON.parse(text); } catch { problems.push(`${whose} ${MANIFEST_PATH} is not JSON`); return null; }
  if (!plainObject(doc)) { problems.push(`${whose} ${MANIFEST_PATH} is not a JSON object`); return null; }
  if (doc.assets !== undefined && !plainObject(doc.assets)) { problems.push(`${whose} ${MANIFEST_PATH} has an "assets" that is not an object`); return null; }
  return doc;
}

/** Do this tree's entry for `id` and the release manifest's agree, for `pack`? */
function rowAgrees(id, ours, theirs, pack, legacy = false) {
  const common = commonOf(ours[id]);
  if (pack === 'common') return common ? same(theirs[id]?.common, common) : !has(theirs, id);
  // A common id never belongs in the light pack's manifest; only a legacy
  // (schema-1) high zip may list one (hd-assets-v1 carried the fonts), and then
  // with the same bytes. A schema-2 high zip is pack-scoped like the others.
  if (common) return pack === 'high' && legacy ? agreesCommon(theirs[id], common) : !has(theirs, id);
  return same(theirs[id]?.[pack], ours[id]?.[pack]);
}

/**
 * verifyRelease(zipBuf, pin, manifest, pack = 'high') → { problems, entries }.
 * The checks the header lists; `entries` is the zip's content (name → Buffer)
 * when it read.
 */
export function verifyRelease(zipBuf, pin, manifest, pack = 'high') {
  const problems = [];
  const pinned = (pin.packs && pin.packs[pack]) || (pack === 'high' ? { zip: pin.zip, sha256: pin.sha256 } : null);
  if (!pinned) return { problems: [`${PIN_PATH} pins no ${pack} zip`], entries: null };
  const got = sha256(zipBuf);
  if (got !== pinned.sha256) return { problems: [`${pinned.zip}: the zip's sha256 is ${got}, ${PIN_PATH} pins ${pinned.sha256}`], entries: null };
  let entries;
  try { entries = new Map(readZip(zipBuf).map((e) => [e.name, e.data])); }
  catch (e) { return { problems: [e.message], entries: null }; }
  const want = manifest.assets || {};
  // The release's own manifest is what a served `hd/` folder is found by
  // (src/ui/highResArt.js reads `hd/art-manifest.json`), so it must be present
  // and must name every id of its pack with the same record as this tree's.
  const embedded = entries.get(MANIFEST_PATH);
  let theirs = null;
  if (!embedded) problems.push(`the release has no ${MANIFEST_PATH}`);
  else {
    const doc = parseManifestDoc(embedded.toString('utf8'), "the release's", problems);
    if (doc) {
      theirs = doc.assets || {};
      const wrong = packProblem(doc, pack, legacyPin(pin));
      if (wrong) problems.push(wrong);
      for (const id of Object.keys(want)) {
        if (!rowAgrees(id, want, theirs, pack, legacyPin(pin))) problems.push(`${id}: the release's ${MANIFEST_PATH} disagrees with this tree's`);
      }
      for (const id of Object.keys(theirs)) if (!want[id]) problems.push(`${id}: in the release's ${MANIFEST_PATH}, not in this tree's`);
    }
  }
  const paths = new Set();
  for (const [id, rec] of Object.entries(want)) {
    const common = commonOf(rec);
    if (pack === 'common' && !common) continue; // an art id: not the common pack's
    if (common && pack !== 'common') {
      if (pack === 'light') continue; // the light pack never carries common ids; a stray one is an extra file below
      // Not the high release's to carry, unless its own manifest lists it;
      // checked whenever it does carry it.
      const data = entries.get(common.path);
      if (!data) {
        if (!theirs || has(theirs, id)) problems.push(`${id}: not in the release`);
        continue;
      }
      // Allowed in the zip only when the release's own manifest declares it;
      // otherwise it is an extra file like any other.
      if (!theirs || !has(theirs, id)) continue;
      paths.add(common.path);
      if (data.length !== common.bytes || sha256(data) !== common.sha256) problems.push(`${id}: the release's file differs from ${MANIFEST_PATH}`);
      continue;
    }
    const own = common || (rec && rec[pack]);
    if (!own) { problems.push(`${id}: ${MANIFEST_PATH} has no ${pack} record`); continue; }
    paths.add(own.path);
    const data = entries.get(own.path);
    if (!data) { problems.push(`${id}: not in the release`); continue; }
    if (data.length !== own.bytes || sha256(data) !== own.sha256) problems.push(`${id}: the release's file differs from ${MANIFEST_PATH}`);
  }
  for (const name of entries.keys()) {
    if (name !== MANIFEST_PATH && !paths.has(name)) problems.push(`${name}: in the release, not in ${MANIFEST_PATH}`);
  }
  return { problems, entries };
}

/** A name beside `dir` that no other process picks: the staging and discard directories. */
const beside = (dir, what) => `${dir}.${what}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * markOf(dir) → the verified marker's text, or null. Another run may discard
 * `dir` between any two calls, so a vanished file is an answer, not an error.
 */
function markOf(dir) {
  try { return readFileSync(join(dir, VERIFIED), 'utf8').trim(); } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}

/**
 * setAside(dir) → the name it was moved to, or null when there was nothing:
 * takes a cache out of reach in one rename. Deleting it is separate (sweep),
 * so a delete Windows refuses never reads as a failed rename.
 */
function setAside(dir) {
  const gone = beside(dir, 'discard');
  try { renameSync(dir, gone); return gone; } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

/**
 * sweep(dir) — delete every directory set aside beside `dir`, this run's and
 * any an earlier run could not delete (a Windows handle, a killed process).
 * No reader looks at them, so a failure is reported and left for the next run.
 */
function sweep(dir) {
  const prefix = `${basename(dir)}.discard-`;
  let names = [];
  try { names = readdirSync(dirname(dir)).filter((n) => n.startsWith(prefix)); } catch { return; }
  for (const n of names) {
    try { rmSync(join(dirname(dir), n), { recursive: true, force: true, maxRetries: 5 }); }
    catch (e) { console.error(`fetch-art: could not delete ${n} (${e.code}); the next run retries`); }
  }
}

/** discard(dir) — take a cache out of reach, then delete it where no reader looks. */
function discard(dir) {
  setAside(dir);
  sweep(dir);
}

/**
 * unpack(entries, dir, mark) — write every entry into a staging directory of
 * this process's own, the verified marker last, then publish it under `dir` in
 * one rename. A reader therefore sees either no cache or a whole one: two runs
 * at once never share a half-written directory, and the one that loses the
 * race keeps the winner's cache when it carries the same marker.
 * A run that replaces the cache (every --from run does) can remove one another
 * run has just returned; that run's `dir` is then briefly absent, never partial.
 * Exported for the tests: an entry that resolves outside the staging directory
 * is refused before anything is published.
 */
export function unpack(entries, dir, mark) {
  const stage = beside(dir, 'staging');
  try {
    mkdirSync(stage, { recursive: true });
    for (const [name, data] of entries) {
      const target = resolve(stage, name);
      if (!target.startsWith(resolve(stage) + sep)) throw new Error(`${name} escapes the cache directory`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
    writeFileSync(join(stage, VERIFIED), `${mark}\n`);
    // Always replace what is there (a stale or damaged cache can carry the
    // right marker; --from relies on this). Only a cache another run
    // published between our discard and our rename is kept, and only when
    // its marker matches: it was unpacked from a verified release too.
    const pause = (attempt) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(10 * (attempt + 1), 200));
    for (let attempt = 0; ; attempt += 1) {
      // EPERM/EBUSY/EACCES: Windows refuses to rename a directory another
      // process holds a file open in (a sibling's marker read, an indexer).
      try { setAside(dir); } catch (e) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt >= 20) throw e;
        pause(attempt); continue; // the old cache is still there: never accept its marker
      }
      try { renameSync(stage, dir); return; } catch (e) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt >= 20) throw e;
        if (markOf(dir) === mark) return; // published by another run since our discard
        pause(attempt);
      }
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
    sweep(dir);
  }
}


/**
 * recheck(dir, manifest, pack = 'high', pin = null) → problems: the cached
 * manifest and every listed file still match. `pin` decides whether a cached
 * high manifest may omit `"pack"` (schema 1 only); none means schema 1.
 */
export function recheck(dir, manifest, pack = 'high', pin = null) {
  const problems = [];
  const cached = join(dir, MANIFEST_PATH);
  let theirs = null;
  if (!existsSync(cached)) problems.push(`the cache has no ${MANIFEST_PATH}`);
  else {
    const doc = parseManifestDoc(readFileSync(cached, 'utf8'), 'the cached', problems);
    if (doc) {
      theirs = doc.assets || {};
      const wrong = packProblem(doc, pack, legacyPin(pin));
      if (wrong) problems.push(wrong.replace("the release's", 'the cached'));
      const want = manifest.assets || {};
      for (const id of Object.keys(want)) {
        if (!rowAgrees(id, want, theirs, pack, legacyPin(pin))) problems.push(`${id}: the cached ${MANIFEST_PATH} disagrees with this tree's`);
      }
      for (const id of Object.keys(theirs)) if (!want[id]) problems.push(`${id}: in the cached ${MANIFEST_PATH}, not in this tree's`);
    }
  }
  for (const [id, rec] of Object.entries(manifest.assets || {})) {
    const common = commonOf(rec);
    if (pack === 'common' && !common) continue;
    if (pack === 'light' && common) continue;
    const want = common || rec[pack];
    if (!want) { problems.push(`${id}: ${MANIFEST_PATH} has no ${pack} record`); continue; }
    const file = join(dir, want.path);
    // A common id is optional in the high cache only when the release's own
    // manifest omits it; one the release lists (hd-assets-v1's fonts) must be
    // there. With no readable cached manifest, every listed id is required.
    if (!existsSync(file)) {
      if (pack !== 'high' || !common || !theirs || has(theirs, id)) problems.push(`${id}: missing from the cache`);
      continue;
    }
    const buf = readFileSync(file);
    if (buf.length !== want.bytes || sha256(buf) !== want.sha256) problems.push(`${id}: the cached file changed`);
  }
  return problems;
}

/** The variable a token came from, and the token, or nulls. Blank counts as unset (CI passes an empty secret). */
function tokenFromEnv(env = process.env) {
  for (const name of ['ART_REPO_TOKEN', 'GITHUB_TOKEN']) {
    const v = (env[name] || '').trim();
    if (v) return { name, token: v };
  }
  return { name: null, token: null };
}

/**
 * httpCause(res, ctx) → one sentence naming why GitHub refused. Exported for
 * the tests: every refusal a fetch can meet says what to do about it.
 */
export function httpCause(res, { pin, zip, url, tokenName }) {
  const status = res.status;
  const header = (k) => (res.headers && typeof res.headers.get === 'function' ? res.headers.get(k) : null);
  const where = `${pin.repo} ${pin.tag} ${zip}`;
  if ((status === 403 || status === 429) && header('x-ratelimit-remaining') === '0') {
    const reset = Number(header('x-ratelimit-reset'));
    const when = Number.isFinite(reset) && reset > 0 ? ` (it resets at ${new Date(reset * 1000).toISOString()})` : '';
    return `${where}: HTTP ${status} — GitHub's rate limit is spent${when}. ${tokenName ? `${tokenName} is set; wait for the reset` : 'Set ART_REPO_TOKEN or GITHUB_TOKEN to raise it'}.`;
  }
  if (status === 401) return `${where}: HTTP 401 — GitHub refused the token in ${tokenName || 'the request'} (expired, revoked or mistyped). Replace it.`;
  if (status === 403) {
    if (tokenName) return `${where}: HTTP 403 — the token in ${tokenName} may not read ${pin.repo}. It needs read access to that repository's Contents.`;
    return `${where}: HTTP 403 — GitHub refused a request sent with no token. Set ART_REPO_TOKEN to a token with read access to ${pin.repo}'s Contents (in CI, pass the secret of that name in the step's env), or check that the repository is public.`;
  }
  if (status === 404) {
    if (tokenName) return `${where}: HTTP 404 — either ${pin.repo} has no release ${pin.tag} with ${zip}, or the token in ${tokenName} cannot read the repository (a private repository answers 404 to a token without access). Check the pin, then the token's repository access.`;
    return `${where}: HTTP 404 at ${url} — no token was set, and ${pin.repo} answers 404 to anyone without one if it is private (it is public since step 10a). Set ART_REPO_TOKEN to a token with read access to its Contents (in CI, pass the secret of that name in the step's env). If the repository is already public, the pin names a tag or zip that release does not have.`;
  }
  if (status >= 500) return `${where}: HTTP ${status} — GitHub answered with a server error. Run again.`;
  return `${where}: HTTP ${status} ${res.statusText || ''}`.trim();
}

/** netCause(e, url) → one sentence naming a request that never got an answer. */
export function netCause(e, url) {
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) return `no answer from ${host} in time (${e.message}). Run again; a slow link may need a retry.`;
  const cause = e && e.cause ? (e.cause.code || e.cause.message) : (e && e.message);
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const hint = proxy && process.env.NODE_USE_ENV_PROXY !== '1' ? ' HTTPS_PROXY is set but Node ignores it: set NODE_USE_ENV_PROXY=1.' : '';
  return `could not reach ${host}: ${cause || 'network error'}.${hint}`;
}

/** One fetch with the cause named on every failure. */
async function request(url, init, ctx) {
  let res;
  try { res = await fetch(url, init); } catch (e) { throw Object.assign(new Error(netCause(e, url)), { cause: e }); }
  if (!res.ok && !(init.redirect === 'manual' && res.status >= 300 && res.status < 400)) {
    throw Object.assign(new Error(httpCause(res, { ...ctx, url })), { status: res.status });
  }
  return res;
}

/** Where the downloads go. Only the tests point these elsewhere (a stub server). */
export const GITHUB = Object.freeze({ api: 'https://api.github.com', web: 'https://github.com' });

/**
 * download(pin, pack, { api, web, env }) → the zip's bytes.
 *
 * WITH A TOKEN (only a rate-limit raise now that the art repository is public;
 * it was the only door while the repository was private): the releases API. GET the release by its
 * tag, find the asset's id, GET /releases/assets/<id> with
 * `accept: application/octet-stream`; GitHub answers 302 to a signed storage
 * URL, which is fetched in a second request carrying NO Authorization header,
 * so the token never leaves the API host. (A private release's
 * github.com/<repo>/releases/download/… URL answers 404 even with a token.)
 * A 404 on the release is told apart by asking for the repository itself: a
 * 404 there means the token cannot see the repository at all.
 *
 * WITHOUT ONE: the release's public download URL, which needs no API call (and
 * spends no API rate limit). It works once the repository is public.
 */
export async function download(pin, pack, { api = GITHUB.api, web = GITHUB.web, env = process.env, warn = (m) => console.warn(m) } = {}) {
  const zip = pin.packs[pack].zip;
  const { name: tokenName, token } = tokenFromEnv(env);
  const ctx = { pin, zip, tokenName };
  const timed = (ms) => ({ signal: AbortSignal.timeout(ms) });
  const ua = { 'user-agent': 'ashenspire-fetch-art' };
  const anonymous = async () => {
    const url = `${web}/${pin.repo}/releases/download/${encodeURIComponent(pin.tag)}/${encodeURIComponent(zip)}`;
    const r = await request(url, { headers: ua, redirect: 'follow', ...timed(15 * 60_000) }, { ...ctx, tokenName: null });
    try { return Buffer.from(await r.arrayBuffer()); }
    catch (e) { throw new Error(`${zip}: the download broke off (${netCause(e, r.url || url)})`); }
  };
  if (!token) return anonymous();
  try { return await viaApi(); } catch (e) {
    // A token that cannot read the repository (refused, expired, no access)
    // must not stop a build once the repository is public: try the public
    // URL, and keep the token's own diagnosis when that fails too.
    if (!e.tokenRefused) throw e;
    try {
      const buf = await anonymous();
      warn(`fetch-art: ${zip}: the token in ${tokenName} could not read ${pin.repo} (${e.message.replace(/^.*?HTTP /, 'HTTP ')}); the public release URL served it, so the repository is public — fix or remove ${tokenName}.`);
      return buf;
    } catch { throw e; }
  }

  async function viaApi() {
    let res;
    const repo = `${api}/repos/${pin.repo}`;
    const headers = { ...ua, authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' };
    let rel;
    try {
      rel = await request(`${repo}/releases/tags/${encodeURIComponent(pin.tag)}`, { headers: { ...headers, accept: 'application/vnd.github+json' }, ...timed(30_000) }, ctx);
    } catch (e) {
      if (e.status === 401 || e.status === 403) e.tokenRefused = true;
      if (e.status !== 404) throw e;
      // Which 404? Ask for the repository: a token that cannot see it gets 404 there too.
      let probe = null;
      try { probe = await fetch(repo, { headers: { ...headers, accept: 'application/vnd.github+json' }, ...timed(30_000) }); } catch { /* the first answer stands */ }
      if (probe && probe.status === 404) {
        throw Object.assign(new Error(`${pin.repo} ${pin.tag} ${zip}: HTTP 404 — the token in ${tokenName} cannot see ${pin.repo} at all (GitHub answers 404 for a private repository the token has no access to). Give the token read access to that repository's Contents (a fine-grained token must list ${pin.repo} under its repository access), then update the ${tokenName} secret, or make the repository public (then no token is needed).`), { tokenRefused: true });
      }
      if (probe && probe.ok) {
        throw new Error(`${pin.repo} ${pin.tag} ${zip}: HTTP 404 — the token can read ${pin.repo}, but it has no published release tagged ${pin.tag} (a draft is not found by its tag). Check the pin's tag.`);
      }
      throw e;
    }
    const asset = (await rel.json()).assets?.find((a) => a.name === zip);
    if (!asset) throw new Error(`${pin.repo} ${pin.tag}: the release has no asset named ${zip} (the pin names a zip that release does not carry)`);
    res = await request(`${repo}/releases/assets/${asset.id}`, { headers: { ...headers, accept: 'application/octet-stream' }, redirect: 'manual', ...timed(15 * 60_000) }, ctx);
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`${pin.repo} ${pin.tag} ${zip}: HTTP ${res.status} with no Location to follow`);
      // The storage hop: a signed URL, and no Authorization on it. Its
      // failures are the storage's, never the token's, and say so.
      const hop = new URL(location, `${repo}/`).href;
      try { res = await fetch(hop, { headers: ua, redirect: 'follow', ...timed(15 * 60_000) }); }
      catch (e) { throw new Error(`${pin.repo} ${pin.tag} ${zip}: the release's storage URL could not be reached — ${netCause(e, hop)}`); }
      if (!res.ok) throw new Error(`${pin.repo} ${pin.tag} ${zip}: the release's storage URL answered HTTP ${res.status} (the token is not sent there); run again.`);
    }
    try { return Buffer.from(await res.arrayBuffer()); }
    catch (e) { throw new Error(`${zip}: the download broke off (${netCause(e, res.url || 'github.com')})`); }
  }
}

/**
 * fetchArt({ root, from, recheck, pack }) → the verified cache directory of one
 * pack. `get` replaces the download (the tests use it; nothing else should).
 */
export async function fetchArt({ root = ROOT, from = null, recheck: again = false, pack = 'high', get = download } = {}) {
  const pin = readPin(root);
  packsOf(pin, pack); // refuses a pack the pin does not name
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
  const dir = packDirFor(pin, pack, root);
  const mark = markerFor(pin, manifest, pack);
  if (!from && markOf(dir) === mark) {
    if (!again) return { dir, pack, reused: true };
    const problems = recheck(dir, manifest, pack, pin);
    if (!problems.length) return { dir, pack, reused: true };
    discard(dir);
    throw Object.assign(new Error(`the ${pack} cache no longer matches the manifest; it was removed — run again to re-download`), { problems });
  }
  const zipBuf = from ? readFileSync(from) : await get(pin, pack);
  const { problems, entries } = verifyRelease(zipBuf, pin, manifest, pack);
  if (problems.length) throw Object.assign(new Error(`${pin.packs[pack].zip} (${pin.tag}, ${pack}) failed verification`), { problems });
  unpack(entries, dir, mark);
  return { dir, pack, reused: false, count: entries.size - (entries.has(MANIFEST_PATH) ? 1 : 0) };
}

/**
 * verifiedPackDir(pack, { root }) → the pack's cache directory when it is
 * verified against the current pin and manifest; otherwise an error that says
 * which fetch fills it. Readers of the cache (tools/asset-pack.mjs) go through
 * this, never through a bare path.
 */
export function verifiedPackDir(pack, { root = ROOT } = {}) {
  const pin = readPin(root);
  packsOf(pin, pack);
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
  const dir = packDirFor(pin, pack, root);
  if (markOf(dir) !== markerFor(pin, manifest, pack)) {
    throw new Error(`the ${pack} pack of ${pin.tag} is not fetched, or was verified against another pin or manifest: node tools/fetch-art.mjs --pack ${pack}`);
  }
  return dir;
}

/** Which pack a zip on disk is: its name, else its sha256, against the pin. */
export function packOfZip(pin, file) {
  const name = basename(file);
  const byName = PACKS.find((p) => pin.packs[p] && pin.packs[p].zip === name);
  if (byName) return byName;
  const sum = sha256(readFileSync(file));
  const bySum = PACKS.find((p) => pin.packs[p] && pin.packs[p].sha256 === sum);
  if (bySum) return bySum;
  throw new Error(`${name} is none of the zips ${PIN_PATH} pins (by name or sha256): pass --pack`);
}

/** Every file under dir, relative and posix, never following a symlink. */
function filesUnder(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const st = lstatSync(abs);
    if (st.isDirectory()) filesUnder(abs, base, out);
    else out.push(posix(relative(base, abs)));
  }
  return out;
}

/**
 * agree({ root, packs }) → { problems, checks }. The step-11 proof that the
 * fetched release and the trees here are the same files:
 *   · each pack's cache is verified against the current pin and manifest;
 *   · each pack's rows in the release equal the rows derived from the trees
 *     now (tools/art-manifest.mjs buildManifest), so neither side has an id
 *     the other lacks, and no record differs;
 *   · every file in the cache equals its tree file byte for byte (text in its
 *     LF form, the bytes the manifest records), and nothing else is cached;
 *   · every shippable file of assets-mobile/ is in the light cache, and its
 *     font twins equal the common pack's fonts.
 */
export function agree({ root = ROOT, packs = null } = {}) {
  const pin = readPin(root);
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
  const fresh = buildManifest(root).assets;
  const sources = new Map(commonSources(root).map((c) => [c.id, c.source]));
  const problems = [];
  let checks = 0;
  const dirs = {};
  const listedBy = {};
  for (const pack of packsOf(pin, packs)) {
    const dir = packDirFor(pin, pack, root);
    if (markOf(dir) !== markerFor(pin, manifest, pack)) {
      problems.push(`${pack}: ${posix(relative(root, dir))} is not a verified cache of ${pin.packs[pack].zip} — node tools/fetch-art.mjs --pack ${pack}`);
      continue;
    }
    dirs[pack] = dir;
    let theirs = {};
    try { theirs = JSON.parse(readFileSync(join(dir, MANIFEST_PATH), 'utf8')).assets || {}; }
    catch (e) { problems.push(`${pack}: the cached ${MANIFEST_PATH} cannot be read (${e.message})`); continue; }
    const ids = Object.keys(fresh).filter((id) => inPack(fresh[id], pack));
    const idSet = new Set(ids);
    const listed = new Set();
    listedBy[pack] = listed;
    for (const id of ids) {
      checks += 1;
      if (!isDeepStrictEqual(theirs[id], fresh[id])) problems.push(`${pack}: ${id}: ${has(theirs, id) ? "the release's row differs from the one the trees give" : 'in the trees, not in the release'}`);
      const rec = fresh[id][pack];
      if (!rec) { problems.push(`${pack}: ${id}: the trees have no ${pack} file`); continue; }
      listed.add(rec.path);
      const source = pack === 'common' ? sources.get(id) : resolve(root, rec.path);
      const file = join(dir, rec.path);
      if (!existsSync(file)) { problems.push(`${pack}: ${id}: ${rec.path} is in the trees, not in the cache`); continue; }
      checks += 1;
      if (!canonicalBytes(source).equals(readFileSync(file))) problems.push(`${pack}: ${id}: ${posix(relative(root, source))} and the cache's ${rec.path} differ`);
    }
    for (const id of Object.keys(theirs)) if (!idSet.has(id)) problems.push(`${pack}: ${id}: in the release, not in the trees`);
    for (const f of filesUnder(dir)) {
      if (f === MANIFEST_PATH || f === VERIFIED || listed.has(f)) continue;
      problems.push(`${pack}: ${f}: in the cache, not in the trees`);
    }
  }
  // The light tree beyond its manifest rows: every shippable file is either a
  // light record (above) or a font twin, which the common pack carries once.
  if (dirs.light || dirs.common) {
    const lightRoot = resolve(root, LIGHT_DIR);
    const walkTree = (d) => (existsSync(d) ? filesUnder(d) : []);
    for (const rel of walkTree(lightRoot)) {
      if (!runtimeAsset(rel) || !MIME[extname(rel).toLowerCase()]) continue;
      if (rel.startsWith('fonts/')) {
        if (!dirs.common) continue;
        checks += 1;
        const cached = join(dirs.common, 'assets', rel);
        if (!existsSync(cached)) problems.push(`common: ${LIGHT_DIR}/${rel}: a font twin the common pack does not carry`);
        else if (!canonicalBytes(join(lightRoot, rel)).equals(readFileSync(cached))) problems.push(`common: ${LIGHT_DIR}/${rel} differs from the common pack's assets/${rel}`);
      } else if (dirs.light && !listedBy.light.has(`${LIGHT_DIR}/${rel}`)) {
        problems.push(`light: ${LIGHT_DIR}/${rel}: in the light tree, not in the release`);
      }
    }
  }
  return { problems, checks };
}

/** --flag value, or null; a flag with no value is an error. */
function valueOf(args, flag, what) {
  const at = args.indexOf(flag);
  if (at < 0) return null;
  const v = args[at + 1];
  if (!v || v.startsWith('--')) throw new Error(`${flag} needs ${what}`);
  return v;
}

/** In GitHub Actions, the failure also becomes an annotation on the run's summary. */
function annotate(message) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=fetch-art::${esc(message)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fail = (e) => {
    console.error(`fetch-art: FAIL — ${e.message}`);
    for (const p of (e.problems || []).slice(0, 20)) console.error(`  · ${p}`);
    if ((e.problems || []).length > 20) console.error(`  … and ${e.problems.length - 20} more`);
    annotate(`${e.message}${(e.problems || []).length ? ` — ${e.problems[0]}${e.problems.length > 1 ? ` (and ${e.problems.length - 1} more)` : ''}` : ''}`);
    process.exit(1);
  };
  try {
    const packArg = valueOf(args, '--pack', 'high, light, common, a comma list of them, or all');
    const fromArg = valueOf(args, '--from', 'the path of a zip');
    if (args.includes('--print-dir')) {
      const pin = readPin();
      let dir = cacheDirFor(pin);
      if (packArg) {
        const one = packsOf(pin, packArg);
        if (one.length !== 1) throw new Error('--print-dir takes one pack');
        dir = packDirFor(pin, one[0]);
      }
      console.log(relative(process.cwd(), dir) || '.');
    } else if (args.includes('--agree')) {
      const { problems, checks } = agree({ packs: packArg });
      if (problems.length) throw Object.assign(new Error(`the fetched release and the trees disagree (${problems.length} problem(s))`), { problems });
      console.log(`fetch-art agree: OK — ${checks} checks passed`);
    } else {
      const pin = readPin();
      let packs;
      if (fromArg) {
        const asked = packArg ? packsOf(pin, packArg) : [packOfZip(pin, resolve(fromArg))];
        if (asked.length !== 1) throw new Error('--from verifies one zip: pass one --pack');
        packs = asked;
      } else packs = packsOf(pin, packArg);
      let failed = null;
      for (const pack of packs) {
        try {
          const r = await fetchArt({ pack, from: fromArg ? resolve(fromArg) : null, recheck: args.includes('--recheck') });
          const rel = relative(ROOT, r.dir);
          console.log(r.reused ? `fetch-art: OK — ${pack}: ${rel} already verified` : `fetch-art: OK — ${pack}: ${r.count} files verified into ${rel}`);
        } catch (e) {
          // One pack's failure does not hide the next one's cause.
          console.error(`fetch-art: FAIL — ${pack}: ${e.message}`);
          for (const p of (e.problems || []).slice(0, 20)) console.error(`  · ${p}`);
          if ((e.problems || []).length > 20) console.error(`  … and ${e.problems.length - 20} more`);
          annotate(`${pack}: ${e.message}${(e.problems || []).length ? ` — ${e.problems[0]}` : ''}`);
          failed = failed || e;
        }
      }
      if (failed) process.exit(1);
    }
  } catch (e) { fail(e); }
}
