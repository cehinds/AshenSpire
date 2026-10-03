#!/usr/bin/env node
// tools/art-manifest.mjs — the data-driven art manifest: one entry per asset id,
// with the file each art tier ships for it.
//
//   node tools/art-manifest.mjs --write [--from <dir>]
//                                          write art-manifest.json from the release
//                                          art-release.json pins: each pack's zip (from
//                                          <dir>, else downloaded), held to its pinned
//                                          sha256, and the art-manifest.json inside it
//   node tools/art-manifest.mjs --check    exit 1 when the manifest is malformed, or
//                                          disagrees with a fetched pack's own manifest
//
// SINCE STEP 13 (docs/EXTERNAL-ASSETS-PLAN.md; ART-REPO-PLAN step 6) the trees
// this file was derived from live in cehinds/AshenSpire-art, whose
// tools/manifest.mjs derives each pack's rows there and ships them inside the
// pack's zip. This repository's manifest is the union of those three, under the
// header below: --write assembles it from the pinned zips (the pin's sha256 is
// the trust anchor, so a re-pin is: edit art-release.json, --write, fetch), and
// --check holds the committed file to every pack fetched into .art-cache/ (row
// for row, both ways) and to its own shape. buildManifest() below still derives
// a manifest from trees under a root, for the sandboxes and fixtures that build
// one (tests/asset-pack.test.mjs, tests/fetch-art.test.mjs), never this checkout.
//
// SCHEMA 2 (docs/EXTERNAL-ASSETS-PLAN.md §2, step 2). Besides the art ids, which
// keep a `light` and a `high` record, the manifest lists the files the art
// repository's `common` pack will carry. Each of those has ONE `common` record,
// `{path, bytes, sha256}`, and no light or high record:
//
//   assets/fonts/*.woff2          the 15 interface faces (their twins under
//                                 assets-mobile/fonts/ are byte-identical, and
//                                 --check refuses the day they are not)
//   music/manifest.json, music/**/*.mp3   the shipped score
//   map-detail/**/*.webp          the map detail tiles
//   licenses/OFL.txt              the fonts' licence, from asset-data/fonts/OFL.txt
//
// A common record's `path` is where the file sits in the common pack (the id,
// except the licence), not where it is read from here: COMMON_SOURCES below is
// that mapping. `licenses/OFL.txt` is listed so the pack carries the licence next
// to the fonts; it is not something assetUrl() asks for. Readers that walk the
// light/high twins skip ids whose entry is `common` (isCommonEntry).
//
// WHY (LFS / art-tier plan, step 3, 2026-09-26). The game has three art tiers:
//
//   placeholder  the style guide's generated recipe (src/ui/assets.js): no file
//   light        the assets-mobile/ twin — what dev/test builds ship (#1336)
//   high         the full-resolution file under assets/ — release/main builds,
//                and the "Local high-res" setting on any build
//
// An ASSET ID is the runtime path the game already asks for (`assets/…`): every
// module builds those paths and passes them through src/ui/assetmap.js, so the
// id needs no second vocabulary. The manifest says, per id, what each tier
// carries — path, bytes, sha256 and pixel size — so a tool can pick a tier
// without walking two trees, the high-res release can be verified file by file
// (docs/ART-REPO-PLAN.md), and a high-res folder a player picks can be matched
// to ids by its own copy of this file.
//
// DERIVED, NEVER HAND-EDITED: --write regenerates it from the pinned release;
// --check is the gate (tests/art-manifest.test.mjs) that fails the day the
// committed file and a fetched pack disagree, or the file was edited by hand.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSortedSync } from './dirorder.mjs';
import { MIME, runtimeAsset } from './assetmime.mjs';
import { MOBILE_ASSET_DIR, webpDimensions } from './mobileart-policy.mjs';
import { download, markerFor, packDirFor, packsOf, readPin } from './fetch-art.mjs';
import { readZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_PATH = 'art-manifest.json';
export const HIGH_DIR = 'assets';
export const LIGHT_DIR = MOBILE_ASSET_DIR;
export const SCHEMA = 2;
/** The directory under the high tree whose files are `common` ids (the fonts). */
export const COMMON_ASSET_PREFIX = 'fonts/';
export const LICENSE_ID = 'licenses/OFL.txt';
export const LICENSE_SOURCE = 'asset-data/fonts/OFL.txt';

/** True when a manifest entry is a `common` record rather than a light/high pair. */
export function isCommonEntry(entry) {
  return Boolean(entry && entry.common);
}

// Text payloads hash by their LF form, so a CRLF checkout (Windows) records and
// packs the same bytes as an LF one. bundle.mjs ships SVG this way already.
const TEXT_EXTS = new Set(['.svg', '.json', '.txt']);

/** The bytes a file is recorded and packed as: text with canonical line endings. */
export function canonicalBytes(abs) {
  const buf = readFileSync(abs);
  return TEXT_EXTS.has(extname(abs).toLowerCase())
    ? Buffer.from(buf.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8')
    : buf;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSortedSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** Pixel size of an image payload, or null when the format carries none we read. */
export function dimensions(buf, ext) {
  if (ext === '.webp') {
    const d = webpDimensions(buf);
    return d ? { width: d.width, height: d.height } : null;
  }
  if (ext === '.png' && buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (ext === '.gif' && buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if ((ext === '.jpg' || ext === '.jpeg') && buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    // Walk the segments to the first start-of-frame (SOF0–SOF15 except the
    // DHT/JPG/DAC markers C4, C8, CC); its height and width follow the precision byte.
    let i = 2;
    while (i + 9 < buf.length && buf[i] === 0xff) {
      // Any number of 0xFF fill bytes may precede a marker code.
      while (i + 9 < buf.length && buf[i + 1] === 0xff) i += 1;
      const marker = buf[i + 1];
      // Standalone markers carry no length: TEM (01), RSTn (D0–D7), SOI (D8).
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
      if (marker === 0xd9) return null; // EOI before any frame
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (ext === '.svg') {
    // The root element's width and height attributes when both are plain
    // numbers (px), else its viewBox size — what the browser uses as the
    // intrinsic size of an <img> that names neither.
    const root = svgRootTag(buf.toString('utf8'));
    if (!root) return null;
    const attr = (name) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root)?.[1];
    const px = (v) => (v !== undefined && /^\d+(?:\.\d+)?(?:px)?$/.test(v.trim()) ? Number.parseFloat(v) : null);
    const w = px(attr('width'));
    const h = px(attr('height'));
    if (w !== null && h !== null) return { width: w, height: h };
    const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
    return box && box.length === 4 && box.every(Number.isFinite) ? { width: box[2], height: box[3] } : null;
  }
  return null;
}

/**
 * The SVG document element's start tag, or null. The XML prolog is SCANNED,
 * not searched: an XML declaration or processing instruction (`<?…?>`),
 * comments (`<!--…-->`) and a DOCTYPE (with an internal subset `[…]`) are
 * skipped whole, in any number and order, so markup-like text inside them is
 * never mistaken for the root. The first element after them must be <svg>.
 */
export function svgRootTag(text) {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const skip = (close) => { const j = text.indexOf(close, i); return j < 0 ? -1 : j + close.length; };
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (text.startsWith('<?', i)) i = skip('?>');
    else if (text.startsWith('<!--', i)) i = skip('-->');
    else if (/^<!DOCTYPE/i.test(text.slice(i, i + 9))) {
      // Up to the '>' that closes the DOCTYPE, past any bracketed internal subset
      // (whose own declarations and quoted strings may contain '>').
      let depth = 0; let quote = null; let j = i + 9;
      for (; j < text.length; j++) {
        const c = text[j];
        // Inside the subset, comments and PIs are skipped whole: their text may
        // hold brackets and '>' that are not markup.
        if (!quote && depth > 0 && text.startsWith('<!--', j)) { const k = text.indexOf('-->', j + 4); if (k < 0) return null; j = k + 2; continue; }
        if (!quote && depth > 0 && text.startsWith('<?', j)) { const k = text.indexOf('?>', j + 2); if (k < 0) return null; j = k + 1; continue; }
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '[') depth += 1;
        else if (c === ']') depth -= 1;
        else if (c === '>' && depth <= 0) break;
      }
      i = j < text.length ? j + 1 : -1;
    } else break;
    if (i < 0) return null;
  }
  const m = /^<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(text.slice(i));
  return m ? m[0] : null;
}

/** One tier's record of one file. SVG line endings are canonical, as bundle.mjs ships them. */
export function fileRecord(abs, relPath) {
  const ext = extname(abs).toLowerCase();
  const buf = canonicalBytes(abs);
  const dims = dimensions(buf, ext);
  return {
    path: relPath,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    ...(dims ? { width: dims.width, height: dims.height } : {}),
  };
}

/** A `common` record: path, bytes and sha256 only (no pixel size), per the plan. */
export function commonRecord(abs, packPath) {
  const buf = canonicalBytes(abs);
  return { path: packPath, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

/**
 * COMMON_SOURCES(root) → [{ id, path, source }] sorted by id: every file the
 * common pack carries, with its pack path and the file it is read from here.
 * One home, shared with tools/asset-pack.mjs, so the manifest and the packs
 * can never disagree about what `common` holds.
 */
export function commonSources(root = ROOT) {
  const out = [];
  const rel = (abs, base) => relative(base, abs).split(/[\\/]/g).join('/');
  const highRoot = resolve(root, HIGH_DIR);
  for (const abs of walk(resolve(highRoot, COMMON_ASSET_PREFIX))) {
    const r = rel(abs, highRoot);
    if (!runtimeAsset(r) || !MIME[extname(r).toLowerCase()]) continue;
    out.push({ id: `${HIGH_DIR}/${r}`, path: `${HIGH_DIR}/${r}`, source: abs });
  }
  const license = resolve(root, LICENSE_SOURCE);
  if (existsSync(license)) out.push({ id: LICENSE_ID, path: LICENSE_ID, source: license });
  const music = resolve(root, 'music');
  if (existsSync(resolve(music, 'manifest.json'))) out.push({ id: 'music/manifest.json', path: 'music/manifest.json', source: resolve(music, 'manifest.json') });
  for (const abs of walk(music)) {
    if (extname(abs).toLowerCase() !== '.mp3') continue;
    const id = `music/${rel(abs, music)}`;
    out.push({ id, path: id, source: abs });
  }
  const tiles = resolve(root, 'map-detail');
  for (const abs of walk(tiles)) {
    if (extname(abs).toLowerCase() !== '.webp') continue;
    const id = `map-detail/${rel(abs, tiles)}`;
    out.push({ id, path: id, source: abs });
  }
  return out.sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
}

/**
 * buildManifest(root) → the manifest object. Ids come from the HIGH tree (the
 * source of truth the light tree mirrors); a light twin that is missing is
 * recorded as `light: null`, which --check reports, never as a silent gap.
 */
export function buildManifest(root = ROOT) {
  const highRoot = resolve(root, HIGH_DIR);
  const lightRoot = resolve(root, LIGHT_DIR);
  const assets = {};
  for (const abs of walk(highRoot)) {
    const rel = relative(highRoot, abs).split(/[\\/]/g).join('/');
    if (!runtimeAsset(rel) || !MIME[extname(rel).toLowerCase()]) continue;
    if (rel.startsWith(COMMON_ASSET_PREFIX)) continue; // a `common` id, below
    const id = `${HIGH_DIR}/${rel}`;
    const twin = resolve(lightRoot, rel);
    assets[id] = {
      light: existsSync(twin) ? fileRecord(twin, `${LIGHT_DIR}/${rel}`) : null,
      high: fileRecord(abs, id),
    };
  }
  for (const { id, path, source } of commonSources(root)) assets[id] = { common: commonRecord(source, path) };
  return withHeader(assets);
}

/** The committed file's header around a set of rows: what --write and buildManifest both write. */
export function withHeader(assets) {
  return {
    _: 'DERIVED — written by node tools/art-manifest.mjs --write, never by a hand. One entry per asset id (the runtime `assets/…` path, or a `common` pack path: fonts, licenses/OFL.txt, music/, map-detail/).',
    schema: SCHEMA,
    tiers: {
      placeholder: 'no file: src/ui/assets.js draws the style guide recipe from the id (SPEC §2.4)',
      light: `${LIGHT_DIR}/ — the dev/test tier and the mobile edition's art`,
      high: `${HIGH_DIR}/ — full resolution; release/main builds and the Local high-res setting`,
      common: `one file for every tier: ${HIGH_DIR}/${COMMON_ASSET_PREFIX} (the fonts), ${LICENSE_ID} (from ${LICENSE_SOURCE}), music/ and map-detail/`,
    },
    count: Object.keys(assets).length,
    assets,
  };
}

const RELEASE_PACKS = Object.freeze(['high', 'light', 'common']);
const plain = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * releaseManifest(docs) → { manifest, problems }. `docs` maps a pack name to
 * the art-manifest.json its zip carries (schema 2, `"pack"` naming it). The
 * high and light zips each list every art id with both its light and high
 * records (the art repository's tools/manifest.mjs), and must list the same
 * ids with the same rows; the common zip lists the common ids, one `common`
 * record each. The union is this repository's manifest.
 */
export function releaseManifest(docs) {
  const problems = [];
  const assets = {};
  const from = {};
  for (const pack of RELEASE_PACKS) {
    const doc = docs[pack];
    if (!doc) { problems.push(`the ${pack} pack's ${MANIFEST_PATH} is missing`); continue; }
    if (!plain(doc) || !plain(doc.assets)) { problems.push(`the ${pack} pack's ${MANIFEST_PATH} has no "assets" object`); continue; }
    if (doc.schema !== SCHEMA) problems.push(`the ${pack} pack's ${MANIFEST_PATH} is schema ${doc.schema}, not ${SCHEMA}`);
    if (doc.pack !== pack) problems.push(`the ${pack} pack's ${MANIFEST_PATH} names pack ${JSON.stringify(doc.pack ?? null)}`);
    for (const [id, row] of Object.entries(doc.assets)) {
      const tiers = plain(row) ? Object.keys(row).sort().join('+') : '';
      const want = pack === 'common' ? 'common' : 'high+light';
      if (tiers !== want || !Object.values(row).every(plain)) { problems.push(`${id}: the ${pack} pack's row has ${tiers || 'no records'}, not ${want}`); continue; }
      // Key order as buildManifest writes it, so serialize() is byte-stable.
      const norm = pack === 'common' ? { common: row.common } : { light: row.light, high: row.high };
      if (assets[id] && JSON.stringify(assets[id]) !== JSON.stringify(norm)) { problems.push(`${id}: the ${from[id]} and ${pack} packs' rows differ`); continue; }
      if (pack === 'light' && !assets[id] && docs.high) { problems.push(`${id}: in the light pack's manifest, not in the high pack's`); continue; }
      if (!assets[id]) { assets[id] = norm; from[id] = pack; }
    }
  }
  if (docs.high && docs.light && plain(docs.light.assets)) {
    for (const id of Object.keys(assets)) if (from[id] === 'high' && !docs.light.assets[id]) problems.push(`${id}: in the high pack's manifest, not in the light pack's`);
  }
  const ordered = {};
  for (const id of Object.keys(assets).sort()) ordered[id] = assets[id];
  return { manifest: withHeader(ordered), problems };
}

/**
 * releaseDocsFromZips(root, { from, get }) → { pack: its zip's manifest }.
 * Each pinned zip is read from `from` (a directory holding the zips by their
 * pinned names) or downloaded (tools/fetch-art.mjs download), and refused
 * unless its sha256 is the one art-release.json pins: the pin is the anchor.
 */
export async function releaseDocsFromZips(root = ROOT, { from = null, get = download } = {}) {
  const pin = readPin(root);
  const docs = {};
  for (const pack of packsOf(pin, 'all')) {
    const { zip, sha256 } = pin.packs[pack];
    const buf = from ? readFileSync(resolve(from, zip)) : await get(pin, pack);
    const got = createHash('sha256').update(buf).digest('hex');
    if (got !== sha256) throw new Error(`${zip}: sha256 ${got}, ${PIN_PATH_NAME} pins ${sha256}`);
    const entry = readZip(buf).find((e) => e.name === MANIFEST_PATH);
    if (!entry) throw new Error(`${zip} carries no ${MANIFEST_PATH}`);
    docs[pack] = JSON.parse(entry.data.toString('utf8'));
  }
  return docs;
}
const PIN_PATH_NAME = 'art-release.json';

/**
 * releaseDocsFromCache(root) → { docs, missing, stale }: the manifest each
 * pack cache of THIS PIN (.art-cache/<tag>/<pack>/, tools/fetch-art.mjs)
 * carries, the packs with no such cache, and a problem for every cache that
 * was fetched for this pin's zip but verified against another
 * art-manifest.json. The cache is read by its zip, not by the verified marker
 * alone: the marker also digests the committed manifest's rows, so keying on
 * it would make an edited manifest look unfetched and compare nothing.
 */
export function releaseDocsFromCache(root = ROOT) {
  const docs = {};
  const missing = [];
  const stale = [];
  let pin = null;
  let manifest = null;
  try { pin = readPin(root); manifest = JSON.parse(readFileSync(resolve(root, MANIFEST_PATH), 'utf8')); } catch { return { docs, missing: [...RELEASE_PACKS], stale }; }
  for (const pack of RELEASE_PACKS) {
    let dir;
    let marker = '';
    try { dir = packDirFor(pin, pack, root); marker = readFileSync(resolve(dir, '.verified'), 'utf8').trim(); } catch { missing.push(pack); continue; }
    const zipSha = pin.packs && pin.packs[pack] && pin.packs[pack].sha256;
    if (!zipSha || marker.split(' ')[0] !== zipSha || !existsSync(resolve(dir, MANIFEST_PATH))) { missing.push(pack); continue; }
    try { docs[pack] = JSON.parse(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8')); } catch (e) { stale.push(`the fetched ${pack} pack's ${MANIFEST_PATH} cannot be read: ${e.message}`); continue; }
    let want = null;
    try { want = markerFor(pin, manifest, pack); } catch { /* the pin names no such zip: reported above */ }
    if (marker !== want) stale.push(`the fetched ${pack} pack of ${pin.tag} was verified against another ${MANIFEST_PATH}: this one is not what the release says (node tools/art-manifest.mjs --write)`);
  }
  return { docs, missing, stale };
}

/**
 * The bytes --write puts on disk: the header fields pretty-printed, then ONE
 * LINE PER ASSET in id order, so an art change is a one-line diff and the file
 * stays about a third smaller than fully indented JSON.
 */
export function serialize(manifest) {
  const { assets, ...head } = manifest;
  const top = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  const rows = Object.keys(assets).sort().map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify(assets[id])}`);
  return `${top},\n  "assets": {\n${rows.join(',\n')}\n  }\n}\n`;
}

/**
 * checkManifest(root, { docs }) → list of problems; empty means the committed
 * manifest is well formed and agrees, row for row and both ways, with every
 * pack whose own manifest `docs` holds (by default: every pack fetched into
 * .art-cache/, releaseDocsFromCache). A pack that is not fetched is checked by
 * tools/fetch-art.mjs when it is: its rows must equal this file's.
 */
export function checkManifest(root = ROOT, opts = {}) {
  const fromCache = opts.docs ? null : releaseDocsFromCache(root);
  const docs = opts.docs || fromCache.docs;
  const problems = [...(opts.stale || (fromCache ? fromCache.stale : []))];
  const path = resolve(root, MANIFEST_PATH);
  if (!existsSync(path)) return [`${MANIFEST_PATH} is missing — node tools/art-manifest.mjs --write`];
  let committed;
  try { committed = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { return [`${MANIFEST_PATH} is not JSON: ${e.message}`]; }
  if (committed.schema !== SCHEMA) problems.push(`${MANIFEST_PATH} is schema ${committed.schema}, this tool writes ${SCHEMA}`);
  const have = plain(committed.assets) ? committed.assets : {};
  for (const [id, row] of Object.entries(have)) {
    const tiers = plain(row) ? Object.keys(row).sort().join('+') : '';
    if (tiers !== 'common' && tiers !== 'high+light') problems.push(`${id}: has ${tiers || 'no records'} (an art id needs light and high, a common id common alone)`);
  }
  for (const pack of RELEASE_PACKS) {
    const doc = docs[pack];
    if (!doc) continue;
    const theirs = plain(doc.assets) ? doc.assets : {};
    const ours = Object.keys(have).filter((id) => plain(have[id]) && (pack === 'common' ? isCommonEntry(have[id]) : !isCommonEntry(have[id])));
    for (const id of ours) {
      if (!theirs[id]) problems.push(`${id}: in the manifest, not in the ${pack} pack's`);
      else if (JSON.stringify(theirs[id]) !== JSON.stringify(have[id])) problems.push(`${id}: its row differs from the ${pack} pack's`);
    }
    const mine = new Set(ours);
    for (const id of Object.keys(theirs)) if (!mine.has(id)) problems.push(`${id}: in the ${pack} pack's manifest, not in this one`);
  }
  if (committed.count !== Object.keys(have).length) problems.push(`${MANIFEST_PATH} says count ${committed.count} but lists ${Object.keys(have).length}`);
  // AND BYTE FOR BYTE. Whatever the rows, the file is the header --write gives
  // around them, one line per id: a hand edit of the header, an extra key or a
  // reordered record is refused. Line endings are canonical first, because a
  // Windows checkout may store the file with CRLF.
  if (!problems.length && serialize(withHeader(have)) !== readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')) {
    problems.push(`${MANIFEST_PATH} differs from what --write produces (a field was edited by hand)`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--from');
  const from = at >= 0 ? args[at + 1] : null;
  if (args.includes('--write')) {
    try {
      const { manifest, problems } = releaseManifest(await releaseDocsFromZips(ROOT, { from }));
      if (problems.length) throw Object.assign(new Error(`the pinned release's manifests do not make one (${problems.length} problem(s))`), { problems });
      writeFileSync(resolve(ROOT, MANIFEST_PATH), serialize(manifest), 'utf8');
      console.log(`art-manifest: OK — ${manifest.count} assets written to ${MANIFEST_PATH} from the release art-release.json pins; now node tools/fetch-art.mjs`);
    } catch (e) {
      console.error(`art-manifest: FAIL — ${e.message}`);
      for (const p of (e.problems || []).slice(0, 20)) console.error(`  · ${p}`);
      process.exit(1);
    }
  } else if (args.includes('--check')) {
    const { docs, missing, stale } = releaseDocsFromCache();
    const problems = checkManifest(ROOT, { docs, stale });
    if (problems.length) {
      console.error(`art-manifest: FAIL — ${problems.length} problem(s):`);
      for (const p of problems.slice(0, 20)) console.error(`  · ${p}`);
      if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
      console.error('  Fix: node tools/art-manifest.mjs --write (from the release art-release.json pins)');
      process.exit(1);
    }
    const n = Object.keys(JSON.parse(readFileSync(resolve(ROOT, MANIFEST_PATH), 'utf8')).assets).length;
    const against = Object.keys(docs);
    console.log(`art-manifest: OK — ${n} ids, well formed${against.length ? `, and equal to the fetched ${against.join(', ')} pack(s)` : ''}${missing.length ? ` (not fetched, so not compared: ${missing.join(', ')})` : ''}`);
  } else {
    console.error('usage: node tools/art-manifest.mjs --write [--from <dir of zips>] | --check');
    process.exit(2);
  }
}
