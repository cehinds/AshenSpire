// workbench/core/assets.mjs — the read-only listing of game art for the Asset Gallery.
//
// Two places hold art: the tracked trees (assets-mobile/, assets-display/, music/)
// and the fetched release packs under .art-cache/<tag>/<pack>/ (tools/fetch-art.mjs).
// A pack's files sit at their game paths: .art-cache/<tag>/high/assets/x.webp is the
// file the game serves at /assets/x.webp. This module lists those files with size
// and, where a header says so, pixel dimensions; it never writes, and it resolves a
// game path to a file only inside those roots (safePath: no traversal, no links).
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { safePath, refusedPath } from '../lib/safe-path.mjs';
import { shippable } from '../../tools/assetmime.mjs';
import { usageNeedles, lineUses } from '../modules/assets/model.mjs';

/** The tracked trees the gallery lists, relative to the project root. */
export const TREE_ROOTS = Object.freeze(['assets-mobile', 'assets-display', 'music']);
export const CACHE_DIR = '.art-cache';
/** The packs a schema-2 pin names, in lookup order: a path in more than one wins from the first. */
export const PACKS = Object.freeze(['high', 'light', 'common']);
/** More files than this are not listed; the response says so. */
export const MAX_FILES = 20000;
const HEADER_BYTES = 512;
const SVG_BYTES = 4096;

const cache = new Map(); // absolute path -> { mtimeMs, size, dims }: a header is read once per file version
/** The most header reads in flight at once: each holds a file descriptor, and a tree can hold thousands of files. */
export const HEADER_CONCURRENCY = 32;

/** `fn` over `items`, at most `limit` calls in flight; the results keep the items' order. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** The pinned tag and its packs, from art-release.json. Null when the pin is missing or unreadable. */
export async function pinOf(root) {
  try {
    const pin = JSON.parse(await fs.readFile(path.join(root, 'art-release.json'), 'utf8'));
    return typeof pin.tag === 'string' && /^[\w.-]+$/.test(pin.tag) ? { tag: pin.tag, zips: Object.fromEntries(PACKS.map((p) => [p, pin.packs?.[p]?.zip || null])) } : null;
  } catch { return null; }
}

/** Where each pack is cached, and whether it holds files: [{ id, dir, fetched }]. */
export async function packsOf(root, pin) {
  return Promise.all(PACKS.map(async (id) => {
    const dir = pin ? path.join(root, CACHE_DIR, pin.tag, id) : null;
    const fetched = dir ? existsSync(dir) && (await fs.readdir(dir).catch(() => [])).length > 0 : false;
    return { id, zip: pin?.zips?.[id] || null, dir, fetched };
  }));
}

/** The pixel size a file's header states, read from its first bytes; null when no header says. */
export function dimsOf(buf, ext) {
  const u16 = (o) => buf.readUInt16LE(o);
  const u24 = (o) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
  if (ext === '.png') {
    if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (ext === '.webp') {
    if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: u24(24) + 1, h: u24(27) + 1 };
    if (chunk === 'VP8L') {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === 'VP8 ' && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) return { w: u16(26) & 0x3fff, h: u16(28) & 0x3fff };
    return null;
  }
  if (ext === '.gif') {
    if (buf.length < 10 || buf.toString('ascii', 0, 4) !== 'GIF8') return null;
    return { w: u16(6), h: u16(8) };
  }
  if (ext === '.svg') {
    const text = buf.toString('utf8');
    const open = text.match(/<svg\b[^>]*>/i);
    if (!open) return null;
    const attr = (name) => { const m = open[0].match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i')); return m ? Number(m[1]) : null; };
    const w = attr('width'), h = attr('height');
    if (w && h) return { w: Math.round(w), h: Math.round(h) };
    const vb = open[0].match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    return vb ? { w: Math.round(Number(vb[1])), h: Math.round(Number(vb[2])) } : null;
  }
  return null;
}

async function headerOf(file, ext, stat) {
  const key = file;
  const hit = cache.get(key);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.dims;
  const fh = await fs.open(file, 'r');
  let dims = null;
  try {
    const want = ext === '.svg' ? SVG_BYTES : HEADER_BYTES;
    const buf = Buffer.alloc(Math.min(want, stat.size));
    await fh.read(buf, 0, buf.length, 0);
    dims = dimsOf(buf, ext);
  } catch { dims = null; } finally { await fh.close(); }
  cache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, dims });
  return dims;
}

/** Every regular file under `dir`, as '/'-joined paths relative to `base`. Links are skipped; hidden entries too. */
async function walk(base, dir, out, limit) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (out.length > limit) return;
    if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(base, full, out, limit);
    else if (e.isFile()) out.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
  }
}

