#!/usr/bin/env node
// tools/art-manifest.mjs — the data-driven art manifest: one entry per asset id,
// with the file each art tier ships for it.
//
//   node tools/art-manifest.mjs --write    regenerate art-manifest.json
//   node tools/art-manifest.mjs --check    exit 1 when the manifest and the trees disagree
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
// DERIVED, NEVER HAND-EDITED: --write regenerates it from the trees; --check is
// the gate (tests/art-manifest.test.mjs) that fails the day an asset is added,
// removed or re-encoded without regenerating. Same file filter as the bundler
// (tools/assetmime.mjs), so the manifest lists exactly what a build can ship.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSortedSync } from './dirorder.mjs';
import { MIME, runtimeAsset } from './assetmime.mjs';
import { MOBILE_ASSET_DIR, webpDimensions } from './mobileart-policy.mjs';

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

/** checkManifest(root) → list of problems; empty means the manifest is current. */
export function checkManifest(root = ROOT) {
  const problems = [];
  const path = resolve(root, MANIFEST_PATH);
  if (!existsSync(path)) return [`${MANIFEST_PATH} is missing — node tools/art-manifest.mjs --write`];
  let committed;
  try { committed = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { return [`${MANIFEST_PATH} is not JSON: ${e.message}`]; }
  const fresh = buildManifest(root);
  if (committed.schema !== SCHEMA) problems.push(`${MANIFEST_PATH} is schema ${committed.schema}, this tool writes ${SCHEMA}`);
  const have = committed.assets || {};
  const want = fresh.assets;
  const home = (id) => (id.startsWith(`${HIGH_DIR}/`) ? `${HIGH_DIR}/` : 'the common sources');
  for (const id of Object.keys(want)) {
    if (!have[id]) { problems.push(`${id}: in ${home(id)} but not in the manifest`); continue; }
    for (const tier of isCommonEntry(want[id]) ? ['common'] : ['light', 'high']) {
      const a = have[id][tier];
      const b = want[id][tier];
      if (b === null) { problems.push(`${id}: no ${tier} file (${LIGHT_DIR}/ has no twin — node tools/mobile-art.mjs)`); continue; }
      if (!a || a.sha256 !== b.sha256 || a.bytes !== b.bytes || a.path !== b.path) problems.push(`${id}: the ${tier} file changed since the manifest was written`);
    }
  }
  for (const id of Object.keys(have)) if (!want[id]) problems.push(`${id}: in the manifest but not in ${home(id)}`);
  // ONE FILE PER COMMON FONT. The light tree still carries the faces (the light
  // single file inlines them through CSS), so its copy must be the same bytes
  // the one `common` record names, or the tiers would ship different fonts.
  for (const id of Object.keys(want)) {
    if (!id.startsWith(`${HIGH_DIR}/${COMMON_ASSET_PREFIX}`)) continue;
    const twin = resolve(root, LIGHT_DIR, id.slice(HIGH_DIR.length + 1));
    if (!existsSync(twin)) problems.push(`${id}: no twin under ${LIGHT_DIR}/ (a common font is the same file in both trees)`);
    else if (commonRecord(twin, id).sha256 !== want[id].common.sha256) problems.push(`${id}: the ${LIGHT_DIR}/ copy differs from ${HIGH_DIR}/ (a common font is the same file in both trees)`);
  }
  if (committed.count !== Object.keys(have).length) problems.push(`${MANIFEST_PATH} says count ${committed.count} but lists ${Object.keys(have).length}`);
  // AND BYTE FOR BYTE. The messages above name what moved; this catches every
  // field they do not compare (pixel sizes, the header, an extra key), so a
  // hand edit anywhere in the file is refused. Line endings are canonical first,
  // because a Windows checkout may store the file with CRLF.
  if (!problems.length && serialize(fresh) !== readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')) {
    problems.push(`${MANIFEST_PATH} differs from what --write produces (a field was edited by hand, e.g. a pixel size)`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--write')) {
    const m = buildManifest();
    writeFileSync(resolve(ROOT, MANIFEST_PATH), serialize(m), 'utf8');
    console.log(`art-manifest: OK — ${m.count} assets written to ${MANIFEST_PATH}`);
  } else if (args.includes('--check')) {
    const problems = checkManifest();
    if (problems.length) {
      console.error(`art-manifest: FAIL — ${problems.length} problem(s):`);
      for (const p of problems.slice(0, 20)) console.error(`  · ${p}`);
      if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
      console.error('  Fix: node tools/art-manifest.mjs --write');
      process.exit(1);
    }
    const n = Object.keys(JSON.parse(readFileSync(resolve(ROOT, MANIFEST_PATH), 'utf8')).assets).length;
    console.log(`art-manifest: OK — ${n} checks passed`);
  } else {
    console.error('usage: node tools/art-manifest.mjs --write | --check');
    process.exit(2);
  }
}
