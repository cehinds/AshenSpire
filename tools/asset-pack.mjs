#!/usr/bin/env node
// tools/asset-pack.mjs — the pack format: a content-addressed object store and
// one hash-pinnable index per pack, written from the trees in this repository.
//
//   node tools/asset-pack.mjs [--out <dir>] [--pack light,high,common] [--json]
//                                    write <dir>/objects/ and <dir>/packs/
//                                    (default <dir>: build/asset-pack)
//   node tools/asset-pack.mjs --check [--out <dir>] [--pack …]
//                                    verify a written tree (exit 1 = red)
//   node tools/asset-pack.mjs --source cache [--out <dir>] [--pack …]
//                                    write from the fetched release
//                                    (.art-cache/<tag>/<pack>/, tools/fetch-art.mjs)
//                                    instead of the trees here
//
// WHY (docs/EXTERNAL-ASSETS-PLAN.md §3, step 2). The game is moving from one
// HTML with every asset inlined to an HTML that loads its assets at runtime
// from files named by their sha256. This tool defines that shape and writes it;
// NOTHING READS IT YET. The bundler, the editions and the game are unchanged by
// this step (step 3a wires the web edition to it).
//
// WHAT IT WRITES
//   objects/<sha256[0:2]>/<sha256>.<ext>
//       every file of every pack, once: identical bytes are one object, and a
//       name can never hold other bytes than the ones it names.
//   packs/<pack>-<digest12>.json
//       the pack index: a map id → [sha256, bytes, mime], keys in byte order,
//       one entry per line, `\n` only. <digest12> is the first 12 hex digits
//       of the sha256 of this file's text, so a changed index is a new name.
//   packs/<pack>-<digest12>.js
//       the index's twin for file:// pages, exactly
//         window.__ashenPack("<pack>-<digest12>", "<the .json text as a JS string>");
//       The string is the .json text byte for byte, so the one sha256 the HTML
//       will pin covers both files (the loader hashes the string before it
//       parses it, and drops a twin whose string does not match).
//   packs/fonts-<digest12>.js   (with the common pack)
//       the font sidecar for file:// pages, where Chrome refuses cross-origin
//       font loads:
//         __ashenFonts("fonts-<digest12>", "<JSON text: font id → base64>");
//       <digest12> and the pin are the JSON text's; each decoded face must
//       match its `common` record.
//
// WHERE THE FILES COME FROM. art-manifest.json (schema 2) is the list: an art
// id's `light` record is read from assets-mobile/, its `high` record from
// assets/, and a `common` id (the fonts, licenses/OFL.txt, music/, map-detail/)
// from the source tools/art-manifest.mjs `commonSources` names. With
// `--source cache` (step 11) every record is read instead from the fetched
// release, .art-cache/<tag>/<pack>/<record path>, and only from a pack cache
// tools/fetch-art.mjs has verified against the current pin and manifest; an
// unfetched or stale pack is refused by name. Either source writes the same
// bytes while `node tools/fetch-art.mjs --agree` is green. Each file is
// hashed as it is read and must match its record, so a stale manifest stops the
// write instead of shipping bytes the manifest does not describe. Text (SVG,
// JSON, the licence) is packed with LF line endings, so a Windows checkout
// writes the same objects and the same indexes as a Linux one.
//
// BYTE-STABLE. Ids sort by byte order (tools/dirorder.mjs says why never by
// locale), the output carries no time, path or platform, and the output tree is
// cleared before it is written, so two runs on any OS write identical bytes.
// tests/asset-pack.test.mjs proves that, and plants a wrong hash, a stray and a
// twin that does not match, each of which --check must catch.

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIME } from './assetmime.mjs';
import { MANIFEST_PATH, canonicalBytes, commonSources, isCommonEntry } from './art-manifest.mjs';
import { verifiedPackDir } from './fetch-art.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PACKS = Object.freeze(['light', 'high', 'common']);
/** Where planPacks reads the files: the trees in this repository, or the fetched release. */
export const SOURCES = Object.freeze(['trees', 'cache']);
export const DEFAULT_OUT = 'build/asset-pack';
export const FONTS_SIDECAR = 'fonts';
export const PACKS_DIR = 'packs';
export const OBJECTS_DIR = 'objects';
/** The marker a written tree carries: packs/ and objects/ beside it are this tool's to clear. */
export const MARKER = '.asset-pack';
const MARKER_TEXT = 'Written by tools/asset-pack.mjs. packs/ and objects/ beside this file are cleared and rewritten on every run.\n';