/**
 * The art files the gallery lists: [{ path, bytes, from, w, h }]. `from` is 'tree' for a tracked
 * tree or the pack name for a cached one; a path both places hold is listed once, from the tree first.
 */
export async function listArt(root, { limit = MAX_FILES } = {}) {
  const real = realpathSync(root);
  const pin = await pinOf(real);
  const packs = await packsOf(real, pin);
  const sources = [
    ...TREE_ROOTS.map((d) => ({ from: 'tree', base: path.join(real, d), dir: path.join(real, d) })),
    ...packs.filter((p) => p.fetched).map((p) => ({ from: p.id, base: p.dir, dir: p.dir })),
  ];
  const seen = new Map();
  let truncated = false;
  for (const src of sources) {
    const found = [];
    await walk(src.base, src.dir, found, limit);
    for (const f of found) {
      const ext = path.extname(f.rel).toLowerCase();
      if (!shippable(ext) || seen.has(f.rel)) continue;
      if (seen.size >= limit) { truncated = true; break; }
      const stat = await fs.stat(f.full);
      // A tree file is listed at its game path (assets-mobile/poses/x.webp); a pack's files already sit at theirs.
      const gamePath = src.from === 'tree' ? `${path.basename(src.base)}/${f.rel}` : f.rel;
      seen.set(gamePath, { path: gamePath, bytes: stat.size, from: src.from, file: f.full, ext, stat });
    }
  }
  const files = await mapLimit([...seen.values()], HEADER_CONCURRENCY, async ({ path: p, bytes, from, file, ext, stat }) => {
    const dims = await headerOf(file, ext, stat);
    return { path: p, bytes, from, ...(dims ? { w: dims.w, h: dims.h } : {}) };
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  // The light tier is also tracked in this repository (assets-mobile/), so it is available without a fetch.
  const tracked = files.some((f) => f.from === 'tree' && f.path.startsWith('assets-mobile/'));
  return {
    tag: pin?.tag || null,
    packs: packs.map(({ id, zip, fetched }) => ({ id, zip, fetched: fetched || (id === 'light' && tracked) })),
    files, truncated,
  };
}

/**
 * The absolute file behind a game path, or null. A tracked-tree path is read from its tree; any other
 * is read from the first fetched pack that holds it. Anything refused, linked or missing is null.
 */
export async function resolveArt(root, gamePath) {
  if (refusedPath(gamePath) || !shippable(path.extname(gamePath).toLowerCase())) return null;
  const real = realpathSync(root);
  const top = gamePath.split('/')[0];
  // Every candidate base is a directory the game path is relative to: the project root for a tracked tree
  // (its paths start with the tree's name), and each fetched pack's folder for the cache.
  const bases = [];
  if (TREE_ROOTS.includes(top)) bases.push(real);
  for (const p of await packsOf(real, await pinOf(real))) if (p.fetched) bases.push(p.dir);
  for (const base of bases) {
    try {
      const file = await safePath(realpathSync(base), gamePath);
      if ((await fs.stat(file)).isFile()) return file;
    } catch { /* not in this place: the next one */ }
  }
  return null;
}

/** The folders a usage search reads, and the text kinds it reads in them. */
export const USAGE_DIRS = Object.freeze(['content', 'src']);
const USAGE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.csv', '.md', '.txt', '.html', '.css']);
export const USAGE_LIMIT = 200;
const USAGE_FILE_BYTES = 1024 * 1024;

/**
 * Where a game path is named in content/ and src/: [{ file, line, text }] (at most USAGE_LIMIT, then
 * `truncated`). Read-only: it reads text files under those two folders, skips links, hidden and dependency
 * folders, and files over 1 MB. The needles are the model's (usageNeedles, lineUses).
 */
export async function findUsage(root, gamePath) {
  const real = realpathSync(root);
  const needles = usageNeedles(gamePath);
  const hits = [];
  let files = 0;
  let truncated = false;
  if (!needles.paths.length && !needles.keys.length) return { hits, files, truncated };
  async function scan(dir) {
    if (truncated) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (truncated) return;
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.isSymbolicLink()) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await scan(full); continue; }
      if (!e.isFile() || !USAGE_EXT.has(path.extname(e.name).toLowerCase())) continue;
      const st = await fs.stat(full);
      if (st.size > USAGE_FILE_BYTES) continue;
      files += 1;
      const rel = path.relative(real, full).split(path.sep).join('/');
      const lines = (await fs.readFile(full, 'utf8')).split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (!lineUses(lines[i], needles)) continue;
        if (hits.length >= USAGE_LIMIT) { truncated = true; return; }
        hits.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 240) });
      }
    }
  }
  for (const d of USAGE_DIRS) await scan(path.join(real, d));
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { hits, files, truncated };
}

/** Forget the header cache (tests). */
export function clearArtCache() { cache.clear(); }