// What the packs carry beyond shippable art: the score's manifest and the font
// licence. Kept here, not in tools/assetmime.mjs, because that table decides
// what the bundler inlines and is part of the build's identity; a pack index
// naming a JSON or text file must not change what any edition ships.
const PACK_MIME = { ...MIME, '.json': 'application/json', '.txt': 'text/plain' };

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const byteOrder = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const posix = (p) => p.split(/[\\/]/g).join('/');

/** The mime a pack index records for an id, or null when the pack cannot carry it. */
export function mimeOf(id) {
  return PACK_MIME[extname(id).toLowerCase()] || null;
}

/** objects/<xx>/<sha256>.<ext> for an id's bytes. */
export function objectPath(sha, id) {
  return `${OBJECTS_DIR}/${sha.slice(0, 2)}/${sha}${extname(id).toLowerCase()}`;
}

/** The index text: one `"id": [sha256, bytes, mime]` line per id, byte order, LF. */
export function indexText(entries) {
  const ids = Object.keys(entries).sort(byteOrder);
  if (!ids.length) return '{}\n';
  return `{\n${ids.map((id) => `${JSON.stringify(id)}:${JSON.stringify(entries[id])}`).join(',\n')}\n}\n`;
}

/** The .js twin of an index (or of the font sidecar's JSON text). */
export function twinText(fn, name, text) {
  return `${fn}(${JSON.stringify(name)}, ${JSON.stringify(text)});\n`;
}

const PACK_FN = 'window.__ashenPack';
const FONTS_FN = '__ashenFonts';

/**
 * planPacks(root, packs, { source }) → { packs: { name: { entries, files } }, fonts, problems }.
 * `entries` is id → [sha256, bytes, mime]; `files` is objectPath → Buffer.
 * Nothing is written; every source is read and checked against the manifest.
 * `source` is 'trees' (this repository) or 'cache' (the fetched release).
 */
export function planPacks(root = ROOT, packs = PACKS, { source: from = 'trees' } = {}) {
  const problems = [];
  if (!SOURCES.includes(from)) return { packs: {}, fonts: null, problems: [`unknown source ${JSON.stringify(from)} (one of ${SOURCES.join(', ')})`] };
  const manifestFile = resolve(root, MANIFEST_PATH);
  if (!existsSync(manifestFile)) return { packs: {}, fonts: null, problems: [`${MANIFEST_PATH} is missing — node tools/art-manifest.mjs --write`] };
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (manifest.schema !== 2) problems.push(`${MANIFEST_PATH} is schema ${manifest.schema}; the pack format needs schema 2 (node tools/art-manifest.mjs --write)`);
  const sources = from === 'trees' ? new Map(commonSources(root).map((c) => [c.id, c.source])) : null;
  const out = {};
  let fonts = null;
  for (const pack of packs) {
    if (!PACKS.includes(pack)) { problems.push(`unknown pack ${JSON.stringify(pack)} (one of ${PACKS.join(', ')})`); continue; }
    const entries = {};
    const files = new Map();
    // The fetched pack: verified against this pin and this manifest, or refused.
    let cacheDir = null;
    if (from === 'cache') {
      try { cacheDir = resolve(verifiedPackDir(pack, { root })); } catch (e) { problems.push(e.message); continue; }
    }
    for (const id of Object.keys(manifest.assets || {}).sort(byteOrder)) {
      const entry = manifest.assets[id];
      const common = isCommonEntry(entry);
      if ((pack === 'common') !== common) continue;
      const rec = entry[pack];
      if (!rec) { problems.push(`${id}: ${MANIFEST_PATH} has no ${pack} record`); continue; }
      const mime = mimeOf(id);
      if (!mime) { problems.push(`${id}: no mime for ${extname(id) || 'a file without an extension'} — the pack cannot carry it`); continue; }
      let source;
      if (cacheDir) {
        source = resolve(cacheDir, rec.path);
        if (!source.startsWith(cacheDir + sep)) { problems.push(`${id}: its ${pack} path ${rec.path} escapes the cache`); continue; }
      } else source = common ? sources.get(id) : resolve(root, rec.path);
      if (!source || !existsSync(source)) { problems.push(`${id}: the ${pack} source ${cacheDir ? `${posix(relative(root, source))} (the fetched ${pack} pack)` : common ? '(see commonSources)' : rec.path} is missing`); continue; }
      const buf = canonicalBytes(source);
      const sha = sha256(buf);
      if (sha !== rec.sha256 || buf.length !== rec.bytes) {
        problems.push(`${id}: the ${pack} file does not match ${MANIFEST_PATH} (node tools/art-manifest.mjs --write)`);
        continue;
      }
      entries[id] = [sha, buf.length, mime];
      files.set(objectPath(sha, id), buf);
    }
    out[pack] = { entries, files };
    if (pack === 'common') {
      const faces = {};
      for (const id of Object.keys(entries)) if (entries[id][2].startsWith('font/')) faces[id] = files.get(objectPath(entries[id][0], id)).toString('base64');
      fonts = faces;
    }
  }
  return { packs: out, fonts, problems };
}

/**
 * renderPacks(plan) → { files: Map relPath → Buffer, summary }. Pure: the
 * whole output tree as bytes, and what step 3a's ASSET_PACKS stamp will pin.
 */
export function renderPacks(plan) {
  const files = new Map();
  const summary = { packs: {}, fonts: null };
  for (const pack of Object.keys(plan.packs).sort(byteOrder)) {
    const { entries, files: objects } = plan.packs[pack];
    const text = indexText(entries);
    const sha = sha256(Buffer.from(text, 'utf8'));
    const name = `${pack}-${sha.slice(0, 12)}`;
    files.set(`${PACKS_DIR}/${name}.json`, Buffer.from(text, 'utf8'));
    files.set(`${PACKS_DIR}/${name}.js`, Buffer.from(twinText(PACK_FN, name, text), 'utf8'));
    let bytes = 0;
    for (const [path, buf] of objects) { files.set(path, buf); bytes += buf.length; }
    summary.packs[pack] = { index: `${PACKS_DIR}/${name}.json`, sha256: sha, ids: Object.keys(entries).length, objects: objects.size, bytes };
  }
  if (plan.fonts) {
    const ids = Object.keys(plan.fonts).sort(byteOrder);
    const text = ids.length ? `{\n${ids.map((id) => `${JSON.stringify(id)}:${JSON.stringify(plan.fonts[id])}`).join(',\n')}\n}\n` : '{}\n';
    const sha = sha256(Buffer.from(text, 'utf8'));
    const name = `${FONTS_SIDECAR}-${sha.slice(0, 12)}`;
    files.set(`${PACKS_DIR}/${name}.js`, Buffer.from(twinText(FONTS_FN, name, text), 'utf8'));
    summary.fonts = { file: `${PACKS_DIR}/${name}.js`, sha256: sha, faces: ids.length };
  }
  return { files, summary };
}

/**
 * realOut(p) → p with every existing component resolved through symlinks:
 * the real path of its nearest existing ancestor, plus the part not yet made.
 */
export function realOut(p) {
  let head = resolve(p);
  const rest = [];
  while (!existsSync(head)) {
    const up = dirname(head);
    if (up === head) break;
    rest.unshift(basename(head));
    head = up;
  }
  return join(existsSync(head) ? realpathSync(head) : head, ...rest);
}

/**
 * Refuse an output directory that would put packs/ or objects/ into the
 * tracked tree. Judged on REAL paths: `build/out` that is a symlink to `src/`
 * is `src/`, and is refused. Returns the real output directory to write into.
 */
export function guardOut(out, root) {
  const realRoot = realOut(root);
  const real = realOut(out);
  const rel = relative(realRoot, real);
  const r = posix(rel);
  if (!r || r === '.') throw new Error('--out must be a directory of its own, not the repository root');
  // Outside the checkout only when the first segment IS `..` (or the path is
  // on another drive): `..cache` is a directory inside the checkout.
  if (r === '..' || r.startsWith('../') || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return real; // the caller's business
  if (!/^(build|dist)\//.test(`${r}/`)) {
    throw new Error(`--out ${r}: write under build/ or dist/ (ignored by .gitignore), or outside the checkout`);
  }
  return real;
}

/**
 * strictlyUnderBuild(out, root) → true when `out` is a folder INSIDE this
 * checkout's build/ or dist/, never build/ or dist/ itself. tools/bundle.mjs
 * removes copies an earlier web edition left beside its HTML (assets/,
 * map-detail/, music/) only there: build/ and dist/ themselves hold the
 * map-detail/ and music/ folders tools/launch.mjs writes for the single
 * files, which still read them (review of #1454).
 */
export function strictlyUnderBuild(out, root) {
  let real;
  try { real = guardOut(out, root); } catch { return false; }
  const rel = posix(relative(realOut(root), real));
  return /^(build|dist)\/[^/]/.test(rel);
}

/**
 * The packs/ or objects/ directory to clear. Refused when it is a symlink (it
 * could name a tracked tree), and when it holds anything while `out` carries
 * no MARKER: an --out outside the checkout may be someone else's directory,
 * and its packs/ or objects/ are not this tool's to delete.
 */
function clearable(dir, marked) {
  let st = null;
  try { st = lstatSync(dir); } catch (e) { if (e.code === 'ENOENT') return dir; throw e; }
  if (st.isSymbolicLink()) throw new Error(`${dir} is a symlink; asset-pack clears this directory and will not follow one`);
  if (!marked && (!st.isDirectory() || readdirSync(dir).length)) {
    throw new Error(`${dir} is not empty and ${MARKER} is not beside it: asset-pack did not write it, so it will not delete it`);
  }
  return dir;
}

/** writePacks({ root, out, packs, source }) → summary. Clears out/packs and out/objects first. */
export function writePacks({ root = ROOT, out: asked = resolve(ROOT, DEFAULT_OUT), packs = PACKS, source = 'trees' } = {}) {
  const out = guardOut(asked, root);
  const plan = planPacks(root, packs, { source });
  if (plan.problems.length) throw Object.assign(new Error('the sources do not match the manifest; nothing was written'), { problems: plan.problems });
  const { files, summary } = renderPacks(plan);
  const marker = resolve(out, MARKER);
  let marked = false;
  try {
    const st = lstatSync(marker);
    // A symlinked or non-file marker could make the write below land anywhere.
    if (!st.isFile()) throw new Error(`${marker} exists and is not a regular file (a symlink or directory); asset-pack will not write through it`);
    // Only this tool's own marker proves ownership; a same-named file is not.
    if (readFileSync(marker, 'utf8') !== MARKER_TEXT) throw new Error(`${marker} exists but was not written by asset-pack; it will not clear or overwrite anything beside it`);
    marked = true;
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const clear = [clearable(resolve(out, PACKS_DIR), marked), clearable(resolve(out, OBJECTS_DIR), marked)];
  mkdirSync(out, { recursive: true });
  // Replace only a regular marker, then create the new one exclusively
  // ('wx'), so a link planted between the check and the write is refused.
  if (marked) unlinkSync(marker);
  writeFileSync(marker, MARKER_TEXT, { flag: 'wx' });
  for (const dir of clear) rmSync(dir, { recursive: true, force: true });
  for (const path of [...files.keys()].sort(byteOrder)) {
    const abs = resolve(out, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, files.get(path));
  }
  return summary;
}

/**
 * walk(dir) → files under dir, relative, byte order. Never follows a symlink:
 * each one is pushed to `links` (the check reports them) and not entered.
 */
function walk(dir, base = dir, out = [], links = []) {
  let st;
  try { st = lstatSync(dir); } catch { return out; }
  if (st.isSymbolicLink()) { links.push(dir); return out; }
  for (const name of readdirSync(dir).sort(byteOrder)) {
    const abs = join(dir, name);
    const s = lstatSync(abs);
    if (s.isSymbolicLink()) links.push(abs);
    else if (s.isDirectory()) walk(abs, base, out, links);
    else out.push(posix(relative(base, abs)));
  }
  return out;
}

/** The string argument of a twin, or null when the file is not exactly a twin. */
function twinArgs(text, fn) {
  const prefix = `${fn}(`;
  if (!text.startsWith(prefix) || !text.endsWith(');\n')) return null;
  try {
    const args = JSON.parse(`[${text.slice(prefix.length, -3)}]`);
    return args.length === 2 && args.every((a) => typeof a === 'string') ? args : null;
  } catch { return null; }
}

/**
 * verifyPacks(out, { manifest }) → problems (empty = green). The integrity
 * rules of docs/EXTERNAL-ASSETS-PLAN.md §3: every index is named by its own
 * digest and is canonical; its twin carries exactly its text; every object it
 * lists is present and hashes to its name; nothing unlisted is in the store;
 * the font sidecar is named by its text's digest and each face matches the
 * common index; every pack in `packs` (default all three) has its index; and,
 * given the manifest, every id agrees with its record.
 */
export function verifyPacks(out, { manifest = null, packs = PACKS } = {}) {
  const problems = [];
  const listed = new Set();
  const seen = new Map(); // pack → index name
  const indexes = {};
  const links = [];
  const packFiles = walk(resolve(out, PACKS_DIR), resolve(out, PACKS_DIR), [], links);
  if (!packFiles.length) problems.push(`no ${PACKS_DIR}/ under ${out}`);
  for (const file of packFiles) {
    const m = /^([a-z]+)-([0-9a-f]{12})\.(json|js)$/.exec(file);
    if (!m) { problems.push(`${PACKS_DIR}/${file}: stray (not a pack index, twin or font sidecar)`); continue; }
    const [, pack, d12, kind] = m;
    const text = readFileSync(resolve(out, PACKS_DIR, file), 'utf8');
    if (pack === FONTS_SIDECAR) {
      if (kind !== 'js') { problems.push(`${PACKS_DIR}/${file}: stray (the font sidecar is a .js file only)`); continue; }
      continue; // checked after the common index is read
    }
    if (!PACKS.includes(pack)) { problems.push(`${PACKS_DIR}/${file}: stray (no pack named ${pack})`); continue; }
    if (kind === 'js') {
      if (!existsSync(resolve(out, PACKS_DIR, `${pack}-${d12}.json`))) problems.push(`${PACKS_DIR}/${file}: stray (a twin with no index)`);
      continue;
    }
    if (seen.has(pack)) { problems.push(`${PACKS_DIR}/${file}: a second ${pack} index beside ${seen.get(pack)}`); continue; }
    seen.set(pack, file);
    const sha = sha256(Buffer.from(text, 'utf8'));
    if (sha.slice(0, 12) !== d12) problems.push(`${PACKS_DIR}/${file}: its text hashes to ${sha.slice(0, 12)}, not the name's ${d12}`);
    let entries;
    try { entries = JSON.parse(text); } catch (e) { problems.push(`${PACKS_DIR}/${file}: not JSON (${e.message})`); continue; }
    if (indexText(entries) !== text) problems.push(`${PACKS_DIR}/${file}: not in canonical form (byte-order keys, one per line, LF)`);
    indexes[pack] = entries;
    // The twin: exactly the index's text under the index's name.
    const twin = resolve(out, PACKS_DIR, `${pack}-${d12}.js`);
    if (!existsSync(twin)) problems.push(`${PACKS_DIR}/${pack}-${d12}.js: the twin is missing`);
    else {
      const args = twinArgs(readFileSync(twin, 'utf8'), PACK_FN);
      if (!args) problems.push(`${PACKS_DIR}/${pack}-${d12}.js: not a ${PACK_FN}(name, text) twin`);
      else if (args[0] !== `${pack}-${d12}` || args[1] !== text) problems.push(`${PACKS_DIR}/${pack}-${d12}.js: the twin does not match its index (its string hashes to ${sha256(Buffer.from(args[1], 'utf8')).slice(0, 12)})`);
    }
    for (const [id, row] of Object.entries(entries)) {
      if (!Array.isArray(row) || row.length !== 3 || !/^[0-9a-f]{64}$/.test(row[0]) || !Number.isInteger(row[1]) || typeof row[2] !== 'string') {
        problems.push(`${pack}: ${id}: not [sha256, bytes, mime]`); continue;
      }
      const [osha, bytes, mime] = row;
      if (mime !== mimeOf(id)) problems.push(`${pack}: ${id}: mime ${mime}, its extension says ${mimeOf(id)}`);
      const path = objectPath(osha, id);
      listed.add(path);
      const abs = resolve(out, path);
      if (!existsSync(abs)) { problems.push(`${pack}: ${id}: ${path} is missing`); continue; }
      const buf = readFileSync(abs);
      if (buf.length !== bytes) problems.push(`${pack}: ${id}: ${path} is ${buf.length} bytes, the index says ${bytes}`);
      if (sha256(buf) !== osha) problems.push(`${pack}: ${id}: ${path} does not hash to its name`);
      if (manifest) {
        const rec = manifest.assets?.[id]?.[pack];
        if (!rec) problems.push(`${pack}: ${id}: not a ${pack} id in ${MANIFEST_PATH}`);
        else if (rec.sha256 !== osha || rec.bytes !== bytes) problems.push(`${pack}: ${id}: disagrees with ${MANIFEST_PATH}`);
      }
    }
    if (manifest) {
      for (const [id, entry] of Object.entries(manifest.assets || {})) {
        if (entry && entry[pack] && !Object.prototype.hasOwnProperty.call(entries, id)) problems.push(`${pack}: ${id}: in ${MANIFEST_PATH}, not in the index`);
      }
    }
  }
  // Every selected pack is here: a tree missing a whole pack is not green.
  for (const pack of packs) {
    if (!PACKS.includes(pack)) problems.push(`unknown pack ${JSON.stringify(pack)} (one of ${PACKS.join(', ')})`);
    else if (!seen.has(pack)) problems.push(`${PACKS_DIR}/: no ${pack} index (packs/${pack}-<digest12>.json)`);
  }
  for (const [pack, file] of seen) if (!packs.includes(pack)) problems.push(`${PACKS_DIR}/${file}: a ${pack} index, which was not asked for (--pack ${packs.join(',')})`);
  // Every object in the store is listed by some index, and named by its bytes.
  const objectFiles = walk(resolve(out, OBJECTS_DIR), resolve(out, OBJECTS_DIR), [], links);
  // A symlink is never a pack file or an object: it could point anywhere,
  // and a check that followed it would vouch for bytes outside the tree.
  for (const link of links) problems.push(`${posix(relative(out, link))}: a symlink (the store holds files only)`);
  for (const path of objectFiles.map((p) => `${OBJECTS_DIR}/${p}`)) {
    if (listed.has(path)) continue;
    const m = /^objects\/([0-9a-f]{2})\/([0-9a-f]{64})\.[a-z0-9]+$/.exec(path);
    if (!m || m[1] !== m[2].slice(0, 2)) problems.push(`${path}: stray (not an object name)`);
    else if (sha256(readFileSync(resolve(out, path))) !== m[2]) problems.push(`${path}: stray, and does not hash to its name`);
    else problems.push(`${path}: stray (no index lists it)`);
  }
  // The font sidecar: one, with the common pack, each face its common record.
  const sidecars = packFiles.filter((f) => /^fonts-[0-9a-f]{12}\.js$/.test(f));
  if (indexes.common && sidecars.length !== 1) problems.push(`${PACKS_DIR}/: ${sidecars.length} font sidecars beside the common index, want 1`);
  if (!indexes.common && sidecars.length) problems.push(`${PACKS_DIR}/${sidecars[0]}: a font sidecar with no common index`);
  for (const file of sidecars) {
    const name = file.slice(0, -3);
    const args = twinArgs(readFileSync(resolve(out, PACKS_DIR, file), 'utf8'), FONTS_FN);
    if (!args || args[0] !== name) { problems.push(`${PACKS_DIR}/${file}: not a ${FONTS_FN}("${name}", text) sidecar`); continue; }
    const sha = sha256(Buffer.from(args[1], 'utf8'));
    if (sha.slice(0, 12) !== name.slice(-12)) problems.push(`${PACKS_DIR}/${file}: its text hashes to ${sha.slice(0, 12)}, not the name's ${name.slice(-12)}`);
    let faces;
    try { faces = JSON.parse(args[1]); } catch { problems.push(`${PACKS_DIR}/${file}: its text is not JSON`); continue; }
    const common = indexes.common || {};
    const want = Object.keys(common).filter((id) => common[id][2].startsWith('font/'));
    for (const id of want) if (!(id in faces)) problems.push(`${PACKS_DIR}/${file}: ${id} is missing`);
    for (const [id, b64] of Object.entries(faces)) {
      const row = common[id];
      const buf = Buffer.from(String(b64), 'base64');
      if (!row || !row[2].startsWith('font/')) problems.push(`${PACKS_DIR}/${file}: ${id} is not a font in the common index`);
      else if (buf.length !== row[1] || sha256(buf) !== row[0]) problems.push(`${PACKS_DIR}/${file}: ${id} does not match its common record`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return null;
    const v = args[at + 1];
    if (!v || v.startsWith('--')) {
      console.error(`asset-pack: FAIL — ${flag} needs a value (${{ '--out': 'a directory', '--pack': 'light,high,common', '--source': SOURCES.join(' or ') }[flag]})`);
      process.exit(2);
    }
    return v;
  };
  const outArg = value('--out');
  const packArg = value('--pack');
  const sourceArg = value('--source') || 'trees';
  const out = resolve(process.cwd(), outArg || resolve(ROOT, DEFAULT_OUT));
  const packs = packArg ? packArg.split(',').filter(Boolean) : PACKS;
  try {
    if (args.includes('--check')) {
      const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_PATH), 'utf8'));
      const problems = verifyPacks(out, { manifest, packs });
      if (problems.length) {
        console.error(`asset-pack: FAIL — ${problems.length} problem(s) in ${posix(relative(process.cwd(), out)) || '.'}:`);
        for (const p of problems.slice(0, 20)) console.error(`  · ${p}`);
        if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
        process.exit(1);
      }
      console.log(`asset-pack: OK — ${posix(relative(process.cwd(), out)) || '.'} verified`);
    } else {
      const summary = writePacks({ out, packs, source: sourceArg });
      if (args.includes('--json')) console.log(JSON.stringify(summary, null, 2));
      else {
        for (const [pack, s] of Object.entries(summary.packs)) console.log(`  ${pack}: ${s.ids} ids, ${s.objects} objects, ${s.bytes} bytes → ${s.index}`);
        if (summary.fonts) console.log(`  fonts: ${summary.fonts.faces} faces → ${summary.fonts.file}`);
        console.log(`asset-pack: OK — written to ${posix(relative(process.cwd(), out)) || '.'}`);
      }
    }
  } catch (e) {
    console.error(`asset-pack: FAIL — ${e.message}`);
    for (const p of (e.problems || []).slice(0, 20)) console.error(`  · ${p}`);
    if ((e.problems || []).length > 20) console.error(`  … and ${e.problems.length - 20} more`);
    process.exit(1);
  }
}
